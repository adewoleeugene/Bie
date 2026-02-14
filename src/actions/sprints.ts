"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import {
    createSprintSchema,
    updateSprintSchema,
    deleteSprintSchema,
    CreateSprintInput,
    UpdateSprintInput,
    DeleteSprintInput
} from "@/lib/validators/sprint";
import { Sprint, SprintStatus } from "@prisma/client";
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

export async function createSprint(
    input: CreateSprintInput
): Promise<ActionResult<Sprint>> {
    try {
        const validated = createSprintSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        if (validated.status === "ACTIVE") {
            const hasActiveSprint = await db.sprint.findFirst({
                where: {
                    projectId: validated.projectId,
                    organizationId,
                    status: "ACTIVE",
                },
            });

            if (hasActiveSprint) {
                return { success: false, error: "Project already has an active sprint" };
            }
        }

        const sprint = await db.sprint.create({
            data: {
                name: validated.name,
                goal: validated.goal,
                startDate: new Date(validated.startDate),
                endDate: new Date(validated.endDate),
                status: validated.status,
                projectId: validated.projectId,
                organizationId,
            },
        });

        revalidatePath(`/projects/${validated.projectId}`);
        return { success: true, data: sprint };
    } catch (error) {
        console.error("Create sprint error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create sprint",
        };
    }
}

export async function updateSprint(
    input: UpdateSprintInput
): Promise<ActionResult<Sprint>> {
    try {
        const validated = updateSprintSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        const existingSprint = await db.sprint.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingSprint) {
            return { success: false, error: "Sprint not found" };
        }

        if (validated.status === "ACTIVE" && existingSprint.status !== "ACTIVE") {
            const projectId = validated.projectId || existingSprint.projectId;
            const hasActiveSprint = await db.sprint.findFirst({
                where: {
                    projectId: projectId,
                    organizationId,
                    status: "ACTIVE",
                    id: { not: validated.id },
                },
            });

            if (hasActiveSprint) {
                return { success: false, error: "Project already has an active sprint" };
            }
        }

        const sprint = await db.sprint.update({
            where: { id: validated.id },
            data: {
                name: validated.name,
                goal: validated.goal,
                startDate: validated.startDate ? new Date(validated.startDate) : undefined,
                endDate: validated.endDate ? new Date(validated.endDate) : undefined,
                status: validated.status,
                projectId: validated.projectId,
            },
        });

        revalidatePath(`/projects/${sprint.projectId}`);
        return { success: true, data: sprint };
    } catch (error) {
        console.error("Update sprint error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update sprint",
        };
    }
}

export async function deleteSprint(
    input: DeleteSprintInput
): Promise<ActionResult> {
    try {
        const validated = deleteSprintSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        const existingSprint = await db.sprint.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingSprint) {
            return { success: false, error: "Sprint not found" };
        }

        await db.sprint.delete({
            where: { id: validated.id },
        });

        revalidatePath(`/projects/${existingSprint.projectId}`);
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete sprint error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete sprint",
        };
    }
}

export async function getSprints(projectId?: string) {
    try {
        const { organizationId } = await getUserOrganization();

        const sprints = await db.sprint.findMany({
            where: {
                organizationId,
                ...(projectId ? { projectId } : {}),
            },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                _count: {
                    select: {
                        tasks: true
                    }
                }
            },
            orderBy: {
                endDate: "desc",
            },
        });

        return sprints;
    } catch (error) {
        console.error("Get sprints error:", error);
        return [];
    }
}

export async function getSprint(id: string) {
    try {
        const { organizationId } = await getUserOrganization();

        const sprint = await db.sprint.findFirst({
            where: {
                id,
                organizationId
            },
            include: {
                tasks: {
                    include: {
                        assignees: { include: { user: true } }
                    }
                }
            }
        });

        return sprint;
    } catch (error) {
        console.error("Get sprint error:", error);
        return null;
    }
}

export async function completeSprint(
    input: { id: string }
): Promise<ActionResult<Sprint>> {
    try {
        const { organizationId } = await getUserOrganization();

        const existingSprint = await db.sprint.findFirst({
            where: {
                id: input.id,
                organizationId,
            },
        });

        if (!existingSprint) {
            return { success: false, error: "Sprint not found" };
        }

        // Archive all DONE tasks in this sprint
        await db.task.updateMany({
            where: {
                sprintId: input.id,
                status: "DONE",
            },
            data: {
                status: "ARCHIVED",
            },
        });

        // Incomplete tasks remain in their current state, still linked to this sprint

        // Mark sprint as completed
        const sprint = await db.sprint.update({
            where: { id: input.id },
            data: {
                status: "COMPLETED",
            },
        });

        revalidatePath(`/projects/${sprint.projectId}`);
        return { success: true, data: sprint };
    } catch (error) {
        console.error("Complete sprint error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to complete sprint",
        };
    }
}
