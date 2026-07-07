"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
    AccessRequestStatus,
    MentionTargetType,
    NotificationType,
    OrgRole,
    ResourceMemberRole,
    ResourceVisibility,
    WikiNamespace,
} from "@prisma/client";
import { extractMentions, newlyAddedTargets } from "@/lib/wiki-mentions";
import { sendNotifications } from "@/lib/notifications";
import { canView, resolveAccess, resolveInheritedAccess } from "@/lib/permissions";
import { loadPageAccessChain } from "@/lib/wiki-access";

const createWikiPageSchema = z.object({
    title: z.string().min(1, "Title is required"),
    content: z.any().optional(),
    namespace: z.nativeEnum(WikiNamespace),
    organizationId: z.string(),
    projectId: z.string().optional(),
    parentPageId: z.string().optional(),
    template: z.boolean().optional(),
    isFolder: z.boolean().optional(),
});

const updateWikiPageSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required").optional(),
    icon: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    content: z.any().optional(),
    parentPageId: z.string().nullable().optional(),
    published: z.boolean().optional(),
    slug: z.string().min(3).regex(/^[a-z0-0-]+$/, "Slug must be lowercase alphanumeric with hyphens").nullable().optional(),
    allowDuplicate: z.boolean().optional(),
    disallowIndexing: z.boolean().optional(),
});

export async function createWikiPage(data: z.infer<typeof createWikiPageSchema>) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const validated = createWikiPageSchema.parse(data);

        // Get the highest sort order for pages at this level
        const lastPage = await db.wikiPage.findFirst({
            where: {
                organizationId: validated.organizationId,
                parentPageId: validated.parentPageId || null,
            },
            orderBy: { sortOrder: "desc" },
        });

        const page = await db.wikiPage.create({
            data: {
                title: validated.title,
                content: validated.content || null,
                namespace: validated.namespace,
                organizationId: validated.organizationId,
                projectId: validated.projectId || null,
                parentPageId: validated.parentPageId || null,
                authorId: user.id,
                template: validated.template || false,
                isFolder: validated.isFolder || false,
                sortOrder: (lastPage?.sortOrder || 0) + 1,
            },
            include: {
                author: true,
                childPages: true,
            },
        });

        // Create initial version
        await db.wikiPageVersion.create({
            data: {
                pageId: page.id,
                content: validated.content || {},
                editedById: user.id,
            },
        });

        revalidatePath("/wiki");
        revalidatePath(`/projects/${validated.projectId}/wiki`);

        return { success: true, data: page };
    } catch (error) {
        console.error("Error creating wiki page:", error);
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return { success: false, error: "Failed to create wiki page" };
    }
}

