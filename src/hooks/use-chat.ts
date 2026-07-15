import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getConversations,
    getChatUnreadCount,
    listBrowsablePublicChannels,
    getMessages,
    createConversation,
    createChannel,
    addChannelMembers,
    removeChannelMember,
    renameChannel,
    archiveChannel,
    joinPublicChannel,
    sendMessage,
    updateMessage,
    deleteMessage,
    publishTypingStatus,
    markConversationRead,
    searchChatReferences,
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

export function useChatUnreadCount() {
    return useQuery({
        queryKey: ["chat-unread-count"],
        queryFn: () => getChatUnreadCount(),
        // A minute-stale badge is imperceptible, and refocusing the tab — the
        // moment you'd actually look at it — refetches immediately.
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
}

export function useBrowsablePublicChannels() {
    return useQuery({
        queryKey: ["browsable-public-channels"],
        queryFn: () => listBrowsablePublicChannels(),
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

export function useChatReferenceSearch(kind: "user" | "task" | "project", query: string, enabled: boolean) {
    return useQuery({
        queryKey: ["chat-reference-search", kind, query],
        queryFn: () => searchChatReferences(kind, query),
        enabled,
        staleTime: 30 * 1000,
    });
}

export function useCreateConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { name?: string; memberIds: string[]; isGroup?: boolean }) =>
            createConversation(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
        },
    });
}

export function useCreateChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { name: string; topic?: string; isPrivate?: boolean; memberIds?: string[] }) =>
            createChannel(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useRenameChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ conversationId, input }: { conversationId: string; input: { name?: string; topic?: string } }) =>
            renameChannel(conversationId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useArchiveChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (conversationId: string) => archiveChannel(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useAddChannelMembers() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ conversationId, memberIds }: { conversationId: string; memberIds: string[] }) =>
            addChannelMembers(conversationId, memberIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useRemoveChannelMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ conversationId, memberId }: { conversationId: string; memberId: string }) =>
            removeChannelMember(conversationId, memberId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useJoinPublicChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (conversationId: string) => joinPublicChannel(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["browsable-public-channels"] });
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
            queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
        },
    });
}

export function useUpdateMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { messageId: string; body: string; conversationId: string }) =>
            updateMessage({ messageId: input.messageId, body: input.body }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
    });
}

export function useDeleteMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { messageId: string; conversationId: string }) =>
            deleteMessage(input.messageId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
        },
    });
}

export function usePublishTypingStatus() {
    return useMutation({
        mutationFn: (input: { conversationId: string; isTyping: boolean }) =>
            publishTypingStatus(input.conversationId, input.isTyping),
    });
}

export function useMarkConversationRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (conversationId: string) => markConversationRead(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
        },
    });
}
