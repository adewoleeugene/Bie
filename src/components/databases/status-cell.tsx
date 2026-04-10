"use client";

import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import {
    parseStatusConfig,
    SELECT_COLOR_CLASSES,
    SELECT_DOT_CLASSES,
    SELECT_COLORS,
    StatusOption,
    newOptionId,
} from "@/lib/database-types";

interface StatusCellProps {
    config: unknown;
    /** Currently selected option id. */
    value: unknown;
    onChangeValue: (value: unknown) => void;
    /** Called when the user creates a new option from the picker. */
    onAddOption: (option: StatusOption) => Promise<void> | void;
}

export function StatusCell({
    config,
    value,
    onChangeValue,
    onAddOption,
}: StatusCellProps) {
    const { groups, options } = parseStatusConfig(config);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const selectedId = typeof value === "string" ? value : null;
    const selected = options.find((o) => o.id === selectedId) || null;

    const filteredOptions = options.filter((o) =>
        o.name.toLowerCase().includes(query.toLowerCase()),
    );
    const exact = options.find(
        (o) => o.name.toLowerCase() === query.toLowerCase(),
    );

    const optionsByGroup = groups.map((g) => ({
        group: g,
        items: filteredOptions.filter((o) => o.groupId === g.id),
    }));

    const create = async () => {
        const name = query.trim();
        if (!name || exact) return;
        // New options land in the first group ("To-do") by default.
        const targetGroup = groups[0];
        if (!targetGroup) return;
        const newOpt: StatusOption = {
            id: newOptionId(),
            name,
            color: targetGroup.color,
            groupId: targetGroup.id,
        };
        await onAddOption(newOpt);
        onChangeValue(newOpt.id);
        setQuery("");
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex min-h-[28px] w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                    {selected ? (
                        <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${SELECT_COLOR_CLASSES[selected.color]}`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${SELECT_DOT_CLASSES[selected.color]}`}
                            />
                            {selected.name}
                        </span>
                    ) : (
                        <span className="text-xs text-neutral-400">Empty</span>
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
                <div className="mt-2 max-h-72 space-y-3 overflow-y-auto">
                    {optionsByGroup.map(({ group, items }) =>
                        items.length === 0 ? null : (
                            <div key={group.id}>
                                <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase text-neutral-500">
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${SELECT_DOT_CLASSES[group.color]}`}
                                    />
                                    {group.name}
                                </div>
                                <div className="space-y-0.5">
                                    {items.map((o) => (
                                        <button
                                            key={o.id}
                                            type="button"
                                            onClick={() => {
                                                onChangeValue(o.id);
                                                setOpen(false);
                                                setQuery("");
                                            }}
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
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ),
                    )}
                    {query && !exact && (
                        <button
                            type="button"
                            onClick={create}
                            className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        >
                            <Plus className="h-3 w-3 text-neutral-500" />
                            Create &quot;{query}&quot; in {groups[0]?.name}
                        </button>
                    )}
                    {filteredOptions.length === 0 && !query && (
                        <p className="px-1 text-xs italic text-neutral-500">
                            No options yet
                        </p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
