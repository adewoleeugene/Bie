"use server";

import { db } from "@/lib/db";
import { WikiNamespace } from "@prisma/client";

export type SearchResult = {
    type: "page";
    id: string;
    title: string;
    subtitle?: string;
    url: string;
};

export async function publicWikiSearch(query: string, organizationId: string): Promise<{
    success: boolean;
    results?: SearchResult[];
    error?: string;
}> {
    try {
        if (!query || query.length < 2) {
            return { success: true, results: [] };
        }

        const wikiPages = await db.wikiPage.findMany({
            where: {
                organizationId,
                published: true,
                title: {
                    contains: query,
                    mode: "insensitive",
                },
            } as any,
            take: 10,
            select: {
                id: true,
                title: true,
            },
        });

        const results: SearchResult[] = wikiPages.map((page) => ({
            type: "page",
            id: page.id,
            title: page.title,
            subtitle: "Wiki Page",
            url: `/published-wiki/${page.id}`,
        }));

        return { success: true, results };
    } catch (error) {
        console.error("Public search error:", error);
        return { success: false, error: "Failed to perform search" };
    }
}
