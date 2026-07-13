import { ActivityAction, FocusSessionType, NotificationType, OrgRole, Prisma, Project, Task, TaskPriority, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { parseTaskInput } from "@/lib/ai/nlp";
import { projectAccessWhere, resolveProjectAccess, taskAccessWhere, canEdit } from "@/lib/permissions";
import { sendNotifications } from "@/lib/notifications";
import { sendWhatsAppListMessage, sendWhatsAppMessage, WhatsAppListSection } from "@/lib/whatsapp";

type WhatsAppUser = Awaited<ReturnType<typeof getWhatsAppUserByPhone>>;
type LoadedWhatsAppUser = NonNullable<WhatsAppUser>;

type Viewer = {
    userId: string;
    organizationId: string;
    role: OrgRole;
};

interface DigestTask {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    projectId: string | null;
    project: { id: string; name: string } | null;
}

interface PendingCreateTask {
    type: "CREATE_TASK";
    text: string;
    organizationId?: string;
    projectId?: string | null;
    title?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeIds?: string[];
}

type PendingAction = PendingCreateTask;

const DIGEST_CAP = 7;

const DEFAULT_STATUS_COLUMNS: Array<{ name: string; status: TaskStatus; color: string; sortOrder: number }> = [
    { name: "Backlog", status: "BACKLOG", color: "#858585", sortOrder: 0 },
    { name: "To Do", status: "TODO", color: "#0099ff", sortOrder: 1 },
    { name: "In Progress", status: "IN_PROGRESS", color: "#f6b73c", sortOrder: 2 },
    { name: "In Review", status: "IN_REVIEW", color: "#df5cff", sortOrder: 3 },
    { name: "Done", status: "DONE", color: "#20d990", sortOrder: 4 },
    { name: "Archived", status: "ARCHIVED", color: "#474747", sortOrder: 5 },
];

export async function getWhatsAppUserByPhone(phone: string) {
    return db.user.findFirst({
        where: {
            phone,
            phoneVerifiedAt: { not: null },
            whatsappEnabled: true,
        },
        include: {
            memberships: {
                include: {
                    organization: true,
                },
                orderBy: { joinedAt: "asc" },
            },
            whatsappSession: true,
        },
    });
}

async function getOrCreateSession(userId: string) {
    return db.whatsAppSession.upsert({
        where: { userId },
        create: { userId },
        update: {},
    });
}

function membershipFor(user: LoadedWhatsAppUser, organizationId?: string | null) {
    if (organizationId) {
        return user.memberships.find((membership) => membership.organizationId === organizationId) ?? null;
    }
    if (user.whatsappSession?.activeOrganizationId) {
        const active = user.memberships.find((membership) => membership.organizationId === user.whatsappSession?.activeOrganizationId);
        if (active) return active;
    }
    return user.memberships[0] ?? null;
}

function viewerFor(user: LoadedWhatsAppUser, organizationId?: string | null): Viewer | null {
    const membership = membershipFor(user, organizationId);
    if (!membership) return null;
    return {
        userId: user.id,
        organizationId: membership.organizationId,
        role: membership.role,
    };
}

export async function getMyDayTasksForViewer(viewer: Viewer, limit = DIGEST_CAP): Promise<DigestTask[]> {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const tasks = await db.task.findMany({
        where: {
            ...taskAccessWhere({
                userId: viewer.userId,
                organizationId: viewer.organizationId,
                orgRole: viewer.role,
            }),
            status: { not: "ARCHIVED" },
        },
        include: { project: { select: { id: true, name: true } } },
    });

    const priorityRank: Record<TaskPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const statusRank: Record<TaskStatus, number> = {
        IN_PROGRESS: 0,
        TODO: 1,
        IN_REVIEW: 2,
        BACKLOG: 3,
        DONE: 4,
        ARCHIVED: 5,
    };

    return tasks
        .filter((task) => {
            if (task.status === "DONE") return false;
            if (task.dueDate && task.dueDate < todayEnd) return true;
            return task.status === "IN_PROGRESS" || task.status === "TODO";
        })
        .sort((a, b) => {
            const aOverdue = a.dueDate && a.dueDate < todayStart ? 0 : 1;
            const bOverdue = b.dueDate && b.dueDate < todayStart ? 0 : 1;
            if (aOverdue !== bOverdue) return aOverdue - bOverdue;
            const priority = priorityRank[a.priority] - priorityRank[b.priority];
            if (priority !== 0) return priority;
            return statusRank[a.status] - statusRank[b.status];
        })
        .slice(0, limit)
        .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            projectId: task.projectId,
            project: task.project,
        }));
}

