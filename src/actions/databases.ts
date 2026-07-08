"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    DatabasePropertyType,
    DatabaseViewType,
    Prisma,
    ResourceMemberRole,
    ResourceVisibility,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { canEdit, canView, resolveAccess } from "@/lib/permissions";
import { parseRelationConfig, parseRollupConfig } from "@/lib/database-types";
import { computeRollup } from "@/lib/database-rollup";
import { DATABASE_TEMPLATES } from "@/lib/database-templates";
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
    return {
        userId: user.id,
        organizationId: (await activeMembership(user.memberships)).organizationId,
        orgRole: (await activeMembership(user.memberships)).role,
    };
}

async function assertDatabaseAccess(
    databaseId: string,
    require: "view" | "edit" = "edit",
    opts?: { allowTrashed?: boolean },
) {
    const { organizationId, userId, orgRole } = await getMe();
    const database = await db.wikiDatabase.findUnique({
        where: { id: databaseId },
        select: {
            id: true,
            organizationId: true,
            createdById: true,
            visibility: true,
            deletedAt: true,
            members: { select: { userId: true, role: true } },
        },
    });
    if (!database) throw new Error("Database not found");
    if (database.deletedAt && !opts?.allowTrashed) {
        throw new Error("Database is in trash");
    }
    const access = resolveAccess(
        {
            visibility: database.visibility,
            organizationId: database.organizationId,
            creatorId: database.createdById,
            members: database.members,
        },
        { userId, organizationId, orgRole },
    );
    if (require === "edit" ? !canEdit(access) : !canView(access)) {
        throw new Error("Access denied");
    }
    return { userId, organizationId, access };
}

// ─── Rollup cache invalidation ───────────────────────────

/**
 * Clear the rollup cache for any row whose rollup result could be affected
 * by a change to a given row's value.
 *
 * The cases:
 *   1) The changed row's *own* rollups depend on its outgoing relations.
 *      → clear the row itself.
 *   2) The changed row is a rollup *target* — anyone who LINKS TO it via a
 *      relation that's followed by a rollup may now have a stale result.
 *      → clear all source rows whose `relationsFrom.toRowId === changed.id`.
 */
async function invalidateRollupCacheForRowChange(rowId: string) {
    try {
        await db.databaseRow.update({
            where: { id: rowId },
            data: { rollupCache: Prisma.DbNull },
        });
        // Also clear any row that links to this one via the join table.
        const incoming = await db.databaseRowRelation.findMany({
            where: { toRowId: rowId },
            select: { fromRowId: true },
        });
        if (incoming.length > 0) {
            const fromIds = [...new Set(incoming.map((e) => e.fromRowId))];
            await db.databaseRow.updateMany({
                where: { id: { in: fromIds } },
                data: { rollupCache: Prisma.DbNull },
            });
        }
    } catch (error) {
        console.error("invalidateRollupCacheForRowChange error:", error);
    }
}

/**
 * Clear *every* row's rollup cache in databases that have ROLLUP properties
 * — used when a property/config changes in a way we can't reason about
 * locally (e.g. property added or deleted).
 */
async function invalidateAllRollupCachesInDatabase(databaseId: string) {
    try {
        await db.databaseRow.updateMany({
            where: { databaseId },
            data: { rollupCache: Prisma.DbNull },
        });
    } catch (error) {
        console.error("invalidateAllRollupCachesInDatabase error:", error);
    }
}

// ─── Database CRUD ───────────────────────────────────────

