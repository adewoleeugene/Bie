import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    startFocusSession,
    endFocusSession,
    logCompletedFocusSession,
    getFocusSessions,
    getActiveFocusSession,
    deleteFocusSession,
    getFocusStats,
    StartFocusSessionInput,
    EndFocusSessionInput,
    LogCompletedFocusSessionInput,
} from "@/actions/focus-sessions";

export function useFocusSessions(options?: { limit?: number; taskId?: string }) {
    return useQuery({
        queryKey: ["focus-sessions", options],
        queryFn: () => getFocusSessions(options),
    });
}

export function useActiveFocusSession() {
    return useQuery({
        queryKey: ["active-focus-session"],
        queryFn: () => getActiveFocusSession(),
        // The timer ticks locally off `startedAt` — the server is only consulted to
        // adopt a session started on another device, which mount + refocus covers.
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });
}

export function useFocusStats() {
    return useQuery({
        queryKey: ["focus-stats"],
        queryFn: () => getFocusStats(),
    });
}

export function useStartFocusSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: StartFocusSessionInput) => startFocusSession(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["active-focus-session"] });
            queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
            queryClient.invalidateQueries({ queryKey: ["focus-stats"] });
        },
    });
}

export function useLogFocusSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: LogCompletedFocusSessionInput) =>
            logCompletedFocusSession(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
            queryClient.invalidateQueries({ queryKey: ["focus-stats"] });
            queryClient.invalidateQueries({ queryKey: ["time-entries"] });
            queryClient.invalidateQueries({ queryKey: ["time-tracking-stats"] });
        },
    });
}

export function useEndFocusSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: EndFocusSessionInput) => endFocusSession(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["active-focus-session"] });
            queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
            queryClient.invalidateQueries({ queryKey: ["focus-stats"] });
            queryClient.invalidateQueries({ queryKey: ["time-entries"] });
            queryClient.invalidateQueries({ queryKey: ["time-tracking-stats"] });
        },
    });
}

export function useDeleteFocusSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionId: string) => deleteFocusSession(sessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
            queryClient.invalidateQueries({ queryKey: ["focus-stats"] });
        },
    });
}
