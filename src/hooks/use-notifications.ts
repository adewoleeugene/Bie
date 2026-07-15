"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
} from "@/actions/notifications";

/**
 * The notification list. Callers pass `enabled` so the rows are only pulled
 * while the panel showing them is actually open — the bell renders nothing from
 * this list when closed, and the unread badge comes from `useUnreadCount`.
 */
export function useNotifications(limit = 20, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["notifications", limit],
        queryFn: () => getNotifications(limit),
        enabled: options?.enabled ?? true,
        refetchInterval: 30_000,
    });
}

export function useUnreadCount() {
    return useQuery({
        queryKey: ["notifications-unread-count"],
        queryFn: () => getUnreadCount(),
        // A minute-stale badge is imperceptible, and refocusing the tab — the
        // moment you'd actually look at it — refetches immediately.
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
}

export function useMarkRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (notificationId: string) => markNotificationRead(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        },
    });
}

export function useMarkAllRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => markAllNotificationsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        },
    });
}
