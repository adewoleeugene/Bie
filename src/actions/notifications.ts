"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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

export async function getNotifications(limit = 20) {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const notifications = await db.notification.findMany({
            where: {
                userId,
                organizationId,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        });

        return notifications;
    } catch (error) {
        console.error("Get notifications error:", error);
        return [];
    }
}

export async function getUnreadCount() {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const count = await db.notification.count({
            where: {
                userId,
                organizationId,
                read: false,
            },
        });

        return count;
    } catch (error) {
        console.error("Get unread count error:", error);
        return 0;
    }
}

export async function markNotificationRead(notificationId: string) {
    try {
        const { userId } = await getUserOrganization();

        await db.notification.update({
            where: {
                id: notificationId,
                userId,
            },
            data: {
                read: true,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Mark notification read error:", error);
        return { success: false };
    }
}

export async function markAllNotificationsRead() {
    try {
        const { userId, organizationId } = await getUserOrganization();

        await db.notification.updateMany({
            where: {
                userId,
                organizationId,
                read: false,
            },
            data: {
                read: true,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Mark all notifications read error:", error);
        return { success: false };
    }
}

export async function createNotification(data: {
    userId: string;
    type: "MENTION" | "DUE_SOON" | "OVERDUE" | "ASSIGNED" | "COMMENT";
    title: string;
    body?: string;
    linkUrl?: string;
}) {
    try {
        const { organizationId } = await getUserOrganization();

        const notification = await db.notification.create({
            data: {
                ...data,
                organizationId,
            },
        });

        return notification;
    } catch (error) {
        console.error("Create notification error:", error);
        return null;
    }
}
