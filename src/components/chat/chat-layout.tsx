"use client";

import { useState } from "react";
import { Hash, MessageSquare } from "lucide-react";
import { ConversationType } from "@prisma/client";
import { useBrowsablePublicChannels, useConversations } from "@/hooks/use-chat";
import { useSession } from "next-auth/react";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { NewConversationDialog } from "./new-conversation-dialog";
import { CreateChannelDialog } from "./create-channel-dialog";

export function ChatLayout() {
    const { data: conversations, isLoading } = useConversations();
    const { data: browsableChannels = [] } = useBrowsablePublicChannels();
    const { data: session } = useSession();
    const [selectedId, setSelectedId] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        return new URLSearchParams(window.location.search).get("conversation");
    });

    const selectedConversation = conversations?.find((c) => c.id === selectedId);

    const getConversationName = () => {
        if (!selectedConversation) return "";
        if (selectedConversation.type === ConversationType.CHANNEL) {
            return selectedConversation.name ? `# ${selectedConversation.name}` : "# channel";
        }
        if (selectedConversation.name) return selectedConversation.name;
        const others = selectedConversation.members.filter(
            (m) => m.user.id !== session?.user?.id
        );
        return others.map((m) => m.user.name).join(", ") || "Chat";
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background text-foreground">
            {/* Sidebar */}
            <aside className="flex w-[264px] shrink-0 flex-col bg-sidebar">
                <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-bz-blue to-bz-peri text-white shadow-lg shadow-bz-blue/20">
                            <MessageSquare className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">Team Chat</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <CreateChannelDialog onCreated={(id) => setSelectedId(id)} />
                        <NewConversationDialog onCreated={(id) => setSelectedId(id)} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-3 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
                    {isLoading ? (
                        <div className="space-y-1.5 px-1">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
                            ))}
                        </div>
                    ) : (
                        <ConversationList
                            conversations={conversations || []}
                            browsableChannels={browsableChannels}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                    )}
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex min-w-0 flex-1 flex-col rounded-tl-xl border-l border-border bg-background">
                {selectedId ? (
                    <MessageThread
                        conversationId={selectedId}
                        conversationName={getConversationName()}
                        conversationTopic={selectedConversation?.topic}
                        isChannel={selectedConversation?.type === ConversationType.CHANNEL}
                        isPrivateChannel={Boolean(selectedConversation?.isPrivate)}
                        conversation={selectedConversation}
                        onConversationArchived={() => setSelectedId(null)}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center p-8">
                        <div className="max-w-sm text-center">
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-bz-blue shadow-2xl shadow-black/40">
                                <Hash className="h-7 w-7" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Choose a room</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Pick a channel or direct message to jump back into the conversation.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
