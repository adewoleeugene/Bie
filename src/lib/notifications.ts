import { db } from "@/lib/db";
import { NotificationType } from "@prisma/client";
import { sendEmail, buildNotificationEmail } from "@/lib/email";
import { buildNotificationWhatsApp, isInsideQuietHours, sendWhatsAppMessage } from "@/lib/whatsapp";

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
 * Create in-app notifications and send email / WhatsApp notifications for multiple recipients.
 * Automatically excludes the actor (excludeUserId) from recipients.
 * Respects each user's notification preferences (inApp / email toggles).
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
        // Fetch preferences for all recipients at once
        const preferences = await db.notificationPreference.findMany({
            where: {
                userId: { in: recipients },
                organizationId,
                type,
            },
        });

        const prefMap = new Map(preferences.map((p) => [p.userId, p]));

        // In-app notifications — send to users who haven't explicitly disabled inApp
        const inAppRecipients = recipients.filter((id) => {
            const pref = prefMap.get(id);
            return pref?.inApp !== false; // default to true
        });

        if (inAppRecipients.length > 0) {
            await db.notification.createMany({
                data: inAppRecipients.map((userId) => ({
                    userId,
                    organizationId,
                    type,
                    title,
                    body: body || null,
                    linkUrl: linkUrl || null,
                })),
            });
        }

        // Email notifications — send to users who have explicitly enabled email
        const emailRecipients = recipients.filter((id) => {
            const pref = prefMap.get(id);
            return pref?.email === true; // default to false
        });

        if (emailRecipients.length > 0) {
            // Fetch email addresses
            const users = await db.user.findMany({
                where: { id: { in: emailRecipients } },
                select: { id: true, email: true },
            });

            const email = buildNotificationEmail({ title, body: body || undefined, linkUrl: linkUrl || undefined });

            // Send emails in parallel, fire-and-forget
            await Promise.allSettled(
                users
                    .filter((u) => u.email)
                    .map((u) =>
                        sendEmail({
                            to: u.email!,
                            subject: email.subject,
                            text: email.text,
                            html: email.html,
                        })
                    )
            );
        }

        const whatsappRecipients = recipients.filter((id) => {
            const pref = prefMap.get(id);
            return pref?.whatsapp === true;
        });

        if (whatsappRecipients.length > 0) {
            const users = await db.user.findMany({
                where: {
                    id: { in: whatsappRecipients },
                    phone: { not: null },
                    phoneVerifiedAt: { not: null },
                    whatsappEnabled: true,
                },
                select: {
                    phone: true,
                    whatsappQuietHoursEnabled: true,
                    whatsappQuietStart: true,
                    whatsappQuietEnd: true,
                    whatsappTimezone: true,
                },
            });

            const message = buildNotificationWhatsApp({ title, body: body || undefined, linkUrl: linkUrl || undefined });

            await Promise.allSettled(
                users
                    .filter((u) => {
                        if (!u.phone) return false;
                        if (!u.whatsappQuietHoursEnabled) return true;
                        return !isInsideQuietHours({
                            timezone: u.whatsappTimezone,
                            quietStart: u.whatsappQuietStart,
                            quietEnd: u.whatsappQuietEnd,
                        });
                    })
                    .map((u) => sendWhatsAppMessage({ to: u.phone!, body: message }))
            );
        }
    } catch (error) {
        console.error("Failed to send notifications:", error);
    }
}
