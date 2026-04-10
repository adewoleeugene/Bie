"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { AttachmentParent } from "@prisma/client";
import {
    useAttachments,
    useUploadAttachment,
    useDeleteAttachment,
} from "@/hooks/use-attachments";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AttachmentPanelProps {
    parentType: AttachmentParent;
    parentId: string;
    title?: string;
    compact?: boolean;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
    return mime.startsWith("image/");
}

export function AttachmentPanel({
    parentType,
    parentId,
    title = "Attachments",
    compact = false,
}: AttachmentPanelProps) {
    const { data: attachments, isLoading } = useAttachments(parentType, parentId);
    const upload = useUploadAttachment(parentType, parentId);
    const remove = useDeleteAttachment(parentType, parentId);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        for (const file of Array.from(files)) {
            await upload.mutateAsync(file);
        }
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className="space-y-3">
            {!compact && (
                <h3 className="text-sm font-semibold text-neutral-500 uppercase flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5" />
                    {title}
                </h3>
            )}

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`rounded-md border-2 border-dashed p-3 text-center transition-colors ${
                    dragging
                        ? "border-primary bg-primary/5"
                        : "border-neutral-200 dark:border-neutral-800"
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onChange}
                />
                <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Drop files or</span>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => inputRef.current?.click()}
                        disabled={upload.isPending}
                    >
                        {upload.isPending ? "Uploading…" : "browse"}
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                {isLoading ? (
                    <p className="text-xs text-neutral-500">Loading…</p>
                ) : attachments && attachments.length > 0 ? (
                    attachments.map((a) => (
                        <div
                            key={a.id}
                            className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
                        >
                            {isImage(a.mimeType) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={`/uploads/${a.key}`}
                                    alt={a.filename}
                                    className="h-10 w-10 rounded object-cover"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-900">
                                    <FileText className="h-5 w-5 text-neutral-500" />
                                </div>
                            )}
                            <a
                                href={`/uploads/${a.key}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 min-w-0"
                            >
                                <div className="truncate text-sm font-medium hover:underline">
                                    {a.filename}
                                </div>
                                <div className="text-xs text-neutral-500">
                                    {formatBytes(a.size)} ·{" "}
                                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                                </div>
                            </a>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-neutral-400 hover:text-red-500"
                                onClick={() => remove.mutate(a.id)}
                                disabled={remove.isPending}
                                aria-label="Delete attachment"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))
                ) : (
                    !compact && (
                        <p className="text-xs text-neutral-500 italic">No attachments yet.</p>
                    )
                )}
            </div>
        </div>
    );
}
