"use client";

import { useMemo, useState } from "react";
import { WikiPageVersion, User } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { restoreWikiPageVersion } from "@/actions/wiki";
import { diffBlocks, BlockDiffEntry } from "@/lib/blocknote-diff";
import { BlockEditor } from "@/components/wiki/block-editor";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";

type VersionWithEditor = WikiPageVersion & { editedBy: User };

interface WikiHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pageId: string;
    currentContent: unknown;
    versions: VersionWithEditor[];
}

type Mode = "diff" | "preview";

export function WikiHistoryDialog({
    open,
    onOpenChange,
    pageId,
    currentContent,
    versions,
}: WikiHistoryDialogProps) {
    const router = useRouter();
    const [authorId, setAuthorId] = useState<string>("all");
    const [selectedId, setSelectedId] = useState<string | null>(
        versions[0]?.id ?? null,
    );
    const [mode, setMode] = useState<Mode>("diff");
    const [restoring, setRestoring] = useState(false);

    const authors = useMemo(() => {
        const seen = new Map<string, User>();
        for (const v of versions) {
            if (!seen.has(v.editedBy.id)) seen.set(v.editedBy.id, v.editedBy);
        }
        return Array.from(seen.values());
    }, [versions]);

    const filteredVersions = useMemo(() => {
        if (authorId === "all") return versions;
        return versions.filter((v) => v.editedBy.id === authorId);
    }, [versions, authorId]);

    const selected =
        filteredVersions.find((v) => v.id === selectedId) ||
        filteredVersions[0] ||
        null;

    const diff: BlockDiffEntry[] = useMemo(() => {
        if (!selected) return [];
        return diffBlocks(selected.content, currentContent);
    }, [selected, currentContent]);

    const handleRestore = async () => {
        if (!selected) return;
        setRestoring(true);
        try {
            const result = await restoreWikiPageVersion(pageId, selected.id);
            if (result.success) {
                toast.success("Version restored");
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(result.error || "Restore failed");
            }
        } finally {
            setRestoring(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-6xl h-[85vh] flex flex-col p-0">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>Page history</DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 min-h-0">
                    {/* Sidebar: filter + version list */}
                    <div className="w-72 border-r flex flex-col min-h-0">
                        <div className="border-b p-3">
                            <Select value={authorId} onValueChange={setAuthorId}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="All editors" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All editors</SelectItem>
                                    {authors.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.name || a.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {filteredVersions.length === 0 ? (
                                <p className="p-4 text-sm italic text-neutral-500">
                                    No versions for this filter.
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {filteredVersions.map((v) => (
                                        <li key={v.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedId(v.id)}
                                                className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 ${
                                                    selected?.id === v.id
                                                        ? "bg-neutral-100 dark:bg-neutral-900"
                                                        : ""
                                                }`}
                                            >
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage
                                                        src={v.editedBy.image || undefined}
                                                    />
                                                    <AvatarFallback className="text-[10px]">
                                                        {(v.editedBy.name || "?")
                                                            .substring(0, 2)
                                                            .toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-medium">
                                                        {v.editedBy.name || "Unknown"}
                                                    </div>
                                                    <div className="text-xs text-neutral-500">
                                                        {formatDistanceToNow(
                                                            new Date(v.createdAt),
                                                            { addSuffix: true },
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-neutral-400">
                                                        {format(new Date(v.createdAt), "PP p")}
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Right pane: tabs + viewer */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex items-center justify-between border-b px-6 py-3">
                            <div className="flex items-center gap-1 rounded-md border p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setMode("diff")}
                                    className={`rounded px-3 py-1 text-xs ${
                                        mode === "diff"
                                            ? "bg-primary text-primary-foreground"
                                            : "text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                    }`}
                                >
                                    Diff
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("preview")}
                                    className={`rounded px-3 py-1 text-xs ${
                                        mode === "preview"
                                            ? "bg-primary text-primary-foreground"
                                            : "text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                    }`}
                                >
                                    Preview
                                </button>
                            </div>
                            {selected && (
                                <Button
                                    size="sm"
                                    onClick={handleRestore}
                                    disabled={restoring}
                                >
                                    {restoring ? "Restoring…" : "Restore this version"}
                                </Button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {!selected ? (
                                <p className="italic text-neutral-500">
                                    Pick a version on the left.
                                </p>
                            ) : mode === "preview" ? (
                                <div className="prose prose-neutral dark:prose-invert max-w-none">
                                    <BlockEditor
                                        key={selected.id}
                                        initialContent={selected.content as any}
                                        editable={false}
                                    />
                                </div>
                            ) : (
                                <DiffView entries={diff} />
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DiffView({ entries }: { entries: BlockDiffEntry[] }) {
    if (entries.length === 0) {
        return <p className="italic text-neutral-500">No structural differences.</p>;
    }
    const changed = entries.filter((e) => e.type !== "same");
    if (changed.length === 0) {
        return <p className="italic text-neutral-500">No changes between these versions.</p>;
    }
    return <DiffEntries entries={entries} depth={0} />;
}

function DiffEntries({
    entries,
    depth,
}: {
    entries: BlockDiffEntry[];
    depth: number;
}) {
    return (
        <div className="space-y-3">
            {entries.map((entry, idx) => (
                <DiffEntryView key={idx} entry={entry} depth={depth} idx={idx} />
            ))}
        </div>
    );
}

function DiffEntryView({
    entry,
    depth,
    idx,
}: {
    entry: BlockDiffEntry;
    depth: number;
    idx: number;
}) {
    if (entry.type === "same") {
        return (
            <div className="rounded border border-neutral-200 px-3 py-2 text-xs text-neutral-400 dark:border-neutral-800">
                <span className="mr-2 select-none">·</span>
                unchanged ({entry.block.type || "block"})
            </div>
        );
    }

    if (entry.type === "added") {
        return (
            <div className="rounded border border-green-200 bg-green-50 p-2 dark:border-green-900 dark:bg-green-950">
                <div className="mb-1 text-[10px] font-semibold uppercase text-green-700 dark:text-green-300">
                    Added
                </div>
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                    <BlockEditor
                        key={`added-${depth}-${idx}`}
                        initialContent={[entry.block] as any}
                        editable={false}
                    />
                </div>
            </div>
        );
    }

    if (entry.type === "removed") {
        return (
            <div className="rounded border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950">
                <div className="mb-1 text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
                    Removed
                </div>
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                    <BlockEditor
                        key={`removed-${depth}-${idx}`}
                        initialContent={[entry.block] as any}
                        editable={false}
                    />
                </div>
            </div>
        );
    }

    if (entry.type === "children-changed") {
        // The shell didn't change — only nested children did. Render the shell
        // without children for context, then recurse into the child diff.
        const shellWithoutChildren = { ...entry.block, children: [] };
        return (
            <div className="rounded border border-blue-200 bg-blue-50/30 p-2 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="mb-1 text-[10px] font-semibold uppercase text-blue-700 dark:text-blue-300">
                    Children changed
                </div>
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none mb-2">
                    <BlockEditor
                        key={`shell-${depth}-${idx}`}
                        initialContent={[shellWithoutChildren] as any}
                        editable={false}
                    />
                </div>
                <div className="ml-4 border-l-2 border-blue-200 pl-3 dark:border-blue-800">
                    <DiffEntries entries={entry.childDiff} depth={depth + 1} />
                </div>
            </div>
        );
    }

    // modified
    return (
        <div className="rounded border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="mb-1 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                Modified
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded border border-red-200 bg-red-50 p-1 dark:border-red-900 dark:bg-red-950">
                    <div className="mb-1 text-[9px] uppercase text-red-700 dark:text-red-300 md:hidden">
                        Before
                    </div>
                    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                        <BlockEditor
                            key={`mod-old-${depth}-${idx}`}
                            initialContent={[entry.oldBlock] as any}
                            editable={false}
                        />
                    </div>
                </div>
                <div className="rounded border border-green-200 bg-green-50 p-1 dark:border-green-900 dark:bg-green-950">
                    <div className="mb-1 text-[9px] uppercase text-green-700 dark:text-green-300 md:hidden">
                        After
                    </div>
                    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                        <BlockEditor
                            key={`mod-new-${depth}-${idx}`}
                            initialContent={[entry.newBlock] as any}
                            editable={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
