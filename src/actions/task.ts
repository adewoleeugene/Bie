"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import {
    createTaskSchema,
    updateTaskSchema,
    deleteTaskSchema,
    reorderTaskSchema,
    CreateTaskInput,
    UpdateTaskInput,
    DeleteTaskInput,
    ReorderTaskInput,
} from "@/lib/validators/task";
import { Task, ActivityAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Helper to get user's organization
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

export async function createTask(
    input: CreateTaskInput
): Promise<ActionResult<Task>> {
    try {
        const validated = createTaskSchema.parse(input);
        const { userId, organizationId } = await getUserOrganization();

        const task = await db.task.create({
            data: {
                title: validated.title,
                description: validated.description || undefined,
                status: validated.status,
                priority: validated.priority,
                projectId: validated.projectId || null,
                sprintId: validated.sprintId || null,
                parentTaskId: validated.parentTaskId || null,
                dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
                startDate: validated.startDate ? new Date(validated.startDate) : null,
                estimatedHours: validated.estimatedHours || null,
                labels: validated.labels,
                organizationId,
                assignees: {
                    create: validated.assigneeIds.map((userId) => ({
                        userId,
                    })),
                },
            },
            include: {
                assignees: {
                    include: {
                        user: true,
                    },
                },
                project: true,
                parentTask: true,
            },
        });

        await db.taskActivity.create({
            data: {
                taskId: task.id,
                userId,
                action: ActivityAction.EDITED, // Using EDITED for creation as CREATED is not in enum
                metadata: { isCreation: true },
            },
        });

        revalidatePath("/");
        return { success: true, data: task };
    } catch (error) {
        console.error("Create task error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create task",
        };
    }
}

export async function updateTask(
    input: UpdateTaskInput
): Promise<ActionResult<Task>> {
    try {
        const validated = updateTaskSchema.parse(input);
        const { userId, organizationId } = await getUserOrganization(); // Added userId here

        // Verify task belongs to user's organization
        const existingTask = await db.task.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingTask) {
            return { success: false, error: "Task not found" };
        }

        // Prepare update data
        const updateData: any = {};
        if (validated.title !== undefined) updateData.title = validated.title;
        if (validated.description !== undefined)
            updateData.description = validated.description;
        if (validated.status !== undefined) updateData.status = validated.status;
        if (validated.priority !== undefined)
            updateData.priority = validated.priority;
        if (validated.projectId !== undefined)
            updateData.projectId = validated.projectId;
        if (validated.sprintId !== undefined)
            updateData.sprintId = validated.sprintId;
        if (validated.dueDate !== undefined)
            updateData.dueDate = validated.dueDate
                ? new Date(validated.dueDate)
                : null;
        if (validated.startDate !== undefined)
            updateData.startDate = validated.startDate
                ? new Date(validated.startDate)
                : null;
        if (validated.estimatedHours !== undefined)
            updateData.estimatedHours = validated.estimatedHours;
        if (validated.labels !== undefined) updateData.labels = validated.labels;

        // Handle assignees separately
        if (validated.assigneeIds !== undefined) {
            await db.taskAssignee.deleteMany({
                where: { taskId: validated.id },
            });
            await db.taskAssignee.createMany({
                data: validated.assigneeIds.map((userId) => ({
                    taskId: validated.id,
                    userId,
                })),
            });
        }

        const task = await db.task.update({
            where: { id: validated.id },
            data: updateData,
            include: {
                assignees: {
                    include: {
                        user: true,
                    },
                },
                project: true,
                parentTask: true,
            },
        });

        // Create activity log
        let action: ActivityAction = ActivityAction.EDITED;

        if (validated.status !== undefined && existingTask.status !== validated.status) {
            action = ActivityAction.STATUS_CHANGE;
        } else if (validated.assigneeIds !== undefined) {
            action = ActivityAction.ASSIGNED;
        }

        // Only create activity if something significant changed (status, assignees, or generic edit)
        // For strictness, we might want to skip if nothing changed, but here likely something did.
        await db.taskActivity.create({
            data: {
                taskId: validated.id,
                userId,
                action,
            },
        });

        revalidatePath("/");
        return { success: true, data: task };
    } catch (error) {
        console.error("Update task error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update task",
        };
    }
}

export async function deleteTask(
    input: DeleteTaskInput
): Promise<ActionResult> {
    try {
        const validated = deleteTaskSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        // Verify task belongs to user's organization
        const existingTask = await db.task.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingTask) {
            return { success: false, error: "Task not found" };
        }

        await db.task.delete({
            where: { id: validated.id },
        });

        revalidatePath("/");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete task error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete task",
        };
    }
}

export async function reorderTask(
    input: ReorderTaskInput
): Promise<ActionResult> {
    try {
        const validated = reorderTaskSchema.parse(input);
        const { userId, organizationId } = await getUserOrganization();

        // Verify task belongs to user's organization
        const existingTask = await db.task.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingTask) {
            return { success: false, error: "Task not found" };
        }

        await db.task.update({
            where: { id: validated.id },
            data: {
                status: validated.status,
                sortOrder: validated.sortOrder,
            },
        });

        if (existingTask.status !== validated.status) {
            await db.taskActivity.create({
                data: {
                    taskId: validated.id,
                    userId,
                    action: ActivityAction.STATUS_CHANGE,
                },
            });
        }

        revalidatePath("/");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Reorder task error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reorder task",
        };
    }
}

export async function getTasks(projectId?: string | null, options?: { sprintId?: string | null }) {
    try {
        const { organizationId } = await getUserOrganization();

        // If sprintId is specifically null (for backlog), filter for it
        // If sprintId is undefined, don't filter by sprintId
        // If filters are provided, combine them

        const where: Prisma.TaskWhereInput = { organizationId };

        // Handle projectId filter: 
        // If projectId is generic string, filter by it.
        // If projectId is explicitly null, filter for tasks with NO project.
        // If projectId is undefined, return ALL tasks (ignore project filter).
        if (projectId !== undefined) {
            where.projectId = projectId;
        }

        if (options?.sprintId !== undefined) where.sprintId = options.sprintId;

        const tasks = await db.task.findMany({
            where,
            include: {
                assignees: {
                    include: {
                        user: true,
                    },
                },
                project: true,
                sprint: true,
                parentTask: true,
                subtasks: {
                    include: {
                        assignees: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        });

        console.log(`[getTasks] Fetched ${tasks.length} tasks for Org: ${organizationId}, Project: ${projectId || 'ALL'}, Sprint: ${options?.sprintId === null ? 'NULL' : options?.sprintId || 'ANY'}`);

        return tasks;
    } catch (error) {
        console.error("Get tasks error:", error);
        return [];
    }
}