export async function updateWikiPage(data: z.infer<typeof updateWikiPageSchema>) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const validated = updateWikiPageSchema.parse(data);

        const existingPage = await db.wikiPage.findUnique({
            where: { id: validated.id },
        });

        if (!existingPage) {
            return { success: false, error: "Page not found" };
        }

        const updateData: any = {};
        if (validated.title !== undefined) updateData.title = validated.title;
        if (validated.icon !== undefined) updateData.icon = validated.icon;
        if (validated.coverImage !== undefined) updateData.coverImage = validated.coverImage;
        if (validated.content !== undefined) updateData.content = validated.content;
        if (validated.parentPageId !== undefined) {
            updateData.parentPageId = validated.parentPageId;
        }
        if (validated.published !== undefined) updateData.published = validated.published;
        if (validated.slug !== undefined) updateData.slug = validated.slug;
        if (validated.allowDuplicate !== undefined) updateData.allowDuplicate = validated.allowDuplicate;
        if (validated.disallowIndexing !== undefined) updateData.disallowIndexing = validated.disallowIndexing;

        const page = await db.wikiPage.update({
            where: { id: validated.id },
            data: updateData,
            include: {
                author: true,
                childPages: true,
            },
        });

        // Create version if content changed
        if (validated.content !== undefined) {
            await db.wikiPageVersion.create({
                data: {
                    pageId: page.id,
                    content: validated.content,
                    editedById: user.id,
                },
            });

            // Recompute mentions for this page.
            const previousMentions = await db.wikiMention.findMany({
                where: { sourcePageId: page.id },
            });
            const next = extractMentions(validated.content);

            await db.$transaction([
                db.wikiMention.deleteMany({ where: { sourcePageId: page.id } }),
                ...(next.length > 0
                    ? [
                          db.wikiMention.createMany({
                              data: next.map((m) => ({
                                  sourcePageId: page.id,
                                  targetType: m.targetType,
                                  targetId: m.targetId,
                                  blockId: m.blockId,
                              })),
                          }),
                      ]
                    : []),
            ]);

            // Notify newly mentioned users (don't notify the editor).
            const newUserIds = newlyAddedTargets(
                previousMentions.map((m) => ({
                    targetType: m.targetType,
                    targetId: m.targetId,
                    blockId: m.blockId,
                })),
                next,
                MentionTargetType.USER,
            );
            if (newUserIds.length > 0) {
                sendNotifications({
                    recipientIds: newUserIds,
                    excludeUserId: user.id,
                    organizationId: existingPage.organizationId,
                    type: NotificationType.MENTION,
                    title: `You were mentioned in "${page.title}"`,
                    linkUrl: `/wiki/${page.id}`,
                }).catch((e) => console.error("Mention notification error:", e));
            }

            // @@ everyone — notify all org members if a new EVERYONE mention appeared.
            const previouslyHadEveryone = previousMentions.some(
                (m) => m.targetType === MentionTargetType.EVERYONE,
            );
            const nowHasEveryone = next.some(
                (m) => m.targetType === MentionTargetType.EVERYONE,
            );
            if (nowHasEveryone && !previouslyHadEveryone) {
                const memberships = await db.organizationMember.findMany({
                    where: { organizationId: existingPage.organizationId },
                    select: { userId: true },
                });
                sendNotifications({
                    recipientIds: memberships.map((m) => m.userId),
                    excludeUserId: user.id,
                    organizationId: existingPage.organizationId,
                    type: NotificationType.MENTION,
                    title: `@everyone in "${page.title}"`,
                    linkUrl: `/wiki/${page.id}`,
                }).catch((e) => console.error("Everyone mention error:", e));
            }
        }

        revalidatePath("/wiki");
        if (existingPage.projectId) {
            revalidatePath(`/projects/${existingPage.projectId}/wiki`);
        }
        revalidatePath("/published-wiki");
        revalidatePath(`/published-wiki/${page.id}`);

        return { success: true, data: page };
    } catch (error) {
        console.error("Error updating wiki page:", error);
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update wiki page"
        };
    }
}

export async function deleteWikiPage(id: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const page = await db.wikiPage.findUnique({
            where: { id },
        });

        if (!page) {
            return { success: false, error: "Page not found" };
        }

        await db.wikiPage.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        revalidatePath("/wiki");
        revalidatePath(`/projects/${page.projectId}/wiki`);

        return { success: true };
    } catch (error) {
        console.error("Error deleting wiki page:", error);
        return { success: false, error: "Failed to delete wiki page" };
    }
}

export async function getDeletedWikiPages() {
    try {
        const session = await auth();
        if (!session?.user?.email) return [];
        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });
        if (!user || user.memberships.length === 0) return [];
        const orgId = user.memberships[0].organizationId;
        return db.wikiPage.findMany({
            where: { organizationId: orgId, deletedAt: { not: null } },
            include: { author: true },
            orderBy: { deletedAt: "desc" },
        });
    } catch (error) {
        console.error("getDeletedWikiPages error:", error);
        return [];
    }
}

export async function restoreWikiPage(pageId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Unauthorized" };
        await db.wikiPage.update({
            where: { id: pageId },
            data: { deletedAt: null },
        });
        revalidatePath("/wiki");
        revalidatePath("/wiki/trash");
        return { success: true };
    } catch (error) {
        console.error("restoreWikiPage error:", error);
        return { success: false, error: "Failed to restore" };
    }
}

export async function permanentlyDeleteWikiPage(pageId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Unauthorized" };
        await db.wikiPage.delete({ where: { id: pageId } });
        revalidatePath("/wiki/trash");
        return { success: true };
    } catch (error) {
        console.error("permanentlyDeleteWikiPage error:", error);
        return { success: false, error: "Failed to permanently delete" };
    }
}

