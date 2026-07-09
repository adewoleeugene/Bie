"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";
import { publishChatEvent } from "@/lib/chat-events";
import { activeMembership } from "@/lib/user-organization";
import { isOrgAdmin, projectAccessWhere, resolveChannelAccess, taskAccessWhere } from "@/lib/permissions";
import { ConversationType, MessageRefType, NotificationType, OrgRole, ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { joinPublicChannelsForMember } from "@/lib/chat-channels";
import { sendNotifications } from "@/lib/notifications";

async function getUserOrganization() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: true,
                },
            },
        },
    });

    if (!user || user.memberships.length === 0) {
        throw new Error("No organization found");
    }

    const membership = await activeMembership(user.memberships);

    return {
        userId: user.id,
        organizationId: membership.organizationId,
        role: membership.role,
    };
}

async function getConversationForAccess(conversationId: string) {
    return db.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            type: true,
            isPrivate: true,
            archived: true,
            createdById: true,
            organizationId: true,
            members: { select: { userId: true } },
        },
    });
}

async function assertConversationAccess(
    conversationId: string,
    action: "read" | "post" | "manage" | "join",
) {
    const viewer = await getUserOrganization();
    const conversation = await getConversationForAccess(conversationId);

    if (!conversation) {
        throw new Error("Conversation not found");
    }

    if (!resolveChannelAccess(conversation, {
        userId: viewer.userId,
        organizationId: viewer.organizationId,
        orgRole: viewer.role,
    }, action)) {
        throw new Error("Forbidden");
    }

    return { ...viewer, conversation };
}

async function assertOrgMembers(organizationId: string, userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) return [];

    const members = await db.organizationMember.findMany({
        where: {
            organizationId,
            userId: { in: uniqueIds },
        },
        select: { userId: true, role: true },
    });

    if (members.length !== uniqueIds.length) {
        throw new Error("All recipients must belong to this workspace");
    }

    return members;
}

function parseMessageReferences(body: string) {
    const userIds = Array.from(body.matchAll(/@\[([^\]]+)\]/g), (match) => match[1]);
    const taskIds = Array.from(body.matchAll(/#\[([^\]]+)\]/g), (match) => match[1]);
    const projectIds = Array.from(body.matchAll(/\+\[([^\]]+)\]/g), (match) => match[1]);

    return {
        userIds: Array.from(new Set(userIds)),
        taskIds: Array.from(new Set(taskIds)),
        projectIds: Array.from(new Set(projectIds)),
    };
}

function projectUrl(projectId: string) {
    return `/projects/${projectId}`;
}

function taskUrl(task: { id: string; projectId: string | null }) {
    return task.projectId ? `/projects/${task.projectId}?task=${task.id}` : `/tasks/${task.id}`;
}

async function filterConversationMemberRecipients(
    conversationId: string,
    recipientIds: string[],
) {
    const uniqueIds = Array.from(new Set(recipientIds));
    if (uniqueIds.length === 0) return [];

    const memberships = await db.conversationMember.findMany({
        where: {
            conversationId,
            userId: { in: uniqueIds },
        },
        select: { userId: true },
    });

    return memberships.map((membership) => membership.userId);
}

