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

    const renderChannel = (conv: ConversationWithPreview) => {
        const displayName = getDisplayName(conv);
        const active = selectedId === conv.id;
        const hasUnread = conv.unreadCount > 0;

        return (
            <button
                key={conv.id}
                className={cn(
                    "group relative flex w-full items-center gap-1.5 rounded-md px-2 py-[7px] text-left transition-colors",
                    active
                        ? "bg-secondary text-foreground"
                        : hasUnread
                            ? "text-foreground hover:bg-sidebar-accent"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
                onClick={() => onSelect(conv.id)}
            >
                {conv.isPrivate ? (
                    <Lock className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                ) : (
                    <Hash className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                )}
                <span className={cn("truncate text-[15px]", hasUnread ? "font-semibold" : "font-medium")}>
                    {displayName}
                </span>
                {hasUnread ? (
                    <Badge className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-0 bg-bz-red px-1.5 text-[11px] font-bold text-white">
                        {conv.unreadCount}
                    </Badge>
                ) : conv.lastMessage ? (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                    </span>
                ) : null}
            </button>
        );
    };

    const renderDirectMessage = (conv: ConversationWithPreview) => {
        const avatar = getAvatar(conv);
        const displayName = getDisplayName(conv);
        const active = selectedId === conv.id;
        const hasUnread = conv.unreadCount > 0;
        const isGroup = conv.type === ConversationType.GROUP;

        return (
            <button
                key={conv.id}
                className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
                onClick={() => onSelect(conv.id)}
            >
                <div className="relative shrink-0">
                    {isGroup ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                            <MessageCircle className="h-4 w-4" />
                        </div>
                    ) : (
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={avatar?.image || undefined} />
                            <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
                                {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar bg-bz-green" />
                </div>
                <div className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[15px]", hasUnread ? "font-semibold text-foreground" : "font-medium")}>
                        {displayName}
                    </span>
                    {conv.lastMessage && (
                        <p className={cn("truncate text-xs", hasUnread ? "text-muted-foreground" : "text-muted-foreground/70 group-hover:text-muted-foreground")}>
                            {conv.lastMessage.sender.name}: {conv.lastMessage.body}
                        </p>
                    )}
                </div>
                {hasUnread && (
                    <Badge className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border-0 bg-bz-red px-1.5 text-[11px] font-bold text-white">
                        {conv.unreadCount}
                    </Badge>
                )}
            </button>
        );
    };

    return (
        <div className="space-y-5">
            {conversations.length === 0 && browsableChannels.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No conversations yet
                </div>
            ) : (
                <>
                    <div>
                        <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            Channels
                        </div>
                        <div className="space-y-0.5">
                            {channels.length > 0 ? channels.map(renderChannel) : (
                                <p className="px-2 py-1.5 text-xs text-muted-foreground">No channels yet</p>
                            )}
                        </div>
                    </div>
                    {browsableChannels.length > 0 && (
                        <div>
                            <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                Browse channels
                            </div>
                            <div className="space-y-0.5">
                                {browsableChannels.map((channel) => (
                                    <div
                                        key={channel.id}
                                        className="group flex items-center gap-1.5 rounded-md px-2 py-[7px] text-muted-foreground transition-colors hover:bg-sidebar-accent"
                                    >
                                        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-[15px] font-medium text-muted-foreground">
                                            {channel.name ?? "channel"}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="ml-auto h-6 shrink-0 border-border bg-secondary px-2 text-[11px] hover:bg-muted"
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
                        <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            Direct Messages
                        </div>
                        <div className="space-y-0.5">
                            {directMessages.length > 0 ? directMessages.map(renderDirectMessage) : (
                                <p className="px-2 py-1.5 text-xs text-muted-foreground">No direct messages yet</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