export async function sendMorningDigestToUser(user: LoadedWhatsAppUser, organizationId?: string) {
    if (!user.phone) return false;
    const viewer = viewerFor(user, organizationId);
    if (!viewer) return false;

    const tasks = await getMyDayTasksForViewer(viewer);
    await db.whatsAppSession.upsert({
        where: { userId: user.id },
        create: {
            userId: user.id,
            activeOrganizationId: viewer.organizationId,
            lastDigestTaskIds: tasks.map((task) => task.id),
            selectedTaskIds: [],
        },
        update: {
            activeOrganizationId: viewer.organizationId,
            lastDigestTaskIds: tasks.map((task) => task.id),
            selectedTaskIds: [],
            pendingAction: Prisma.DbNull,
        },
    });

    if (tasks.length === 0) {
        return sendWhatsAppMessage({
            to: user.phone,
            body: "Good morning. You have no suggested tasks for today in Bie.",
        });
    }

    return sendWhatsAppListMessage({
        to: user.phone,
        body: [
            "Good morning. Pick what you want to work on today:",
            ...tasks.map((task, index) => `${index + 1}. ${task.title}${task.project ? ` (${task.project.name})` : ""}`),
            "",
            "You can also reply: all, 1,3, start 1, done 1, or comment on 1: your note.",
        ].join("\n"),
        buttonText: "Choose tasks",
        sections: [
            {
                title: "Today",
                rows: [
                    { id: "wa:select:all", title: "All tasks", description: `${tasks.length} suggested` },
                    ...tasks.map((task, index) => ({
                        id: `wa:select:${task.id}`,
                        title: `${index + 1}. ${task.title}`.slice(0, 24),
                        description: task.project?.name,
                    })),
                ],
            },
        ],
    });
}

