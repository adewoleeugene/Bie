"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSprints, getSprint, createSprint, updateSprint, deleteSprint, completeSprint } from "@/actions/sprints";
import { CreateSprintInput, UpdateSprintInput, DeleteSprintInput } from "@/lib/validators/sprint";
import { toast } from "sonner";

export function useSprints(projectId?: string) {
    return useQuery({
        queryKey: ["sprints", projectId || "all"],
        queryFn: () => getSprints(projectId),
    });
}

export function useSprint(id: string) {
    return useQuery({
        queryKey: ["sprint", id],
        queryFn: () => getSprint(id),
        enabled: !!id,
    });
}

export function useCreateSprint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateSprintInput) => createSprint(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["sprints"] });
                toast.success("Sprint created successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to create sprint");
        },
    });
}

export function useUpdateSprint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateSprintInput) => updateSprint(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["sprints"] });
                if (result.data) {
                    queryClient.invalidateQueries({ queryKey: ["sprint", result.data.id] });
                }
                toast.success("Sprint updated successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to update sprint");
        },
    });
}

export function useDeleteSprint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: DeleteSprintInput) => deleteSprint(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["sprints"] });
                toast.success("Sprint deleted successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to delete sprint");
        },
    });
}

export function useCompleteSprint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { id: string }) => completeSprint(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["sprints"] });
                queryClient.invalidateQueries({ queryKey: ["sprint"] });
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Sprint completed successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to complete sprint");
        },
    });
}
