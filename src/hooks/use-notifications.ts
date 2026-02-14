"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
} from "@/actions/notifications";

export function useNotifications(limit = 20) {
    return useQuery({
        queryKey: ["notifications", limit],
        queryFn: () => getNotifications(limit),
        refetchInterval: 30000, // Poll every 30 seconds
    });
}

export function useUnreadCount() {
    return useQuery({
        queryKey: ["notifications-unread-count"],
        queryFn: () => getUnreadCount(),
        refetchInterval: 15000, // Poll every 15 seconds
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
