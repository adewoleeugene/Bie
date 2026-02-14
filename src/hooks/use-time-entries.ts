import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    getTimeEntries,
    getTimeTrackingStats,
    CreateTimeEntryInput,
    UpdateTimeEntryInput,
} from "@/actions/time-entries";

export function useTimeEntries(options?: {
    taskId?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
}) {
    return useQuery({
        queryKey: ["time-entries", options],
        queryFn: () => getTimeEntries(options),
    });
}

export function useTimeTrackingStats() {
    return useQuery({
        queryKey: ["time-tracking-stats"],
        queryFn: () => getTimeTrackingStats(),
    });
}

export function useCreateTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateTimeEntryInput) => createTimeEntry(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["time-entries"] });
            queryClient.invalidateQueries({ queryKey: ["time-tracking-stats"] });
        },
    });
}

export function useUpdateTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateTimeEntryInput) => updateTimeEntry(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["time-entries"] });
            queryClient.invalidateQueries({ queryKey: ["time-tracking-stats"] });
        },
    });
}

export function useDeleteTimeEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (entryId: string) => deleteTimeEntry(entryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["time-entries"] });
            queryClient.invalidateQueries({ queryKey: ["time-tracking-stats"] });
        },
    });
}