export async function handleWhatsAppInbound(params: {
    phone: string;
    text: string;
    replyId?: string;
    messageId?: string;
}) {
    const user = await getWhatsAppUserByPhone(params.phone);
    if (!user?.phone) {
        await sendWhatsAppMessage({
            to: params.phone,
            body: "This number is not connected to a Bie account. Open Bie settings to verify it first.",
        });
        return;
    }

    const session = await getOrCreateSession(user.id);
    if (params.messageId && session.lastInboundMessageId === params.messageId) return;
    if (params.messageId) {
        await db.whatsAppSession.update({
            where: { userId: user.id },
            data: { lastInboundMessageId: params.messageId },
        });
    }

    const normalized = params.text.trim();
    const lower = normalized.toLowerCase();

    if (lower === "stop") {
        await db.user.update({ where: { id: user.id }, data: { whatsappEnabled: false } });
        await sendWhatsAppMessage({
            to: user.phone,
            body: "WhatsApp notifications are now off for your Bie account. You can turn them back on in Bie settings.",
        });
        return;
    }

    if (lower === "help") {
        await sendWhatsAppMessage({
            to: user.phone,
            body: "Bie WhatsApp commands: all, 1,3, start 1, done 1, stop session, comment on 1: note, create task: title, digest, report, help.",
        });
        return;
    }

    if (lower === "digest" || lower === "today") {
        await sendMorningDigestToUser(user, session.activeOrganizationId ?? undefined);
        return;
    }

    const replyHandled = await handleListReply(user, params.replyId || normalized);
    if (replyHandled) return;

    if (lower === "report") {
        await sendDailyReportToUser(user);
        return;
    }

    if (lower === "confirm" || lower === "yes") {
        await confirmPendingAction(user);
        return;
    }

    if (lower === "cancel") {
        await db.whatsAppSession.update({ where: { userId: user.id }, data: { pendingAction: Prisma.DbNull } });
        await sendWhatsAppMessage({ to: user.phone, body: "Cancelled." });
        return;
    }

    if (lower === "all" || /^\d+(\s*,\s*\d+)*$/.test(lower)) {
        await selectDigestTasks(user, lower);
        return;
    }

    const startMatch = lower.match(/^start(?:\s+(.+))?$/);
    if (startMatch) {
        await startTaskFocus(user, startMatch[1]);
        return;
    }

    const doneMatch = lower.match(/^(?:done|complete|finish)(?:\s+(.+))?$/);
    if (doneMatch) {
        await completeTask(user, doneMatch[1]);
        return;
    }

    if (lower === "stop session" || lower === "end session") {
        await endActiveFocus(user);
        return;
    }

    const commentMatch = normalized.match(/^comment(?:\s+on)?\s+(.+?):\s*(.+)$/i);
    if (commentMatch) {
        await commentOnTask(user, commentMatch[1], commentMatch[2]);
        return;
    }

    if (/^(create task|new task|add task|task):/i.test(normalized)) {
        await beginTaskCreation(user, normalized.replace(/^(create task|new task|add task|task):/i, "").trim());
        return;
    }

    await sendWhatsAppMessage({
        to: user.phone,
        body: "I did not catch that. Reply help for the available Bie commands.",
    });
}

async function handleListReply(user: LoadedWhatsAppUser, replyId: string) {
    if (!replyId.startsWith("wa:")) return false;
    const [, action, value] = replyId.split(":");

    if (action === "select") {
        await selectDigestTasks(user, value === "all" ? "all" : value);
        return true;
    }

    if (action === "workspace") {
        await chooseWorkspaceForPendingTask(user, value);
        return true;
    }

    if (action === "project") {
        await chooseProjectForPendingTask(user, value === "none" ? null : value);
        return true;
    }

    if (action === "confirm") {
        await confirmPendingAction(user);
        return true;
    }

    if (action === "cancel") {
        await db.whatsAppSession.update({ where: { userId: user.id }, data: { pendingAction: Prisma.DbNull } });
        await sendWhatsAppMessage({ to: user.phone!, body: "Cancelled." });
        return true;
    }

    return false;
}

async function resolveTaskReference(user: LoadedWhatsAppUser, reference?: string | null) {
    const session = await getOrCreateSession(user.id);
    const digestIds = jsonStringArray(session.selectedTaskIds) ?? jsonStringArray(session.lastDigestTaskIds) ?? [];
    const ref = reference?.trim();

    if (!ref && session.activeTaskId) return session.activeTaskId;
    if (!ref && digestIds.length === 1) return digestIds[0];

    const number = ref && /^\d+$/.test(ref) ? Number(ref) : null;
    if (number && digestIds[number - 1]) return digestIds[number - 1];

    if (ref && digestIds.includes(ref)) return ref;

    if (ref) {
        const viewer = viewerFor(user, session.activeOrganizationId);
        if (!viewer) return null;
        const matches = await db.task.findMany({
            where: {
                ...taskAccessWhere({ userId: viewer.userId, organizationId: viewer.organizationId, orgRole: viewer.role }),
                status: { notIn: ["DONE", "ARCHIVED"] },
                title: { contains: ref, mode: "insensitive" },
            },
            take: 2,
            select: { id: true },
        });
        if (matches.length === 1) return matches[0].id;
    }

    return null;
}