export async function trackWikiPageView(pageId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) return;
        const user = await db.user.findUnique({ where: { email: session.user.email } });
        if (!user) return;
        // Don't count the page's own author viewing their page.
        const page = await db.wikiPage.findUnique({
            where: { id: pageId },
            select: { authorId: true },
        });
        if (page?.authorId === user.id) return;
        await db.wikiPageAnalytics.create({
            data: { pageId, userId: user.id },
        });
    } catch {
        // Silent — analytics should never break the page
    }
}

export async function getWikiPageAnalytics(pageId: string) {
    try {
        // Exclude the page author so the count reflects other viewers only.
        const page = await db.wikiPage.findUnique({
            where: { id: pageId },
            select: { authorId: true },
        });
        const where = page?.authorId
            ? { pageId, userId: { not: page.authorId } }
            : { pageId };
        const totalViews = await db.wikiPageAnalytics.count({
            where,
        });
        const uniqueViewers = await db.wikiPageAnalytics.groupBy({
            by: ["userId"],
            where,
        });
        const lastView = await db.wikiPageAnalytics.findFirst({
            where,
            orderBy: { viewedAt: "desc" },
            include: { user: { select: { name: true, image: true } } },
        });
        const recentViewers = await db.wikiPageAnalytics.findMany({
            where,
            orderBy: { viewedAt: "desc" },
            distinct: ["userId"],
            take: 5,
            include: { user: { select: { id: true, name: true, image: true } } },
        });
        return {
            totalViews,
            uniqueViewers: uniqueViewers.length,
            lastViewedAt: lastView?.viewedAt || null,
            lastViewedBy: lastView?.user || null,
            recentViewers: recentViewers.map((v: any) => ({
                ...v.user,
                viewedAt: v.viewedAt,
            })),
        };
    } catch (error) {
        console.error("getWikiPageAnalytics error:", error);
        return { totalViews: 0, uniqueViewers: 0, lastViewedAt: null, lastViewedBy: null, recentViewers: [] };
    }
}

export async function duplicateWikiPage(pageId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }
        const user = await db.user.findUnique({
            where: { email: session.user.email },
        });
        if (!user) return { success: false, error: "User not found" };

        const source = await db.wikiPage.findUnique({ where: { id: pageId } });
        if (!source) return { success: false, error: "Page not found" };

        const lastPage = await db.wikiPage.findFirst({
            where: {
                organizationId: source.organizationId,
                parentPageId: source.parentPageId,
            },
            orderBy: { sortOrder: "desc" },
        });

        const copy = await db.wikiPage.create({
            data: {
                title: `${source.title} (copy)`,
                content: source.content ?? undefined,
                namespace: source.namespace,
                organizationId: source.organizationId,
                projectId: source.projectId,
                parentPageId: source.parentPageId,
                authorId: user.id,
                sortOrder: (lastPage?.sortOrder ?? 0) + 1,
                icon: source.icon ?? null,
                coverImage: source.coverImage ?? null,
            },
            include: { author: true, childPages: true },
        });

        await db.wikiPageVersion.create({
            data: {
                pageId: copy.id,
                content: source.content || {},
                editedById: user.id,
            },
        });

        revalidatePath("/wiki");
        return { success: true, data: copy };
    } catch (error) {
        console.error("Error duplicating wiki page:", error);
        return { success: false, error: "Failed to duplicate page" };
    }
}

export async function getWikiPages(organizationId: string, namespace?: WikiNamespace, projectId?: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        // Resolve current user so we can hide pages the viewer can't access.
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!me) {
            return { success: false, error: "Unauthorized" };
        }

        const where: any = {
            organizationId,
            deletedAt: null,
            // Visibility filter: ORG visibility is open; PRIVATE pages are
            // visible only to the author or explicit members.
            OR: [
                { visibility: ResourceVisibility.ORG },
                { authorId: me.id },
                { members: { some: { userId: me.id } } },
            ],
        };
        if (namespace) where.namespace = namespace;
        if (projectId) where.projectId = projectId;

        const pages = await db.wikiPage.findMany({
            where,
            include: {
                author: true,
                childPages: {
                    include: {
                        author: true,
                    },
                },
            },
            orderBy: [{ parentPageId: "asc" }, { sortOrder: "asc" }],
        });

        return { success: true, data: pages };
    } catch (error) {
        console.error("Error fetching wiki pages:", error);
        return { success: false, error: "Failed to fetch wiki pages" };
    }
}

