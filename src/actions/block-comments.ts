"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NotificationType } from "@prisma/client";
import { sendNotifications } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { activeMembership } from "@/lib/user-organization";

async function getMe() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });
    if (!user || user.memberships.length === 0) {
        throw new Error("No organization");
    }
    return { userId: user.id, organizationId: (await activeMembership(user.memberships)).organizationId };
}

export async function createBlockComment(args: {
    pageId: string;
    blockId: string;
    body: string;
    parentCommentId?: string;
}) {
    try {
        const { userId } = await getMe();

        const page = await db.wikiPage.findUnique({
            where: { id: args.pageId },
            select: { id: true, title: true, authorId: true, organizationId: true },
        });
        if (!page) return { success: false, error: "Page not found" };

        const comment = await db.blockComment.create({
            data: {
                pageId: args.pageId,
                blockId: args.blockId,
                body: args.body,
                authorId: userId,
                parentCommentId: args.parentCommentId,
            },
            include: {
                author: { select: { id: true, name: true, image: true } },
            },
        });

        // Notify page author + everyone already in the thread on that block.
        const threadParticipants = await db.blockComment.findMany({
            where: { pageId: args.pageId, blockId: args.blockId },
            select: { authorId: true },
        });
        const recipientIds = Array.from(
            new Set([page.authorId, ...threadParticipants.map((c) => c.authorId)]),
        );

        sendNotifications({
            recipientIds,
            excludeUserId: userId,
            organizationId: page.organizationId,
            type: NotificationType.COMMENT,
            title: `New comment on "${page.title}"`,
            body: args.body.length > 100 ? args.body.slice(0, 100) + "…" : args.body,
            linkUrl: `/wiki/${page.id}`,
        }).catch((e) => console.error("Block comment notification error:", e));

        revalidatePath(`/wiki/${args.pageId}`);
        return { success: true, data: comment };
    } catch (error) {
        console.error("createBlockComment error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create comment",
        };
    }
}

export async function listBlockComments(pageId: string) {
    try {
        await getMe();
        return db.blockComment.findMany({
            where: { pageId },
            include: {
                author: { select: { id: true, name: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
        });
    } catch (error) {
        console.error("listBlockComments error:", error);
        return [];
    }
}

export async function resolveBlockComment(commentId: string, resolved: boolean) {
    try {
        const { userId } = await getMe();
        const comment = await db.blockComment.findUnique({ where: { id: commentId } });
        if (!comment) return { success: false, error: "Not found" };

        await db.blockComment.update({
            where: { id: commentId },
            data: { resolved },
        });

        // If this is a thread root, also resolve/unresolve all replies.
        if (!comment.parentCommentId) {
            await db.blockComment.updateMany({
                where: { parentCommentId: commentId },
                data: { resolved },
            });
        }

        revalidatePath(`/wiki/${comment.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("resolveBlockComment error:", error);
        return { success: false, error: "Failed to update" };
    }
}

export async function deleteBlockComment(commentId: string) {
    try {
        const { userId } = await getMe();
        const comment = await db.blockComment.findUnique({ where: { id: commentId } });
        if (!comment) return { success: false, error: "Not found" };
        if (comment.authorId !== userId) {
            return { success: false, error: "You can only delete your own comments" };
        }

        await db.blockComment.delete({ where: { id: commentId } });
        revalidatePath(`/wiki/${comment.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("deleteBlockComment error:", error);
        return { success: false, error: "Failed to delete" };
    }
}
