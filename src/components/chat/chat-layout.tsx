"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
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
        <div className="flex h-[calc(100vh-64px)]">
            {/* Sidebar */}
            <div className="w-[300px] border-r flex flex-col shrink-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Chat
                    </h2>
                    <div className="flex items-center gap-1">
                        <CreateChannelDialog onCreated={(id) => setSelectedId(id)} />
                        <NewConversationDialog onCreated={(id) => setSelectedId(id)} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
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
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col">
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
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="h-16 w-16 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" />
                            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                Select a conversation
                            </h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                Or start a new one with your team.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
