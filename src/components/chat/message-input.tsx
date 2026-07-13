"use client";

import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AttachmentParent } from "@prisma/client";
import { AtSign, FileText, FolderKanban, Hash, Mic, Paperclip, Send, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { uploadAttachment } from "@/actions/attachments";
import { useChatReferenceSearch, usePublishTypingStatus, useSendMessage } from "@/hooks/use-chat";
import type { ChatReferenceSuggestion } from "@/actions/chat";

interface MessageInputProps {
    conversationId: string;
}

type TriggerKind = "user" | "task" | "project";

const TRIGGER_RE = /(^|\s)([@#+])([^\s@#+[\]]{0,40})$/;

function kindForMarker(marker: string): TriggerKind {
    return marker === "@" ? "user" : marker === "#" ? "task" : "project";
}

function markerForKind(kind: TriggerKind): string {
    return kind === "user" ? "@" : kind === "task" ? "#" : "+";
}

function tokenFor(kind: TriggerKind, id: string): string {
    return `${markerForKind(kind)}[${id}]`;
}

// Serialize the contentEditable editor back to a token string: chip spans emit
// their stored `@[id]`/`#[id]`/`+[id]` token; text and line breaks pass through,
// so the backend parses references exactly as before.
function serializeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node instanceof HTMLElement) {
        if (node.dataset.token) return node.dataset.token;
        if (node.tagName === "BR") return "\n";
        let inner = "";
        node.childNodes.forEach((child) => {
            inner += serializeNode(child);
        });
        if ((node.tagName === "DIV" || node.tagName === "P") && inner && !inner.startsWith("\n")) {
            return `\n${inner}`;
        }
        return inner;
    }
    return "";
}

function serializeEditor(root: HTMLElement): string {
    let out = "";
    root.childNodes.forEach((node) => {
        out += serializeNode(node);
    });
    return out;
}

function buildChip(suggestion: ChatReferenceSuggestion): HTMLSpanElement {
    const kind = suggestion.type as TriggerKind;
    const chip = document.createElement("span");
    chip.dataset.token = tokenFor(kind, suggestion.id);
    chip.contentEditable = "false";
    chip.className =
        "mx-0.5 inline-flex items-center rounded bg-bz-blue/15 px-1.5 py-0.5 align-baseline text-[13px] font-medium text-bz-blue";
    chip.textContent = `${markerForKind(kind)}${suggestion.label}`;
    return chip;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({ conversationId }: MessageInputProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimerRef = useRef<number | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [isEmpty, setIsEmpty] = useState(true);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recordChunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [trigger, setTrigger] = useState<{ kind: TriggerKind; query: string } | null>(null);
    const queryClient = useQueryClient();
    const sendMessage = useSendMessage();
    const publishTyping = usePublishTypingStatus();

    const { data: suggestions } = useChatReferenceSearch(
        trigger?.kind ?? "user",
        trigger?.query ?? "",
        Boolean(trigger),
    );
    const visibleSuggestions = (suggestions || []).slice(0, 6);

    useEffect(() => {
        return () => {
            if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
            recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            recordChunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordChunksRef.current.push(event.data);
            };
            recorder.onstop = () => {
                stream.getTracks().forEach((track) => track.stop());
                const mime = (recorder.mimeType || "audio/webm").split(";")[0];
                const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
                const blob = new Blob(recordChunksRef.current, { type: mime });
                if (blob.size > 0) {
                    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
                    setFiles((current) => [
                        ...current,
                        new File([blob], `voice-note-${stamp}.${ext}`, { type: mime }),
                    ]);
                }
            };
            recorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch {
            toast.error("Microphone unavailable. Check browser permissions.");
        }
    };

    const stopRecording = () => {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setIsRecording(false);
    };

    const refreshEmpty = useCallback(() => {
        const editor = editorRef.current;
        setIsEmpty(!editor || serializeEditor(editor).trim().length === 0);
    }, []);

    const detectTrigger = useCallback(() => {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
            setTrigger(null);
            return;
        }
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
            setTrigger(null);
            return;
        }
        const textBefore = (node.textContent ?? "").slice(0, range.startOffset);
        const match = textBefore.match(TRIGGER_RE);
        if (!match) {
            setTrigger(null);
            return;
        }
        setTrigger({ kind: kindForMarker(match[2]), query: match[3] ?? "" });
    }, []);

    const handleInput = () => {
        refreshEmpty();
        detectTrigger();
        publishTyping.mutate({ conversationId, isTyping: true });
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => {
            publishTyping.mutate({ conversationId, isTyping: false });
        }, 1600);
    };

    const insertSuggestion = (suggestion: ChatReferenceSuggestion) => {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;

        const textNode = node as Text;
        const textBefore = (textNode.textContent ?? "").slice(0, range.startOffset);
        const match = textBefore.match(TRIGGER_RE);
        if (!match) return;

        const markerAndQuery = match[2].length + (match[3]?.length ?? 0);
        const replaceRange = document.createRange();
        replaceRange.setStart(textNode, range.startOffset - markerAndQuery);
        replaceRange.setEnd(textNode, range.startOffset);
        replaceRange.deleteContents();

        const chip = buildChip(suggestion);
        const trailingSpace = document.createTextNode(" ");
        replaceRange.insertNode(trailingSpace);
        replaceRange.insertNode(chip);

        const caret = document.createRange();
        caret.setStartAfter(trailingSpace);
        caret.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caret);

        setTrigger(null);
        refreshEmpty();
        editor.focus();
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
        const editor = editorRef.current;
        const raw = editor ? serializeEditor(editor) : "";
        const trimmed = raw.trim();
        if (!trimmed && files.length === 0) return;

        const pendingFiles = files;
        const messageBody = trimmed || pendingFiles.map((file) => file.name).join(", ");
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        publishTyping.mutate({ conversationId, isTyping: false });

        if (editor) editor.innerHTML = "";
        setFiles([]);
        setTrigger(null);
        setIsEmpty(true);

        const result = await sendMessage.mutateAsync({
            conversationId,
            body: messageBody,
        });

        if (result.success && result.data && pendingFiles.length > 0) {
            await uploadFiles(result.data.id, pendingFiles);
        }

        editor?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
        <div className="bg-background px-4 pb-5 pt-1">
            <div className="relative">
                {trigger && visibleSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 z-10 mb-3 w-full max-w-md overflow-hidden rounded-lg border border-border bg-popover shadow-2xl shadow-black/40">
                        {visibleSuggestions.map((suggestion) => (
                            <button
                                key={`${suggestion.type}-${suggestion.id}`}
                                type="button"
                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    insertSuggestion(suggestion);
                                }}
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                                    {suggestion.type === "user" ? (
                                        <AtSign className="h-4 w-4" />
                                    ) : suggestion.type === "task" ? (
                                        <Hash className="h-4 w-4" />
                                    ) : (
                                        <FolderKanban className="h-4 w-4" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{suggestion.label}</div>
                                    {suggestion.subtitle && (
                                        <div className="truncate text-xs text-muted-foreground">{suggestion.subtitle}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {files.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {files.map((file, index) => (
                            <div
                                key={`${file.name}-${file.size}-${index}`}
                                className="flex max-w-[240px] items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground"
                            >
                                {file.type.startsWith("audio/") ? (
                                    <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate">{file.name}</span>
                                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                                <button
                                    type="button"
                                    className="text-muted-foreground transition-colors hover:text-bz-red"
                                    onClick={() => removeFile(index)}
                                    aria-label="Remove file"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-muted p-1.5 pl-2.5 transition-colors focus-within:border-bz-blue/40 focus-within:bg-secondary">
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
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendMessage.isPending}
                        className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                        <Paperclip className="h-4 w-4" />
                        <span className="sr-only">Attach files</span>
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={sendMessage.isPending}
                        className={`h-9 w-9 shrink-0 rounded-lg ${
                            isRecording
                                ? "animate-pulse bg-bz-red/15 text-bz-red hover:bg-bz-red/25 hover:text-bz-red"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                    >
                        {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        <span className="sr-only">
                            {isRecording ? "Stop recording" : "Record voice note"}
                        </span>
                    </Button>
                    <div className="relative flex-1">
                        <div
                            ref={editorRef}
                            role="textbox"
                            aria-multiline="true"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={handleInput}
                            onKeyDown={handleKeyDown}
                            onKeyUp={detectTrigger}
                            onMouseUp={detectTrigger}
                            className="max-h-[140px] min-h-9 w-full overflow-y-auto whitespace-pre-wrap break-words px-1 py-2 text-[15px] leading-6 text-foreground outline-none"
                        />
                        {isEmpty && (
                            <span className="pointer-events-none absolute left-1 top-2 text-[15px] leading-6 text-muted-foreground">
                                Type a message...
                            </span>
                        )}
                    </div>
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={(isEmpty && files.length === 0) || sendMessage.isPending}
                        className="h-9 w-9 shrink-0 rounded-lg bg-bz-blue text-white hover:bg-bz-blue/90 disabled:bg-muted disabled:text-muted-foreground"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