async function selectDigestTasks(user: LoadedWhatsAppUser, selection: string) {
    const session = await getOrCreateSession(user.id);
    const digestIds = jsonStringArray(session.lastDigestTaskIds) ?? [];
    if (digestIds.length === 0) {
        await sendWhatsAppMessage({ to: user.phone!, body: "No digest is active. Reply digest to get today's list." });
        return;
    }

    const selected = selection === "all" || digestIds.includes(selection)
        ? selection === "all" ? digestIds : [selection]
        : selection.split(",").map((part) => digestIds[Number(part.trim()) - 1]).filter(Boolean);

    if (selected.length === 0) {
        await sendWhatsAppMessage({ to: user.phone!, body: "I could not match that selection. Reply with numbers like 1,3 or all." });
        return;
    }

    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: { selectedTaskIds: selected, activeTaskId: selected[0] },
    });

    await sendWhatsAppMessage({
        to: user.phone!,
        body: `Selected ${selected.length} task${selected.length === 1 ? "" : "s"}. Reply start 1 when you are ready.`,
    });
}

async function startTaskFocus(user: LoadedWhatsAppUser, reference?: string) {
    const taskId = await resolveTaskReference(user, reference);
    if (!taskId) {
        await sendWhatsAppMessage({ to: user.phone!, body: "Which task should I start? Reply start 1 or select from your digest." });
        return;
    }

    const viewer = viewerFor(user, user.whatsappSession?.activeOrganizationId);
    if (!viewer) return;

    const task = await editableTask(taskId, viewer);
    if (!task) {
        await sendWhatsAppMessage({ to: user.phone!, body: "I cannot edit that task with your current Bie permissions." });
        return;
    }

    const active = await db.focusSession.findFirst({ where: { userId: user.id, endedAt: null } });
    if (active) {
        await sendWhatsAppMessage({ to: user.phone!, body: "You already have an active focus session. Reply stop session first." });
        return;
    }

    const session = await db.focusSession.create({
        data: {
            userId: user.id,
            taskId,
            type: "FREE",
            startedAt: new Date(),
            completed: false,
        },
    });

    if (task.status === "TODO" || task.status === "BACKLOG") {
        await moveTaskToStatus(task, viewer, "IN_PROGRESS");
    }

    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: { activeTaskId: taskId, activeFocusSessionId: session.id, activeOrganizationId: task.organizationId, activeProjectId: task.projectId },
    });

    await sendWhatsAppMessage({ to: user.phone!, body: `Focus started: ${task.title}` });
}

async function completeTask(user: LoadedWhatsAppUser, reference?: string) {
    const taskId = await resolveTaskReference(user, reference);
    if (!taskId) {
        await sendWhatsAppMessage({ to: user.phone!, body: "Which task is done? Reply done 1 or done with the task name." });
        return;
    }

    const session = await getOrCreateSession(user.id);
    const viewer = viewerFor(user, session.activeOrganizationId);
    if (!viewer) return;

    const task = await editableTask(taskId, viewer);
    if (!task) {
        await sendWhatsAppMessage({ to: user.phone!, body: "I cannot edit that task with your current Bie permissions." });
        return;
    }

    const focus = await db.focusSession.findFirst({ where: { userId: user.id, taskId, endedAt: null } });
    let duration = 0;
    if (focus) {
        duration = await closeFocusSession(focus.id, user.id);
    }

    await moveTaskToStatus(task, viewer, "DONE");

    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: { activeTaskId: null, activeFocusSessionId: null },
    });

    await sendWhatsAppMessage({
        to: user.phone!,
        body: `Done: ${task.title}${duration ? `\nFocus time logged: ${formatMinutes(duration)}` : ""}`,
    });
}

async function endActiveFocus(user: LoadedWhatsAppUser) {
    const focus = await db.focusSession.findFirst({
        where: { userId: user.id, endedAt: null },
        include: { task: true },
    });
    if (!focus) {
        await sendWhatsAppMessage({ to: user.phone!, body: "No active focus session is running." });
        return;
    }

    const duration = await closeFocusSession(focus.id, user.id);
    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: { activeFocusSessionId: null },
    });

    await sendWhatsAppMessage({
        to: user.phone!,
        body: `Focus session stopped${focus.task ? `: ${focus.task.title}` : ""}. Logged ${formatMinutes(duration)}.`,
    });
}

