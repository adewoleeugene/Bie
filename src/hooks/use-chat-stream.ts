"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageWithSender } from "@/actions/chat";

type ChatRealtimeEvent =
    | { conversationId: string; type: "message.created"; message: WireMessage }
    | { conversationId: string; type: "message.updated"; message: WireMessage }
    | { conversationId: string; type: "message.deleted"; messageId: string; deletedAt: string }
    | { conversationId: string; type: "typing"; userId: string; name: string; isTyping: boolean }
    | { conversationId: string; type: "presence"; userId: string; name: string; status: "online" | "offline" }
    | { conversationId: string; type: "read"; userId: string; readAt: string };

type WireMessage = Omit<MessageWithSender, "createdAt" | "updatedAt" | "deletedAt"> & {
    createdAt: string;
    updatedAt?: string;
    deletedAt?: string | null;
};

function normalizeMessage(message: WireMessage): MessageWithSender {
    return {
        ...message,
        createdAt: new Date(message.createdAt),
        updatedAt: message.updatedAt ? new Date(message.updatedAt) : new Date(message.createdAt),
        deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
        references: message.references ?? [],
    };
}

export function useChatStream(conversationId: string | null) {
    const queryClient = useQueryClient();
    const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
    const typingTimers = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        if (!conversationId) return;

        const timers = typingTimers.current;

        const invalidateSidebar = () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
        };

        const applyEvent = (event: ChatRealtimeEvent) => {
            if (event.type === "message.created") {
                const normalized = normalizeMessage(event.message);
                queryClient.setQueryData<MessageWithSender[]>(
                    ["messages", conversationId],
                    (old = []) => old.some((message) => message.id === normalized.id)
                        ? old
                        : [...old, normalized],
                );
                invalidateSidebar();
                return;
            }

            if (event.type === "message.updated") {
                const normalized = normalizeMessage(event.message);
                queryClient.setQueryData<MessageWithSender[]>(
                    ["messages", conversationId],
                    (old = []) => old.map((message) => message.id === normalized.id ? normalized : message),
                );
                invalidateSidebar();
                return;
            }

            if (event.type === "message.deleted") {
                queryClient.setQueryData<MessageWithSender[]>(
                    ["messages", conversationId],
                    (old = []) => old.map((message) => message.id === event.messageId
                        ? { ...message, body: "", deletedAt: new Date(event.deletedAt), references: [] }
                        : message),
                );
                invalidateSidebar();
                return;
            }

            if (event.type === "typing") {
                window.clearTimeout(timers.get(event.userId));
                if (event.isTyping) {
                    setTypingUsers((current) => {
                        if (current.some((user) => user.userId === event.userId)) return current;
                        return [...current, { userId: event.userId, name: event.name }];
                    });
                    timers.set(event.userId, window.setTimeout(() => {
                        setTypingUsers((current) => current.filter((user) => user.userId !== event.userId));
                        timers.delete(event.userId);
                    }, 3500));
                } else {
                    setTypingUsers((current) => current.filter((user) => user.userId !== event.userId));
                    timers.delete(event.userId);
                }
            }
        };

        const es = new EventSource(
            `/api/chat/stream?conversationId=${encodeURIComponent(conversationId)}`
        );

        const handleSse = (event: MessageEvent) => {
            try {
                applyEvent(JSON.parse(event.data) as ChatRealtimeEvent);
            } catch (err) {
                console.error("chat stream parse error", err);
            }
        };

        es.addEventListener("message.created", handleSse);
        es.addEventListener("message.updated", handleSse);
        es.addEventListener("message.deleted", handleSse);
        es.addEventListener("typing", handleSse);
        es.addEventListener("presence", handleSse);
        es.addEventListener("read", handleSse);
        es.addEventListener("message", (event: MessageEvent) => {
            try {
                const incoming = JSON.parse(event.data) as WireMessage;
                applyEvent({ conversationId, type: "message.created", message: incoming });
            } catch (err) {
                console.error("legacy chat stream parse error", err);
            }
        });

        return () => {
            es.close();
            timers.forEach((timer) => window.clearTimeout(timer));
            timers.clear();
        };
    }, [conversationId, queryClient]);

    return { typingUsers };
}
