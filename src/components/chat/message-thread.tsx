"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Edit3, Hash, Lock, MessageSquare, MoreHorizontal, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDeleteMessage, useMessages, useMarkConversationRead, useUpdateMessage } from "@/hooks/use-chat";
import { getMessages, type MessageWithSender } from "@/actions/chat";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useSession } from "next-auth/react";
import { MessageInput } from "./message-input";
import { MessageContent } from "./message-content";
import { MessageAttachments } from "./message-attachments";
import { ChannelSettingsDialog } from "./channel-settings-dialog";
import type { ConversationWithPreview } from "@/actions/chat";

interface MessageThreadProps {
    conversationId: string;
    conversationName: string;
    conversationTopic?: string | null;
    isChannel?: boolean;
    isPrivateChannel?: boolean;
    conversation?: ConversationWithPreview;
    onConversationArchived?: () => void;
}

export function MessageThread({
    conversationId,
    conversationName,
    conversationTopic,
    isChannel,
    isPrivateChannel,
    conversation,
    onConversationArchived,
}: MessageThreadProps) {
    const { data: messages, isLoading } = useMessages(conversationId);
    const { typingUsers } = useChatStream(conversationId);
    const { data: session } = useSession();
    const { mutate: markRead } = useMarkConversationRead();
    const updateMessage = useUpdateMessage();
    const deleteMessage = useDeleteMessage();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState("");
    const [olderState, setOlderState] = useState<{
        conversationId: string;
        messages: MessageWithSender[];
        hasMore: boolean;
    } | null>(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevMessageCount = useRef(0);

    // Mark as read when viewing
    useEffect(() => {
        markRead(conversationId);
    }, [conversationId, markRead]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (messages && messages.length > prevMessageCount.current) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
        prevMessageCount.current = messages?.length || 0;
    }, [messages]);

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center bg-background">
                <div className="animate-pulse text-sm text-muted-foreground">Loading messages...</div>
            </div>
        );
    }

    const olderMessages = olderState?.conversationId === conversationId ? olderState.messages : [];
    const hasMoreOlder = olderState?.conversationId === conversationId ? olderState.hasMore : true;
    const allMessages = [...olderMessages, ...(messages || [])];
    const visibleTypingUsers = typingUsers.filter((user) => user.userId !== session?.user?.id);

    const loadOlder = async () => {
        const oldest = allMessages[0];
        if (!oldest || loadingOlder) return;

        setLoadingOlder(true);
        const older = await getMessages(conversationId, 50, oldest.id);
        setOlderState((current) => {
            const currentMessages = current?.conversationId === conversationId ? current.messages : [];
            const existingIds = new Set([...currentMessages, ...(messages || [])].map((message) => message.id));
            return {
                conversationId,
                messages: [...older.filter((message) => !existingIds.has(message.id)), ...currentMessages],
                hasMore: older.length === 50,
            };
        });
        setLoadingOlder(false);
    };

    return (
        <div className="flex h-full min-w-0 flex-col bg-background">
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
                {isChannel ? (
                    isPrivateChannel ? (
                        <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                        <Hash className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )
                ) : null}
                <div className="flex min-w-0 items-center gap-2.5">
                    <h2 className="truncate text-[15px] font-semibold text-foreground">
                        {isChannel ? conversationName.replace(/^#\s*/, "") : conversationName}
                    </h2>
                    {isChannel && conversationTopic && (
                        <>
                            <span className="h-4 w-px shrink-0 bg-border" />
                            <p className="truncate text-[13px] text-muted-foreground">{conversationTopic}</p>
                        </>
                    )}
                </div>
                <div className="ml-auto flex items-center">
                    {conversation && (
                        <ChannelSettingsDialog
                            conversation={conversation}
                            onArchived={onConversationArchived}
                        />
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-0 overflow-y-auto py-4">
                {(!allMessages || allMessages.length === 0) ? (
                    <div className="flex h-full flex-col items-start justify-end px-6 pb-4 text-left">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card text-muted-foreground">
                            {isChannel ? <Hash className="h-8 w-8" /> : <MessageSquare className="h-8 w-8" />}
                        </div>
                        <h3 className="text-2xl font-bold text-foreground">Welcome to {conversationName}</h3>
                        <p className="mt-1 text-[15px] text-muted-foreground">
                            This is the very beginning of the {isChannel ? conversationName : "conversation"}. Send the first message to get things moving.
                        </p>
                    </div>
                ) : (
                    <>
                    {hasMoreOlder && messages && messages.length >= 50 && (
                        <div className="flex justify-center py-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadOlder}
                                disabled={loadingOlder}
                                className="border-border bg-secondary text-foreground hover:bg-muted"
                            >
                                {loadingOlder ? "Loading..." : "Load older"}
                            </Button>
                        </div>
                    )}
                    {allMessages.map((msg, i) => {
                        const isMe = msg.sender.id === session?.user?.id;
                        const prevMsg = i > 0 ? allMessages[i - 1] : null;
                        const sameSender = prevMsg?.senderId === msg.senderId;
                        const timeDiff = prevMsg
                            ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
                            : Infinity;
                        const showHeader = !sameSender || timeDiff > 5 * 60 * 1000;
                        const isDeleted = Boolean(msg.deletedAt);
                        const isEdited = !isDeleted && new Date(msg.updatedAt).getTime() > new Date(msg.createdAt).getTime() + 1000;
                        const showSenderName = !isMe && (Boolean(isChannel) || Boolean(conversation?.isGroup));
                        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "group flex gap-2.5 px-4",
                                    isMe ? "flex-row-reverse" : "flex-row",
                                    showHeader ? "mt-4" : "mt-0.5",
                                )}
                            >
                                {!isMe && (
                                    <div className="w-9 shrink-0">
                                        {showHeader && (
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={msg.sender.image || undefined} />
                                                <AvatarFallback className="bg-secondary text-sm font-medium text-foreground">
                                                    {msg.sender.name?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                )}

                                <div className={cn("flex min-w-0 max-w-[78%] flex-col", isMe ? "items-end" : "items-start")}>
                                    {showHeader && showSenderName && (
                                        <span className="mb-1 px-1 text-[13px] font-semibold text-foreground">
                                            {msg.sender.name}
                                        </span>
                                    )}

                                    {editingId === msg.id ? (
                                        <div className="w-[min(560px,80vw)] space-y-2">
                                            <Textarea
                                                value={editBody}
                                                onChange={(event) => setEditBody(event.target.value)}
                                                className="min-h-20 resize-none border-border bg-card text-sm"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-8 gap-1.5"
                                                    onClick={async () => {
                                                        await updateMessage.mutateAsync({
                                                            conversationId,
                                                            messageId: msg.id,
                                                            body: editBody,
                                                        });
                                                        setEditingId(null);
                                                    }}
                                                    disabled={!editBody.trim() || updateMessage.isPending}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 gap-1.5 border-border bg-secondary hover:bg-muted"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            {isMe && !isDeleted && (
                                                <div className="hidden group-hover:block">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Message actions</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setEditingId(msg.id);
                                                                    setEditBody(msg.body);
                                                                }}
                                                            >
                                                                <Edit3 className="h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                variant="destructive"
                                                                onClick={() => deleteMessage.mutate({ conversationId, messageId: msg.id })}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    "min-w-0 rounded-2xl px-3.5 py-2 text-[15px] leading-[1.45]",
                                                    isDeleted
                                                        ? "bg-muted/50 italic text-muted-foreground"
                                                        : isMe
                                                            ? "rounded-br-md bg-bz-blue text-white"
                                                            : "rounded-bl-md bg-muted text-foreground",
                                                )}
                                            >
                                                {isDeleted ? (
                                                    <span>Message deleted</span>
                                                ) : (
                                                    <>
                                                        <MessageContent body={msg.body} references={msg.references} />
                                                        <MessageAttachments messageId={msg.id} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {!isDeleted && editingId !== msg.id && (
                                        <span className="mt-0.5 hidden px-1 text-[11px] text-muted-foreground group-hover:inline">
                                            {time}{isEdited ? " · edited" : ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    </>
                )}
                {visibleTypingUsers.length > 0 && (
                    <div className="flex items-center gap-2 px-4 pl-[52px] pt-2 text-xs text-muted-foreground">
                        <span className="flex gap-0.5">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                        </span>
                        <span>
                            <span className="font-semibold text-foreground">{visibleTypingUsers.map((user) => user.name).join(", ")}</span>
                            {visibleTypingUsers.length === 1 ? " is" : " are"} typing…
                        </span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <MessageInput conversationId={conversationId} />
        </div>
    );
}
