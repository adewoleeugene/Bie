"use client";

import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMembers } from "@/hooks/use-members";
import { X } from "lucide-react";

interface PersonCellProps {
    value: unknown; // userId | null
    onChangeValue: (value: unknown) => void;
}

export function PersonCell({ value, onChangeValue }: PersonCellProps) {
    const { data: members } = useMembers();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const selectedId = typeof value === "string" ? value : null;
    const selected = members?.find((m) => m.id === selectedId) || null;

    const filtered = (members || []).filter((m) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            (m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q)
        );
    });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex min-h-[28px] w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                    {selected ? (
                        <>
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={selected.image || undefined} />
                                <AvatarFallback className="text-[9px]">
                                    {(selected.name || "?").substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs">{selected.name}</span>
                            <X
                                className="ml-auto h-3 w-3 text-neutral-400 hover:text-red-500"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeValue(null);
                                }}
                            />
                        </>
                    ) : (
                        <span className="text-xs text-neutral-400">Empty</span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search members…"
                    className="h-8"
                />
                <div className="mt-2 max-h-60 space-y-0.5 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-1 text-xs italic text-neutral-500">
                            No members
                        </p>
                    ) : (
                        filtered.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                    onChangeValue(m.id);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                            >
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={m.image || undefined} />
                                    <AvatarFallback className="text-[10px]">
                                        {(m.name || "?").substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-medium">
                                        {m.name || "Unknown"}
                                    </div>
                                    <div className="truncate text-[10px] text-neutral-500">
                                        {m.email}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
