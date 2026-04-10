"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listTrash,
    restoreWikiPage,
    restoreDatabase,
    restoreDatabaseRow,
    purgeWikiPage,
    purgeDatabase,
    purgeDatabaseRow,
    emptyTrash,
} from "@/actions/trash";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Database, RotateCcw, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function TrashPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["trash"],
        queryFn: listTrash,
    });

    const refresh = () => qc.invalidateQueries({ queryKey: ["trash"] });

    const restorePage = useMutation({
        mutationFn: (id: string) => restoreWikiPage(id),
        onSuccess: (r) => {
            if (r.success) {
                toast.success("Page restored");
                refresh();
            } else toast.error(r.error || "Failed");
        },
    });
    const restoreDb = useMutation({
        mutationFn: (id: string) => restoreDatabase(id),
        onSuccess: (r) => {
            if (r.success) {
                toast.success("Database restored");
                refresh();
            } else toast.error(r.error || "Failed");
        },
    });
    const restoreRow = useMutation({
        mutationFn: (id: string) => restoreDatabaseRow(id),
        onSuccess: (r) => {
            if (r.success) {
                toast.success("Row restored");
                refresh();
            } else toast.error(r.error || "Failed");
        },
    });

    const purgePage = useMutation({
        mutationFn: (id: string) => purgeWikiPage(id),
        onSuccess: refresh,
    });
    const purgeDb = useMutation({
        mutationFn: (id: string) => purgeDatabase(id),
        onSuccess: refresh,
    });
    const purgeRow = useMutation({
        mutationFn: (id: string) => purgeDatabaseRow(id),
        onSuccess: refresh,
    });

    const empty = useMutation({
        mutationFn: () => emptyTrash(),
        onSuccess: (r) => {
            if (r.success) {
                toast.success("Trash emptied");
                refresh();
            } else toast.error(r.error || "Failed");
        },
    });

    const totalCount =
        (data?.pages.length ?? 0) +
        (data?.databases.length ?? 0) +
        (data?.rows.length ?? 0);

    return (
        <div className="mx-auto max-w-4xl p-8">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Trash2 className="h-6 w-6 text-neutral-500" />
                    <h1 className="text-2xl font-semibold">Trash</h1>
                    <span className="text-sm text-neutral-500">
                        {totalCount} items
                    </span>
                </div>
                {totalCount > 0 && (
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (
                                confirm(
                                    "Permanently delete everything in trash? This can't be undone.",
                                )
                            )
                                empty.mutate();
                        }}
                        disabled={empty.isPending}
                    >
                        Empty trash
                    </Button>
                )}
            </div>

            {isLoading ? (
                <p className="text-sm text-neutral-500">Loading…</p>
            ) : totalCount === 0 ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-12 text-center text-sm text-neutral-500 dark:border-neutral-800">
                    Nothing in trash. Deleted pages, databases, and rows show up
                    here so you can restore them.
                </div>
            ) : (
                <div className="space-y-8">
                    {data?.pages.length! > 0 && (
                        <Section
                            title="Wiki pages"
                            icon={<FileText className="h-4 w-4 text-neutral-500" />}
                        >
                            {data!.pages.map((p) => (
                                <Row
                                    key={p.id}
                                    title={p.title}
                                    deletedAt={p.deletedAt}
                                    onRestore={() => restorePage.mutate(p.id)}
                                    onPurge={() => purgePage.mutate(p.id)}
                                />
                            ))}
                        </Section>
                    )}
                    {data?.databases.length! > 0 && (
                        <Section
                            title="Databases"
                            icon={<Database className="h-4 w-4 text-neutral-500" />}
                        >
                            {data!.databases.map((d) => (
                                <Row
                                    key={d.id}
                                    title={d.name}
                                    deletedAt={d.deletedAt}
                                    onRestore={() => restoreDb.mutate(d.id)}
                                    onPurge={() => purgeDb.mutate(d.id)}
                                />
                            ))}
                        </Section>
                    )}
                    {data?.rows.length! > 0 && (
                        <Section
                            title="Database rows"
                            icon={<Database className="h-4 w-4 text-neutral-500" />}
                        >
                            {data!.rows.map((r) => (
                                <Row
                                    key={r.id}
                                    title={r.title}
                                    subtitle={`in ${r.databaseName}`}
                                    deletedAt={r.deletedAt}
                                    onRestore={() => restoreRow.mutate(r.id)}
                                    onPurge={() => purgeRow.mutate(r.id)}
                                />
                            ))}
                        </Section>
                    )}
                </div>
            )}
        </div>
    );
}

function Section({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-2 flex items-center gap-2">
                {icon}
                <h2 className="text-xs font-semibold uppercase text-neutral-500">
                    {title}
                </h2>
            </div>
            <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 dark:divide-neutral-900 dark:border-neutral-800">
                {children}
            </ul>
        </div>
    );
}

function Row({
    title,
    subtitle,
    deletedAt,
    onRestore,
    onPurge,
}: {
    title: string;
    subtitle?: string;
    deletedAt: Date | string | null;
    onRestore: () => void;
    onPurge: () => void;
}) {
    return (
        <li className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{title}</div>
                <div className="text-[10px] text-neutral-500">
                    {subtitle && <>{subtitle} · </>}
                    {deletedAt
                        ? `deleted ${formatDistanceToNow(new Date(deletedAt), { addSuffix: true })}`
                        : "deleted"}
                </div>
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={onRestore}
                className="h-7 text-xs"
            >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-600 hover:text-red-700"
                onClick={() => {
                    if (confirm("Permanently delete? This can't be undone.")) onPurge();
                }}
            >
                <X className="mr-1 h-3 w-3" />
                Delete
            </Button>
        </li>
    );
}
