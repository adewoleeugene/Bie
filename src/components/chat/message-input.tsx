"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AttachmentParent } from "@prisma/client";
import { AtSign, FileText, FolderKanban, Hash, Paperclip, Send, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadAttachment } from "@/actions/attachments";
import { useChatReferenceSearch, usePublishTypingStatus, useSendMessage } from "@/hooks/use-chat";
import type { ChatReferenceSuggestion } from "@/actions/chat";

interface MessageInputProps {
    conversationId: string;
}

type TriggerKind = "user" | "task" | "project";

type TriggerState = {
    kind: TriggerKind;
    query: string;
    start: number;
    end: number;
} | null;

function detectTrigger(value: string, cursor: number): TriggerState {
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(^|\s)([@#+])([^\s@#+\[\]]{0,40})$/);
    if (!match || match.index === undefined) return null;

    const marker = match[2];
    const query = match[3] ?? "";
    const markerOffset = match[1] ? 1 : 0;
    const start = match.index + markerOffset;

    return {
        kind: marker === "@" ? "user" : marker === "#" ? "task" : "project",
        query,
        start,
        end: cursor,
    };
}

function tokenFor(suggestion: ChatReferenceSuggestion): string {
    if (suggestion.type === "user") return `@[${suggestion.id}]`;
    if (suggestion.type === "task") return `#[${suggestion.id}]`;
    return `+[${suggestion.id}]`;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({ conversationId }: MessageInputProps) {
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [trigger, setTrigger] = useState<TriggerState>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const sendMessage = useSendMessage();
    const publishTyping = usePublishTypingStatus();
    const typingTimerRef = useRef<number | null>(null);
    const { data: suggestions } = useChatReferenceSearch(
        trigger?.kind ?? "user",
        trigger?.query ?? "",
        Boolean(trigger),
    );

    useEffect(() => {
        return () => {
            if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        };
    }, []);

    const visibleSuggestions = useMemo(
        () => (suggestions || []).slice(0, 6),
        [suggestions],
    );

    const refreshTrigger = (value: string) => {
        const cursor = textareaRef.current?.selectionStart ?? value.length;
        setTrigger(detectTrigger(value, cursor));
    };

    const handleBodyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setBody(event.target.value);
        refreshTrigger(event.target.value);
        publishTyping.mutate({ conversationId, isTyping: true });
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => {
            publishTyping.mutate({ conversationId, isTyping: false });
        }, 1600);
    };

    const insertSuggestion = (suggestion: ChatReferenceSuggestion) => {
        if (!trigger) return;

        const token = tokenFor(suggestion);
        const next = `${body.slice(0, trigger.start)}${token} ${body.slice(trigger.end)}`;
        const nextCursor = trigger.start + token.length + 1;

        setBody(next);
        setTrigger(null);
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files ? Array.from(event.target.files) : [];
        if (selected.length > 0) {
            setFiles((current) => [...current, ...selected]);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    };

    const uploadFiles = async (messageId: string, pendingFiles: File[]) => {
        for (const file of pendingFiles) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("parentType", AttachmentParent.MESSAGE);
            formData.append("parentId", messageId);
            await uploadAttachment(formData);
        }
        queryClient.invalidateQueries({ queryKey: ["attachments", AttachmentParent.MESSAGE, messageId] });
    };

    const handleSend = async () => {
        const trimmed = body.trim();
        if (!trimmed && files.length === 0) return;

        const pendingFiles = files;
        const messageBody = trimmed || pendingFiles.map((file) => file.name).join(", ");
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        publishTyping.mutate({ conversationId, isTyping: false });

        setBody("");
        setFiles([]);
        setTrigger(null);

        const result = await sendMessage.mutateAsync({
            conversationId,
            body: messageBody,
        });

        if (result.success && result.data && pendingFiles.length > 0) {
            await uploadFiles(result.data.id, pendingFiles);
        }

        textareaRef.current?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Escape" && trigger) {
            event.preventDefault();
            setTrigger(null);
            return;
        }

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t p-4">
            <div className="relative">
                {trigger && visibleSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 z-10 mb-2 w-full max-w-md overflow-hidden rounded-md border bg-white shadow-lg dark:bg-neutral-950">
                        {visibleSuggestions.map((suggestion) => (
                            <button
                                key={`${suggestion.type}-${suggestion.id}`}
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    insertSuggestion(suggestion);
                                }}
                            >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-900">
                                    {suggestion.type === "user" ? (
                                        <AtSign className="h-4 w-4 text-neutral-500" />
                                    ) : suggestion.type === "task" ? (
                                        <Hash className="h-4 w-4 text-neutral-500" />
                                    ) : (
                                        <FolderKanban className="h-4 w-4 text-neutral-500" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{suggestion.label}</div>
                                    {suggestion.subtitle && (
                                        <div className="truncate text-xs text-neutral-500">{suggestion.subtitle}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {files.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                        {files.map((file, index) => (
                            <div
                                key={`${file.name}-${file.size}-${index}`}
                                className="flex max-w-[220px] items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-800"
                            >
                                <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                                <span className="truncate">{file.name}</span>
                                <span className="shrink-0 text-neutral-500">{formatBytes(file.size)}</span>
                                <button
                                    type="button"
                                    className="text-neutral-400 hover:text-red-500"
                                    onClick={() => removeFile(index)}
                                    aria-label="Remove file"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendMessage.isPending}
                        className="shrink-0"
                    >
                        <Paperclip className="h-4 w-4" />
                        <span className="sr-only">Attach files</span>
                    </Button>
                    <Textarea
                        ref={textareaRef}
                        value={body}
                        onChange={handleBodyChange}
                        onKeyDown={handleKeyDown}
                        onClick={() => refreshTrigger(body)}
                        onKeyUp={() => refreshTrigger(body)}
                        placeholder="Type a message..."
                        rows={1}
                        className="max-h-[120px] min-h-[40px] resize-none"
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={(!body.trim() && files.length === 0) || sendMessage.isPending}
                        className="shrink-0"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
