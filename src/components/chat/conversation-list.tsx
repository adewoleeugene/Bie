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
        if (conv.type === ConversationType.CHANNEL) return conv.name ? conv.name : "channel";
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
                    "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    "text-neutral-400 hover:bg-white/[0.055] hover:text-neutral-100",
                    selectedId === conv.id && "bg-white/[0.08] text-white"
                )}
                onClick={() => onSelect(conv.id)}
            >
                {selectedId === conv.id && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-bz-blue" />
                )}
                {isChannel ? (
                    <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#20232d] transition-colors",
                        selectedId === conv.id && "bg-bz-blue/15 text-bz-blue"
                    )}>
                        {conv.isPrivate ? (
                            <Lock className="h-4 w-4" />
                        ) : (
                            <Hash className="h-4 w-4" />
                        )}
                    </div>
                ) : conv.type === ConversationType.GROUP ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#20232d]">
                        <MessageCircle className="h-4 w-4" />
                    </div>
                ) : (
                    <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                        <AvatarImage src={avatar?.image || undefined} />
                        <AvatarFallback className="bg-[#242834] text-xs text-neutral-200">
                            {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium">
                            {isChannel ? `# ${displayName}` : displayName}
                        </span>
                        {conv.lastMessage && (
                            <span className="ml-2 shrink-0 text-[10px] text-neutral-600 group-hover:text-neutral-500">
                                {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                            </span>
                        )}
                    </div>
                    {conv.lastMessage ? (
                        <p className="mt-0.5 truncate text-xs text-neutral-600 group-hover:text-neutral-500">
                            {conv.lastMessage.sender.name}: {conv.lastMessage.body}
                        </p>
                    ) : (
                        <p className="mt-0.5 truncate text-xs text-neutral-600 group-hover:text-neutral-500">
                            {isChannel ? conv.topic || "No messages yet" : "No messages yet"}
                        </p>
                    )}
                </div>
                {conv.unreadCount > 0 && (
                    <Badge className="flex h-5 min-w-[20px] items-center justify-center rounded-full border-0 bg-bz-blue px-1.5 text-[10px] text-white">
                        {conv.unreadCount}
                    </Badge>
                )}
            </button>
        );
    };

    return (
        <div className="space-y-5">
            {conversations.length === 0 && browsableChannels.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-neutral-500">
                    No conversations yet
                </div>
            ) : (
                <>
                    <div>
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                            Channels
                        </div>
                        <div className="space-y-1">
                            {channels.length > 0 ? channels.map(renderConversation) : (
                                <p className="px-3 py-2 text-xs text-neutral-500">No channels yet</p>
                            )}
                        </div>
                    </div>
                    {browsableChannels.length > 0 && (
                        <div>
                            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                                Browse channels
                            </div>
                            <div className="space-y-1">
                                {browsableChannels.map((channel) => (
                                    <div
                                        key={channel.id}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-neutral-400 transition-colors hover:bg-white/[0.055] hover:text-neutral-100"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#20232d]">
                                            <Hash className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-medium">
                                                    # {channel.name ?? "channel"}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 truncate text-xs text-neutral-600">
                                                {channel.topic || `${channel.memberCount} members`}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 shrink-0 border-white/10 bg-white/[0.03] px-2 text-xs hover:bg-white/[0.08]"
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
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                            Messages
                        </div>
                        <div className="space-y-1">
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
