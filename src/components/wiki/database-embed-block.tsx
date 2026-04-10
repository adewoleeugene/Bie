"use client";

import { createReactBlockSpec } from "@blocknote/react";
import Link from "next/link";
import { Database as DatabaseIcon, ExternalLink, Lock } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDatabase, useDatabases } from "@/hooks/use-databases";
import { DatabaseTableView } from "@/components/databases/database-table-view";

/**
 * Custom BlockNote block: inline database embed.
 *
 * Stored as: { type: "databaseEmbed", props: { databaseId } }
 *
 * Renders the live, editable database table inside the wiki page using the
 * shared TanStack Query cache, so edits made here propagate everywhere the
 * database is shown (and vice-versa). Capped at 10 rows for embed surface
 * area; the "Open" link in the header opens the full database page.
 */
export const DatabaseEmbedBlock = createReactBlockSpec(
    {
        type: "databaseEmbed",
        propSchema: {
            databaseId: { default: "" },
        } as const,
        content: "none",
    },
    {
        render: ({ block, editor }) => {
            const databaseId = block.props.databaseId as string;
            const editable = editor.isEditable;

            if (!databaseId) {
                return (
                    <DatabasePicker
                        disabled={!editable}
                        onPick={(id) => {
                            editor.updateBlock(block, {
                                type: "databaseEmbed",
                                props: { databaseId: id },
                            } as any);
                        }}
                    />
                );
            }

            return <EmbeddedDatabase databaseId={databaseId} />;
        },
    },
);

function DatabasePicker({
    onPick,
    disabled,
}: {
    onPick: (databaseId: string) => void;
    disabled: boolean;
}) {
    const { data: databases, isLoading } = useDatabases();

    return (
        <div className="my-2 flex items-center gap-2 rounded-md border-2 border-dashed border-neutral-300 p-3 dark:border-neutral-700">
            <DatabaseIcon className="h-4 w-4 text-neutral-400" />
            <span className="text-sm text-neutral-500">Embed database:</span>
            {isLoading ? (
                <span className="text-xs text-neutral-400">Loading…</span>
            ) : !databases || databases.length === 0 ? (
                <span className="text-xs text-neutral-400">
                    No databases yet — create one first
                </span>
            ) : (
                <Select disabled={disabled} onValueChange={(v) => onPick(v)}>
                    <SelectTrigger className="h-8 w-56">
                        <SelectValue placeholder="Pick a database…" />
                    </SelectTrigger>
                    <SelectContent>
                        {databases.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                                {d.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    );
}

function EmbeddedDatabase({ databaseId }: { databaseId: string }) {
    const { data, isLoading } = useDatabase(databaseId);

    if (isLoading) {
        return (
            <div className="my-2 rounded-md border border-neutral-200 p-3 text-xs text-neutral-400 dark:border-neutral-800">
                Loading database…
            </div>
        );
    }
    if (!data) {
        return (
            <div className="my-3 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-xs">
                    <div className="mb-0.5 font-medium text-amber-800 dark:text-amber-200">
                        You don&apos;t have access to this embedded database
                    </div>
                    <div className="text-amber-700 dark:text-amber-300">
                        It&apos;s set to private. Ask the owner to share it with you, or
                        switch the database&apos;s visibility to the whole org.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="my-3 rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                    <DatabaseIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">{data.name}</span>
                    <span className="text-[10px] text-neutral-400">
                        {data.rows.length} rows
                    </span>
                </div>
                <Link
                    href={`/databases/${data.id}`}
                    className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-primary"
                >
                    Open <ExternalLink className="h-3 w-3" />
                </Link>
            </div>
            <div className="p-2">
                <DatabaseTableView
                    databaseId={data.id}
                    properties={data.properties}
                    rows={data.rows}
                    compact
                    rowLimit={10}
                />
            </div>
            {data.rows.length > 10 && (
                <div className="border-t border-neutral-100 px-3 py-1 text-[10px] text-neutral-400 dark:border-neutral-900">
                    Showing 10 of {data.rows.length} rows
                </div>
            )}
        </div>
    );
}
