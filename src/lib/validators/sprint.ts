import { z } from "zod";
import { SprintStatus } from "@prisma/client";

export const createSprintSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    goal: z.string().optional(),
    startDate: z.string().datetime(), // Expect ISO string
    endDate: z.string().datetime(),
    status: z.nativeEnum(SprintStatus).default("PLANNING"),
    projectId: z.string(),
});

export const updateSprintSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required").max(100).optional(),
    goal: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z.nativeEnum(SprintStatus).optional(),
    projectId: z.string().optional(),
});

export const deleteSprintSchema = z.object({
    id: z.string(),
});

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
export type DeleteSprintInput = z.infer<typeof deleteSprintSchema>;
