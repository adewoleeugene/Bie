"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Edit3, Hash, Lock, MoreHorizontal, Trash2, X } from "lucide-react";
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
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-neutral-500">Loading messages...</div>
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0">
                {isChannel && (
                    <div className="h-8 w-8 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        {isPrivateChannel ? (
                            <Lock className="h-4 w-4 text-neutral-500" />
                        ) : (
                            <Hash className="h-4 w-4 text-neutral-500" />
                        )}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold truncate">{conversationName}</h2>
                    {isChannel && conversationTopic && (
                        <p className="text-xs text-neutral-500 truncate">{conversationTopic}</p>
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
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
                {(!allMessages || allMessages.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                        No messages yet. Start the conversation!
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
                                <div className={cn("relative pl-8 text-sm", isMe ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-800 dark:text-neutral-200")}>
                                    {isDeleted ? (
                                        <p className="italic text-neutral-400">Message deleted</p>
                                    ) : editingId === msg.id ? (
                                        <div className="max-w-2xl space-y-2">
                                            <Textarea
                                                value={editBody}
                                                onChange={(event) => setEditBody(event.target.value)}
                                                className="min-h-20 resize-none text-sm"
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
                                                    className="h-8 gap-1.5"
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
                                                <span className="text-[11px] text-neutral-400">edited</span>
                                            )}
                                            <MessageAttachments messageId={msg.id} />
                                        </>
                                    )}
                                    {isMe && !isDeleted && editingId !== msg.id && (
                                        <div className="absolute right-0 top-0 hidden group-hover:block">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
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
                    <div className="pl-8 pt-2 text-xs italic text-neutral-500">
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