export async function getWikiPage(id: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const page = await db.wikiPage.findUnique({
            where: { id },
            include: {
                author: true,
                childPages: {
                    include: {
                        author: true,
                    },
                },
                parentPage: true,
                members: { select: { userId: true, role: true } },
                versions: {
                    include: {
                        editedBy: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 20,
                },
            },
        });

        if (!page || page.deletedAt) {
            return { success: false, error: "Page not found" };
        }

        // Permission gate
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });
        if (!me || me.memberships.length === 0) {
            return { success: false, error: "Unauthorized" };
        }
        const access = resolveAccess(
            {
                visibility: page.visibility,
                organizationId: page.organizationId,
                creatorId: page.authorId,
                members: page.members,
            },
            {
                userId: me.id,
                organizationId: me.memberships[0].organizationId,
                orgRole: me.memberships[0].role,
            },
        );
        if (!canView(access)) {
            return { success: false, error: "Access denied" };
        }

        return { success: true, data: page };
    } catch (error) {
        console.error("Error fetching wiki page:", error);
        return { success: false, error: "Failed to fetch wiki page" };
    }
}

// ─── Search Wiki Pages ───────────────────────────────────

export async function searchWikiPages(query: string, organizationId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized", data: [] };
        }

        if (!query || query.length < 2) {
            return { success: true, data: [] };
        }

        const pages = await db.wikiPage.findMany({
            where: {
                organizationId,
                title: { contains: query, mode: "insensitive" },
            },
            select: {
                id: true,
                title: true,
                namespace: true,
                projectId: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 20,
        });

        return { success: true, data: pages };
    } catch (error) {
        console.error("Search wiki pages error:", error);
        return { success: false, error: "Failed to search", data: [] };
    }
}

// ─── Reorder Wiki Pages ──────────────────────────────────

export async function reorderWikiPages(
    pages: { id: string; sortOrder: number; parentPageId?: string | null }[]
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        await db.$transaction(
            pages.map((p) =>
                db.wikiPage.update({
                    where: { id: p.id },
                    data: {
                        sortOrder: p.sortOrder,
                        ...(p.parentPageId !== undefined ? { parentPageId: p.parentPageId } : {}),
                    },
                })
            )
        );

        revalidatePath("/wiki");
        return { success: true };
    } catch (error) {
        console.error("Reorder wiki pages error:", error);
        return { success: false, error: "Failed to reorder" };
    }
}

// ─── Restore Wiki Page Version ───────────────────────────

export async function restoreWikiPageVersion(pageId: string, versionId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
        });
        if (!user) return { success: false, error: "User not found" };

        const version = await db.wikiPageVersion.findUnique({
            where: { id: versionId },
        });

        if (!version || version.pageId !== pageId) {
            return { success: false, error: "Version not found" };
        }

        // Update the page content
        const page = await db.wikiPage.update({
            where: { id: pageId },
            data: { content: version.content as any },
        });

        // Create a new version record for the restore
        await db.wikiPageVersion.create({
            data: {
                pageId,
                content: version.content as any,
                editedById: user.id,
            },
        });

        revalidatePath("/wiki");
        revalidatePath(`/wiki/${pageId}`);
        return { success: true, data: page };
    } catch (error) {
        console.error("Restore wiki version error:", error);
        return { success: false, error: "Failed to restore version" };
    }
}

// ─── Mention search (for @-suggestion menu) ─────────────

export async function searchMentionTargets(query: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { users: [], pages: [] };
        }

        const me = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });
        if (!me || me.memberships.length === 0) {
            return { users: [], pages: [] };
        }
        const organizationId = me.memberships[0].organizationId;

        const q = (query || "").trim();

        const memberships = await db.organizationMember.findMany({
            where: {
                organizationId,
                user: q
                    ? {
                          OR: [
                              { name: { contains: q, mode: "insensitive" } },
                              { email: { contains: q, mode: "insensitive" } },
                          ],
                      }
                    : undefined,
            },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
            },
            take: 8,
        });

        const pages = await db.wikiPage.findMany({
            where: {
                organizationId,
                ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
            },
            select: { id: true, title: true },
            orderBy: { updatedAt: "desc" },
            take: 8,
        });

        return {
            users: memberships.map((m) => m.user),
            pages,
        };
    } catch (error) {
        console.error("Search mention targets error:", error);
        return { users: [], pages: [] };
    }
}

