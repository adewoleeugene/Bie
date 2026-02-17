"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createTemplateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    content: z.any(),
    organizationId: z.string(),
});

export async function createWikiTemplate(data: z.infer<typeof createTemplateSchema>) {
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

        const validated = createTemplateSchema.parse(data);

        const template = await db.wikiTemplate.create({
            data: {
                name: validated.name,
                description: validated.description,
                content: validated.content,
                organizationId: validated.organizationId,
                authorId: user.id,
            },
        });

        revalidatePath("/wiki");
        return { success: true, data: template };
    } catch (error) {
        console.error("Error creating template:", error);
        return { success: false, error: "Failed to create template" };
    }
}

export async function getWikiTemplates(organizationId: string) {
    try {
        const templates = await db.wikiTemplate.findMany({
            where: { organizationId },
            include: {
                author: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: templates };
    } catch (error) {
        console.error("Error fetching templates:", error);
        return { success: false, error: "Failed to fetch templates" };
    }
}

export async function deleteWikiTemplate(id: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Unauthorized" };

        await db.wikiTemplate.delete({
            where: { id },
        });

        revalidatePath("/wiki");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete template" };
    }
}
