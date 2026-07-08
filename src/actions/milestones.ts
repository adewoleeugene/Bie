"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { MilestoneStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { activeMembership } from "@/lib/user-organization";

async function getUserOrganization() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) throw new Error("No organization");
    return { userId: user.id, organizationId: (await activeMembership(user.memberships)).organizationId };
}

export async function createMilestone(data: {
    title: string;
    description?: string;
    dueDate: string;
    projectId: string;
}) {
    try {
        const { organizationId } = await getUserOrganization();

        const milestone = await db.milestone.create({
            data: {
                title: data.title,
                description: data.description || null,
                dueDate: new Date(data.dueDate),
                projectId: data.projectId,
                organizationId,
            },
        });

        revalidatePath(`/projects/${data.projectId}`);
        return { success: true, data: milestone };
    } catch (error) {
        console.error("Create milestone error:", error);
        return { success: false, error: "Failed to create milestone" };
    }
}

export async function getMilestones(projectId: string) {
    try {
        const { organizationId } = await getUserOrganization();

        return await db.milestone.findMany({
            where: { projectId, organizationId },
            orderBy: { dueDate: "asc" },
        });
    } catch (error) {
        console.error("Get milestones error:", error);
        return [];
    }
}

export async function updateMilestone(
    milestoneId: string,
    data: { title?: string; description?: string; dueDate?: string; status?: MilestoneStatus }
) {
    try {
        await getUserOrganization();

        const milestone = await db.milestone.update({
            where: { id: milestoneId },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
                ...(data.status ? { status: data.status } : {}),
            },
        });

        revalidatePath(`/projects/${milestone.projectId}`);
        return { success: true, data: milestone };
    } catch (error) {
        console.error("Update milestone error:", error);
        return { success: false, error: "Failed to update milestone" };
    }
}

export async function deleteMilestone(milestoneId: string) {
    try {
        await getUserOrganization();

        const milestone = await db.milestone.delete({
            where: { id: milestoneId },
        });

        revalidatePath(`/projects/${milestone.projectId}`);
        return { success: true };
    } catch (error) {
        console.error("Delete milestone error:", error);
        return { success: false, error: "Failed to delete milestone" };
    }
}