// ─── Mentions OF a target (for user/date pages) ──────────

export async function getPagesMentioning(
    targetType: "USER" | "DATE",
    targetId: string,
) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, data: [] };

        const me = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });
        if (!me || me.memberships.length === 0) {
            return { success: false, data: [] };
        }
        const organizationId = me.memberships[0].organizationId;

        const mentions = await db.wikiMention.findMany({
            where: {
                targetType: targetType as MentionTargetType,
                targetId,
                sourcePage: { organizationId },
            },
            include: {
                sourcePage: {
                    select: {
                        id: true,
                        title: true,
                        namespace: true,
                        projectId: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const seen = new Set<string>();
        const data = mentions
            .filter((m) => {
                if (seen.has(m.sourcePageId)) return false;
                seen.add(m.sourcePageId);
                return true;
            })
            .map((m) => m.sourcePage);

        return { success: true, data };
    } catch (error) {
        console.error("getPagesMentioning error:", error);
        return { success: false, data: [] };
    }
}

// ─── Backlinks ───────────────────────────────────────────

export async function getWikiBacklinks(pageId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized", data: [] };
        }

        const mentions = await db.wikiMention.findMany({
            where: {
                targetType: MentionTargetType.WIKI_PAGE,
                targetId: pageId,
            },
            include: {
                sourcePage: {
                    select: {
                        id: true,
                        title: true,
                        namespace: true,
                        projectId: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Deduplicate by source page (one entry per linking page).
        const seen = new Set<string>();
        const data = mentions
            .filter((m) => {
                if (seen.has(m.sourcePageId)) return false;
                seen.add(m.sourcePageId);
                return true;
            })
            .map((m) => m.sourcePage);

        return { success: true, data };
    } catch (error) {
        console.error("Get wiki backlinks error:", error);
        return { success: false, error: "Failed to fetch backlinks", data: [] };
    }
}

export async function getWikiTemplates(organizationId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const templates = await db.wikiPage.findMany({
            where: {
                organizationId,
                template: true,
            },
            include: {
                author: true,
            },
            orderBy: {
                title: "asc",
            },
        });

        return { success: true, data: templates };
    } catch (error) {
        console.error("Error fetching wiki templates:", error);
        return { success: false, error: "Failed to fetch wiki templates" };
    }
}

// ─── Wiki page sharing ───────────────────────────────────

async function assertPageEditAccess(pageId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const me = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });
    if (!me || me.memberships.length === 0) throw new Error("Unauthorized");
    const page = await db.wikiPage.findUnique({
        where: { id: pageId },
        select: {
            id: true,
            organizationId: true,
            authorId: true,
            visibility: true,
            members: { select: { userId: true, role: true } },
        },
    });
    if (!page) throw new Error("Page not found");
    // Edit access inherits from ancestor folders too, so a folder shared with
    // edit rights lets you edit the docs inside it.
    const chain = await loadPageAccessChain(page.id);
    const access = resolveInheritedAccess(chain, {
        userId: me.id,
        organizationId: me.memberships[0].organizationId,
        orgRole: me.memberships[0].role,
    });
    if (access !== "edit") throw new Error("Access denied");
    return { userId: me.id, page };
}

export async function getWikiPageSharing(pageId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) return null;
        // Reuse getWikiPage's read check by going through the DB directly +
        // resolveAccess for "view".
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });
        if (!me || me.memberships.length === 0) return null;
        const page = await db.wikiPage.findUnique({
            where: { id: pageId },
            select: {
                id: true,
                visibility: true,
                authorId: true,
                organizationId: true,
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, image: true },
                        },
                    },
                },
            },
        });
        if (!page) return null;
        const access = resolveAccess(
            {
                visibility: page.visibility,
                organizationId: page.organizationId,
                creatorId: page.authorId,
                members: page.members.map((m) => ({
                    userId: m.userId,
                    role: m.role,
                })),
            },
            {
                userId: me.id,
                organizationId: me.memberships[0].organizationId,
                orgRole: me.memberships[0].role,
            },
        );
        if (!canView(access)) return null;
        return page;
    } catch (error) {
        console.error("getWikiPageSharing error:", error);
        return null;
    }
}

