"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { X, Link2 } from "lucide-react";
import { getRelationRowsLite } from "@/actions/databases";
import { parseRelationConfig } from "@/lib/database-types";
import { useQuery } from "@tanstack/react-query";

interface RelationCellProps {
    /** RELATION property's config blob — must include targetDatabaseId. */
    config: unknown;
    /** Current value: array of related row ids. */
    value: unknown;
    onChangeValue: (value: unknown) => void;
}

interface RowLite {
    id: string;
    title: string;
}

export function RelationCell({
    config,
    value,
    onChangeValue,
}: RelationCellProps) {
    const { targetDatabaseId } = parseRelationConfig(config);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [page, setPage] = useState(0);

    // Debounce the query input → server-side filter argument.
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedQuery(query.trim());
            setPage(0);
        }, 200);
        return () => clearTimeout(t);
    }, [query]);

    const selectedIdsForFetch: string[] = useMemo(
        () =>
            Array.isArray(value)
                ? (value as unknown[]).filter((v): v is string => typeof v === "string")
                : [],
        [value],
    );

    const PAGE_SIZE = 50;
    const { data: targetRows } = useQuery({
        queryKey: [
            "relation-rows",
            targetDatabaseId,
            debouncedQuery,
            page,
            // include current selection so off-page chips still hydrate
            selectedIdsForFetch.join(","),
        ],
        queryFn: () =>
            targetDatabaseId
                ? getRelationRowsLite(targetDatabaseId, {
                      query: debouncedQuery || undefined,
                      cursor: page * PAGE_SIZE,
                      pageSize: PAGE_SIZE,
                      includeIds: selectedIdsForFetch,
                  })
                : Promise.resolve([] as RowLite[]),
        enabled: !!targetDatabaseId && open,
        staleTime: 30 * 1000,
    });

    const selectedIds: string[] = Array.isArray(value)
        ? (value as unknown[]).filter((v): v is string => typeof v === "string")
        : [];

    const byId = useMemo(() => {
        const map = new Map<string, RowLite>();
        for (const r of targetRows || []) map.set(r.id, r);
        return map;
    }, [targetRows]);

    const selected = selectedIds
        .map((id) => byId.get(id) || { id, title: "Loading…" });

    // Server already filtered by debouncedQuery; just hide already-linked.
    const filtered = (targetRows || []).filter((r) => !selectedIds.includes(r.id));
    const hasMore = (targetRows?.length ?? 0) >= PAGE_SIZE;

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChangeValue(selectedIds.filter((x) => x !== id));
        } else {
            onChangeValue([...selectedIds, id]);
        }
        setQuery("");
    };

    if (!targetDatabaseId) {
        return (
            <span className="text-xs italic text-neutral-400">
                Pick a target database in property settings.
            </span>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex min-h-[28px] w-full flex-wrap items-center gap-1 rounded px-1 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                    {selected.length === 0 ? (
                        <span className="text-xs text-neutral-400">Empty</span>
                    ) : (
                        selected.map((s) => (
                            <span
                                key={s.id}
                                className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                            >
                                <Link2 className="h-2.5 w-2.5" />
                                {s.title}
                            </span>
                        ))
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search rows…"
                    className="h-8"
                />
                {selected.length > 0 && (
                    <div className="mt-2">
                        <div className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">
                            Linked
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {selected.map((s) => (
                                <span
                                    key={s.id}
                                    className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                                >
                                    {s.title}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggle(s.id);
                                        }}
                                        aria-label="Unlink"
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="mt-2 max-h-60 space-y-0.5 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-1 text-xs italic text-neutral-500">
                            {targetRows && targetRows.length > 0
                                ? "Nothing else matches"
                                : "No rows in target database yet"}
                        </p>
                    ) : (
                        filtered.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => toggle(r.id)}
                                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                            >
                                <Link2 className="h-3 w-3 text-neutral-400" />
                                <span className="truncate text-xs">{r.title}</span>
                            </button>
                        ))
                    )}
                </div>
                {(page > 0 || hasMore) && (
                    <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-[10px] dark:border-neutral-900">
                        <button
                            type="button"
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            className="text-neutral-500 hover:text-primary disabled:opacity-30"
                        >
                            ← Prev
                        </button>
                        <span className="text-neutral-400">Page {page + 1}</span>
                        <button
                            type="button"
                            disabled={!hasMore}
                            onClick={() => setPage((p) => p + 1)}
                            className="text-neutral-500 hover:text-primary disabled:opacity-30"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