// When a project is tagged, surface the chat to the project team. For a public
// channel we add the (non-guest) project members so the conversation shows up in
// their list and the notification opens. For private channels / DMs we do NOT
// pull outsiders in (that would leak the conversation's history) — we only
// notify project members already in it. Returns the userIds to notify.
async function resolveProjectTagRecipients(params: {
    conversation: { id: string; type: ConversationType; isPrivate: boolean };
    projectIds: string[];
    senderId: string;
    organizationId: string;
}): Promise<string[]> {
    const { conversation, projectIds, senderId, organizationId } = params;
    if (projectIds.length === 0) return [];

    const projectMembers = await db.projectMember.findMany({
        where: { projectId: { in: projectIds } },
        select: { userId: true },
    });
    const candidateIds = Array.from(new Set(projectMembers.map((member) => member.userId)))
        .filter((id) => id !== senderId);
    if (candidateIds.length === 0) return [];

    // Guests can't be channel members — keep only non-guest org members.
    const eligible = await db.organizationMember.findMany({
        where: { organizationId, userId: { in: candidateIds }, role: { not: OrgRole.GUEST } },
        select: { userId: true },
    });
    const eligibleIds = eligible.map((member) => member.userId);
    if (eligibleIds.length === 0) return [];

    if (conversation.type === ConversationType.CHANNEL && !conversation.isPrivate) {
        await db.$transaction(
            eligibleIds.map((userId) =>
                db.conversationMember.upsert({
                    where: { conversationId_userId: { conversationId: conversation.id, userId } },
                    update: {},
                    create: { conversationId: conversation.id, userId },
                }),
            ),
        );
        return eligibleIds;
    }

    return filterConversationMemberRecipients(conversation.id, eligibleIds);
}

// ─── Types ───────────────────────────────────────────────

export interface ConversationWithPreview {
    id: string;
    name: string | null;
    topic: string | null;
    type: ConversationType;
    isPrivate: boolean;
    archived: boolean;
    createdById: string | null;
    isGroup: boolean;
    updatedAt: Date;
    members: {
        userId: string;
        lastReadAt: Date;
        user: { id: string; name: string; image: string | null };
    }[];
    lastMessage: {
        body: string;
        senderId: string;
        createdAt: Date;
        sender: { name: string };
    } | null;
    unreadCount: number;
}

export interface BrowsablePublicChannel {
    id: string;
    name: string | null;
    topic: string | null;
    memberCount: number;
    updatedAt: Date;
}

// ─── Get Conversations ───────────────────────────────────

export async function getConversations(): Promise<ConversationWithPreview[]> {
    try {
        const { userId, organizationId, role } = await getUserOrganization();

        if (role !== OrgRole.GUEST) {
            await joinPublicChannelsForMember(db, organizationId, userId, role);
        }

        const conversations = await db.conversation.findMany({
            where: {
                organizationId,
                archived: false,
                members: { some: { userId } },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, image: true },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: { select: { name: true } },
                    },
                },
            },
            orderBy: [
                { updatedAt: "desc" },
            ],
        });

        return Promise.all(conversations.map(async (conv) => {
            const myMembership = conv.members.find((m) => m.userId === userId);
            const lastReadAt = myMembership?.lastReadAt || new Date(0);
            const lastMessage = conv.messages[0] || null;
            const unreadCount = await db.message.count({
                where: {
                    conversationId: conv.id,
                    senderId: { not: userId },
                    createdAt: { gt: lastReadAt },
                },
            });

            return {
                id: conv.id,
                name: conv.name,
                topic: conv.topic,
                type: conv.type,
                isPrivate: conv.isPrivate,
                archived: conv.archived,
                createdById: conv.createdById,
                isGroup: conv.type !== ConversationType.DM,
                updatedAt: conv.updatedAt,
                members: conv.members,
                lastMessage: lastMessage
                    ? {
                        body: lastMessage.body,
                        senderId: lastMessage.senderId,
                        createdAt: lastMessage.createdAt,
                        sender: lastMessage.sender,
                    }
                    : null,
                unreadCount,
            };
        }));
    } catch (error) {
        console.error("Get conversations error:", error);
        return [];
    }
}

export async function getChatUnreadCount(): Promise<number> {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const memberships = await db.conversationMember.findMany({
            where: {
                userId,
                conversation: {
                    organizationId,
                    archived: false,
                },
            },
            select: {
                conversationId: true,
                lastReadAt: true,
            },
        });

        const counts = await Promise.all(
            memberships.map((membership) =>
                db.message.count({
                    where: {
                        conversationId: membership.conversationId,
                        senderId: { not: userId },
                        createdAt: { gt: membership.lastReadAt },
                    },
                }),
            ),
        );

        return counts.reduce((total, count) => total + count, 0);
    } catch (error) {
        console.error("Get chat unread count error:", error);
        return 0;
    }
}

