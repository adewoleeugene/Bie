"use client";

import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import {
    parseSelectConfig,
    SELECT_COLOR_CLASSES,
    SELECT_DOT_CLASSES,
    SELECT_COLORS,
    SelectColor,
    SelectOption,
    newOptionId,
} from "@/lib/database-types";

interface SelectCellProps {
    config: unknown;
    value: unknown;
    multi: boolean;
    onChangeValue: (value: unknown) => void;
    onAddOption: (option: SelectOption) => Promise<void> | void;
}

export function SelectCell({
    config,
    value,
    multi,
    onChangeValue,
    onAddOption,
}: SelectCellProps) {
    const { options } = parseSelectConfig(config);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const selectedIds: string[] = multi
        ? Array.isArray(value)
            ? (value as string[]).filter((v) => typeof v === "string")
            : []
        : typeof value === "string" && value
          ? [value]
          : [];

    const selected = selectedIds
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is SelectOption => !!o);

    const filtered = options.filter((o) =>
        o.name.toLowerCase().includes(query.toLowerCase()),
    );
    const exact = options.find((o) => o.name.toLowerCase() === query.toLowerCase());

    const toggle = (optionId: string) => {
        if (multi) {
            const next = selectedIds.includes(optionId)
                ? selectedIds.filter((id) => id !== optionId)
                : [...selectedIds, optionId];
            onChangeValue(next);
        } else {
            onChangeValue(optionId);
            setOpen(false);
        }
        setQuery("");
    };

    const remove = (optionId: string) => {
        if (multi) {
            onChangeValue(selectedIds.filter((id) => id !== optionId));
        } else {
            onChangeValue(null);
        }
    };

    const create = async () => {
        const name = query.trim();
        if (!name || exact) return;
        const newOpt: SelectOption = {
            id: newOptionId(),
            name,
            color: SELECT_COLORS[Math.floor(Math.random() * SELECT_COLORS.length)],
        };
        await onAddOption(newOpt);
        toggle(newOpt.id);
    };

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
                        selected.map((o) => (
                            <span
                                key={o.id}
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${SELECT_COLOR_CLASSES[o.color]}`}
                            >
                                {o.name}
                            </span>
                        ))
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search or create…"
                    className="h-8"
                />
                <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                    {filtered.length === 0 && !query && (
                        <p className="px-1 text-xs italic text-neutral-500">
                            No options yet
                        </p>
                    )}
                    {filtered.map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => toggle(o.id)}
                            className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        >
                            <span
                                className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${SELECT_COLOR_CLASSES[o.color]}`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${SELECT_DOT_CLASSES[o.color]}`}
                                />
                                {o.name}
                            </span>
                            {selectedIds.includes(o.id) && (
                                <X
                                    className="h-3 w-3 text-neutral-400"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        remove(o.id);
                                    }}
                                />
                            )}
                        </button>
                    ))}
                    {query && !exact && (
                        <button
                            type="button"
                            onClick={create}
                            className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        >
                            <Plus className="h-3 w-3 text-neutral-500" />
                            Create &quot;{query}&quot;
                        </button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
