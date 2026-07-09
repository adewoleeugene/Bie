"use client";

import { AttachmentParent } from "@prisma/client";
import { FileText, Image as ImageIcon } from "lucide-react";
import { useAttachments } from "@/hooks/use-attachments";

interface MessageAttachmentsProps {
    messageId: string;
}

function isImage(mimeType: string) {
    return mimeType.startsWith("image/");
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachments({ messageId }: MessageAttachmentsProps) {
    const { data: attachments } = useAttachments(AttachmentParent.MESSAGE, messageId);

    if (!attachments || attachments.length === 0) return null;

    return (
        <div className="mt-2 grid max-w-xl gap-2 sm:grid-cols-2">
            {attachments.map((attachment) => (
                <a
                    key={attachment.id}
                    href={`/uploads/${attachment.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-2 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                >
                    {isImage(attachment.mimeType) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={`/uploads/${attachment.key}`}
                            alt={attachment.filename}
                            className="h-10 w-10 rounded object-cover"
                        />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-900">
                            {attachment.mimeType.startsWith("image/") ? (
                                <ImageIcon className="h-5 w-5 text-neutral-500" />
                            ) : (
                                <FileText className="h-5 w-5 text-neutral-500" />
                            )}
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="truncate font-medium">{attachment.filename}</div>
                        <div className="text-neutral-500">{formatBytes(attachment.size)}</div>
                    </div>
                </a>
            ))}
        </div>
    );
}
