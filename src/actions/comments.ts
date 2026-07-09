"use server";

import { db } from "@/lib/db";
import { ActivityAction, NotificationType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendNotifications } from "@/lib/notifications";
import { activeMembership } from "@/lib/user-organization";
import { taskAccessWhere } from "@/lib/permissions";

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

export async function getComments(taskId: string) {
    try {
        const viewer = await getUserOrganization();

        const task = await db.task.findFirst({
            where: {
                id: taskId,
                ...taskAccessWhere({
                    userId: viewer.userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
            select: { id: true },
        });

        if (!task) return [];

        const comments = await db.comment.findMany({
            where: {
                taskId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return comments;
    } catch (error) {
        console.error("Get comments error:", error);
        return [];
    }
}

export async function createComment(taskId: string, body: string) {
    try {
        const viewer = await getUserOrganization();
        const { userId } = viewer;

        const accessibleTask = await db.task.findFirst({
            where: {
                id: taskId,
                ...taskAccessWhere({
                    userId: viewer.userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
            select: { id: true },
        });

        if (!accessibleTask) {
            return { success: false, error: "Forbidden" };
        }

        const comment = await db.comment.create({
            data: {
                body,
                taskId,
                authorId: userId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

        await db.taskActivity.create({
            data: {
                taskId,
                userId,
                action: ActivityAction.COMMENTED,
            },
        });

        // Notify task assignees about the comment
        const task = await db.task.findUnique({
            where: { id: taskId },
            include: {
                assignees: { select: { userId: true } },
                organization: { select: { id: true } },
            },
        });

        if (task) {
            const assigneeIds = task.assignees.map((a) => a.userId);
            sendNotifications({
                recipientIds: assigneeIds,
                excludeUserId: userId,
                organizationId: task.organizationId,
                type: NotificationType.COMMENT,
                title: `New comment on "${task.title}"`,
                body: body.length > 100 ? body.slice(0, 100) + "..." : body,
                linkUrl: task.projectId ? `/projects/${task.projectId}/board` : "/dashboard",
            }).catch((e) => console.error("Notification error:", e));
        }

        revalidatePath("/");
        return { success: true, data: comment };
    } catch (error) {
        console.error("Create comment error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create comment",
        };
    }
}
