"use server";

import { db } from "@/lib/db";
import { ActivityAction } from "@prisma/client";
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

export async function getComments(taskId: string) {
    try {
        await getUserOrganization(); // check auth

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
        const { userId } = await getUserOrganization();

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
