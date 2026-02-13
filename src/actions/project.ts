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
import { Project } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

export async function createProject(
    input: CreateProjectInput
): Promise<ActionResult<Project>> {
    try {
        const validated = createProjectSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        const project = await db.project.create({
            data: {
                name: validated.name,
                description: validated.description,
                status: validated.status,
                organizationId,
                leadId: validated.leadId || null,
                squadId: validated.squadId || null,
            },
            include: {
                lead: true,
                squad: true,
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
        const { organizationId } = await getUserOrganization();

        const existingProject = await db.project.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingProject) {
            return { success: false, error: "Project not found" };
        }

        const project = await db.project.update({
            where: { id: validated.id },
            data: {
                name: validated.name,
                description: validated.description,
                status: validated.status,
                leadId: validated.leadId,
                squadId: validated.squadId,
            },
            include: {
                lead: true,
                squad: true,
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
        const { organizationId } = await getUserOrganization();

        const existingProject = await db.project.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingProject) {
            return { success: false, error: "Project not found" };
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
        const { organizationId } = await getUserOrganization();

        const projects = await db.project.findMany({
            where: {
                organizationId,
            },
            include: {
                lead: {
                    select: { id: true, name: true, image: true }
                },
                squad: {
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
        const { organizationId } = await getUserOrganization();

        const project = await db.project.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                lead: {
                    select: { id: true, name: true, image: true, email: true }
                },
                squad: {
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
            taskStats,
            recentActivity,
            activeSprint: project.sprints[0] || null,
        };
    } catch (error) {
        console.error("Get project error:", error);
        return null;
    }
}
