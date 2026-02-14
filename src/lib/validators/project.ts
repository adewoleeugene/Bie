import { z } from "zod";
import { ProjectStatus } from "@prisma/client";

export const createProjectSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().optional(),
    status: z.nativeEnum(ProjectStatus).default("ACTIVE"),
    leadId: z.string().optional(),
    squadIds: z.array(z.string()).optional().default([]),
});

export const updateProjectSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required").max(100).optional(),
    description: z.string().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    leadId: z.string().nullable().optional(),
    squadIds: z.array(z.string()).optional(),
});

export const deleteProjectSchema = z.object({
    id: z.string(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
