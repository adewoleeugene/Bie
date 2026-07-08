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
    BulkReorderTasksInput,
    bulkReorderTasksSchema,
    createTaskStatusColumnSchema,
    CreateTaskStatusColumnInput,
    deleteTaskStatusColumnSchema,
    DeleteTaskStatusColumnInput,
} from "@/lib/validators/task";
import { Task, ActivityAction, Prisma, NotificationType, TaskStatus, TaskStatusColumn } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { processAutomationRules } from "@/actions/automation";
import { sendNotifications } from "@/lib/notifications";
import { activeMembership } from "@/lib/user-organization";

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
        organizationId: (await activeMembership(user.memberships)).organizationId,
    };
}

const DEFAULT_STATUS_COLUMNS: Array<{ name: string; status: TaskStatus; color: string; sortOrder: number }> = [
    { name: "Backlog", status: "BACKLOG", color: "#858585", sortOrder: 0 },
    { name: "To Do", status: "TODO", color: "#0099ff", sortOrder: 1 },
    { name: "In Progress", status: "IN_PROGRESS", color: "#f6b73c", sortOrder: 2 },
    { name: "In Review", status: "IN_REVIEW", color: "#df5cff", sortOrder: 3 },
    { name: "Done", status: "DONE", color: "#20d990", sortOrder: 4 },
    { name: "Archived", status: "ARCHIVED", color: "#474747", sortOrder: 5 },
];

async function assertProjectScope(projectId: string | null | undefined, organizationId: string) {
    if (!projectId) return null;

    const project = await db.project.findFirst({
        where: { id: projectId, organizationId },
        select: { id: true },
    });

    if (!project) {
        throw new Error("Project not found");
    }

    return project.id;
}

