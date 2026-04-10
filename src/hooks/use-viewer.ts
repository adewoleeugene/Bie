"use client";

import { useQuery } from "@tanstack/react-query";
import { getViewerUserId } from "@/actions/viewer";

/**
 * Returns the current viewer's `User.id`. Cached for the session.
 * Used by share dialogs to know which UI elements (e.g. transfer-ownership)
 * to show.
 */
export function useViewerUserId(): string | undefined {
    const { data } = useQuery({
        queryKey: ["viewer-id"],
        queryFn: getViewerUserId,
        staleTime: 60 * 60 * 1000,
    });
    return data ?? undefined;
}