export async function setWikiPageVisibility(args: {
    pageId: string;
    visibility: ResourceVisibility;
}) {
    try {
        await assertPageEditAccess(args.pageId);
        await db.wikiPage.update({
            where: { id: args.pageId },
            data: { visibility: args.visibility },
        });
        revalidatePath(`/wiki/${args.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("setWikiPageVisibility error:", error);
        return { success: false, error: "Failed to set visibility" };
    }
}

export async function addWikiPageMember(args: {
    pageId: string;
    userId: string;
    role?: ResourceMemberRole;
}) {
    try {
        await assertPageEditAccess(args.pageId);
        await db.wikiPageMember.upsert({
            where: {
                pageId_userId: { pageId: args.pageId, userId: args.userId },
            },
            create: {
                pageId: args.pageId,
                userId: args.userId,
                role: args.role ?? ResourceMemberRole.EDITOR,
            },
            update: { role: args.role ?? ResourceMemberRole.EDITOR },
        });
        revalidatePath(`/wiki/${args.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("addWikiPageMember error:", error);
        return { success: false, error: "Failed to add member" };
    }
}

export async function transferWikiPageOwnership(args: {
    pageId: string;
    newOwnerId: string;
}) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Unauthorized" };
        const me = await db.user.findUnique({
            where: { email: session.user.email },
        });
        if (!me) return { success: false, error: "Unauthorized" };
        const page = await db.wikiPage.findUnique({
            where: { id: args.pageId },
            select: { id: true, organizationId: true, authorId: true },
        });
        if (!page) return { success: false, error: "Not found" };
        if (page.authorId !== me.id) {
            return { success: false, error: "Only the owner can transfer ownership" };
        }
        const newOwner = await db.user.findUnique({
            where: { id: args.newOwnerId },
            include: { memberships: true },
        });
        const sameOrg = newOwner?.memberships.some(
            (m) => m.organizationId === page.organizationId,
        );
        if (!sameOrg) {
            return { success: false, error: "User is not in this organization" };
        }
        await db.$transaction(async (tx) => {
            await tx.wikiPage.update({
                where: { id: args.pageId },
                data: { authorId: args.newOwnerId },
            });
            await tx.wikiPageMember.upsert({
                where: {
                    pageId_userId: { pageId: args.pageId, userId: me.id },
                },
                create: {
                    pageId: args.pageId,
                    userId: me.id,
                    role: ResourceMemberRole.EDITOR,
                },
                update: { role: ResourceMemberRole.EDITOR },
            });
            await tx.wikiPageMember.deleteMany({
                where: { pageId: args.pageId, userId: args.newOwnerId },
            });
        });
        revalidatePath(`/wiki/${args.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("transferWikiPageOwnership error:", error);
        return { success: false, error: "Failed to transfer ownership" };
    }
}

export async function removeWikiPageMember(args: {
    pageId: string;
    userId: string;
}) {
    try {
        await assertPageEditAccess(args.pageId);
        await db.wikiPageMember.delete({
            where: {
                pageId_userId: { pageId: args.pageId, userId: args.userId },
            },
        });
        revalidatePath(`/wiki/${args.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("removeWikiPageMember error:", error);
        return { success: false, error: "Failed to remove member" };
    }
}

// ─── Wiki page "request edit access" (Google-Docs style) ─────────────

/**
 * A view-only (or no-access) user asks the page owner for access. Creates or
 * re-opens a PENDING request and notifies the owner + org admins, who can
 * approve (granting a role of their choice) or deny.
 */
export async function requestWikiPageEditAccess(args: {
    pageId: string;
    message?: string;
}) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Unauthorized" };
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });
        if (!me || me.memberships.length === 0) {
            return { success: false, error: "Unauthorized" };
        }
        const page = await db.wikiPage.findUnique({
            where: { id: args.pageId },
            select: {
                id: true,
                title: true,
                organizationId: true,
                authorId: true,
                visibility: true,
                members: { select: { userId: true, role: true } },
            },
        });
        if (!page) return { success: false, error: "Page not found" };
        if (page.organizationId !== me.memberships[0].organizationId) {
            return { success: false, error: "Page not found" };
        }

        const chain = await loadPageAccessChain(page.id);
        const access = resolveInheritedAccess(chain, {
            userId: me.id,
            organizationId: me.memberships[0].organizationId,
            orgRole: me.memberships[0].role,
        });
        if (access === "edit") {
            return { success: false, error: "You already have edit access" };
        }

        await db.wikiPageAccessRequest.upsert({
            where: { pageId_userId: { pageId: page.id, userId: me.id } },
            create: {
                pageId: page.id,
                userId: me.id,
                message: args.message?.trim() || null,
                status: AccessRequestStatus.PENDING,
            },
            // Re-open a previously denied/approved request.
            update: {
                message: args.message?.trim() || null,
                status: AccessRequestStatus.PENDING,
            },
        });

        // Notify the owner + org admins/owners, who are the people able to grant.
        const admins = await db.organizationMember.findMany({
            where: {
                organizationId: page.organizationId,
                role: { in: [OrgRole.ADMIN, OrgRole.OWNER] },
            },
            select: { userId: true },
        });
        const recipientIds = Array.from(
            new Set([page.authorId, ...admins.map((a) => a.userId)]),
        );
        const requesterName = me.name || me.email || "Someone";
        sendNotifications({
            recipientIds,
            excludeUserId: me.id,
            organizationId: page.organizationId,
            type: NotificationType.ACCESS_REQUEST,
            title: `${requesterName} requested access to "${page.title}"`,
            body: args.message?.trim() || undefined,
            linkUrl: `/wiki/${page.id}`,
        }).catch((e) => console.error("Access request notification error:", e));

        revalidatePath(`/wiki/${page.id}`);
        return { success: true };
    } catch (error) {
        console.error("requestWikiPageEditAccess error:", error);
        return { success: false, error: "Failed to request access" };
    }
}

