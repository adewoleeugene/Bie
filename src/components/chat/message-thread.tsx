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
import { formatDistanceToNow } from "date-fns";
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
            <div className="flex flex-1 items-center justify-center bg-[#101116]">
                <div className="animate-pulse text-sm text-neutral-500">Loading messages...</div>
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
        <div className="flex h-full min-w-0 flex-col bg-[#101116]">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#101116]/95 px-5 py-3">
                {isChannel && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1c202a] text-neutral-400">
                        {isPrivateChannel ? (
                            <Lock className="h-4 w-4" />
                        ) : (
                            <Hash className="h-4 w-4" />
                        )}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-white">{conversationName}</h2>
                    {isChannel && conversationTopic && (
                        <p className="mt-0.5 truncate text-xs text-neutral-500">{conversationTopic}</p>
                    )}
                </div>
                {conversation && (
                    <ChannelSettingsDialog
                        conversation={conversation}
                        onArchived={onConversationArchived}
                    />
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-0 overflow-y-auto py-4">
                {(!allMessages || allMessages.length === 0) ? (
                    <div className="flex h-full items-center justify-center px-8 text-center">
                        <div>
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1c202a] text-neutral-400">
                                {isChannel ? <Hash className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
                            </div>
                            <h3 className="text-base font-semibold text-white">This is the start of {conversationName}</h3>
                            <p className="mt-2 text-sm text-neutral-500">Send the first message and get the thread moving.</p>
                        </div>
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
                                className="border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.08]"
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

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "group relative px-5 py-0.5 transition-colors hover:bg-white/[0.035]",
                                    showHeader && "mt-4 pt-2"
                                )}
                            >
                                {showHeader && (
                                    <div className="mb-1 flex items-center gap-2">
                                        <Avatar className="h-10 w-10 ring-1 ring-white/10">
                                            <AvatarImage src={msg.sender.image || undefined} />
                                            <AvatarFallback className="bg-[#242834] text-xs text-neutral-200">
                                                {msg.sender.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-semibold text-neutral-100">{msg.sender.name}</span>
                                        <span className="text-[11px] text-neutral-600">
                                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                )}
                                <div className={cn(
                                    "relative min-h-6 text-[15px] leading-6",
                                    showHeader ? "pl-12" : "pl-12",
                                    isMe ? "text-neutral-100" : "text-neutral-200"
                                )}>
                                    {!showHeader && (
                                        <span className="absolute left-0 top-0 hidden w-10 text-right text-[10px] text-neutral-700 group-hover:block">
                                            {new Date(msg.createdAt).toLocaleTimeString([], {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    )}
                                    {isDeleted ? (
                                        <p className="italic text-neutral-400">Message deleted</p>
                                    ) : editingId === msg.id ? (
                                        <div className="max-w-2xl space-y-2">
                                            <Textarea
                                                value={editBody}
                                                onChange={(event) => setEditBody(event.target.value)}
                                                className="min-h-20 resize-none border-white/10 bg-[#1c202a] text-sm"
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
                                                    className="h-8 gap-1.5 border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <MessageContent body={msg.body} references={msg.references} />
                                            {isEdited && (
                                                <span className="ml-1 text-[11px] text-neutral-600">edited</span>
                                            )}
                                            <MessageAttachments messageId={msg.id} />
                                        </>
                                    )}
                                    {isMe && !isDeleted && editingId !== msg.id && (
                                        <div className="absolute right-1 top-0 hidden rounded-lg border border-white/10 bg-[#1c202a] shadow-xl shadow-black/30 group-hover:block">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/[0.08]">
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
                                </div>
                            </div>
                        );
                    })}
                    </>
                )}
                {visibleTypingUsers.length > 0 && (
                    <div className="px-5 pl-[68px] pt-2 text-xs italic text-neutral-500">
                        {visibleTypingUsers.map((user) => user.name).join(", ")}
                        {visibleTypingUsers.length === 1 ? " is" : " are"} typing...
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <MessageInput conversationId={conversationId} />
        </div>
    );
}