export async function listDatabases() {
    try {
        const { organizationId, userId } = await getMe();
        return db.wikiDatabase.findMany({
            where: {
                organizationId,
                deletedAt: null,
                OR: [
                    { visibility: ResourceVisibility.ORG },
                    { createdById: userId },
                    { members: { some: { userId } } },
                ],
            },
            include: {
                createdBy: { select: { id: true, name: true, image: true } },
                _count: { select: { rows: true, properties: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
    } catch (error) {
        console.error("listDatabases error:", error);
        return [];
    }
}

export async function getDatabase(databaseId: string) {
    try {
        await assertDatabaseAccess(databaseId, "view");
        const database = await db.wikiDatabase.findUnique({
            where: { id: databaseId },
            include: {
                createdBy: { select: { id: true, name: true, image: true } },
                properties: { orderBy: { sortOrder: "asc" } },
                views: { orderBy: { sortOrder: "asc" } },
                rows: {
                    where: { deletedAt: null },
                    orderBy: { sortOrder: "asc" },
                    include: {
                        values: true,
                        relationsFrom: {
                            select: {
                                propertyId: true,
                                toRowId: true,
                            },
                        },
                        relationsTo: {
                            select: {
                                propertyId: true,
                                fromRowId: true,
                            },
                        },
                    },
                },
            },
        });
        if (!database) return null;

        // Classify each RELATION property: "primary" owns the join-table
        // edges; "paired" is the synced reverse side living on a target
        // database whose edges live under the primary's id.
        const primaryRelationIds = new Set<string>();
        const pairedRelations: { id: string; pairedPropertyId: string }[] = [];
        for (const p of database.properties) {
            if (p.type !== DatabasePropertyType.RELATION) continue;
            const cfg = parseRelationConfig(p.config);
            if (cfg.pairedPropertyId && !cfg.targetDatabaseId) {
                pairedRelations.push({
                    id: p.id,
                    pairedPropertyId: cfg.pairedPropertyId,
                });
            } else {
                primaryRelationIds.add(p.id);
            }
        }

        // For paired RELATION props the picker needs `targetDatabaseId` —
        // synthesize it by looking up the primary's owning database.
        if (pairedRelations.length > 0) {
            const primaryProps = await db.databaseProperty.findMany({
                where: {
                    id: { in: pairedRelations.map((p) => p.pairedPropertyId) },
                },
                select: { id: true, databaseId: true },
            });
            const primaryDbById = new Map(
                primaryProps.map((p) => [p.id, p.databaseId]),
            );
            for (const paired of pairedRelations) {
                const prop = database.properties.find((x) => x.id === paired.id);
                if (!prop) continue;
                const sourceDbId = primaryDbById.get(paired.pairedPropertyId);
                if (sourceDbId) {
                    prop.config = {
                        ...(typeof prop.config === "object" && prop.config
                            ? prop.config
                            : {}),
                        targetDatabaseId: sourceDbId,
                    } as any;
                }
            }
        }

        if (primaryRelationIds.size > 0 || pairedRelations.length > 0) {
            for (const row of database.rows) {
                // Primary edges: from this row, via this row's relationsFrom.
                const groupedFrom = new Map<string, string[]>();
                for (const edge of row.relationsFrom) {
                    if (!primaryRelationIds.has(edge.propertyId)) continue;
                    const arr = groupedFrom.get(edge.propertyId) || [];
                    arr.push(edge.toRowId);
                    groupedFrom.set(edge.propertyId, arr);
                }
                for (const [propertyId, ids] of groupedFrom) {
                    (row.values as any[]).push({
                        id: `__rel_${row.id}_${propertyId}`,
                        rowId: row.id,
                        propertyId,
                        value: ids,
                    });
                }

                // Paired edges: incoming, indexed by this row's id, where the
                // edge's propertyId equals the *primary's* id. We project the
                // value under the *paired* property's id so the UI sees one
                // synthetic cell per paired property.
                if (pairedRelations.length > 0) {
                    const groupedTo = new Map<string, string[]>();
                    for (const edge of row.relationsTo) {
                        const paired = pairedRelations.find(
                            (p) => p.pairedPropertyId === edge.propertyId,
                        );
                        if (!paired) continue;
                        const arr = groupedTo.get(paired.id) || [];
                        arr.push(edge.fromRowId);
                        groupedTo.set(paired.id, arr);
                    }
                    for (const [pairedId, ids] of groupedTo) {
                        (row.values as any[]).push({
                            id: `__relp_${row.id}_${pairedId}`,
                            rowId: row.id,
                            propertyId: pairedId,
                            value: ids,
                        });
                    }
                }
            }
        }

        // ─── Rollup projection ────────────────────────────────────────────
        // For every ROLLUP property, walk each source row's relation edges
        // (via the configured relationPropertyId), fetch the target rows'
        // values for the configured targetPropertyId, then run the
        // aggregation. The result lands in the row's values array as a
        // synthetic cell whose value is a `RollupValue` object.
        //
        // Rollup-of-rollup: rollups within the same database are computed in
        // dependency order via a small toposort, so a rollup whose target is
        // another rollup property reads the previously-computed value.
        const allRollupProperties = database.properties.filter(
            (p) => p.type === DatabasePropertyType.ROLLUP,
        );
        // Build dependency map: rollup A → rollup B (in same DB) if A's
        // followed relation points to this DB AND its targetPropertyId is B.
        // (A self-edge counts as a cycle and is dropped from the order.)
        const rollupDeps = new Map<string, Set<string>>();
        const inSameDb = new Set(allRollupProperties.map((p) => p.id));
        for (const p of allRollupProperties) {
            const cfg = parseRollupConfig(p.config);
            const deps = new Set<string>();
            if (cfg.targetPropertyId && inSameDb.has(cfg.targetPropertyId)) {
                deps.add(cfg.targetPropertyId);
            }
            rollupDeps.set(p.id, deps);
        }
        // Kahn's algorithm — any rollup with unsatisfied deps after the loop
        // is part of a cycle and gets computed last with empty inputs.
        const rollupOrder: string[] = [];
        const remaining = new Set(allRollupProperties.map((p) => p.id));
        while (remaining.size > 0) {
            const ready = [...remaining].filter((id) =>
                [...(rollupDeps.get(id) || [])].every((d) => !remaining.has(d)),
            );
            if (ready.length === 0) {
                // Cycle: drain remaining in arbitrary order.
                rollupOrder.push(...remaining);
                break;
            }
            for (const id of ready) {
                rollupOrder.push(id);
                remaining.delete(id);
            }
        }
        const rollupProperties = rollupOrder
            .map((id) => allRollupProperties.find((p) => p.id === id)!)
            .filter(Boolean);
        if (rollupProperties.length > 0) {
            // Build: source row id -> RELATION property id -> related row ids
            const edgesByRowAndProp = new Map<string, Map<string, string[]>>();
            for (const row of database.rows) {
                const inner = new Map<string, string[]>();
                for (const edge of row.relationsFrom) {
                    const arr = inner.get(edge.propertyId) || [];
                    arr.push(edge.toRowId);
                    inner.set(edge.propertyId, arr);
                }
                edgesByRowAndProp.set(row.id, inner);
            }

            // Group rollups by (relationProperty, targetProperty) to coalesce
            // bulk fetches.
            const targetRowIdsToFetch = new Set<string>();
            const targetPropertyIds = new Set<string>();
            for (const rollupProp of rollupProperties) {
                const cfg = parseRollupConfig(rollupProp.config);
                if (!cfg.relationPropertyId || !cfg.targetPropertyId) continue;
                targetPropertyIds.add(cfg.targetPropertyId);
                for (const row of database.rows) {
                    const ids = edgesByRowAndProp
                        .get(row.id)
                        ?.get(cfg.relationPropertyId) || [];
                    for (const id of ids) targetRowIdsToFetch.add(id);
                }
            }

            // Bulk-fetch all needed target values + target property types in
            // two queries.
            const [targetValueRows, targetProperties] = await Promise.all([
                targetRowIdsToFetch.size > 0 && targetPropertyIds.size > 0
                    ? db.databaseValue.findMany({
                          where: {
                              rowId: { in: [...targetRowIdsToFetch] },
                              propertyId: { in: [...targetPropertyIds] },
                          },
                          select: {
                              rowId: true,
                              propertyId: true,
                              value: true,
                          },
                      })
                    : Promise.resolve([] as { rowId: string; propertyId: string; value: unknown }[]),
                targetPropertyIds.size > 0
                    ? db.databaseProperty.findMany({
                          where: { id: { in: [...targetPropertyIds] } },
                          select: { id: true, type: true },
                      })
                    : Promise.resolve([] as { id: string; type: DatabasePropertyType }[]),
            ]);

            // (rowId, propertyId) -> value
            const valueLookup = new Map<string, unknown>();
            for (const r of targetValueRows) {
                valueLookup.set(`${r.rowId}__${r.propertyId}`, r.value);
            }
            const propertyTypeById = new Map<string, DatabasePropertyType>();
            for (const p of targetProperties) propertyTypeById.set(p.id, p.type);

            // Compute & inject. Use the per-row `rollupCache` if present —
            // any write that could affect the rollup result has cleared the
            // relevant rows' caches via `invalidateRollupCacheForRowChange`.
            //
            // Iterate rollups in dependency order (outer loop) so that a
            // rollup that targets another rollup can read its result from
            // the rolling lookup map.
            const cacheUpdates = new Map<string, Record<string, unknown>>();
            // (sourceRowId, rollupPropertyId) -> RollupValue (used by
            // rollup-of-rollup so a higher-level rollup can read a
            // lower-level rollup's per-row result on the *target* row).
            const rollupResultByRowAndProp = new Map<string, unknown>();

            for (const rollupProp of rollupProperties) {
                const cfg = parseRollupConfig(rollupProp.config);
                const aggregation = cfg.aggregation || "count";
                // Target type: if the target is itself a rollup, the target
                // values are RollupValue tagged unions and we let
                // computeRollup do best-effort coercion via asNumber/asString.
                const targetType = cfg.targetPropertyId
                    ? propertyTypeById.get(cfg.targetPropertyId)
                    : undefined;

                for (const row of database.rows) {
                    const existingCache =
                        row.rollupCache && typeof row.rollupCache === "object"
                            ? (row.rollupCache as Record<string, unknown>)
                            : null;
                    const cached = existingCache?.[rollupProp.id];
                    let result;
                    if (cached !== undefined) {
                        result = cached;
                    } else {
                        const ids = cfg.relationPropertyId
                            ? edgesByRowAndProp
                                  .get(row.id)
                                  ?.get(cfg.relationPropertyId) || []
                            : [];
                        const targetValues = cfg.targetPropertyId
                            ? ids.map((id) => {
                                  // First: previously-computed rollup on the
                                  // target row (rollup-of-rollup).
                                  const fromRollup = rollupResultByRowAndProp.get(
                                      `${id}__${cfg.targetPropertyId}`,
                                  );
                                  if (fromRollup !== undefined) {
                                      // Unwrap RollupValue → its underlying primitive
                                      // so a higher-level rollup can aggregate it.
                                      const rv = fromRollup as { kind?: string; value?: unknown };
                                      if (rv?.kind === "number" || rv?.kind === "text")
                                          return rv.value;
                                      if (rv?.kind === "empty") return null;
                                      return rv;
                                  }
                                  return valueLookup.get(
                                      `${id}__${cfg.targetPropertyId}`,
                                  );
                              })
                            : ids;
                        result = computeRollup(
                            targetValues,
                            aggregation,
                            targetType,
                        );
                        const accumulated =
                            cacheUpdates.get(row.id) ||
                            ({ ...(existingCache || {}) } as Record<string, unknown>);
                        accumulated[rollupProp.id] = result;
                        cacheUpdates.set(row.id, accumulated);
                    }

                    rollupResultByRowAndProp.set(
                        `${row.id}__${rollupProp.id}`,
                        result,
                    );
                    (row.values as any[]).push({
                        id: `__rollup_${row.id}_${rollupProp.id}`,
                        rowId: row.id,
                        propertyId: rollupProp.id,
                        value: result,
                    });
                }
            }

            // Persist newly computed rollup cache entries (fire-and-forget;
            // safe to fail since we already returned the value to the caller
            // via the projection above).
            if (cacheUpdates.size > 0) {
                Promise.all(
                    [...cacheUpdates.entries()].map(([rowId, cache]) =>
                        db.databaseRow.update({
                            where: { id: rowId },
                            data: { rollupCache: cache as any },
                        }),
                    ),
                ).catch((err) =>
                    console.error("rollupCache write failed:", err),
                );
            }
        }

        return database;
    } catch (error) {
        console.error("getDatabase error:", error);
        return null;
    }
}

export async function createDatabase(args: { name: string; description?: string }) {
    try {
        const { userId, organizationId } = await getMe();

        const database = await db.wikiDatabase.create({
            data: {
                name: args.name,
                description: args.description,
                organizationId,
                createdById: userId,
                // Always seed with a "Name" text property and a default Table view.
                properties: {
                    create: [
                        {
                            name: "Name",
                            type: DatabasePropertyType.TEXT,
                            sortOrder: 0,
                        },
                    ],
                },
                views: {
                    create: [
                        {
                            name: "All",
                            type: DatabaseViewType.TABLE,
                            sortOrder: 0,
                        },
                    ],
                },
            },
            include: { properties: true, views: true },
        });

        revalidatePath("/databases");
        return { success: true, data: database };
    } catch (error) {
        console.error("createDatabase error:", error);
        return { success: false, error: "Failed to create database" };
    }
}

export async function createDatabaseFromTemplate(templateKey: string) {
    try {
        const template = DATABASE_TEMPLATES.find((t) => t.key === templateKey);
        if (!template) return { success: false, error: "Template not found" };

        const { userId, organizationId } = await getMe();

        const database = await db.wikiDatabase.create({
            data: {
                name: template.name,
                description: template.description,
                organizationId,
                createdById: userId,
                properties: {
                    create: template.properties.map((p) => ({
                        name: p.name,
                        type: p.type,
                        config: p.config as any,
                        sortOrder: p.sortOrder,
                    })),
                },
                views: {
                    create: template.views.map((v) => ({
                        name: v.name,
                        type: v.type,
                        sortOrder: v.sortOrder,
                    })),
                },
            },
            include: { properties: true, views: true },
        });

        revalidatePath("/databases");
        return { success: true, data: database };
    } catch (error) {
        console.error("createDatabaseFromTemplate error:", error);
        return { success: false, error: "Failed to create database from template" };
    }
}

export async function updateDatabase(args: {
    databaseId: string;
    name?: string;
    description?: string;
}) {
    try {
        await assertDatabaseAccess(args.databaseId);
        const updated = await db.wikiDatabase.update({
            where: { id: args.databaseId },
            data: {
                ...(args.name !== undefined ? { name: args.name } : {}),
                ...(args.description !== undefined ? { description: args.description } : {}),
            },
        });
        revalidatePath("/databases");
        revalidatePath(`/databases/${args.databaseId}`);
        return { success: true, data: updated };
    } catch (error) {
        console.error("updateDatabase error:", error);
        return { success: false, error: "Failed to update database" };
    }
}

export async function deleteDatabase(databaseId: string) {
    try {
        await assertDatabaseAccess(databaseId);
        await db.wikiDatabase.update({
            where: { id: databaseId },
            data: { deletedAt: new Date() },
        });
        revalidatePath("/databases");
        return { success: true };
    } catch (error) {
        console.error("deleteDatabase error:", error);
        return { success: false, error: "Failed to delete database" };
    }
}

// ─── Property CRUD ───────────────────────────────────────

export async function addProperty(args: {
    databaseId: string;
    name: string;
    type: DatabasePropertyType;
    config?: Prisma.InputJsonValue;
}) {
    try {
        await assertDatabaseAccess(args.databaseId);
        const last = await db.databaseProperty.findFirst({
            where: { databaseId: args.databaseId },
            orderBy: { sortOrder: "desc" },
        });
        const property = await db.databaseProperty.create({
            data: {
                databaseId: args.databaseId,
                name: args.name,
                type: args.type,
                config: args.config,
                sortOrder: (last?.sortOrder ?? -1) + 1,
            },
        });
        revalidatePath(`/databases/${args.databaseId}`);
        return { success: true, data: property };
    } catch (error) {
        console.error("addProperty error:", error);
        return { success: false, error: "Failed to add property" };
    }
}

export async function updateProperty(args: {
    propertyId: string;
    name?: string;
    config?: Prisma.InputJsonValue;
}) {
    try {
        const property = await db.databaseProperty.findUnique({
            where: { id: args.propertyId },
            select: { databaseId: true, type: true },
        });
        if (!property) return { success: false, error: "Not found" };
        await assertDatabaseAccess(property.databaseId);
        await db.databaseProperty.update({
            where: { id: args.propertyId },
            data: {
                ...(args.name !== undefined ? { name: args.name } : {}),
                ...(args.config !== undefined ? { config: args.config } : {}),
            },
        });
        // A rollup config change invalidates every cached row in this DB.
        // (Cheap blanket clear — config edits are rare.)
        if (
            args.config !== undefined &&
            (property.type === DatabasePropertyType.ROLLUP ||
                property.type === DatabasePropertyType.RELATION)
        ) {
            await invalidateAllRollupCachesInDatabase(property.databaseId);
        }
        revalidatePath(`/databases/${property.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("updateProperty error:", error);
        return { success: false, error: "Failed to update property" };
    }
}

export async function deleteProperty(propertyId: string) {
    try {
        const property = await db.databaseProperty.findUnique({
            where: { id: propertyId },
            select: { databaseId: true, type: true, config: true },
        });
        if (!property) return { success: false, error: "Not found" };
        await assertDatabaseAccess(property.databaseId);

        // If this is part of a synced relation pair, clean up the partner so
        // we never leave a dangling `pairedPropertyId` reference.
        if (property.type === DatabasePropertyType.RELATION) {
            const cfg = parseRelationConfig(property.config);
            if (cfg.pairedPropertyId) {
                const partner = await db.databaseProperty.findUnique({
                    where: { id: cfg.pairedPropertyId },
                    select: { id: true, databaseId: true, type: true, config: true },
                });
                if (partner && partner.type === DatabasePropertyType.RELATION) {
                    const partnerCfg = parseRelationConfig(partner.config);
                    // If the partner had its targetDatabaseId set (i.e. the
                    // partner is the primary side), we're deleting the
                    // mirror — clear `pairedPropertyId` on the primary so it
                    // becomes a normal one-way relation again.
                    if (partnerCfg.targetDatabaseId) {
                        await db.databaseProperty.update({
                            where: { id: partner.id },
                            data: {
                                config: {
                                    targetDatabaseId: partnerCfg.targetDatabaseId,
                                } as any,
                            },
                        });
                        revalidatePath(`/databases/${partner.databaseId}`);
                    } else {
                        // Otherwise we're deleting the primary — also
                        // delete the mirror (it has nothing to point to).
                        await db.databaseProperty
                            .delete({ where: { id: partner.id } })
                            .catch(() => {});
                        revalidatePath(`/databases/${partner.databaseId}`);
                    }
                }
            }
        }

        await db.databaseProperty.delete({ where: { id: propertyId } });
        revalidatePath(`/databases/${property.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("deleteProperty error:", error);
        return { success: false, error: "Failed to delete property" };
    }
}

// ─── Row CRUD ────────────────────────────────────────────

export async function addRow(databaseId: string) {
    try {
        await assertDatabaseAccess(databaseId);
        const last = await db.databaseRow.findFirst({
            where: { databaseId },
            orderBy: { sortOrder: "desc" },
        });
        const row = await db.databaseRow.create({
            data: {
                databaseId,
                sortOrder: (last?.sortOrder ?? -1) + 1,
            },
            include: { values: true },
        });
        // Row count may affect any "count" rollups in databases that link
        // here — invalidate them all in this database. This is the only
        // mutation that doesn't have a specific incoming-edges anchor.
        await invalidateAllRollupCachesInDatabase(databaseId);
        revalidatePath(`/databases/${databaseId}`);
        return { success: true, data: row };
    } catch (error) {
        console.error("addRow error:", error);
        return { success: false, error: "Failed to add row" };
    }
}

export async function setRowValue(args: {
    rowId: string;
    propertyId: string;
    value: Prisma.InputJsonValue;
}) {
    try {
        const row = await db.databaseRow.findUnique({
            where: { id: args.rowId },
            select: { databaseId: true },
        });
        if (!row) return { success: false, error: "Row not found" };
        await assertDatabaseAccess(row.databaseId);

        // RELATION properties are stored in a join table, not DatabaseValue.
        // Diff the incoming id list against the existing edges to keep writes minimal.
        const property = await db.databaseProperty.findUnique({
            where: { id: args.propertyId },
            select: { type: true, config: true },
        });
        if (property?.type === DatabasePropertyType.RELATION) {
            const desiredIds = Array.isArray(args.value)
                ? (args.value as unknown[]).filter(
                      (v): v is string => typeof v === "string",
                  )
                : [];

            // Determine whether this is a paired (synced reverse) RELATION.
            // Paired props don't own edges — we read/write them on the primary
            // side with from/to swapped.
            const cfg = parseRelationConfig(property.config);
            const isPaired = !!cfg.pairedPropertyId && !cfg.targetDatabaseId;
            const edgePropertyId = isPaired
                ? (cfg.pairedPropertyId as string)
                : args.propertyId;

            // Cycle / self-link guard: a row may not link to itself.
            const filteredDesired = desiredIds.filter((id) => id !== args.rowId);

            const existing = await db.databaseRowRelation.findMany({
                where: isPaired
                    ? {
                          propertyId: edgePropertyId,
                          toRowId: args.rowId,
                      }
                    : {
                          propertyId: edgePropertyId,
                          fromRowId: args.rowId,
                      },
                select: isPaired
                    ? { fromRowId: true }
                    : { toRowId: true },
            });
            const existingIds = new Set(
                existing.map((e: any) => (isPaired ? e.fromRowId : e.toRowId)),
            );
            const desiredSet = new Set(filteredDesired);
            const toAdd = filteredDesired.filter((id) => !existingIds.has(id));
            const toRemove = [...existingIds].filter((id) => !desiredSet.has(id));
            await db.$transaction([
                ...(toRemove.length > 0
                    ? [
                          db.databaseRowRelation.deleteMany({
                              where: isPaired
                                  ? {
                                        propertyId: edgePropertyId,
                                        toRowId: args.rowId,
                                        fromRowId: { in: toRemove },
                                    }
                                  : {
                                        propertyId: edgePropertyId,
                                        fromRowId: args.rowId,
                                        toRowId: { in: toRemove },
                                    },
                          }),
                      ]
                    : []),
                ...toAdd.map((otherId) =>
                    db.databaseRowRelation.create({
                        data: isPaired
                            ? {
                                  propertyId: edgePropertyId,
                                  fromRowId: otherId,
                                  toRowId: args.rowId,
                              }
                            : {
                                  propertyId: edgePropertyId,
                                  fromRowId: args.rowId,
                                  toRowId: otherId,
                              },
                    }),
                ),
            ]);
            // Relation edges changed → invalidate rollup caches.
            // For the changed row's own rollups, plus any source rows that
            // newly link to or unlinked from each affected target.
            await invalidateRollupCacheForRowChange(args.rowId);
            for (const other of [...toAdd, ...toRemove]) {
                await invalidateRollupCacheForRowChange(other);
            }
            revalidatePath(`/databases/${row.databaseId}`);
            return { success: true };
        }

        await db.databaseValue.upsert({
            where: {
                rowId_propertyId: { rowId: args.rowId, propertyId: args.propertyId },
            },
            create: {
                rowId: args.rowId,
                propertyId: args.propertyId,
                value: args.value,
            },
            update: { value: args.value },
        });

        // A normal value changed → invalidate any source rows that link to
        // this row via a relation (their rollups may now be stale).
        await invalidateRollupCacheForRowChange(args.rowId);

        revalidatePath(`/databases/${row.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("setRowValue error:", error);
        return { success: false, error: "Failed to set value" };
    }
}

// ─── View CRUD ───────────────────────────────────────────

export async function createView(args: {
    databaseId: string;
    name: string;
    type: DatabaseViewType;
    config?: Prisma.InputJsonValue;
}) {
    try {
        await assertDatabaseAccess(args.databaseId);
        const last = await db.databaseView.findFirst({
            where: { databaseId: args.databaseId },
            orderBy: { sortOrder: "desc" },
        });
        const view = await db.databaseView.create({
            data: {
                databaseId: args.databaseId,
                name: args.name,
                type: args.type,
                config: args.config,
                sortOrder: (last?.sortOrder ?? -1) + 1,
            },
        });
        revalidatePath(`/databases/${args.databaseId}`);
        return { success: true, data: view };
    } catch (error) {
        console.error("createView error:", error);
        return { success: false, error: "Failed to create view" };
    }
}

export async function updateView(args: {
    viewId: string;
    name?: string;
    config?: Prisma.InputJsonValue;
}) {
    try {
        const view = await db.databaseView.findUnique({
            where: { id: args.viewId },
            select: { databaseId: true },
        });
        if (!view) return { success: false, error: "Not found" };
        await assertDatabaseAccess(view.databaseId);
        await db.databaseView.update({
            where: { id: args.viewId },
            data: {
                ...(args.name !== undefined ? { name: args.name } : {}),
                ...(args.config !== undefined ? { config: args.config } : {}),
            },
        });
        revalidatePath(`/databases/${view.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("updateView error:", error);
        return { success: false, error: "Failed to update view" };
    }
}

export async function deleteView(viewId: string) {
    try {
        const view = await db.databaseView.findUnique({
            where: { id: viewId },
            select: { databaseId: true },
        });
        if (!view) return { success: false, error: "Not found" };
        await assertDatabaseAccess(view.databaseId);
        await db.databaseView.delete({ where: { id: viewId } });
        revalidatePath(`/databases/${view.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("deleteView error:", error);
        return { success: false, error: "Failed to delete view" };
    }
}

/**
 * Toggle bidirectional/synced mode on a RELATION property.
 *
 * When `paired` is true: create a mirror RELATION property on the target
 * database and cross-link the two via `pairedPropertyId` in their configs.
 * When `paired` is false: delete the mirror property and clear the link.
 *
 * Only callable on the *primary* side (the one with `targetDatabaseId`).
 */
export async function setRelationPaired(args: {
    propertyId: string;
    paired: boolean;
}) {
    try {
        const property = await db.databaseProperty.findUnique({
            where: { id: args.propertyId },
            select: { id: true, name: true, databaseId: true, config: true },
        });
        if (!property) return { success: false, error: "Not found" };
        await assertDatabaseAccess(property.databaseId);

        const cfg = parseRelationConfig(property.config);
        if (!cfg.targetDatabaseId) {
            return {
                success: false,
                error: "Pick a target database before enabling pairing",
            };
        }

        if (args.paired) {
            // Already paired? no-op.
            if (cfg.pairedPropertyId) return { success: true };

            // Create mirror property on the target database.
            await assertDatabaseAccess(cfg.targetDatabaseId);
            const last = await db.databaseProperty.findFirst({
                where: { databaseId: cfg.targetDatabaseId },
                orderBy: { sortOrder: "desc" },
            });
            const sourceDb = await db.wikiDatabase.findUnique({
                where: { id: property.databaseId },
                select: { name: true },
            });
            const mirror = await db.databaseProperty.create({
                data: {
                    databaseId: cfg.targetDatabaseId,
                    name: `${sourceDb?.name || "Linked"} ← ${property.name}`,
                    type: DatabasePropertyType.RELATION,
                    sortOrder: (last?.sortOrder ?? -1) + 1,
                    config: { pairedPropertyId: property.id } as any,
                },
            });
            // Update primary's config to point at the mirror.
            await db.databaseProperty.update({
                where: { id: property.id },
                data: {
                    config: {
                        ...cfg,
                        pairedPropertyId: mirror.id,
                    } as any,
                },
            });
            revalidatePath(`/databases/${property.databaseId}`);
            revalidatePath(`/databases/${cfg.targetDatabaseId}`);
            return { success: true };
        } else {
            // Unpair: delete the mirror, clear the link.
            if (cfg.pairedPropertyId) {
                await db.databaseProperty
                    .delete({ where: { id: cfg.pairedPropertyId } })
                    .catch(() => {});
            }
            await db.databaseProperty.update({
                where: { id: property.id },
                data: {
                    config: {
                        targetDatabaseId: cfg.targetDatabaseId,
                    } as any,
                },
            });
            revalidatePath(`/databases/${property.databaseId}`);
            if (cfg.targetDatabaseId)
                revalidatePath(`/databases/${cfg.targetDatabaseId}`);
            return { success: true };
        }
    } catch (error) {
        console.error("setRelationPaired error:", error);
        return { success: false, error: "Failed to update pairing" };
    }
}

// ─── Lightweight readers (for relation pickers, etc) ────

/**
 * Returns minimal row data — id + the value of the first TEXT property as a
 * "title". Used by the relation picker so it can render a chip per row
 * without loading the whole database.
 *
 * Search semantics: when `query` is provided we do a *case-insensitive*
 * substring match on the title in JS. To avoid blowing memory on huge
 * databases the scan window is capped at SCAN_CAP rows ordered by sortOrder
 * starting at `cursor * SCAN_CAP`. Above that the user should narrow their
 * query rather than scroll forever.
 */
export async function getRelationRowsLite(
    databaseId: string,
    opts?: { query?: string; cursor?: number; pageSize?: number; includeIds?: string[] },
) {
    try {
        await assertDatabaseAccess(databaseId, "view");
        const pageSize = Math.min(opts?.pageSize ?? 50, 200);
        const cursor = opts?.cursor ?? 0;
        const SCAN_CAP = 500; // Max rows we'll examine per request when filtering.
        const titleProp = await db.databaseProperty.findFirst({
            where: { databaseId, type: DatabasePropertyType.TEXT },
            orderBy: { sortOrder: "asc" },
        });

        const lowerQuery = (opts?.query || "").trim().toLowerCase();

        // Load a window of rows in sortOrder. When filtering, scan a wider
        // window than pageSize so the JS filter has rows to work with.
        const scanLimit = lowerQuery ? SCAN_CAP : pageSize;
        const rowsRaw = await db.databaseRow.findMany({
            where: { databaseId },
            select: {
                id: true,
                sortOrder: true,
                values: titleProp
                    ? {
                          where: { propertyId: titleProp.id },
                          select: { value: true },
                      }
                    : false,
            },
            orderBy: { sortOrder: "asc" },
            take: scanLimit,
            skip: lowerQuery ? 0 : cursor,
        });

        const hydrated = rowsRaw.map((r) => {
            const v = (r as any).values?.[0]?.value;
            return {
                id: r.id,
                title: typeof v === "string" && v ? v : "Untitled",
            };
        });

        // Case-insensitive filter in JS.
        const filtered = lowerQuery
            ? hydrated.filter((r) => r.title.toLowerCase().includes(lowerQuery))
            : hydrated;

        // Apply pagination AFTER the filter when querying; otherwise the
        // server-level skip already paginated.
        const page = lowerQuery
            ? filtered.slice(cursor, cursor + pageSize)
            : filtered;

        // Always-included off-window rows (already-linked chips).
        const presentIds = new Set(page.map((r) => r.id));
        const missingIncludes = (opts?.includeIds || []).filter(
            (id) => !presentIds.has(id),
        );
        if (missingIncludes.length > 0 && titleProp) {
            const extras = await db.databaseRow.findMany({
                where: { id: { in: missingIncludes }, databaseId },
                select: {
                    id: true,
                    values: {
                        where: { propertyId: titleProp.id },
                        select: { value: true },
                    },
                },
            });
            for (const e of extras) {
                const v = (e as any).values?.[0]?.value;
                page.push({
                    id: e.id,
                    title: typeof v === "string" && v ? v : "Untitled",
                });
            }
        }

        return page;
    } catch (error) {
        console.error("getRelationRowsLite error:", error);
        return [];
    }
}

/**
 * Returns just the property list of a database. Used by the rollup config
 * UI to populate the "target property" dropdown without loading rows.
 */
export async function getDatabasePropertiesLite(databaseId: string) {
    try {
        await assertDatabaseAccess(databaseId, "view");
        return db.databaseProperty.findMany({
            where: { databaseId },
            select: { id: true, name: true, type: true },
            orderBy: { sortOrder: "asc" },
        });
    } catch (error) {
        console.error("getDatabasePropertiesLite error:", error);
        return [];
    }
}

// ─── Sharing ─────────────────────────────────────────────

export async function getDatabaseSharing(databaseId: string) {
    try {
        await assertDatabaseAccess(databaseId, "view");
        const database = await db.wikiDatabase.findUnique({
            where: { id: databaseId },
            select: {
                id: true,
                visibility: true,
                createdById: true,
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, image: true },
                        },
                    },
                },
            },
        });
        return database;
    } catch (error) {
        console.error("getDatabaseSharing error:", error);
        return null;
    }
}

export async function setDatabaseVisibility(args: {
    databaseId: string;
    visibility: ResourceVisibility;
}) {
    try {
        await assertDatabaseAccess(args.databaseId);
        await db.wikiDatabase.update({
            where: { id: args.databaseId },
            data: { visibility: args.visibility },
        });
        revalidatePath(`/databases/${args.databaseId}`);
        revalidatePath("/databases");
        return { success: true };
    } catch (error) {
        console.error("setDatabaseVisibility error:", error);
        return { success: false, error: "Failed to set visibility" };
    }
}

export async function addDatabaseMember(args: {
    databaseId: string;
    userId: string;
    role?: ResourceMemberRole;
}) {
    try {
        await assertDatabaseAccess(args.databaseId);
        await db.wikiDatabaseMember.upsert({
            where: {
                databaseId_userId: {
                    databaseId: args.databaseId,
                    userId: args.userId,
                },
            },
            create: {
                databaseId: args.databaseId,
                userId: args.userId,
                role: args.role ?? ResourceMemberRole.EDITOR,
            },
            update: { role: args.role ?? ResourceMemberRole.EDITOR },
        });
        revalidatePath(`/databases/${args.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("addDatabaseMember error:", error);
        return { success: false, error: "Failed to add member" };
    }
}

export async function transferDatabaseOwnership(args: {
    databaseId: string;
    newOwnerId: string;
}) {
    try {
        const { userId } = await getMe();
        const database = await db.wikiDatabase.findUnique({
            where: { id: args.databaseId },
            select: { id: true, organizationId: true, createdById: true },
        });
        if (!database) return { success: false, error: "Not found" };
        if (database.createdById !== userId) {
            return { success: false, error: "Only the owner can transfer ownership" };
        }
        // Sanity-check the new owner is in the same org
        const newOwner = await db.user.findUnique({
            where: { id: args.newOwnerId },
            include: { memberships: true },
        });
        const sameOrg = newOwner?.memberships.some(
            (m) => m.organizationId === database.organizationId,
        );
        if (!sameOrg) {
            return { success: false, error: "User is not in this organization" };
        }
        await db.$transaction(async (tx) => {
            await tx.wikiDatabase.update({
                where: { id: args.databaseId },
                data: { createdById: args.newOwnerId },
            });
            // Demote previous owner to explicit EDITOR member so they keep
            // edit access on a now-private database.
            await tx.wikiDatabaseMember.upsert({
                where: {
                    databaseId_userId: {
                        databaseId: args.databaseId,
                        userId,
                    },
                },
                create: {
                    databaseId: args.databaseId,
                    userId,
                    role: ResourceMemberRole.EDITOR,
                },
                update: { role: ResourceMemberRole.EDITOR },
            });
            // And remove the new owner from the members list (they're now
            // owner instead).
            await tx.wikiDatabaseMember.deleteMany({
                where: {
                    databaseId: args.databaseId,
                    userId: args.newOwnerId,
                },
            });
        });
        revalidatePath(`/databases/${args.databaseId}`);
        revalidatePath("/databases");
        return { success: true };
    } catch (error) {
        console.error("transferDatabaseOwnership error:", error);
        return { success: false, error: "Failed to transfer ownership" };
    }
}

export async function removeDatabaseMember(args: {
    databaseId: string;
    userId: string;
}) {
    try {
        await assertDatabaseAccess(args.databaseId);
        await db.wikiDatabaseMember.delete({
            where: {
                databaseId_userId: {
                    databaseId: args.databaseId,
                    userId: args.userId,
                },
            },
        });
        revalidatePath(`/databases/${args.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("removeDatabaseMember error:", error);
        return { success: false, error: "Failed to remove member" };
    }
}

export async function setRowContent(args: {
    rowId: string;
    content: Prisma.InputJsonValue;
}) {
    try {
        const row = await db.databaseRow.findUnique({
            where: { id: args.rowId },
            select: { databaseId: true },
        });
        if (!row) return { success: false, error: "Row not found" };
        await assertDatabaseAccess(row.databaseId);
        await db.databaseRow.update({
            where: { id: args.rowId },
            data: { content: args.content },
        });
        revalidatePath(`/databases/${row.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("setRowContent error:", error);
        return { success: false, error: "Failed to save content" };
    }
}

export async function deleteRow(rowId: string) {
    try {
        const row = await db.databaseRow.findUnique({
            where: { id: rowId },
            select: { databaseId: true },
        });
        if (!row) return { success: false, error: "Not found" };
        await assertDatabaseAccess(row.databaseId);
        // Invalidate before "delete" so the join-table walk still finds edges.
        await invalidateRollupCacheForRowChange(rowId);
        await db.databaseRow.update({
            where: { id: rowId },
            data: { deletedAt: new Date() },
        });
        revalidatePath(`/databases/${row.databaseId}`);
        return { success: true };
    } catch (error) {
        console.error("deleteRow error:", error);
        return { success: false, error: "Failed to delete row" };
    }
}
