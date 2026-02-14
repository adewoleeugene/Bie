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

// ─── Favorites ────────────────────────────────────────────

export async function getFavorites() {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const favorites = await db.favorite.findMany({
            where: {
                userId,
                organizationId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return favorites;
    } catch (error) {
        console.error("Get favorites error:", error);
        return [];
    }
}

export async function toggleFavorite(data: {
    itemType: string;
    itemId: string;
    itemTitle: string;
    itemUrl: string;
}) {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const existing = await db.favorite.findUnique({
            where: {
                userId_itemType_itemId: {
                    userId,
                    itemType: data.itemType,
                    itemId: data.itemId,
                },
            },
        });

        if (existing) {
            await db.favorite.delete({ where: { id: existing.id } });
            return { favorited: false };
        }

        await db.favorite.create({
            data: {
                userId,
                organizationId,
                ...data,
            },
        });

        return { favorited: true };
    } catch (error) {
        console.error("Toggle favorite error:", error);
        return { favorited: false };
    }
}

export async function isFavorited(itemType: string, itemId: string) {
    try {
        const { userId } = await getUserOrganization();

        const fav = await db.favorite.findUnique({
            where: {
                userId_itemType_itemId: {
                    userId,
                    itemType,
                    itemId,
                },
            },
        });

        return !!fav;
    } catch (error) {
        return false;
    }
}

// ─── Recent Items ─────────────────────────────────────────

export async function getRecentItems(limit = 10) {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const items = await db.recentItem.findMany({
            where: {
                userId,
                organizationId,
            },
            orderBy: {
                visitedAt: "desc",
            },
            take: limit,
        });

        return items;
    } catch (error) {
        console.error("Get recent items error:", error);
        return [];
    }
}

export async function trackRecentItem(data: {
    itemType: string;
    itemId: string;
    itemTitle: string;
    itemUrl: string;
}) {
    try {
        const { userId, organizationId } = await getUserOrganization();

        await db.recentItem.upsert({
            where: {
                userId_itemType_itemId: {
                    userId,
                    itemType: data.itemType,
                    itemId: data.itemId,
                },
            },
            update: {
                visitedAt: new Date(),
                itemTitle: data.itemTitle,
                itemUrl: data.itemUrl,
            },
            create: {
                userId,
                organizationId,
                ...data,
            },
        });

        // Clean up: keep only last 50 recent items per user
        const allRecent = await db.recentItem.findMany({
            where: { userId, organizationId },
            orderBy: { visitedAt: "desc" },
            skip: 50,
            select: { id: true },
        });

        if (allRecent.length > 0) {
            await db.recentItem.deleteMany({
                where: {
                    id: { in: allRecent.map((r: { id: string }) => r.id) },
                },
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Track recent item error:", error);
        return { success: false };
    }
}
