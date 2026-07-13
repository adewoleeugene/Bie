import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";

export const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required").max(255, "Title is too long"),
    description: z.any().optional(),
    status: z.nativeEnum(TaskStatus).default("BACKLOG"),
    statusColumnId: z.string().optional(),
    priority: z.nativeEnum(TaskPriority).default("P2"),
    projectId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
    parentTaskId: z.string().nullable().optional(),
    // Allow any string for dates from form, validate/transform later
    dueDate: z.string().optional(),
    startDate: z.string().optional(),
    estimatedHours: z.number().optional(),
    assigneeIds: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
});

export const updateTaskSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required").max(255, "Title is too long").optional(),
    description: z.any().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    statusColumnId: z.string().nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    projectId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    estimatedHours: z.number().positive().nullable().optional(),
    assigneeIds: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
});

export const deleteTaskSchema = z.object({
    id: z.string(),
});

export const duplicateTaskSchema = z.object({
    id: z.string(),
});

export const reorderTaskSchema = z.object({
    id: z.string(),
    status: z.nativeEnum(TaskStatus),
    statusColumnId: z.string().optional(),
    sortOrder: z.number().int().nonnegative(),
});

export const bulkReorderTasksSchema = z.object({
    tasks: z.array(z.object({
        id: z.string(),
        status: z.nativeEnum(TaskStatus).optional(),
        statusColumnId: z.string().optional(),
        sortOrder: z.number().int().nonnegative(),
    }))
});

export const createTaskStatusColumnSchema = z.object({
    name: z.string().trim().min(1, "Column name is required").max(80, "Column name is too long"),
    projectId: z.string().nullable().optional(),
});

export const deleteTaskStatusColumnSchema = z.object({
    id: z.string(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;
export type DuplicateTaskInput = z.infer<typeof duplicateTaskSchema>;
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
export type BulkReorderTasksInput = z.infer<typeof bulkReorderTasksSchema>;
export type CreateTaskStatusColumnInput = z.infer<typeof createTaskStatusColumnSchema>;
export type DeleteTaskStatusColumnInput = z.infer<typeof deleteTaskStatusColumnSchema>;
