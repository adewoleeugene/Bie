"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useSendMessage } from "@/hooks/use-chat";

interface MessageInputProps {
    conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
    const [body, setBody] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const sendMessage = useSendMessage();

    const handleSend = async () => {
        const trimmed = body.trim();
        if (!trimmed) return;

        setBody("");
        await sendMessage.mutateAsync({
            conversationId,
            body: trimmed,
        });
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t p-4 flex gap-2">
            <Textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="resize-none min-h-[40px] max-h-[120px]"
            />
            <Button
                size="icon"
                onClick={handleSend}
                disabled={!body.trim() || sendMessage.isPending}
                className="shrink-0"
            >
                <Send className="h-4 w-4" />
            </Button>
        </div>
    );
}