async function commentOnTask(user: LoadedWhatsAppUser, reference: string, body: string) {
    const taskId = await resolveTaskReference(user, reference);
    if (!taskId) {
        await sendWhatsAppMessage({ to: user.phone!, body: "Which task should get the comment? Try comment on 1: your note." });
        return;
    }

    const session = await getOrCreateSession(user.id);
    const viewer = viewerFor(user, session.activeOrganizationId);
    if (!viewer) return;

    const task = await db.task.findFirst({
        where: {
            id: taskId,
            ...taskAccessWhere({ userId: viewer.userId, organizationId: viewer.organizationId, orgRole: viewer.role }),
        },
        include: { assignees: true },
    });

    if (!task) {
        await sendWhatsAppMessage({ to: user.phone!, body: "I cannot find that task with your current Bie permissions." });
        return;
    }

    const commentBody = `${body}\n\n(via WhatsApp)`;
    await db.comment.create({
        data: { taskId, authorId: user.id, body: commentBody },
    });
    await db.taskActivity.create({ data: { taskId, userId: user.id, action: ActivityAction.COMMENTED } });

    sendNotifications({
        recipientIds: task.assignees.map((assignee) => assignee.userId),
        excludeUserId: user.id,
        organizationId: task.organizationId,
        type: NotificationType.COMMENT,
        title: `New comment on "${task.title}"`,
        body,
        linkUrl: task.projectId ? `/projects/${task.projectId}/board` : "/dashboard",
    }).catch((error) => console.error("Notification error:", error));

    await sendWhatsAppMessage({ to: user.phone!, body: `Comment added to ${task.title}.` });
}

async function beginTaskCreation(user: LoadedWhatsAppUser, text: string) {
    if (!text) {
        await sendWhatsAppMessage({ to: user.phone!, body: "Send the task after the colon, for example: create task: finalize the grant deck by Friday." });
        return;
    }

    const memberships = user.memberships.filter((membership) => membership.role !== "GUEST");
    const pending: PendingCreateTask = { type: "CREATE_TASK", text };

    await db.whatsAppSession.upsert({
        where: { userId: user.id },
        create: { userId: user.id, pendingAction: pendingActionJson(pending) },
        update: { pendingAction: pendingActionJson(pending) },
    });

    if (memberships.length > 1 && !user.whatsappSession?.activeOrganizationId) {
        await sendWorkspaceList(user, memberships.map((membership) => ({
            id: membership.organizationId,
            name: membership.organization.name,
        })));
        return;
    }

    const organizationId = user.whatsappSession?.activeOrganizationId ?? memberships[0]?.organizationId;
    if (!organizationId) {
        await sendWhatsAppMessage({ to: user.phone!, body: "I could not find a workspace where you can create tasks." });
        return;
    }

    await chooseWorkspaceForPendingTask(user, organizationId);
}

async function chooseWorkspaceForPendingTask(user: LoadedWhatsAppUser, organizationId: string) {
    const session = await getOrCreateSession(user.id);
    const pending = parsePendingAction(session.pendingAction);
    if (!pending || pending.type !== "CREATE_TASK") return;

    const viewer = viewerFor(user, organizationId);
    if (!viewer || viewer.role === "GUEST") {
        await sendWhatsAppMessage({ to: user.phone!, body: "You do not have permission to create tasks in that workspace." });
        return;
    }

    const projects = await editableProjects(viewer);
    const nextPending: PendingCreateTask = { ...pending, organizationId };
    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: { activeOrganizationId: organizationId, pendingAction: pendingActionJson(nextPending) },
    });

    if (projects.length === 0) {
        await chooseProjectForPendingTask(user, null);
        return;
    }

    await sendWhatsAppListMessage({
        to: user.phone!,
        body: "Choose a project for this task, or keep it unfiled.",
        buttonText: "Choose project",
        sections: [
            {
                title: "Projects",
                rows: [
                    { id: "wa:project:none", title: "No project" },
                    ...projects.slice(0, 9).map((project) => ({ id: `wa:project:${project.id}`, title: project.name.slice(0, 24) })),
                ],
            },
        ],
    });
}

