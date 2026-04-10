import { db } from "@/lib/db";
import { NotificationType } from "@prisma/client";

interface CreateNotificationParams {
    recipientIds: string[];
    excludeUserId?: string;
    organizationId: string;
    type: NotificationType;
    title: string;
    body?: string;
    linkUrl?: string;
}

/**
 * Create in-app notifications for multiple recipients.
 * Automatically excludes the actor (excludeUserId) from recipients.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function sendNotifications(params: CreateNotificationParams): Promise<void> {
    const {
        recipientIds,
        excludeUserId,
        organizationId,
        type,
        title,
        body,
        linkUrl,
    } = params;

    const recipients = recipientIds.filter((id) => id !== excludeUserId);
    if (recipients.length === 0) return;

    try {
        await db.notification.createMany({
            data: recipients.map((userId) => ({
                userId,
                organizationId,
                type,
                title,
                body: body || null,
                linkUrl: linkUrl || null,
            })),
        });
    } catch (error) {
        console.error("Failed to send notifications:", error);
    }
}
