import type { Metadata } from "next";
import { ChatLayout } from "@/components/chat/chat-layout";

export const metadata: Metadata = {
    title: "Chat",
    description: "Team conversations and direct messages",
};

export default function ChatPage() {
    return <ChatLayout />;
}
