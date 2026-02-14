import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";

export const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required").max(255, "Title is too long"),
    description: z.any().optional(),
    status: z.nativeEnum(TaskStatus).default("BACKLOG"),
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

export const reorderTaskSchema = z.object({
    id: z.string(),
    status: z.nativeEnum(TaskStatus),
    sortOrder: z.number().int().nonnegative(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
