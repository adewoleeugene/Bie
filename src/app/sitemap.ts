import { MetadataRoute } from "next";
import { db } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://christbase.christex.org";

    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: `${baseUrl}/login`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ];

    // Published wiki pages are publicly accessible
    const publishedPages = await db.wikiPage.findMany({
        where: {
            published: true,
            deletedAt: null,
        },
        select: {
            id: true,
            updatedAt: true,
        },
    });

    const wikiRoutes: MetadataRoute.Sitemap = publishedPages.map((page) => ({
        url: `${baseUrl}/published-wiki/${page.id}`,
        lastModified: page.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
    }));

    return [...staticRoutes, ...wikiRoutes];
}
