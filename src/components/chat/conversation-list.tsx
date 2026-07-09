"use client";

import { cn } from "@/lib/utils";
import { ConversationType } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import type { BrowsablePublicChannel, ConversationWithPreview } from "@/actions/chat";
import { useJoinPublicChannel } from "@/hooks/use-chat";
import { Hash, Lock, MessageCircle } from "lucide-react";

interface ConversationListProps {
    conversations: ConversationWithPreview[];
    browsableChannels: BrowsablePublicChannel[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export function ConversationList({
    conversations,
    browsableChannels,
    selectedId,
    onSelect,
}: ConversationListProps) {
    const { data: session } = useSession();
    const joinPublicChannel = useJoinPublicChannel();

    const getDisplayName = (conv: ConversationWithPreview) => {
        if (conv.type === ConversationType.CHANNEL) return conv.name ? `# ${conv.name}` : "# channel";
        if (conv.name) return conv.name;
        const otherMembers = conv.members.filter((m) => m.user.id !== session?.user?.id);
        return otherMembers.map((m) => m.user.name).join(", ") || "Chat";
    };

    const getAvatar = (conv: ConversationWithPreview) => {
        if (conv.type !== ConversationType.DM) return null;
        const other = conv.members.find((m) => m.user.id !== session?.user?.id);
        return other?.user;
    };

    const channels = conversations.filter((conv) => conv.type === ConversationType.CHANNEL);
    const directMessages = conversations.filter((conv) => conv.type !== ConversationType.CHANNEL);

    const renderConversation = (conv: ConversationWithPreview) => {
        const avatar = getAvatar(conv);
        const displayName = getDisplayName(conv);
        const isChannel = conv.type === ConversationType.CHANNEL;

        return (
            <button
                key={conv.id}
                className={cn(
                    "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                    "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    selectedId === conv.id && "bg-neutral-100 dark:bg-neutral-800"
                )}
                onClick={() => onSelect(conv.id)}
            >
                {isChannel ? (
                    <div className="h-9 w-9 shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        {conv.isPrivate ? (
                            <Lock className="h-4 w-4 text-neutral-500" />
                        ) : (
                            <Hash className="h-4 w-4 text-neutral-500" />
                        )}
                    </div>
                ) : conv.type === ConversationType.GROUP ? (
                    <div className="h-9 w-9 shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-neutral-500" />
                    </div>
                ) : (
                    <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={avatar?.image || undefined} />
                        <AvatarFallback className="text-xs">
                            {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{displayName}</span>
                        {conv.lastMessage && (
                            <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                                {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                            </span>
                        )}
                    </div>
                    {conv.lastMessage ? (
                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {conv.lastMessage.sender.name}: {conv.lastMessage.body}
                        </p>
                    ) : (
                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {isChannel ? conv.topic || "No messages yet" : "No messages yet"}
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
    };

    return (
        <div className="space-y-4 p-2">
            {conversations.length === 0 && browsableChannels.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                    No conversations yet
                </div>
            ) : (
                <>
                    <div>
                        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                            Channels
                        </div>
                        <div className="space-y-0.5">
                            {channels.length > 0 ? channels.map(renderConversation) : (
                                <p className="px-3 py-2 text-xs text-neutral-500">No channels yet</p>
                            )}
                        </div>
                    </div>
                    {browsableChannels.length > 0 && (
                        <div>
                            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                                Browse channels
                            </div>
                            <div className="space-y-0.5">
                                {browsableChannels.map((channel) => (
                                    <div
                                        key={channel.id}
                                        className="flex items-center gap-3 rounded-md px-3 py-2.5"
                                    >
                                        <div className="h-9 w-9 shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                                            <Hash className="h-4 w-4 text-neutral-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-medium">
                                                    # {channel.name ?? "channel"}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 truncate text-xs text-neutral-500">
                                                {channel.topic || `${channel.memberCount} members`}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 shrink-0 px-2 text-xs"
                                            disabled={joinPublicChannel.isPending}
                                            onClick={async () => {
                                                const result = await joinPublicChannel.mutateAsync(channel.id);
                                                if (result.success) onSelect(channel.id);
                                            }}
                                        >
                                            Join
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                            Messages
                        </div>
                        <div className="space-y-0.5">
                            {directMessages.length > 0 ? directMessages.map(renderConversation) : (
                                <p className="px-3 py-2 text-xs text-neutral-500">No direct messages yet</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
