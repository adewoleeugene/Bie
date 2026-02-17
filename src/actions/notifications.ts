"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
        organizationId: user.memberships[0].organizationId,
    };
}

// ─── In-app Notification CRUD ──────────────────────────────

export async function getNotifications(limit = 20) {
    try {
        const { userId } = await getUserOrganization();

        return await db.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    } catch (error) {
        console.error("Get notifications error:", error);
        return [];
    }
}

export async function getUnreadCount() {
    try {
        const { userId } = await getUserOrganization();

        return await db.notification.count({
            where: { userId, read: false },
        });
    } catch (error) {
        console.error("Get unread count error:", error);
        return 0;
    }
}

export async function markNotificationRead(notificationId: string) {
    try {
        const { userId } = await getUserOrganization();

        await db.notification.update({
            where: { id: notificationId, userId },
            data: { read: true },
        });

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Mark notification read error:", error);
        return { success: false, error: "Failed to mark notification as read" };
    }
}

export async function markAllNotificationsRead() {
    try {
        const { userId } = await getUserOrganization();

        await db.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Mark all notifications read error:", error);
        return { success: false, error: "Failed to mark all notifications as read" };
    }
}

// ─── Task Alert System (Browser Notifications) ─────────────

export interface TaskAlert {
    id: string;
    title: string;
    projectName: string | null;
    dueDate: string;
    priority: string;
    type: "overdue" | "due_soon" | "due_today";
}

/**
 * Get tasks that are overdue, due today, or due within the next 24 hours.
 * Used by the client-side TaskAlertMonitor to trigger browser notifications.
 */
export async function getTaskAlerts(): Promise<TaskAlert[]> {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const tomorrow = new Date(todayEnd);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all non-done tasks with due dates in this org
        const tasks = await db.task.findMany({
            where: {
                organizationId,
                status: { not: "DONE" },
                dueDate: { not: null, lte: tomorrow },
            },
            include: {
                project: {
                    select: { name: true },
                },
                assignees: {
                    select: { userId: true },
                },
            },
            orderBy: { dueDate: "asc" },
        });

        // Filter for tasks assigned to user or unassigned
        const userTasks = tasks.filter(
            (t) =>
                t.assignees.length === 0 ||
                t.assignees.some((a) => a.userId === userId)
        );

        const alerts: TaskAlert[] = [];

        for (const task of userTasks) {
            if (!task.dueDate) continue;
            const dueDate = new Date(task.dueDate);

            let type: TaskAlert["type"];

            if (dueDate < now) {
                type = "overdue";
            } else if (dueDate >= todayStart && dueDate < todayEnd) {
                type = "due_today";
            } else if (dueDate >= todayEnd && dueDate < tomorrow) {
                type = "due_soon";
            } else {
                continue;
            }

            alerts.push({
                id: task.id,
                title: task.title,
                projectName: task.project?.name || null,
                dueDate: task.dueDate.toISOString(),
                priority: task.priority,
                type,
            });
        }

        return alerts;
    } catch (error) {
        console.error("Get task alerts error:", error);
        return [];
    }
}
