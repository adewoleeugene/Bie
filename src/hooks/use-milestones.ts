"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMilestones, createMilestone, updateMilestone, deleteMilestone } from "@/actions/milestones";
import { MilestoneStatus } from "@prisma/client";

export function useMilestones(projectId: string) {
    return useQuery({
        queryKey: ["milestones", projectId],
        queryFn: () => getMilestones(projectId),
        staleTime: 60_000,
    });
}

export function useCreateMilestone(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { title: string; description?: string; dueDate: string; projectId: string }) =>
            createMilestone(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });
        },
    });
}

export function useUpdateMilestone(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ milestoneId, data }: { milestoneId: string; data: { title?: string; description?: string; dueDate?: string; status?: MilestoneStatus } }) =>
            updateMilestone(milestoneId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });
        },
    });
}

export function useDeleteMilestone(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (milestoneId: string) => deleteMilestone(milestoneId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["milestones", projectId] });
        },
    });
}