async function ensureTaskStatusColumns(organizationId: string, projectId?: string | null) {
    const scopedProjectId = projectId ?? null;

    const existing = await db.taskStatusColumn.findMany({
        where: { organizationId, projectId: scopedProjectId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    // Self-heal: collapse duplicate default columns that share the same status.
    // Concurrent first-loads could each seed the defaults (there is no unique
    // constraint), producing duplicates that carry a status and therefore can't
    // be removed from the UI. Reassign their tasks to the keeper, then delete.
    const keeperByStatus = new Map<TaskStatus, string>();
    const duplicates: { dupeId: string; keepId: string }[] = [];
    for (const column of existing) {
        if (!column.status) continue;
        const keepId = keeperByStatus.get(column.status);
        if (keepId) {
            duplicates.push({ dupeId: column.id, keepId });
        } else {
            keeperByStatus.set(column.status, column.id);
        }
    }

    if (duplicates.length > 0) {
        await db.$transaction([
            ...duplicates.map(({ dupeId, keepId }) =>
                db.task.updateMany({
                    where: { statusColumnId: dupeId },
                    data: { statusColumnId: keepId },
                })
            ),
            db.taskStatusColumn.deleteMany({
                where: { id: { in: duplicates.map((duplicate) => duplicate.dupeId) } },
            }),
        ]);
    }

    const missingDefaults = DEFAULT_STATUS_COLUMNS.filter(
        (defaultColumn) => !keeperByStatus.has(defaultColumn.status)
    );

    if (missingDefaults.length > 0) {
        await db.taskStatusColumn.createMany({
            data: missingDefaults.map((column) => ({
                ...column,
                organizationId,
                projectId: scopedProjectId,
            })),
        });
    }

    return db.taskStatusColumn.findMany({
        where: { organizationId, projectId: scopedProjectId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
}

async function getColumnForTaskInput(input: { statusColumnId?: string | null; status?: TaskStatus }, organizationId: string, projectId?: string | null) {
    if (input.statusColumnId) {
        const column = await db.taskStatusColumn.findFirst({
            where: {
                id: input.statusColumnId,
                organizationId,
                projectId: projectId ?? null,
            },
        });

        if (!column) {
            throw new Error("Status column not found");
        }

        return column;
    }

    const columns = await ensureTaskStatusColumns(organizationId, projectId);
    const status = input.status ?? "BACKLOG";
    return columns.find((column) => column.status === status) ?? columns[0] ?? null;
}

export async function createTask(
    input: CreateTaskInput
): Promise<ActionResult<Task>> {
    try {
        const validated = createTaskSchema.parse(input);
        const { userId, organizationId } = await getUserOrganization();
        await assertProjectScope(validated.projectId, organizationId);
        const statusColumn = await getColumnForTaskInput(validated, organizationId, validated.projectId);
        const taskStatus = statusColumn?.status ?? validated.status;

        const task = await db.task.create({
            data: {
                title: validated.title,
                description: validated.description || undefined,
                status: taskStatus,
                statusColumnId: statusColumn?.id,
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
                statusColumn: true,
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

        // Notify assigned users
        if (validated.assigneeIds.length > 0) {
            sendNotifications({
                recipientIds: validated.assigneeIds,
                excludeUserId: userId,
                organizationId,
                type: NotificationType.ASSIGNED,
                title: `You were assigned to "${task.title}"`,
                body: task.project ? `Project: ${(task.project as { name: string }).name}` : undefined,
                linkUrl: task.projectId ? `/projects/${task.projectId}/board` : "/dashboard",
            }).catch((e) => console.error("Notification error:", e));
        }

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
        const updateData: Prisma.TaskUncheckedUpdateInput = {};
        let statusColumn: TaskStatusColumn | null = null;
        if (validated.title !== undefined) updateData.title = validated.title;
        if (validated.description !== undefined)
            updateData.description = validated.description;
        if (validated.status !== undefined) updateData.status = validated.status;
        if (validated.statusColumnId !== undefined) {
            const nextProjectId = validated.projectId !== undefined ? validated.projectId : existingTask.projectId;
            statusColumn = await getColumnForTaskInput(
                { statusColumnId: validated.statusColumnId, status: validated.status ?? existingTask.status },
                organizationId,
                nextProjectId
            );
            updateData.statusColumnId = statusColumn?.id ?? null;
            updateData.status = statusColumn?.status ?? validated.status ?? existingTask.status;
        }
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
                statusColumn: true,
                parentTask: true,
            },
        });

        // Create activity log
        let action: ActivityAction = ActivityAction.EDITED;

        if (
            (validated.status !== undefined && existingTask.status !== validated.status) ||
            (validated.statusColumnId !== undefined && existingTask.statusColumnId !== validated.statusColumnId)
        ) {
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

        // Notify newly assigned users
        if (validated.assigneeIds !== undefined) {
            sendNotifications({
                recipientIds: validated.assigneeIds,
                excludeUserId: userId,
                organizationId,
                type: NotificationType.ASSIGNED,
                title: `You were assigned to "${task.title}"`,
                linkUrl: task.projectId ? `/projects/${task.projectId}/board` : "/dashboard",
            }).catch((e) => console.error("Notification error:", e));
        }

        // Trigger Automation Rules (Fire and forget)
        if (task.projectId) {
            if (
                (validated.status !== undefined && existingTask.status !== validated.status) ||
                (validated.statusColumnId !== undefined && existingTask.statusColumnId !== validated.statusColumnId)
            ) {
                processAutomationRules(task.id, task.projectId, "STATUS_CHANGE", task.status, userId).catch(e => console.error(e));
            }
            if (validated.priority !== undefined && existingTask.priority !== validated.priority) {
                processAutomationRules(task.id, task.projectId, "PRIORITY_CHANGE", validated.priority, userId).catch(e => console.error(e));
            }
        }

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

        const reorderData: Prisma.TaskUncheckedUpdateInput = {
            status: validated.status,
            sortOrder: validated.sortOrder,
        };
        if (validated.statusColumnId !== undefined) {
            reorderData.statusColumnId = validated.statusColumnId;
        }

        await db.task.update({
            where: { id: validated.id },
            data: reorderData,
        });

        if (existingTask.status !== validated.status || existingTask.statusColumnId !== validated.statusColumnId) {
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

export async function bulkReorderTasks(
    input: BulkReorderTasksInput
): Promise<ActionResult> {
    try {
        const validated = bulkReorderTasksSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        // Perform updates in a transaction
        await db.$transaction(
            validated.tasks.map((taskInfo) => {
                const data: Prisma.TaskUncheckedUpdateInput = { sortOrder: taskInfo.sortOrder };
                if (taskInfo.status) {
                    data.status = taskInfo.status;
                }
                if (taskInfo.statusColumnId) {
                    data.statusColumnId = taskInfo.statusColumnId;
                }

                return db.task.updateMany({
                    where: { id: taskInfo.id, organizationId },
                    data,
                });
            })
        );

        // Optionally, one could create activity logs here for status changes if needed 
        revalidatePath("/");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Bulk reorder tasks error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reorder tasks",
        };
    }
}

export async function addTasksToSprint(
    input: { sprintId: string; taskIds: string[] }
): Promise<ActionResult<{ count: number }>> {
    try {
        const { organizationId } = await getUserOrganization();

        if (!input.taskIds.length) {
            return { success: false, error: "No tasks selected" };
        }

        const sprint = await db.sprint.findFirst({
            where: { id: input.sprintId, organizationId },
        });

        if (!sprint) {
            return { success: false, error: "Sprint not found" };
        }

        const result = await db.task.updateMany({
            where: { id: { in: input.taskIds }, organizationId },
            data: { sprintId: input.sprintId },
        });

        revalidatePath(`/projects/${sprint.projectId}/board`);
        return { success: true, data: { count: result.count } };
    } catch (error) {
        console.error("Add tasks to sprint error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to add tasks to sprint",
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
                statusColumn: true,
                parentTask: true,
                subtasks: {
                    include: {
                        statusColumn: true,
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

export async function getTaskStatusColumns(projectId?: string | null): Promise<ActionResult<TaskStatusColumn[]>> {
    try {
        const { organizationId } = await getUserOrganization();
        const scopedProjectId = await assertProjectScope(projectId, organizationId);
        const columns = await ensureTaskStatusColumns(organizationId, scopedProjectId);

        return { success: true, data: columns };
    } catch (error) {
        console.error("Get task status columns error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch task status columns",
        };
    }
}

export async function createTaskStatusColumn(
    input: CreateTaskStatusColumnInput
): Promise<ActionResult<TaskStatusColumn>> {
    try {
        const validated = createTaskStatusColumnSchema.parse(input);
        const { organizationId } = await getUserOrganization();
        const scopedProjectId = await assertProjectScope(validated.projectId, organizationId);
        const columns = await ensureTaskStatusColumns(organizationId, scopedProjectId);
        const highestOrder = Math.max(-1, ...columns.map((column) => column.sortOrder));

        const column = await db.taskStatusColumn.create({
            data: {
                name: validated.name,
                sortOrder: highestOrder + 1,
                organizationId,
                projectId: scopedProjectId,
            },
        });

        revalidatePath("/");
        return { success: true, data: column };
    } catch (error) {
        console.error("Create task status column error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create task status column",
        };
    }
}

export async function deleteTaskStatusColumn(
    input: DeleteTaskStatusColumnInput
): Promise<ActionResult> {
    try {
        const validated = deleteTaskStatusColumnSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        const column = await db.taskStatusColumn.findFirst({
            where: { id: validated.id, organizationId },
            include: {
                _count: {
                    select: { tasks: true },
                },
            },
        });

        if (!column) {
            return { success: false, error: "Column not found" };
        }

        if (column.status) {
            return { success: false, error: "Default columns cannot be deleted" };
        }

        if (column._count.tasks > 0) {
            return { success: false, error: "Move tasks out of this column before deleting it" };
        }

        await db.taskStatusColumn.delete({
            where: { id: column.id },
        });

        revalidatePath("/");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete task status column error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete task status column",
        };
    }
}
