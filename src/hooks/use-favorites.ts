"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteRecentItem, getFavorites, toggleFavorite, getRecentItems, trackRecentItem } from "@/actions/favorites";

export function useFavorites() {
    return useQuery({
        queryKey: ["favorites"],
        queryFn: () => getFavorites(),
    });
}

export function useToggleFavorite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { itemType: string; itemId: string; itemTitle: string; itemUrl: string }) =>
            toggleFavorite(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
        },
    });
}

export function useRecentItems(limit = 10) {
    return useQuery({
        queryKey: ["recent-items", limit],
        queryFn: () => getRecentItems(limit),
    });
}

export function useTrackRecent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { itemType: string; itemId: string; itemTitle: string; itemUrl: string }) =>
            trackRecentItem(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["recent-items"] });
        },
    });
}

export function useDeleteRecentItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (recentItemId: string) => deleteRecentItem(recentItemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["recent-items"] });
        },
    });
}