async function chooseProjectForPendingTask(user: LoadedWhatsAppUser, projectId: string | null) {
    const session = await getOrCreateSession(user.id);
    const pending = parsePendingAction(session.pendingAction);
    if (!pending || pending.type !== "CREATE_TASK" || !pending.organizationId) return;

    const parsed = parseTaskInput(pending.text);
    const nextPending: PendingCreateTask = {
        ...pending,
        projectId,
        title: parsed.title,
        priority: parsed.priority,
        dueDate: parsed.dueDate?.toISOString(),
        assigneeIds: [],
    };

    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: { activeProjectId: projectId, pendingAction: pendingActionJson(nextPending) },
    });

    await sendWhatsAppListMessage({
        to: user.phone!,
        body: [
            "Create this task?",
            `Title: ${nextPending.title}`,
            `Priority: ${nextPending.priority}`,
            nextPending.dueDate ? `Due: ${new Date(nextPending.dueDate).toDateString()}` : undefined,
        ].filter(Boolean).join("\n"),
        buttonText: "Confirm",
        sections: [
            {
                rows: [
                    { id: "wa:confirm:create", title: "Create task" },
                    { id: "wa:cancel:create", title: "Cancel" },
                ],
            },
        ],
    });
}

async function confirmPendingAction(user: LoadedWhatsAppUser) {
    const session = await getOrCreateSession(user.id);
    const pending = parsePendingAction(session.pendingAction);
    if (!pending || pending.type !== "CREATE_TASK" || !pending.organizationId || !pending.title) {
        await sendWhatsAppMessage({ to: user.phone!, body: "There is nothing to confirm." });
        return;
    }

    const viewer = viewerFor(user, pending.organizationId);
    if (!viewer) return;

    const task = await createTaskAsUser({
        viewer,
        title: pending.title,
        priority: pending.priority ?? "P2",
        dueDate: pending.dueDate,
        projectId: pending.projectId ?? null,
        assigneeIds: pending.assigneeIds ?? [],
    });

    await db.whatsAppSession.update({
        where: { userId: user.id },
        data: {
            pendingAction: Prisma.DbNull,
            activeTaskId: task.id,
            activeOrganizationId: task.organizationId,
            activeProjectId: task.projectId,
        },
    });

    await sendWhatsAppMessage({ to: user.phone!, body: `Created task: ${task.title}` });
}

export async function sendDailyReportToUser(user: LoadedWhatsAppUser) {
    if (!user.phone) return false;
    const viewer = viewerFor(user, user.whatsappSession?.activeOrganizationId);
    if (!viewer) return false;

    const start = startOfTodayInTimezone(user.whatsappTimezone);
    const completedTasks = await db.task.findMany({
        where: {
            organizationId: viewer.organizationId,
            completedAt: { gte: start },
            activities: { some: { userId: user.id, action: ActivityAction.STATUS_CHANGE } },
        },
        select: { title: true },
        take: 10,
    });
    const focus = await db.focusSession.aggregate({
        where: { userId: user.id, startedAt: { gte: start }, endedAt: { not: null } },
        _sum: { duration: true },
    });
    const carryovers = await getMyDayTasksForViewer(viewer, 5);

    return sendWhatsAppMessage({
        to: user.phone,
        body: [
            "Your Bie day recap",
            `Done: ${completedTasks.length}`,
            `Focus time: ${formatMinutes(focus._sum.duration ?? 0)}`,
            completedTasks.length ? `Completed:\n${completedTasks.map((task) => `- ${task.title}`).join("\n")}` : "Completed: none yet",
            carryovers.length ? `Carryovers:\n${carryovers.map((task) => `- ${task.title}`).join("\n")}` : "Carryovers: none",
        ].join("\n\n"),
    });
}

