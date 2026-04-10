"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageWithSender } from "@/actions/chat";

/**
 * Subscribes to the SSE stream for a conversation and pushes new messages
 * into the React Query cache. Also invalidates the conversations list so
 * sidebar previews/unread counters refresh.
 */
export function useChatStream(conversationId: string | null) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!conversationId) return;

        const es = new EventSource(
            `/api/chat/stream?conversationId=${encodeURIComponent(conversationId)}`
        );

        es.addEventListener("message", (e: MessageEvent) => {
            try {
                const incoming = JSON.parse(e.data) as MessageWithSender;
                // Normalize date
                const normalized: MessageWithSender = {
                    ...incoming,
                    createdAt: new Date(incoming.createdAt),
                };

                queryClient.setQueryData<MessageWithSender[]>(
                    ["messages", conversationId],
                    (old = []) => {
                        if (old.some((m) => m.id === normalized.id)) return old;
                        return [...old, normalized];
                    }
                );
                queryClient.invalidateQueries({ queryKey: ["conversations"] });
            } catch (err) {
                console.error("chat stream parse error", err);
            }
        });

        es.onerror = () => {
            // EventSource auto-reconnects; nothing to do
        };

        return () => es.close();
    }, [conversationId, queryClient]);
}