export async function listBrowsablePublicChannels(): Promise<BrowsablePublicChannel[]> {
    try {
        const { userId, organizationId, role } = await getUserOrganization();

        if (role === OrgRole.GUEST) return [];

        const channels = await db.conversation.findMany({
            where: {
                organizationId,
                type: ConversationType.CHANNEL,
                isPrivate: false,
                archived: false,
                members: { none: { userId } },
            },
            select: {
                id: true,
                name: true,
                topic: true,
                updatedAt: true,
                _count: { select: { members: true } },
            },
            orderBy: { updatedAt: "desc" },
        });

        return channels.map((channel) => ({
            id: channel.id,
            name: channel.name,
            topic: channel.topic,
            memberCount: channel._count.members,
            updatedAt: channel.updatedAt,
        }));
    } catch (error) {
        console.error("List browsable public channels error:", error);
        return [];
    }
}

// ─── Get Messages ────────────────────────────────────────

export interface MessageWithSender {
    id: string;
    body: string;
    senderId: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    sender: { id: string; name: string; image: string | null };
    references: MessageReferencePreview[];
}

export interface MessageReferencePreview {
    id: string;
    targetType: MessageRefType;
    targetId: string;
    user?: {
        id: string;
        name: string;
        image: string | null;
    } | null;
    task?: {
        id: string;
        title: string;
        status: TaskStatus;
        priority: TaskPriority;
        projectId: string | null;
        projectName: string | null;
        statusColumnName: string | null;
        statusColumnColor: string | null;
        assignees: { id: string; name: string; image: string | null }[];
        url: string;
    } | null;
    project?: {
        id: string;
        name: string;
        status: ProjectStatus;
        url: string;
    } | null;
}

export interface ChatReferenceSuggestion {
    type: "user" | "task" | "project";
    id: string;
    label: string;
    subtitle?: string;
    image?: string | null;
}

