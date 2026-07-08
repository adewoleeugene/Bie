"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";
import { publishChatEvent } from "@/lib/chat-events";
import { activeMembership } from "@/lib/user-organization";

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

    return {
        userId: user.id,
        organizationId: (await activeMembership(user.memberships)).organizationId,
    };
}

// ─── Types ───────────────────────────────────────────────

export interface ConversationWithPreview {
    id: string;
    name: string | null;
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

// ─── Get Conversations ───────────────────────────────────

export async function getConversations(): Promise<ConversationWithPreview[]> {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const conversations = await db.conversation.findMany({
            where: {
                organizationId,
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
            orderBy: { updatedAt: "desc" },
        });

        return conversations.map((conv) => {
            const myMembership = conv.members.find((m) => m.userId === userId);
            const lastReadAt = myMembership?.lastReadAt || new Date(0);
            const lastMessage = conv.messages[0] || null;

            return {
                id: conv.id,
                name: conv.name,
                isGroup: conv.isGroup,
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
                unreadCount: lastMessage && lastMessage.createdAt > lastReadAt ? 1 : 0,
            };
        });
    } catch (error) {
        console.error("Get conversations error:", error);
        return [];
    }
}

// ─── Get Messages ────────────────────────────────────────

export interface MessageWithSender {
    id: string;
    body: string;
    senderId: string;
    createdAt: Date;
    sender: { id: string; name: string; image: string | null };
}

export async function getMessages(
    conversationId: string,
    limit = 50,
    cursor?: string
): Promise<MessageWithSender[]> {
    try {
        await getUserOrganization();

        const messages = await db.message.findMany({
            where: { conversationId },
            include: {
                sender: {
                    select: { id: true, name: true, image: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        return messages.reverse();
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

        const conversation = await db.conversation.create({
            data: {
                name: input.name || null,
                isGroup: input.isGroup || allMemberIds.length > 2,
                organizationId,
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

// ─── Send Message ────────────────────────────────────────

export async function sendMessage(input: {
    conversationId: string;
    body: string;
}): Promise<ActionResult<{ id: string }>> {
    try {
        const { userId } = await getUserOrganization();

        const message = await db.message.create({
            data: {
                body: input.body,
                conversationId: input.conversationId,
                senderId: userId,
            },
            include: {
                sender: { select: { id: true, name: true, image: true } },
            },
        });

        // Fan out to SSE subscribers via Postgres NOTIFY
        publishChatEvent({
            conversationId: input.conversationId,
            message: {
                id: message.id,
                body: message.body,
                senderId: message.senderId,
                createdAt: message.createdAt.toISOString(),
                sender: message.sender,
            },
        }).catch((e) => console.error("publishChatEvent failed", e));

        // Update conversation timestamp
        await db.conversation.update({
            where: { id: input.conversationId },
            data: { updatedAt: new Date() },
        });

        // Update sender's lastReadAt
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

// ─── Mark Conversation Read ──────────────────────────────

export async function markConversationRead(conversationId: string): Promise<void> {
    try {
        const { userId } = await getUserOrganization();

        await db.conversationMember.update({
            where: {
                conversationId_userId: { conversationId, userId },
            },
            data: { lastReadAt: new Date() },
        });
    } catch (error) {
        console.error("Mark conversation read error:", error);
    }
}
