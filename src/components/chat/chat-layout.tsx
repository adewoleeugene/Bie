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
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0f1015] text-neutral-100">
            {/* Sidebar */}
            <aside className="flex w-[312px] shrink-0 flex-col border-r border-white/10 bg-[#171922]">
                <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#242834] text-bz-blue">
                                    <MessageSquare className="h-4 w-4" />
                                </span>
                                <span className="truncate">Team Chat</span>
                            </div>
                            <p className="mt-1 truncate pl-10 text-xs text-neutral-500">
                                Channels and direct messages
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <CreateChannelDialog onCreated={(id) => setSelectedId(id)} />
                            <NewConversationDialog onCreated={(id) => setSelectedId(id)} />
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-3">
                    {isLoading ? (
                        <div className="space-y-2 p-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
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
            <main className="flex min-w-0 flex-1 flex-col bg-[#101116]">
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
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#1c202a] text-bz-blue shadow-2xl shadow-black/30">
                                <Hash className="h-7 w-7" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Choose a room</h3>
                            <p className="mt-2 text-sm leading-6 text-neutral-500">
                                Pick a channel or direct message to jump back into the conversation.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