/** Owner/admin (anyone with edit access) lists the page's pending requests. */
export async function getWikiPageAccessRequests(pageId: string) {
    try {
        await assertPageEditAccess(pageId);
        return await db.wikiPageAccessRequest.findMany({
            where: { pageId, status: AccessRequestStatus.PENDING },
            include: {
                user: {
                    select: { id: true, name: true, email: true, image: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });
    } catch (error) {
        console.error("getWikiPageAccessRequests error:", error);
        return [];
    }
}

/** Approve a pending request, granting the requester the chosen role. */
export async function approveWikiPageAccessRequest(args: {
    requestId: string;
    role: ResourceMemberRole;
}) {
    try {
        const request = await db.wikiPageAccessRequest.findUnique({
            where: { id: args.requestId },
            include: { page: { select: { id: true, title: true, organizationId: true } } },
        });
        if (!request) return { success: false, error: "Request not found" };
        await assertPageEditAccess(request.pageId);

        await db.$transaction([
            db.wikiPageMember.upsert({
                where: {
                    pageId_userId: {
                        pageId: request.pageId,
                        userId: request.userId,
                    },
                },
                create: {
                    pageId: request.pageId,
                    userId: request.userId,
                    role: args.role,
                },
                update: { role: args.role },
            }),
            db.wikiPageAccessRequest.update({
                where: { id: request.id },
                data: { status: AccessRequestStatus.APPROVED },
            }),
        ]);

        sendNotifications({
            recipientIds: [request.userId],
            organizationId: request.page.organizationId,
            type: NotificationType.ACCESS_GRANTED,
            title: `You were granted access to "${request.page.title}"`,
            linkUrl: `/wiki/${request.pageId}`,
        }).catch((e) => console.error("Access granted notification error:", e));

        revalidatePath(`/wiki/${request.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("approveWikiPageAccessRequest error:", error);
        return { success: false, error: "Failed to approve request" };
    }
}

/** Deny a pending request. */
export async function denyWikiPageAccessRequest(args: { requestId: string }) {
    try {
        const request = await db.wikiPageAccessRequest.findUnique({
            where: { id: args.requestId },
            select: { id: true, pageId: true },
        });
        if (!request) return { success: false, error: "Request not found" };
        await assertPageEditAccess(request.pageId);
        await db.wikiPageAccessRequest.update({
            where: { id: request.id },
            data: { status: AccessRequestStatus.DENIED },
        });
        revalidatePath(`/wiki/${request.pageId}`);
        return { success: true };
    } catch (error) {
        console.error("denyWikiPageAccessRequest error:", error);
        return { success: false, error: "Failed to deny request" };
    }
}
