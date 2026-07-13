"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { uploadAttachment } from "@/actions/attachments";
import { toast } from "sonner";

interface ImageCellProps {
    /** Row id is used as the attachment parent so uploads are scoped per row. */
    rowId?: string;
    value: unknown;
    onChange: (value: unknown) => void;
    /** Compact = inline within a table row. Large = used in row detail sheet. */
    size?: "compact" | "large";
}

export function ImageCell({
    rowId,
    value,
    onChange,
    size = "compact",
}: ImageCellProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const url = typeof value === "string" ? value : "";

    const handleFile = async (file: File) => {
        if (!rowId) {
            toast.error("Save the row before uploading an image");
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("parentType", "DATABASE_ROW");
            fd.append("parentId", rowId);
            const result = await uploadAttachment(fd);
            if (result.success && result.data) {
                onChange(result.data.publicUrl);
                toast.success("Image uploaded");
            } else {
                toast.error(result.error || "Upload failed");
            }
        } finally {
            setUploading(false);
        }
    };

    if (size === "large") {
        return (
            <div className="space-y-2">
                {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={url}
                        alt=""
                        className="h-40 w-full rounded object-cover"
                    />
                )}
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => inputRef.current?.click()}
                    >
                        {uploading ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                            <Upload className="mr-1 h-3 w-3" />
                        )}
                        Upload
                    </Button>
                    {url && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onChange(null)}
                        >
                            <Trash2 className="mr-1 h-3 w-3" /> Remove
                        </Button>
                    )}
                </div>
                <Input
                    defaultValue={url}
                    placeholder="Or paste an image URL"
                    onBlur={(e) => onChange(e.target.value || null)}
                />
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                        e.target.value = "";
                    }}
                />
            </div>
        );
    }

    // compact (table-cell)
    return (
        <div className="flex items-center gap-2">
            {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-6 w-6 rounded object-cover" />
            )}
            <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-primary disabled:opacity-50"
                aria-label="Upload image"
            >
                {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <Upload className="h-3 w-3" />
                )}
                {url ? "Replace" : "Upload"}
            </button>
            {url && (
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="text-neutral-300 hover:text-red-500"
                    aria-label="Remove image"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                }}
            />
        </div>
    );
}