async function hydrateMessageReferences(
    messages: Array<{
        id: string;
        body: string;
        senderId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        sender: { id: string; name: string; image: string | null };
        references: { id: string; targetType: MessageRefType; targetId: string }[];
    }>,
    viewer: { userId: string; organizationId: string; role: OrgRole },
): Promise<MessageWithSender[]> {
    const userIds = new Set<string>();
    const taskIds = new Set<string>();
    const projectIds = new Set<string>();

    for (const message of messages) {
        for (const ref of message.references) {
            if (ref.targetType === MessageRefType.USER) userIds.add(ref.targetId);
            if (ref.targetType === MessageRefType.TASK) taskIds.add(ref.targetId);
            if (ref.targetType === MessageRefType.PROJECT) projectIds.add(ref.targetId);
        }
    }

    const [users, tasks, projects] = await Promise.all([
        userIds.size > 0
            ? db.user.findMany({
                where: { id: { in: Array.from(userIds) } },
                select: { id: true, name: true, image: true },
            })
            : [],
        taskIds.size > 0
            ? db.task.findMany({
                where: {
                    id: { in: Array.from(taskIds) },
                    ...taskAccessWhere({
                        userId: viewer.userId,
                        organizationId: viewer.organizationId,
                        orgRole: viewer.role,
                    }),
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    priority: true,
                    projectId: true,
                    project: { select: { name: true } },
                    statusColumn: { select: { name: true, color: true } },
                    assignees: {
                        select: {
                            user: { select: { id: true, name: true, image: true } },
                        },
                    },
                },
            })
            : [],
        projectIds.size > 0
            ? db.project.findMany({
                where: {
                    id: { in: Array.from(projectIds) },
                    ...projectAccessWhere({
                        userId: viewer.userId,
                        organizationId: viewer.organizationId,
                        orgRole: viewer.role,
                    }),
                },
                select: { id: true, name: true, status: true },
            })
            : [],
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const projectsById = new Map(projects.map((project) => [project.id, project]));

    return messages.map((message) => ({
        ...message,
        references: message.references.map((ref) => {
            const task = ref.targetType === MessageRefType.TASK ? tasksById.get(ref.targetId) : null;
            const project = ref.targetType === MessageRefType.PROJECT ? projectsById.get(ref.targetId) : null;

            return {
                id: ref.id,
                targetType: ref.targetType,
                targetId: ref.targetId,
                user: ref.targetType === MessageRefType.USER ? usersById.get(ref.targetId) ?? null : null,
                task: task
                    ? {
                        id: task.id,
                        title: task.title,
                        status: task.status,
                        priority: task.priority,
                        projectId: task.projectId,
                        projectName: task.project?.name ?? null,
                        statusColumnName: task.statusColumn?.name ?? null,
                        statusColumnColor: task.statusColumn?.color ?? null,
                        assignees: task.assignees.map((assignee) => assignee.user),
                        url: taskUrl(task),
                    }
                    : null,
                project: project
                    ? {
                        id: project.id,
                        name: project.name,
                        status: project.status,
                        url: projectUrl(project.id),
                    }
                    : null,
            };
        }),
    }));
}

// ─── Chat Reference Search ───────────────────────────────

export async function searchChatReferences(
    kind: "user" | "task" | "project",
    query: string,
): Promise<ChatReferenceSuggestion[]> {
    try {
        const { organizationId, userId, role } = await getUserOrganization();
        const trimmed = query.trim();

        if (kind === "user") {
            const members = await db.organizationMember.findMany({
                where: {
                    organizationId,
                    userId: { not: userId },
                    user: trimmed
                        ? { name: { contains: trimmed, mode: "insensitive" } }
                        : undefined,
                },
                take: 8,
                include: {
                    user: { select: { id: true, name: true, image: true, email: true } },
                },
                orderBy: { joinedAt: "asc" },
            });

            return members.map((member) => ({
                type: "user",
                id: member.user.id,
                label: member.user.name,
                subtitle: member.user.email,
                image: member.user.image,
            }));
        }

        if (kind === "project") {
            const projects = await db.project.findMany({
                where: {
                    ...projectAccessWhere({ userId, organizationId, orgRole: role }),
                    name: trimmed
                        ? { contains: trimmed, mode: "insensitive" }
                        : undefined,
                },
                take: 8,
                select: { id: true, name: true, status: true },
                orderBy: { updatedAt: "desc" },
            });

            return projects.map((project) => ({
                type: "project",
                id: project.id,
                label: project.name,
                subtitle: `Project · ${project.status}`,
            }));
        }

        const tasks = await db.task.findMany({
            where: {
                ...taskAccessWhere({ userId, organizationId, orgRole: role }),
                title: trimmed
                    ? { contains: trimmed, mode: "insensitive" }
                    : undefined,
            },
            take: 8,
            select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                project: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
        });

        return tasks.map((task) => ({
            type: "task",
            id: task.id,
            label: task.title,
            subtitle: `${task.project?.name ?? "No project"} · ${task.status} · ${task.priority}`,
        }));
    } catch (error) {
        console.error("Search chat references error:", error);
        return [];
    }
}

export async function getMessages(
    conversationId: string,
    limit = 50,
    cursor?: string
): Promise<MessageWithSender[]> {
    try {
        const viewer = await assertConversationAccess(conversationId, "read");

        const messages = await db.message.findMany({
            where: { conversationId },
            include: {
                sender: {
                    select: { id: true, name: true, image: true },
                },
                references: {
                    select: { id: true, targetType: true, targetId: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        return hydrateMessageReferences(messages.reverse(), viewer);
    } catch (error) {
        console.error("Get messages error:", error);
        return [];
    }
}

// ─── Create Conversation ─────────────────────────────────

export async function createConversation(input: {
    name?: string;
    memberIds: string[];
    isGroup?: boolean;
}): Promise<ActionResult<{ id: string }>> {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const allMemberIds = Array.from(new Set([userId, ...input.memberIds]));
        if (allMemberIds.length < 2) {
            return { success: false, error: "Select at least one other member" };
        }

        await assertOrgMembers(organizationId, allMemberIds);

        const conversation = await db.conversation.create({
            data: {
                name: allMemberIds.length > 2 ? input.name?.trim() || null : null,
                type: allMemberIds.length > 2 || input.isGroup ? ConversationType.GROUP : ConversationType.DM,
                organizationId,
                createdById: userId,
                members: {
                    create: allMemberIds.map((id) => ({
                        userId: id,
                    })),
                },
            },
        });

        return { success: true, data: { id: conversation.id } };
    } catch (error) {
        console.error("Create conversation error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create conversation",
        };
    }
}

// ─── Channel Actions ─────────────────────────────────────

export async function createChannel(input: {
    name: string;
    topic?: string;
    isPrivate?: boolean;
    memberIds?: string[];
}): Promise<ActionResult<{ id: string }>> {
    try {
        const { userId, organizationId, role } = await getUserOrganization();

        if (!isOrgAdmin(role)) {
            return { success: false, error: "Only owners and admins can create channels" };
        }

        const name = input.name.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-");
        if (!name) {
            return { success: false, error: "Channel name is required" };
        }

        const existing = await db.conversation.findFirst({
            where: { organizationId, type: ConversationType.CHANNEL, name },
            select: { id: true },
        });
        if (existing) {
            return { success: false, error: "A channel with that name already exists" };
        }

        const explicitMembers = Array.from(new Set([userId, ...(input.memberIds ?? [])]));
        const memberIds = input.isPrivate
            ? explicitMembers
            : (await db.organizationMember.findMany({
                where: { organizationId, role: { not: OrgRole.GUEST } },
                select: { userId: true },
            })).map((member) => member.userId);
        const orgMembers = await assertOrgMembers(organizationId, memberIds);
        const allowedMembers = orgMembers.filter((member) => member.role !== OrgRole.GUEST);

        const conversation = await db.conversation.create({
            data: {
                type: ConversationType.CHANNEL,
                name,
                topic: input.topic?.trim() || null,
                isPrivate: Boolean(input.isPrivate),
                organizationId,
                createdById: userId,
                members: {
                    create: allowedMembers.map((member) => ({
                        userId: member.userId,
                    })),
                },
            },
        });

        revalidatePath("/chat");
        return { success: true, data: { id: conversation.id } };
    } catch (error) {
        console.error("Create channel error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create channel",
        };
    }
}

export async function renameChannel(
    conversationId: string,
    input: { name?: string; topic?: string },
): Promise<ActionResult> {
    try {
        await assertConversationAccess(conversationId, "manage");
        const data: { name?: string; topic?: string | null } = {};

        if (input.name !== undefined) {
            const name = input.name.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-");
            if (!name) return { success: false, error: "Channel name is required" };
            data.name = name;
        }

        if (input.topic !== undefined) {
            data.topic = input.topic.trim() || null;
        }

        await db.conversation.update({
            where: { id: conversationId },
            data,
        });

        revalidatePath("/chat");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Rename channel error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update channel" };
    }
}

export async function archiveChannel(conversationId: string): Promise<ActionResult> {
    try {
        await assertConversationAccess(conversationId, "manage");

        await db.conversation.update({
            where: { id: conversationId },
            data: { archived: true },
        });

        revalidatePath("/chat");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Archive channel error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to archive channel" };
    }
}

export async function addChannelMembers(
    conversationId: string,
    memberIds: string[],
): Promise<ActionResult> {
    try {
        const { organizationId } = await assertConversationAccess(conversationId, "manage");
        const orgMembers = await assertOrgMembers(organizationId, memberIds);
        const allowedMembers = orgMembers.filter((member) => member.role !== OrgRole.GUEST);

        await db.$transaction(
            allowedMembers.map((member) =>
                db.conversationMember.upsert({
                    where: {
                        conversationId_userId: {
                            conversationId,
                            userId: member.userId,
                        },
                    },
                    update: {},
                    create: {
                        conversationId,
                        userId: member.userId,
                    },
                }),
            ),
        );

        revalidatePath("/chat");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Add channel members error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to add members" };
    }
}

export async function removeChannelMember(
    conversationId: string,
    memberId: string,
): Promise<ActionResult> {
    try {
        await assertConversationAccess(conversationId, "manage");

        await db.conversationMember.delete({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: memberId,
                },
            },
        });

        revalidatePath("/chat");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Remove channel member error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to remove member" };
    }
}

export async function joinPublicChannel(conversationId: string): Promise<ActionResult> {
    try {
        const { userId } = await assertConversationAccess(conversationId, "join");

        await db.conversationMember.upsert({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId,
                },
            },
            update: {},
            create: {
                conversationId,
                userId,
            },
        });

        revalidatePath("/chat");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Join channel error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to join channel" };
    }
}

// ─── Send Message ────────────────────────────────────────

export async function sendMessage(input: {
    conversationId: string;
    body: string;
}): Promise<ActionResult<{ id: string }>> {
    try {
        const { userId, organizationId, role, conversation } = await assertConversationAccess(input.conversationId, "post");
        const body = input.body.trim();

        if (!body) {
            return { success: false, error: "Message cannot be empty" };
        }

        const parsedRefs = parseMessageReferences(body);

        const [validMentionedUsers, validTasks, validProjects] = await Promise.all([
            parsedRefs.userIds.length > 0
                ? db.organizationMember.findMany({
                    where: {
                        organizationId,
                        userId: { in: parsedRefs.userIds },
                    },
                    select: { userId: true },
                })
                : [],
            parsedRefs.taskIds.length > 0
                ? db.task.findMany({
                    where: {
                        ...taskAccessWhere({ userId, organizationId, orgRole: role }),
                        id: { in: parsedRefs.taskIds },
                    },
                    select: {
                        id: true,
                        title: true,
                        projectId: true,
                        assignees: { select: { userId: true } },
                    },
                })
                : [],
            parsedRefs.projectIds.length > 0
                ? db.project.findMany({
                    where: {
                        ...projectAccessWhere({ userId, organizationId, orgRole: role }),
                        id: { in: parsedRefs.projectIds },
                    },
                    select: { id: true },
                })
                : [],
        ]);

        const message = await db.message.create({
            data: {
                body,
                conversationId: input.conversationId,
                senderId: userId,
                references: {
                    create: [
                        ...validMentionedUsers.map((member) => ({
                            targetType: MessageRefType.USER,
                            targetId: member.userId,
                        })),
                        ...validTasks.map((task) => ({
                            targetType: MessageRefType.TASK,
                            targetId: task.id,
                        })),
                        ...validProjects.map((project) => ({
                            targetType: MessageRefType.PROJECT,
                            targetId: project.id,
                        })),
                    ],
                },
            },
            include: {
                sender: { select: { id: true, name: true, image: true } },
                references: { select: { id: true, targetType: true, targetId: true } },
            },
        });

        const [messageForClient] = await hydrateMessageReferences([message], { userId, organizationId, role });

        const mentionedUserIds = validMentionedUsers.map((member) => member.userId);
        const taskRecipientIds = validTasks.flatMap((task) => task.assignees.map((assignee) => assignee.userId));
        const projectRecipients = await resolveProjectTagRecipients({
            conversation: { id: conversation.id, type: conversation.type, isPrivate: conversation.isPrivate },
            projectIds: validProjects.map((project) => project.id),
            senderId: userId,
            organizationId,
        });
        const notificationRecipients = Array.from(new Set([
            ...(await filterConversationMemberRecipients(
                input.conversationId,
                [...mentionedUserIds, ...taskRecipientIds],
            )),
            ...projectRecipients,
        ]));

        if (notificationRecipients.length > 0) {
            sendNotifications({
                recipientIds: notificationRecipients,
                excludeUserId: userId,
                organizationId,
                type: NotificationType.MENTION,
                title: "You were mentioned in chat",
                body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
                linkUrl: `/chat?conversation=${input.conversationId}`,
            }).catch((error) => console.error("Chat mention notification failed", error));
        }

        publishChatEvent({
            conversationId: input.conversationId,
            type: "message.created",
            message: messageForClient
                ? {
                    ...messageForClient,
                    createdAt: messageForClient.createdAt.toISOString(),
                    updatedAt: messageForClient.updatedAt.toISOString(),
                    deletedAt: messageForClient.deletedAt?.toISOString() ?? null,
                }
                : {
                    id: message.id,
                    body: message.body,
                    senderId: message.senderId,
                    createdAt: message.createdAt.toISOString(),
                    updatedAt: message.updatedAt.toISOString(),
                    deletedAt: null,
                    sender: message.sender,
                    references: [],
                },
        }).catch((e) => console.error("publishChatEvent failed", e));

        await db.conversation.update({
            where: { id: input.conversationId },
            data: { updatedAt: new Date() },
        });

        await db.conversationMember.update({
            where: {
                conversationId_userId: {
                    conversationId: input.conversationId,
                    userId,
                },
            },
            data: { lastReadAt: new Date() },
        });

        return { success: true, data: { id: message.id } };
    } catch (error) {
        console.error("Send message error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to send message",
        };
    }
}

export async function updateMessage(input: {
    messageId: string;
    body: string;
}): Promise<ActionResult> {
    try {
        const body = input.body.trim();
        if (!body) {
            return { success: false, error: "Message cannot be empty" };
        }

        const { userId, organizationId, role } = await getUserOrganization();
        const existing = await db.message.findFirst({
            where: {
                id: input.messageId,
                senderId: userId,
                deletedAt: null,
                conversation: {
                    organizationId,
                    members: { some: { userId } },
                },
            },
            select: {
                id: true,
                conversationId: true,
                conversation: { select: { id: true, type: true, isPrivate: true } },
            },
        });

        if (!existing) {
            return { success: false, error: "Message not found" };
        }

        const parsedRefs = parseMessageReferences(body);
        const [validMentionedUsers, validTasks, validProjects] = await Promise.all([
            parsedRefs.userIds.length > 0
                ? db.organizationMember.findMany({
                    where: {
                        organizationId,
                        userId: { in: parsedRefs.userIds },
                    },
                    select: { userId: true },
                })
                : [],
            parsedRefs.taskIds.length > 0
                ? db.task.findMany({
                    where: {
                        ...taskAccessWhere({ userId, organizationId, orgRole: role }),
                        id: { in: parsedRefs.taskIds },
                    },
                    select: {
                        id: true,
                        title: true,
                        projectId: true,
                        assignees: { select: { userId: true } },
                    },
                })
                : [],
            parsedRefs.projectIds.length > 0
                ? db.project.findMany({
                    where: {
                        ...projectAccessWhere({ userId, organizationId, orgRole: role }),
                        id: { in: parsedRefs.projectIds },
                    },
                    select: { id: true },
                })
                : [],
        ]);

        const updated = await db.$transaction(async (tx) => {
            await tx.messageReference.deleteMany({ where: { messageId: input.messageId } });
            return tx.message.update({
                where: { id: input.messageId },
                data: {
                    body,
                    references: {
                        create: [
                            ...validMentionedUsers.map((member) => ({
                                targetType: MessageRefType.USER,
                                targetId: member.userId,
                            })),
                            ...validTasks.map((task) => ({
                                targetType: MessageRefType.TASK,
                                targetId: task.id,
                            })),
                            ...validProjects.map((project) => ({
                                targetType: MessageRefType.PROJECT,
                                targetId: project.id,
                            })),
                        ],
                    },
                },
                include: {
                    sender: { select: { id: true, name: true, image: true } },
                    references: { select: { id: true, targetType: true, targetId: true } },
                },
            });
        });

        const [messageForClient] = await hydrateMessageReferences([updated], { userId, organizationId, role });

        const mentionedUserIds = validMentionedUsers.map((member) => member.userId);
        const taskRecipientIds = validTasks.flatMap((task) => task.assignees.map((assignee) => assignee.userId));
        const projectRecipients = await resolveProjectTagRecipients({
            conversation: existing.conversation,
            projectIds: validProjects.map((project) => project.id),
            senderId: userId,
            organizationId,
        });
        const notificationRecipients = Array.from(new Set([
            ...(await filterConversationMemberRecipients(
                existing.conversationId,
                [...mentionedUserIds, ...taskRecipientIds],
            )),
            ...projectRecipients,
        ]));

        if (notificationRecipients.length > 0) {
            sendNotifications({
                recipientIds: notificationRecipients,
                excludeUserId: userId,
                organizationId,
                type: NotificationType.MENTION,
                title: "You were mentioned in an edited chat message",
                body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
                linkUrl: `/chat?conversation=${existing.conversationId}`,
            }).catch((error) => console.error("Chat edit mention notification failed", error));
        }

        if (messageForClient) {
            publishChatEvent({
                conversationId: existing.conversationId,
                type: "message.updated",
                message: {
                    ...messageForClient,
                    createdAt: messageForClient.createdAt.toISOString(),
                    updatedAt: messageForClient.updatedAt.toISOString(),
                    deletedAt: messageForClient.deletedAt?.toISOString() ?? null,
                },
            }).catch((error) => console.error("publishChatEvent failed", error));
        }

        return { success: true, data: undefined };
    } catch (error) {
        console.error("Update message error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update message" };
    }
}

export async function deleteMessage(messageId: string): Promise<ActionResult> {
    try {
        const { userId, organizationId, role } = await getUserOrganization();
        const message = await db.message.findFirst({
            where: {
                id: messageId,
                deletedAt: null,
                conversation: {
                    organizationId,
                    members: { some: { userId } },
                },
            },
            select: {
                id: true,
                senderId: true,
                conversationId: true,
                conversation: {
                    select: {
                        type: true,
                        isPrivate: true,
                        archived: true,
                        createdById: true,
                        organizationId: true,
                        members: { select: { userId: true } },
                    },
                },
            },
        });

        if (!message) {
            return { success: false, error: "Message not found" };
        }

        const canManageConversation = resolveChannelAccess(message.conversation, {
            userId,
            organizationId,
            orgRole: role,
        }, "manage");

        if (message.senderId !== userId && !canManageConversation) {
            return { success: false, error: "You can only delete your own messages" };
        }

        const deletedAt = new Date();
        await db.message.update({
            where: { id: messageId },
            data: { body: "", deletedAt },
        });

        publishChatEvent({
            conversationId: message.conversationId,
            type: "message.deleted",
            messageId,
            deletedAt: deletedAt.toISOString(),
        }).catch((error) => console.error("publishChatEvent failed", error));

        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete message error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete message" };
    }
}

export async function publishTypingStatus(
    conversationId: string,
    isTyping: boolean,
): Promise<void> {
    try {
        const { userId } = await assertConversationAccess(conversationId, "post");
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });

        publishChatEvent({
            conversationId,
            type: "typing",
            userId,
            name: user?.name ?? "Someone",
            isTyping,
        }).catch((error) => console.error("publishChatEvent failed", error));
    } catch (error) {
        console.error("Publish typing status error:", error);
    }
}

// ─── Mark Conversation Read ──────────────────────────────

export async function markConversationRead(conversationId: string): Promise<void> {
    try {
        const { userId } = await assertConversationAccess(conversationId, "read");

        await db.conversationMember.update({
            where: {
                conversationId_userId: { conversationId, userId },
            },
            data: { lastReadAt: new Date() },
        });

        publishChatEvent({
            conversationId,
            type: "read",
            userId,
            readAt: new Date().toISOString(),
        }).catch((error) => console.error("publishChatEvent failed", error));
    } catch (error) {
        console.error("Mark conversation read error:", error);
    }
}
