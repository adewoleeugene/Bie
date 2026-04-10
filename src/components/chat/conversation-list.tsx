"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import type { ConversationWithPreview } from "@/actions/chat";

interface ConversationListProps {
    conversations: ConversationWithPreview[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
    const { data: session } = useSession();

    const getDisplayName = (conv: ConversationWithPreview) => {
        if (conv.name) return conv.name;
        // For DMs, show the other person's name
        const otherMembers = conv.members.filter((m) => m.user.id !== session?.user?.id);
        return otherMembers.map((m) => m.user.name).join(", ") || "Chat";
    };

    const getAvatar = (conv: ConversationWithPreview) => {
        if (conv.isGroup) return null;
        const other = conv.members.find((m) => m.user.id !== session?.user?.id);
        return other?.user;
    };

    return (
        <div className="space-y-0.5 p-2">
            {conversations.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                    No conversations yet
                </div>
            ) : (
                conversations.map((conv) => {
                    const avatar = getAvatar(conv);
                    const displayName = getDisplayName(conv);

                    return (
                        <button
                            key={conv.id}
                            className={cn(
                                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                                selectedId === conv.id && "bg-neutral-100 dark:bg-neutral-800"
                            )}
                            onClick={() => onSelect(conv.id)}
                        >
                            <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage src={avatar?.image || undefined} />
                                <AvatarFallback className="text-xs">
                                    {displayName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium truncate">{displayName}</span>
                                    {conv.lastMessage && (
                                        <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                                            {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                                        </span>
                                    )}
                                </div>
                                {conv.lastMessage && (
                                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                                        {conv.lastMessage.sender.name}: {conv.lastMessage.body}
                                    </p>
                                )}
                            </div>
                            {conv.unreadCount > 0 && (
                                <Badge className="bg-blue-500 text-white text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                                    {conv.unreadCount}
                                </Badge>
                            )}
                        </button>
                    );
                })
            )}
        </div>
    );
}
