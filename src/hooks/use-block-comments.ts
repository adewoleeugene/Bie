"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listBlockComments,
    createBlockComment,
    resolveBlockComment,
    deleteBlockComment,
} from "@/actions/block-comments";
import { toast } from "sonner";

const key = (pageId: string) => ["block-comments", pageId] as const;

export function useBlockComments(pageId: string | undefined) {
    return useQuery({
        queryKey: pageId ? key(pageId) : ["block-comments", "none"],
        queryFn: () => (pageId ? listBlockComments(pageId) : Promise.resolve([])),
        enabled: !!pageId,
    });
}

export function useCreateBlockComment(pageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: { blockId: string; body: string; parentCommentId?: string }) =>
            createBlockComment({ pageId, ...args }),
        onSuccess: (result) => {
            if (result?.success) {
                qc.invalidateQueries({ queryKey: key(pageId) });
            } else {
                toast.error(result?.error || "Failed to comment");
            }
        },
    });
}

export function useResolveBlockComment(pageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ commentId, resolved }: { commentId: string; resolved: boolean }) =>
            resolveBlockComment(commentId, resolved),
        onSuccess: () => qc.invalidateQueries({ queryKey: key(pageId) }),
    });
}

export function useDeleteBlockComment(pageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (commentId: string) => deleteBlockComment(commentId),
        onSuccess: (result) => {
            if (result?.success) {
                qc.invalidateQueries({ queryKey: key(pageId) });
                toast.success("Comment deleted");
            } else {
                toast.error(result?.error || "Failed to delete");
            }
        },
    });
}
