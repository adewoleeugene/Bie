"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import {
    createProjectSchema,
    updateProjectSchema,
    deleteProjectSchema,
    CreateProjectInput,
    UpdateProjectInput,
    DeleteProjectInput,
} from "@/lib/validators/project";
import { Project, ProjectRole, ProjectVisibility } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ensurePersonalWorkspace, selectCurrentMembership } from "@/lib/workspaces";
import { activeMembership } from "@/lib/user-organization";
import {
    canManageProject,
    projectAccessWhere,
    resolveProjectAccess,
} from "@/lib/permissions";

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

    if (!user) {
        throw new Error("No organization found");
    }

    await ensurePersonalWorkspace(db, user);

    const memberships = await db.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: true },
    });
    const currentMembership = await activeMembership(
        memberships,
        selectCurrentMembership(memberships)
    );

    if (!currentMembership) {
        throw new Error("No organization found");
    }

    return {
        userId: user.id,
        organizationId: currentMembership.organizationId,
        role: currentMembership.role,
    };
}

export async function createProject(
    input: CreateProjectInput
): Promise<ActionResult<Project>> {
    try {
        const validated = createProjectSchema.parse(input);
        const { userId, organizationId, role } = await getUserOrganization();

        if (role === "GUEST") {
            return { success: false, error: "Guests cannot create projects" };
        }

        const ownerIds = Array.from(new Set([userId, validated.leadId].filter(Boolean) as string[]));

        const project = await db.project.create({
            data: {
                name: validated.name,
                description: validated.description,
                status: validated.status,
                visibility: validated.visibility,
                organizationId,
                leadId: validated.leadId || null,
                squads: {
                    connect: validated.squadIds?.map((id) => ({ id })) || [],
                },
                members: {
                    create: ownerIds.map((id) => ({
                        userId: id,
                        role: ProjectRole.OWNER,
                    })),
                },
            },
            include: {
                lead: true,
                squads: true,
                _count: {
                    select: { tasks: true },
                },
            },
        });

        revalidatePath("/projects");
        return { success: true, data: project };
    } catch (error) {
        console.error("Create project error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create project",
        };
    }
}

export async function updateProject(
    input: UpdateProjectInput
): Promise<ActionResult<Project>> {
    try {
        const validated = updateProjectSchema.parse(input);
        const { userId, organizationId, role } = await getUserOrganization();

        const existingProject = await db.project.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
            include: {
                members: { select: { userId: true, role: true } },
            },
        });

        if (!existingProject) {
            return { success: false, error: "Project not found" };
        }

        const access = resolveProjectAccess(existingProject, { userId, organizationId, orgRole: role });
        if (!canManageProject(access)) {
            return { success: false, error: "Forbidden" };
        }

        const project = await db.project.update({
            where: { id: validated.id },
            data: {
                name: validated.name,
                description: validated.description,
                status: validated.status,
                visibility: validated.visibility,
                leadId: validated.leadId,
                squads: {
                    set: validated.squadIds?.map((id) => ({ id })) || [],
                },
            },
            include: {
                lead: true,
                squads: true,
                _count: {
                    select: { tasks: true },
                },
            },
        });

        revalidatePath("/projects");
        revalidatePath(`/projects/${validated.id}`);
        return { success: true, data: project };
    } catch (error) {
        console.error("Update project error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update project",
        };
    }
}

export async function deleteProject(
    input: DeleteProjectInput
): Promise<ActionResult> {
    try {
        const validated = deleteProjectSchema.parse(input);
        const { userId, organizationId, role } = await getUserOrganization();

        const existingProject = await db.project.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
            include: {
                members: { select: { userId: true, role: true } },
            },
        });

        if (!existingProject) {
            return { success: false, error: "Project not found" };
        }

        const access = resolveProjectAccess(existingProject, { userId, organizationId, orgRole: role });
        if (!canManageProject(access)) {
            return { success: false, error: "Forbidden" };
        }

        await db.project.delete({
            where: { id: validated.id },
        });

        revalidatePath("/projects");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete project error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete project",
        };
    }
}

