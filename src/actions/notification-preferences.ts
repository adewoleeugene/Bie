"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NotificationType } from "@prisma/client";

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

export interface NotificationPreferenceItem {
    type: NotificationType;
    inApp: boolean;
    email: boolean;
}

const ALL_TYPES: NotificationType[] = [
    "MENTION",
    "DUE_SOON",
    "OVERDUE",
    "ASSIGNED",
    "COMMENT",
];

export async function getNotificationPreferences(): Promise<NotificationPreferenceItem[]> {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const prefs = await db.notificationPreference.findMany({
            where: { userId, organizationId },
        });

        const prefMap = new Map(prefs.map((p) => [p.type, p]));

        return ALL_TYPES.map((type) => ({
            type,
            inApp: prefMap.get(type)?.inApp ?? true,
            email: prefMap.get(type)?.email ?? false,
        }));
    } catch (error) {
        console.error("Get notification preferences error:", error);
        return ALL_TYPES.map((type) => ({ type, inApp: true, email: false }));
    }
}

export async function updateNotificationPreference(
    type: NotificationType,
    field: "inApp" | "email",
    value: boolean
): Promise<{ success: boolean }> {
    try {
        const { userId, organizationId } = await getUserOrganization();

        await db.notificationPreference.upsert({
            where: {
                userId_organizationId_type: { userId, organizationId, type },
            },
            create: {
                userId,
                organizationId,
                type,
                inApp: field === "inApp" ? value : true,
                email: field === "email" ? value : false,
            },
            update: {
                [field]: value,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Update notification preference error:", error);
        return { success: false };
    }
}
