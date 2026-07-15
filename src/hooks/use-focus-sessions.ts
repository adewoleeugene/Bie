import { useEffect, useSyncExternalStore } from "react";
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

const ACTIVE_SESSION_HINT = "focus-session-active";

/**
 * Records in localStorage that this browser has a session running, so the timer
 * — which mounts in the top nav on every page — can stay silent instead of
 * asking the server whether one exists. Survives reloads, which is the case
 * that matters: a session started, then the page navigated or refreshed.
 */
function readActiveSessionHint(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ACTIVE_SESSION_HINT) === "1";
}

function writeActiveSessionHint(active: boolean) {
    if (typeof window === "undefined") return;
    if (active) localStorage.setItem(ACTIVE_SESSION_HINT, "1");
    else localStorage.removeItem(ACTIVE_SESSION_HINT);
}

// The hint only changes via this module, and every writer already re-renders the
// timer through its own state, so there's nothing to subscribe to.
const noopSubscribe = () => () => {};

/** Reads the hint without tripping SSR — the server always sees "no session". */
export function useActiveSessionHint(): boolean {
    return useSyncExternalStore(noopSubscribe, readActiveSessionHint, () => false);
}

export function useFocusSessions(options?: { limit?: number; taskId?: string }) {
    return useQuery({
        queryKey: ["focus-sessions", options],
        queryFn: () => getFocusSessions(options),
    });
}

/**
 * Resolves the running session so the timer can adopt it after a reload.
 *
 * The countdown ticks locally off `startedAt`, so this never needs to poll.
 * Callers pass `enabled` to keep it from firing at all unless there's reason to
 * believe a session exists — see `useActiveSessionHint`.
 */
export function useActiveFocusSession(options?: { enabled?: boolean }) {
    const query = useQuery({
        queryKey: ["active-focus-session"],
        queryFn: () => getActiveFocusSession(),
        enabled: options?.enabled ?? true,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });

    // Self-heal a hint left behind by a session that ended on another device or
    // a tab that closed mid-session, so it can't strand us fetching forever.
    const { isSuccess, data } = query;
    useEffect(() => {
        if (isSuccess && !data) writeActiveSessionHint(false);
    }, [isSuccess, data]);

    return query;
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
        onSuccess: (result) => {
            if (result.success) writeActiveSessionHint(true);
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
            writeActiveSessionHint(false);
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
            writeActiveSessionHint(false);
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
