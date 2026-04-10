"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDeletedWikiPages, restoreWikiPage, permanentlyDeleteWikiPage } from "@/actions/wiki";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function WikiTrashPage() {
    const qc = useQueryClient();
    const { data: pages, isLoading } = useQuery({
        queryKey: ["wiki-trash"],
        queryFn: getDeletedWikiPages,
    });

    const handleRestore = async (id: string) => {
        const result = await restoreWikiPage(id);
        if (result.success) {
            toast.success("Page restored");
            qc.invalidateQueries({ queryKey: ["wiki-trash"] });
        } else {
            toast.error(result.error || "Failed to restore");
        }
    };

    const handlePermanentDelete = async (id: string) => {
        const confirmed = confirm(
            "Permanently delete this page? This cannot be undone.",
        );
        if (!confirmed) return;
        const result = await permanentlyDeleteWikiPage(id);
        if (result.success) {
            toast.success("Page permanently deleted");
            qc.invalidateQueries({ queryKey: ["wiki-trash"] });
        } else {
            toast.error(result.error || "Failed to delete");
        }
    };

    return (
        <div className="mx-auto max-w-4xl p-8">
            <div className="mb-8 flex items-center gap-3">
                <Trash2 className="h-6 w-6 text-neutral-400" />
                <h1 className="text-2xl font-semibold">Trash</h1>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Pages in trash are kept for 30 days, then automatically removed.
            </div>

            {isLoading ? (
                <p className="text-sm text-neutral-500">Loading…</p>
            ) : !pages || pages.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
                    <Trash2 className="mx-auto h-8 w-8 text-neutral-300" />
                    <p className="mt-3 text-sm text-neutral-500">Trash is empty.</p>
                </div>
            ) : (
                <ul className="divide-y rounded-md border">
                    {pages.map((page) => (
                        <li
                            key={page.id}
                            className="flex items-center gap-4 px-4 py-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                    {page.icon && (
                                        <span className="mr-2">{page.icon}</span>
                                    )}
                                    {page.title}
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-500">
                                    Deleted{" "}
                                    {page.deletedAt
                                        ? formatDistanceToNow(new Date(page.deletedAt), {
                                              addSuffix: true,
                                          })
                                        : "recently"}
                                    {" by "}
                                    {page.author?.name || "Unknown"}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestore(page.id)}
                            >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                Restore
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handlePermanentDelete(page.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
