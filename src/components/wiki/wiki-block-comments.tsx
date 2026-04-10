"use client";

import { useMemo, useState } from "react";
import {
    useBlockComments,
    useCreateBlockComment,
    useResolveBlockComment,
    useDeleteBlockComment,
} from "@/hooks/use-block-comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Check, X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WikiBlockCommentsProps {
    pageId: string;
    activeBlockId: string | null;
}

export function WikiBlockComments({ pageId, activeBlockId }: WikiBlockCommentsProps) {
    const { data: comments, isLoading } = useBlockComments(pageId);
    const create = useCreateBlockComment(pageId);
    const resolve = useResolveBlockComment(pageId);
    const del = useDeleteBlockComment(pageId);
    const [draft, setDraft] = useState("");
    const [showResolved, setShowResolved] = useState(false);

    const grouped = useMemo(() => {
        const byBlock = new Map<string, typeof comments>();
        for (const c of comments || []) {
            if (!showResolved && c.resolved) continue;
            const arr = byBlock.get(c.blockId) || [];
            arr.push(c);
            byBlock.set(c.blockId, arr as typeof comments);
        }
        return Array.from(byBlock.entries());
    }, [comments, showResolved]);

    const submit = async () => {
        if (!draft.trim() || !activeBlockId) return;
        const result = await create.mutateAsync({ blockId: activeBlockId, body: draft.trim() });
        if (result?.success) setDraft("");
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-neutral-500 flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Block comments
                </h3>
                <button
                    type="button"
                    onClick={() => setShowResolved((s) => !s)}
                    className="text-xs text-neutral-500 hover:text-primary"
                >
                    {showResolved ? "Hide resolved" : "Show resolved"}
                </button>
            </div>

            <div className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
                {activeBlockId ? (
                    <>
                        <p className="mb-2 text-xs text-neutral-500">
                            New thread on selected block
                        </p>
                        <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Write a comment…"
                            className="min-h-[60px] resize-none"
                        />
                        <div className="mt-2 flex justify-end">
                            <Button
                                size="sm"
                                onClick={submit}
                                disabled={!draft.trim() || create.isPending}
                            >
                                Comment
                            </Button>
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-neutral-500 italic">
                        Click inside a block to comment on it.
                    </p>
                )}
            </div>

            <div className="space-y-3">
                {isLoading ? (
                    <p className="text-xs text-neutral-500">Loading…</p>
                ) : grouped.length === 0 ? (
                    <p className="text-xs italic text-neutral-500">No comments yet.</p>
                ) : (
                    grouped.map(([blockId, threadComments]) => {
                        const root = threadComments?.[0];
                        if (!root) return null;
                        return (
                            <div
                                key={blockId}
                                className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
                            >
                                <div className="mb-1 flex items-center justify-between text-[10px] uppercase text-neutral-400">
                                    <span>Block {blockId.slice(0, 6)}</span>
                                    <button
                                        type="button"
                                        className="hover:text-primary"
                                        onClick={() =>
                                            resolve.mutate({
                                                commentId: root.id,
                                                resolved: !root.resolved,
                                            })
                                        }
                                    >
                                        {root.resolved ? (
                                            <span className="flex items-center gap-1">
                                                <X className="h-3 w-3" /> Reopen
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1">
                                                <Check className="h-3 w-3" /> Resolve
                                            </span>
                                        )}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {threadComments?.map((c) => (
                                        <div key={c.id} className="flex gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={c.author.image || undefined} />
                                                <AvatarFallback className="text-[10px]">
                                                    {(c.author.name || "?")
                                                        .substring(0, 2)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium">
                                                        {c.author.name}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-neutral-500">
                                                            {formatDistanceToNow(
                                                                new Date(c.createdAt),
                                                                { addSuffix: true },
                                                            )}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => del.mutate(c.id)}
                                                            className="text-neutral-400 hover:text-red-500"
                                                            aria-label="Delete comment"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="whitespace-pre-wrap text-xs text-neutral-700 dark:text-neutral-300">
                                                    {c.body}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
