"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMessages, useMarkConversationRead } from "@/hooks/use-chat";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { MessageInput } from "./message-input";

interface MessageThreadProps {
    conversationId: string;
    conversationName: string;
}

export function MessageThread({ conversationId, conversationName }: MessageThreadProps) {
    const { data: messages, isLoading } = useMessages(conversationId);
    useChatStream(conversationId);
    const { data: session } = useSession();
    const markRead = useMarkConversationRead();
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevMessageCount = useRef(0);

    // Mark as read when viewing
    useEffect(() => {
        markRead.mutate(conversationId);
    }, [conversationId]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (messages && messages.length > prevMessageCount.current) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
        prevMessageCount.current = messages?.length || 0;
    }, [messages?.length]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-neutral-500">Loading messages...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-6 py-3 flex items-center gap-2 shrink-0">
                <h2 className="font-semibold">{conversationName}</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
                {(!messages || messages.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.sender.id === session?.user?.id;
                        const prevMsg = i > 0 ? messages[i - 1] : null;
                        const sameSender = prevMsg?.senderId === msg.senderId;
                        const timeDiff = prevMsg
                            ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
                            : Infinity;
                        const showHeader = !sameSender || timeDiff > 5 * 60 * 1000;

                        return (
                            <div key={msg.id} className={cn("group", showHeader && "mt-4")}>
                                {showHeader && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={msg.sender.image || undefined} />
                                            <AvatarFallback className="text-[10px]">
                                                {msg.sender.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">{msg.sender.name}</span>
                                        <span className="text-[11px] text-neutral-400">
                                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                )}
                                <div className={cn("pl-8 text-sm", isMe ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-800 dark:text-neutral-200")}>
                                    {msg.body}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <MessageInput conversationId={conversationId} />
        </div>
    );
}