export async function sendOwnerReportForOrganization(organizationId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const organization = await db.organization.findUnique({
        where: { id: organizationId },
        include: {
            members: {
                where: { role: { in: ["OWNER", "ADMIN"] } },
                include: { user: true },
            },
        },
    });
    if (!organization) return;

    const completed = await db.task.findMany({
        where: { organizationId, completedAt: { gte: start } },
        include: {
            activities: {
                where: { action: ActivityAction.STATUS_CHANGE, createdAt: { gte: start } },
                include: { user: { select: { name: true } } },
            },
        },
        take: 25,
    });

    const body = [
        `${organization.name} Bie rollup`,
        `Completed tasks: ${completed.length}`,
        ...completed.map((task) => `- ${task.title}${task.activities[0]?.user.name ? ` (${task.activities[0].user.name})` : ""}`),
    ].join("\n");

    await Promise.allSettled(
        organization.members
            .filter((member) => member.user.phone && member.user.phoneVerifiedAt && member.user.whatsappEnabled)
            .map((member) => sendWhatsAppMessage({ to: member.user.phone!, body }))
    );
}

async function editableTask(taskId: string, viewer: Viewer) {
    const task = await db.task.findFirst({
        where: {
            id: taskId,
            ...taskAccessWhere({ userId: viewer.userId, organizationId: viewer.organizationId, orgRole: viewer.role }),
        },
        include: {
            project: { include: { members: true } },
        },
    });
    if (!task) return null;

    if (!task.projectId) return viewer.role !== "GUEST" ? task : null;
    if (!task.project) return null;
    const access = resolveProjectAccess(task.project, viewer);
    return canEdit(access) ? task : null;
}

async function editableProjects(viewer: Viewer) {
    const projects = await db.project.findMany({
        where: projectAccessWhere({ userId: viewer.userId, organizationId: viewer.organizationId, orgRole: viewer.role }),
        include: { members: true },
        orderBy: { name: "asc" },
    });

    return projects.filter((project) => canEdit(resolveProjectAccess(project, viewer)));
}