export async function getProjects() {
    try {
        const { userId, organizationId, role } = await getUserOrganization();

        const projects = await db.project.findMany({
            where: projectAccessWhere({ userId, organizationId, orgRole: role }),
            include: {
                lead: {
                    select: { id: true, name: true, image: true }
                },
                squads: {
                    select: { id: true, name: true }
                },
                sprints: {
                    where: { status: "ACTIVE" },
                    take: 1,
                    select: { id: true, name: true }
                },
                _count: {
                    select: { tasks: true },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return projects;
    } catch (error) {
        console.error("Get projects error:", error);
        return [];
    }
}

export async function getProject(id: string) {
    try {
        const { userId, organizationId, role } = await getUserOrganization();

        const project = await db.project.findFirst({
            where: {
                id,
                ...projectAccessWhere({ userId, organizationId, orgRole: role }),
            },
            include: {
                lead: {
                    select: { id: true, name: true, image: true, email: true }
                },
                squads: {
                    include: {
                        members: {
                            include: {
                                user: { select: { id: true, name: true, image: true } }
                            }
                        }
                    }
                },
                sprints: {
                    where: { status: "ACTIVE" },
                    take: 1,
                    include: {
                        tasks: {
                            select: { id: true, status: true }
                        }
                    }
                },
                _count: {
                    select: { tasks: true },
                },
                members: {
                    include: {
                        user: { select: { id: true, name: true, image: true, email: true } },
                    },
                    orderBy: { joinedAt: "asc" },
                },
            },
        });

        if (!project) return null;

        // Fetch Task Statistics
        const taskStats = await db.task.groupBy({
            by: ['status'],
            where: {
                projectId: id,
            },
            _count: {
                _all: true,
            },
        });

        // Fetch Recent Activity
        const recentActivity = await db.taskActivity.findMany({
            where: {
                task: {
                    projectId: id,
                },
            },
            include: {
                user: {
                    select: { id: true, name: true, image: true },
                },
                task: {
                    select: { id: true, title: true },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 5,
        });

        return {
            ...project,
            accessLevel: resolveProjectAccess(project, { userId, organizationId, orgRole: role }),
            taskStats,
            recentActivity,
            activeSprint: project.sprints[0] || null,
        };
    } catch (error) {
        console.error("Get project error:", error);
        return null;
    }
}

async function getManageableProject(projectId: string) {
    const { userId, organizationId, role } = await getUserOrganization();
    const project = await db.project.findFirst({
        where: { id: projectId, organizationId },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, email: true, image: true } },
                },
                orderBy: { joinedAt: "asc" },
            },
        },
    });

    if (!project) throw new Error("Project not found");

    const access = resolveProjectAccess(project, { userId, organizationId, orgRole: role });
    if (!canManageProject(access)) throw new Error("Forbidden");

    return { project, userId, organizationId, role };
}

export async function listProjectSharing(projectId: string) {
    try {
        const { project, userId, organizationId, role } = await getManageableProject(projectId);
        return {
            success: true,
            data: {
                visibility: project.visibility,
                members: project.members,
                accessLevel: resolveProjectAccess(project, { userId, organizationId, orgRole: role }),
            },
        };
    } catch (error) {
        console.error("List project sharing error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to load sharing" };
    }
}

export async function setProjectVisibility(
    projectId: string,
    visibility: ProjectVisibility,
): Promise<ActionResult> {
    try {
        await getManageableProject(projectId);

        await db.project.update({
            where: { id: projectId },
            data: { visibility },
        });

        revalidatePath("/projects");
        revalidatePath(`/projects/${projectId}`);
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Set project visibility error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update visibility" };
    }
}

export async function updateProjectMemberRole(
    projectId: string,
    targetUserId: string,
    role: ProjectRole,
): Promise<ActionResult> {
    try {
        const { project } = await getManageableProject(projectId);
        const target = project.members.find((member) => member.userId === targetUserId);
        if (!target) return { success: false, error: "Project member not found" };

        await db.projectMember.update({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId,
                },
            },
            data: { role },
        });

        revalidatePath(`/projects/${projectId}`);
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Update project member role error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update member" };
    }
}

export async function removeProjectMember(
    projectId: string,
    targetUserId: string,
): Promise<ActionResult> {
    try {
        const { project } = await getManageableProject(projectId);
        const target = project.members.find((member) => member.userId === targetUserId);
        if (!target) return { success: false, error: "Project member not found" };

        const ownerCount = project.members.filter((member) => member.role === ProjectRole.OWNER).length;
        if (target.role === ProjectRole.OWNER && ownerCount <= 1) {
            return { success: false, error: "A project must keep at least one owner" };
        }

        await db.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId,
                },
            },
        });

        revalidatePath(`/projects/${projectId}`);
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Remove project member error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to remove member" };
    }
}
