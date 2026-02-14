"use server";

import { db } from "@/lib/db";

export async function getWikiPagePath(pageId: string) {
    try {
        const path = [];
        let currentPageId: string | null = pageId;

        while (currentPageId) {
            const foundPage = await db.wikiPage.findUnique({
                where: { id: currentPageId },
                select: { id: true, title: true, parentPageId: true },
            }) as { id: string, title: string, parentPageId: string | null } | null;

            if (!foundPage) break;

            path.unshift({ id: foundPage.id, title: foundPage.title });
            currentPageId = foundPage.parentPageId;
        }

        return { success: true, path };
    } catch (error) {
        console.error("Error getting wiki path:", error);
        return { success: false, error: "Failed to get path" };
    }
}