async function ensureTaskStatusColumns(organizationId: string, projectId?: string | null) {
    const scopedProjectId = projectId ?? null;
    const existing = await db.taskStatusColumn.findMany({
        where: { organizationId, projectId: scopedProjectId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const existingStatuses = new Set(existing.map((column) => column.status).filter(Boolean));
    const missing = DEFAULT_STATUS_COLUMNS.filter((column) => !existingStatuses.has(column.status));
    if (missing.length > 0) {
        await db.taskStatusColumn.createMany({
            data: missing.map((column) => ({ ...column, organizationId, projectId: scopedProjectId })),
        });
    }
    return db.taskStatusColumn.findMany({
        where: { organizationId, projectId: scopedProjectId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
}

async function columnForStatus(organizationId: string, projectId: string | null | undefined, status: TaskStatus) {
    const columns = await ensureTaskStatusColumns(organizationId, projectId);
    return columns.find((column) => column.status === status) ?? null;
}

async function moveTaskToStatus(task: Task & { project?: Project | null }, viewer: Viewer, status: TaskStatus) {
    const column = await columnForStatus(task.organizationId, task.projectId, status);
    await db.task.update({
        where: { id: task.id },
        data: {
            status,
            statusColumnId: column?.id ?? task.statusColumnId,
            completedAt: status === "DONE" ? new Date() : null,
        },
    });
    await db.taskActivity.create({ data: { taskId: task.id, userId: viewer.userId, action: ActivityAction.STATUS_CHANGE } });
}

async function createTaskAsUser(input: {
    viewer: Viewer;
    title: string;
    priority: TaskPriority;
    dueDate?: string;
    projectId?: string | null;
    assigneeIds: string[];
}) {
    if (input.projectId) {
        const projects = await editableProjects(input.viewer);
        if (!projects.some((project) => project.id === input.projectId)) {
            throw new Error("Forbidden");
        }
    } else if (input.viewer.role === "GUEST") {
        throw new Error("Forbidden");
    }

    const column = await columnForStatus(input.viewer.organizationId, input.projectId, "TODO");
    const task = await db.task.create({
        data: {
            title: input.title,
            status: "TODO",
            statusColumnId: column?.id,
            priority: input.priority,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            projectId: input.projectId ?? null,
            organizationId: input.viewer.organizationId,
            labels: [],
            assignees: { create: input.assigneeIds.map((userId) => ({ userId })) },
        },
        include: { project: true },
    });

    await db.taskActivity.create({
        data: { taskId: task.id, userId: input.viewer.userId, action: ActivityAction.EDITED, metadata: { isCreation: true, source: "WHATSAPP" } },
    });

    if (input.assigneeIds.length > 0) {
        sendNotifications({
            recipientIds: input.assigneeIds,
            excludeUserId: input.viewer.userId,
            organizationId: input.viewer.organizationId,
            type: NotificationType.ASSIGNED,
            title: `You were assigned to "${task.title}"`,
            body: task.project ? `Project: ${task.project.name}` : undefined,
            linkUrl: task.projectId ? `/projects/${task.projectId}/board` : "/dashboard",
        }).catch((error) => console.error("Notification error:", error));
    }

    return task;
}

async function closeFocusSession(sessionId: string, userId: string) {
    const existing = await db.focusSession.findFirst({ where: { id: sessionId, userId, endedAt: null } });
    if (!existing) return 0;

    const endedAt = new Date();
    const duration = Math.max(0, Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000 / 60));
    await db.focusSession.update({
        where: { id: sessionId },
        data: { endedAt, duration, completed: true },
    });

    if (existing.taskId && duration > 0) {
        await db.timeEntry.create({
            data: {
                userId,
                taskId: existing.taskId,
                startedAt: existing.startedAt,
                endedAt,
                duration,
                description: `Focus session: ${existing.type === FocusSessionType.POMODORO ? "Pomodoro" : "Free focus"}`,
                source: "FOCUS_SESSION",
            },
        });
    }

    return duration;
}

async function sendWorkspaceList(user: LoadedWhatsAppUser, workspaces: Array<{ id: string; name: string }>) {
    const sections: WhatsAppListSection[] = [
        {
            title: "Workspaces",
            rows: workspaces.slice(0, 10).map((workspace) => ({
                id: `wa:workspace:${workspace.id}`,
                title: workspace.name.slice(0, 24),
            })),
        },
    ];

    await sendWhatsAppListMessage({
        to: user.phone!,
        body: "Choose the workspace for this task.",
        buttonText: "Choose workspace",
        sections,
    });
}

function jsonStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    return value.filter((item): item is string => typeof item === "string");
}

function parsePendingAction(value: unknown): PendingAction | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const action = value as Record<string, unknown>;
    if (action.type !== "CREATE_TASK" || typeof action.text !== "string") return null;
    return {
        type: "CREATE_TASK",
        text: action.text,
        organizationId: typeof action.organizationId === "string" ? action.organizationId : undefined,
        projectId: typeof action.projectId === "string" ? action.projectId : action.projectId === null ? null : undefined,
        title: typeof action.title === "string" ? action.title : undefined,
        priority: isTaskPriority(action.priority) ? action.priority : undefined,
        dueDate: typeof action.dueDate === "string" ? action.dueDate : undefined,
        assigneeIds: Array.isArray(action.assigneeIds) ? action.assigneeIds.filter((id): id is string => typeof id === "string") : undefined,
    };
}

function pendingActionJson(action: PendingAction): Prisma.InputJsonObject {
    return Object.fromEntries(
        Object.entries(action).filter((entry): entry is [string, Prisma.InputJsonValue] => entry[1] !== undefined)
    );
}

function isTaskPriority(value: unknown): value is TaskPriority {
    return value === "P0" || value === "P1" || value === "P2" || value === "P3";
}

function formatMinutes(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function startOfTodayInTimezone(timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}
