"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getComments, createComment } from "@/actions/comments";
import { toast } from "sonner";

export function useComments(taskId: string) {
    return useQuery({
        queryKey: ["comments", taskId],
        queryFn: () => getComments(taskId),
        enabled: !!taskId,
    });
}

export function useCreateComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, body }: { taskId: string; body: string }) =>
            createComment(taskId, body),
        onSuccess: (result, variables) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["comments", variables.taskId] });
                // Also invalidate task if comments affect task details (like comment count)
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Comment added");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to add comment");
        },
    });
}
