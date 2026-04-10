"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Trash actions for wiki pages, databases, and database rows.
 *
 * Soft-delete is the model: every supported resource carries a `deletedAt`
 * timestamp. Read paths filter out non-null deletedAt; this module exposes
 * the inverse — list/restore/purge — for the recovery UI.
 */

async function getMe() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });
    if (!user || user.memberships.length === 0)
        throw new Error("No organization");
    return {
        userId: user.id,
        organizationId: user.memberships[0].organizationId,
    };
}

// ─── List ────────────────────────────────────────────────

export async function listTrash() {
    try {
        const { organizationId } = await getMe();
        const [pages, databases, rows] = await Promise.all([
            db.wikiPage.findMany({
                where: { organizationId, deletedAt: { not: null } },
                select: {
                    id: true,
                    title: true,
                    deletedAt: true,
                    author: { select: { name: true, image: true } },
                },
                orderBy: { deletedAt: "desc" },
                take: 100,
            }),
            db.wikiDatabase.findMany({
                where: { organizationId, deletedAt: { not: null } },
                select: {
                    id: true,
                    name: true,
                    deletedAt: true,
                    createdBy: { select: { name: true, image: true } },
                },
                orderBy: { deletedAt: "desc" },
                take: 100,
            }),
            db.databaseRow.findMany({
                where: {
                    deletedAt: { not: null },
                    database: { organizationId, deletedAt: null },
                },
                select: {
                    id: true,
                    deletedAt: true,
                    databaseId: true,
                    database: { select: { name: true } },
                    values: {
                        // Best-effort title: first text value of the row.
                        select: { propertyId: true, value: true },
                    },
                },
                orderBy: { deletedAt: "desc" },
                take: 100,
            }),
        ]);

        // For rows, derive a title from the first TEXT property.
        const databaseIds = [...new Set(rows.map((r) => r.databaseId))];
        const textProps =
            databaseIds.length > 0
                ? await db.databaseProperty.findMany({
                      where: {
                          databaseId: { in: databaseIds },
                          type: "TEXT",
                      },
                      orderBy: { sortOrder: "asc" },
                      select: { id: true, databaseId: true },
                  })
                : [];
        const titlePropByDb = new Map<string, string>();
        for (const p of textProps) {
            if (!titlePropByDb.has(p.databaseId))
                titlePropByDb.set(p.databaseId, p.id);
        }
        const rowsWithTitle = rows.map((r) => {
            const titlePropId = titlePropByDb.get(r.databaseId);
            const titleVal = titlePropId
                ? r.values.find((v) => v.propertyId === titlePropId)?.value
                : undefined;
            return {
                id: r.id,
                databaseId: r.databaseId,
                databaseName: r.database.name,
                title:
                    typeof titleVal === "string" && titleVal ? titleVal : "Untitled",
                deletedAt: r.deletedAt,
            };
        });

        return {
            pages: pages.map((p) => ({
                id: p.id,
                title: p.title,
                deletedAt: p.deletedAt,
                author: p.author,
            })),
            databases: databases.map((d) => ({
                id: d.id,
                name: d.name,
                deletedAt: d.deletedAt,
                creator: d.createdBy,
            })),
            rows: rowsWithTitle,
        };
    } catch (error) {
        console.error("listTrash error:", error);
        return { pages: [], databases: [], rows: [] };
    }
}

// ─── Restore ─────────────────────────────────────────────

export async function restoreWikiPage(pageId: string) {
    try {
        const { organizationId } = await getMe();
        const page = await db.wikiPage.findUnique({
            where: { id: pageId },
            select: { organizationId: true },
        });
        if (!page || page.organizationId !== organizationId)
            return { success: false, error: "Not found" };
        await db.wikiPage.update({
            where: { id: pageId },
            data: { deletedAt: null },
        });
        revalidatePath("/trash");
        revalidatePath("/wiki");
        return { success: true };
    } catch (error) {
        console.error("restoreWikiPage error:", error);
        return { success: false, error: "Failed to restore" };
    }
}

export async function restoreDatabase(databaseId: string) {
    try {
        const { organizationId } = await getMe();
        const database = await db.wikiDatabase.findUnique({
            where: { id: databaseId },
            select: { organizationId: true },
        });
        if (!database || database.organizationId !== organizationId)
            return { success: false, error: "Not found" };
        await db.wikiDatabase.update({
            where: { id: databaseId },
            data: { deletedAt: null },
        });
        revalidatePath("/trash");
        revalidatePath("/databases");
        return { success: true };
    } catch (error) {
        console.error("restoreDatabase error:", error);
        return { success: false, error: "Failed to restore" };
    }
}

export async function restoreDatabaseRow(rowId: string) {
    try {
        const { organizationId } = await getMe();
        const row = await db.databaseRow.findUnique({
            where: { id: rowId },
            select: { databaseId: true, database: { select: { organizationId: true } } },
        });
        if (!row || row.database.organizationId !== organizationId)
            return { success: false, error: "Not found" };
        await db.databaseRow.update({
            where: { id: rowId },
            data: { deletedAt: null },
        });
        revalidatePath("/trash");
        revalidatePath(`/databases/${row.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("restoreDatabaseRow error:", error);
        return { success: false, error: "Failed to restore" };
    }
}

// ─── Permanent delete ────────────────────────────────────

export async function purgeWikiPage(pageId: string) {
    try {
        const { organizationId } = await getMe();
        const page = await db.wikiPage.findUnique({
            where: { id: pageId },
            select: { organizationId: true },
        });
        if (!page || page.organizationId !== organizationId)
            return { success: false, error: "Not found" };
        await db.wikiPage.delete({ where: { id: pageId } });
        revalidatePath("/trash");
        return { success: true };
    } catch (error) {
        console.error("purgeWikiPage error:", error);
        return { success: false, error: "Failed to purge" };
    }
}

export async function purgeDatabase(databaseId: string) {
    try {
        const { organizationId } = await getMe();
        const database = await db.wikiDatabase.findUnique({
            where: { id: databaseId },
            select: { organizationId: true },
        });
        if (!database || database.organizationId !== organizationId)
            return { success: false, error: "Not found" };
        await db.wikiDatabase.delete({ where: { id: databaseId } });
        revalidatePath("/trash");
        return { success: true };
    } catch (error) {
        console.error("purgeDatabase error:", error);
        return { success: false, error: "Failed to purge" };
    }
}

export async function purgeDatabaseRow(rowId: string) {
    try {
        const { organizationId } = await getMe();
        const row = await db.databaseRow.findUnique({
            where: { id: rowId },
            select: { database: { select: { organizationId: true } } },
        });
        if (!row || row.database.organizationId !== organizationId)
            return { success: false, error: "Not found" };
        await db.databaseRow.delete({ where: { id: rowId } });
        revalidatePath("/trash");
        return { success: true };
    } catch (error) {
        console.error("purgeDatabaseRow error:", error);
        return { success: false, error: "Failed to purge" };
    }
}

export async function emptyTrash() {
    try {
        const { organizationId } = await getMe();
        // Hard-delete everything currently in trash for this org.
        await db.$transaction([
            db.databaseRow.deleteMany({
                where: {
                    deletedAt: { not: null },
                    database: { organizationId },
                },
            }),
            db.wikiDatabase.deleteMany({
                where: { organizationId, deletedAt: { not: null } },
            }),
            db.wikiPage.deleteMany({
                where: { organizationId, deletedAt: { not: null } },
            }),
        ]);
        revalidatePath("/trash");
        return { success: true };
    } catch (error) {
        console.error("emptyTrash error:", error);
        return { success: false, error: "Failed to empty trash" };
    }
}
