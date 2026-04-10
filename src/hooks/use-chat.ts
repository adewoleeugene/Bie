import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getConversations,
    getMessages,
    createConversation,
    sendMessage,
    markConversationRead,
} from "@/actions/chat";

export function useConversations() {
    return useQuery({
        queryKey: ["conversations"],
        queryFn: () => getConversations(),
        // SSE pushes updates; this is just a slow safety net for missed events.
        refetchInterval: 60000,
        refetchOnWindowFocus: true,
    });
}

export function useMessages(conversationId: string | null) {
    return useQuery({
        queryKey: ["messages", conversationId],
        queryFn: () => (conversationId ? getMessages(conversationId) : Promise.resolve([])),
        enabled: !!conversationId,
        // SSE pushes new messages; refetch only on focus as a safety net.
        refetchOnWindowFocus: true,
    });
}

export function useCreateConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { name?: string; memberIds: string[]; isGroup?: boolean }) =>
            createConversation(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { conversationId: string; body: string }) =>
            sendMessage(input),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useMarkConversationRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (conversationId: string) => markConversationRead(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}
