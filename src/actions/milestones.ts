"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { MilestoneStatus, OrgRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { activeMembership } from "@/lib/user-organization";
import { canEdit, projectAccessWhere, resolveProjectAccess } from "@/lib/permissions";

type MilestoneViewer = { userId: string; organizationId: string; role: OrgRole };

async function getUserOrganization() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) throw new Error("No organization");
    const membership = await activeMembership(user.memberships);
    return { userId: user.id, organizationId: membership.organizationId, role: membership.role };
}

async function assertProjectEdit(projectId: string, viewer: MilestoneViewer) {
    const project = await db.project.findFirst({
        where: { id: projectId, organizationId: viewer.organizationId },
        select: {
            id: true,
            visibility: true,
            organizationId: true,
            leadId: true,
            members: { select: { userId: true, role: true } },
        },
    });
    if (!project) throw new Error("Project not found");
    const access = resolveProjectAccess(project, {
        userId: viewer.userId,
        organizationId: viewer.organizationId,
        orgRole: viewer.role,
    });
    if (!canEdit(access)) throw new Error("Forbidden");
}

export async function createMilestone(data: {
    title: string;
    description?: string;
    dueDate: string;
    projectId: string;
}) {
    try {
        const viewer = await getUserOrganization();
        const { organizationId } = viewer;
        await assertProjectEdit(data.projectId, viewer);

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
        const { userId, organizationId, role } = await getUserOrganization();

        return await db.milestone.findMany({
            where: {
                projectId,
                organizationId,
                project: projectAccessWhere({ userId, organizationId, orgRole: role }),
            },
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
        const viewer = await getUserOrganization();
        const existing = await db.milestone.findFirst({
            where: {
                id: milestoneId,
                organizationId: viewer.organizationId,
                project: projectAccessWhere({
                    userId: viewer.userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
            select: { id: true, projectId: true },
        });

        if (!existing) return { success: false, error: "Milestone not found" };
        await assertProjectEdit(existing.projectId, viewer);

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
        const viewer = await getUserOrganization();
        const existing = await db.milestone.findFirst({
            where: {
                id: milestoneId,
                organizationId: viewer.organizationId,
                project: projectAccessWhere({
                    userId: viewer.userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
            select: { id: true, projectId: true },
        });

        if (!existing) return { success: false, error: "Milestone not found" };
        await assertProjectEdit(existing.projectId, viewer);

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
