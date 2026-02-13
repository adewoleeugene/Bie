"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { WikiNamespace } from "@prisma/client";

const createWikiPageSchema = z.object({
    title: z.string().min(1, "Title is required"),
    content: z.any().optional(),
    namespace: z.nativeEnum(WikiNamespace),
    organizationId: z.string(),
    projectId: z.string().optional(),
    parentPageId: z.string().optional(),
    template: z.boolean().optional(),
});

const updateWikiPageSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required").optional(),
    content: z.any().optional(),
    parentPageId: z.string().nullable().optional(),
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
        if (validated.content !== undefined) updateData.content = validated.content;
        if (validated.parentPageId !== undefined) {
            updateData.parentPageId = validated.parentPageId;
        }

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
        }

        revalidatePath("/wiki");
        revalidatePath(`/projects/${existingPage.projectId}/wiki`);

        return { success: true, data: page };
    } catch (error) {
        console.error("Error updating wiki page:", error);
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return { success: false, error: "Failed to update wiki page" };
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

        await db.wikiPage.delete({
            where: { id },
        });

        revalidatePath("/wiki");
        revalidatePath(`/projects/${page.projectId}/wiki`);

        return { success: true };
    } catch (error) {
        console.error("Error deleting wiki page:", error);
        return { success: false, error: "Failed to delete wiki page" };
    }
}

export async function getWikiPages(organizationId: string, namespace?: WikiNamespace, projectId?: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const where: any = { organizationId };
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

        if (!page) {
            return { success: false, error: "Page not found" };
        }

        return { success: true, data: page };
    } catch (error) {
        console.error("Error fetching wiki page:", error);
        return { success: false, error: "Failed to fetch wiki page" };
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
