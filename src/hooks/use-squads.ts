"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSquads, getSquad, createSquad, updateSquad, deleteSquad } from "@/actions/squads";
import { CreateSquadInput, UpdateSquadInput, DeleteSquadInput } from "@/lib/validators/squad";
import { toast } from "sonner";

export function useSquads() {
    return useQuery({
        queryKey: ["squads"],
        queryFn: () => getSquads(),
    });
}

export function useSquad(id: string) {
    return useQuery({
        queryKey: ["squad", id],
        queryFn: () => getSquad(id),
        enabled: !!id,
    });
}

export function useCreateSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateSquadInput) => createSquad(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["squads"] });
                toast.success("Squad created successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to create squad");
        },
    });
}

export function useUpdateSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateSquadInput) => updateSquad(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["squads"] });
                if (result.data) {
                    queryClient.invalidateQueries({ queryKey: ["squad", result.data.id] });
                }
                toast.success("Squad updated successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to update squad");
        },
    });
}

export function useDeleteSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: DeleteSquadInput) => deleteSquad(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["squads"] });
                toast.success("Squad deleted successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to delete squad");
        },
    });
}
