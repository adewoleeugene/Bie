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
import { OrgRole, Sprint, SprintStatus, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { activeMembership } from "@/lib/user-organization";
import {
    canManage,
    projectAccessWhere,
    resolveProjectAccess,
    taskAccessWhere,
} from "@/lib/permissions";

type SprintViewer = { userId: string; organizationId: string; role: OrgRole };

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

    const membership = await activeMembership(user.memberships);

    return {
        userId: user.id,
        organizationId: membership.organizationId,
        role: membership.role,
    };
}

// Sprint planning (create/rename/fill/complete) is reserved for people who
// manage the project — owners, admins, the lead — not everyone who can edit
// tasks. Invitees see the sprint exactly as its creator shaped it.
async function assertProjectManage(projectId: string, viewer: SprintViewer) {
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

    if (!canManage(access)) throw new Error("Forbidden");

    return project;
}

export async function createSprint(
    input: CreateSprintInput
): Promise<ActionResult<Sprint>> {
    try {
        const validated = createSprintSchema.parse(input);
        const viewer = await getUserOrganization();
        const { organizationId } = viewer;

        await assertProjectManage(validated.projectId, viewer);

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
        const viewer = await getUserOrganization();
        const { organizationId } = viewer;

        const existingSprint = await db.sprint.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingSprint) {
            return { success: false, error: "Sprint not found" };
        }

        await assertProjectManage(existingSprint.projectId, viewer);
        if (validated.projectId && validated.projectId !== existingSprint.projectId) {
            await assertProjectManage(validated.projectId, viewer);
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
        const viewer = await getUserOrganization();
        const { organizationId } = viewer;

        const existingSprint = await db.sprint.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingSprint) {
            return { success: false, error: "Sprint not found" };
        }

        await assertProjectManage(existingSprint.projectId, viewer);

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
        const { userId, organizationId, role } = await getUserOrganization();

        const sprints = await db.sprint.findMany({
            where: {
                organizationId,
                ...(projectId ? { projectId } : {}),
                project: projectAccessWhere({ userId, organizationId, orgRole: role }),
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
        const { userId, organizationId, role } = await getUserOrganization();

        const sprint = await db.sprint.findFirst({
            where: {
                id,
                organizationId,
                project: projectAccessWhere({ userId, organizationId, orgRole: role }),
            },
            include: {
                tasks: {
                    where: taskAccessWhere({ userId, organizationId, orgRole: role }),
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
    input: { id: string; carryOver?: "next" | "backlog" | "leave" }
): Promise<ActionResult<Sprint>> {
    try {
        const viewer = await getUserOrganization();
        const { organizationId } = viewer;

        const existingSprint = await db.sprint.findFirst({
            where: {
                id: input.id,
                organizationId,
            },
        });

        if (!existingSprint) {
            return { success: false, error: "Sprint not found" };
        }

        await assertProjectManage(existingSprint.projectId, viewer);

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

        // Carry over incomplete tasks (anything not DONE/ARCHIVED) based on choice.
        // "leave" (default) keeps them linked to this now-completed sprint.
        const carryOver = input.carryOver ?? "leave";
        if (carryOver !== "leave") {
            let targetSprintId: string | null = null; // null => Backlog
            if (carryOver === "next") {
                // Prefer another active sprint; otherwise the earliest planned sprint.
                const nextSprint =
                    (await db.sprint.findFirst({
                        where: {
                            projectId: existingSprint.projectId,
                            organizationId,
                            id: { not: input.id },
                            status: "ACTIVE",
                        },
                        orderBy: { startDate: "asc" },
                    })) ??
                    (await db.sprint.findFirst({
                        where: {
                            projectId: existingSprint.projectId,
                            organizationId,
                            id: { not: input.id },
                            status: "PLANNING",
                        },
                        orderBy: { startDate: "asc" },
                    }));
                targetSprintId = nextSprint?.id ?? null; // fall back to Backlog if none
            }

            await db.task.updateMany({
                where: {
                    sprintId: input.id,
                    status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
                },
                data: { sprintId: targetSprintId },
            });
        }

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
