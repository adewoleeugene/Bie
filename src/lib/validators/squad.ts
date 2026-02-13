import { z } from "zod";

export const createSquadSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    description: z.string().optional(),
    memberIds: z.array(z.string()).default([]),
});

export const updateSquadSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
    description: z.string().optional(),
    memberIds: z.array(z.string()).optional(),
});

export const deleteSquadSchema = z.object({
    id: z.string(),
});

export type CreateSquadInput = z.infer<typeof createSquadSchema>;
export type UpdateSquadInput = z.infer<typeof updateSquadSchema>;
export type DeleteSquadInput = z.infer<typeof deleteSquadSchema>;
