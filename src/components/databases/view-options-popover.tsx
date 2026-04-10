"use client";

import { DatabasePropertyType } from "@prisma/client";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, Trash2, Plus } from "lucide-react";
import {
    ViewFilter,
    ViewFilterOp,
    ViewOptions,
    ViewSort,
    parseViewOptions,
} from "@/lib/database-view-config";
import { useUpdateView } from "@/hooks/use-databases";
import { parseRelationConfig } from "@/lib/database-types";
import { useQuery } from "@tanstack/react-query";
import { getRelationRowsLite } from "@/actions/databases";

interface DbProperty {
    id: string;
    name: string;
    type: DatabasePropertyType;
    config?: unknown;
}

interface ViewOptionsPopoverProps {
    databaseId: string;
    viewId: string;
    /** The full view config blob — we extract ViewOptions out of it. */
    viewConfig: unknown;
    properties: DbProperty[];
}

const FILTER_OPS: { value: ViewFilterOp; label: string }[] = [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "doesn't equal" },
    { value: "contains", label: "contains" },
    { value: "isEmpty", label: "is empty" },
    { value: "isNotEmpty", label: "is not empty" },
    { value: "linksTo", label: "links to" },
    { value: "doesNotLinkTo", label: "doesn't link to" },
];

export function ViewOptionsPopover({
    databaseId,
    viewId,
    viewConfig,
    properties,
}: ViewOptionsPopoverProps) {
    const updateView = useUpdateView(databaseId);
    const opts = parseViewOptions(viewConfig);
    const sorts: ViewSort[] = opts.sorts || [];
    const filters: ViewFilter[] = opts.filters || [];
    const hidden = opts.hiddenPropertyIds || [];

    // Preserve any view-type-specific keys (groupByPropertyId, etc.) when
    // writing back. The new ViewOptions fields override only those keys.
    const persist = (next: Partial<ViewOptions>) => {
        const base =
            viewConfig && typeof viewConfig === "object"
                ? (viewConfig as Record<string, unknown>)
                : {};
        const merged: Record<string, unknown> = { ...base, ...next };
        updateView.mutate({ viewId, config: merged as any });
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Settings2 className="mr-1 h-3 w-3" />
                    View
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-3" align="end">
                <div className="space-y-4">
                    {/* Sorts */}
                    <Section
                        title="Sort"
                        onAdd={() =>
                            persist({
                                sorts: [
                                    ...sorts,
                                    {
                                        propertyId: properties[0]?.id || "",
                                        direction: "asc",
                                    },
                                ],
                            })
                        }
                    >
                        {sorts.length === 0 && (
                            <p className="text-xs italic text-neutral-500">No sorts</p>
                        )}
                        {sorts.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <Select
                                    value={s.propertyId}
                                    onValueChange={(v) => {
                                        const next = [...sorts];
                                        next[idx] = { ...s, propertyId: v };
                                        persist({ sorts: next });
                                    }}
                                >
                                    <SelectTrigger className="h-7 flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {properties.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={s.direction}
                                    onValueChange={(v) => {
                                        const next = [...sorts];
                                        next[idx] = { ...s, direction: v as "asc" | "desc" };
                                        persist({ sorts: next });
                                    }}
                                >
                                    <SelectTrigger className="h-7 w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asc">↑ Asc</SelectItem>
                                        <SelectItem value="desc">↓ Desc</SelectItem>
                                    </SelectContent>
                                </Select>
                                <button
                                    type="button"
                                    onClick={() =>
                                        persist({
                                            sorts: sorts.filter((_, i) => i !== idx),
                                        })
                                    }
                                    aria-label="Remove sort"
                                    className="text-neutral-400 hover:text-red-500"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </Section>

                    {/* Filters */}
                    <Section
                        title="Filter"
                        onAdd={() =>
                            persist({
                                filters: [
                                    ...filters,
                                    {
                                        propertyId: properties[0]?.id || "",
                                        op: "equals",
                                        value: "",
                                    },
                                ],
                            })
                        }
                    >
                        {filters.length === 0 && (
                            <p className="text-xs italic text-neutral-500">No filters</p>
                        )}
                        {filters.map((f, idx) => {
                            const needsValue = f.op !== "isEmpty" && f.op !== "isNotEmpty";
                            return (
                                <div key={idx} className="flex items-center gap-1.5">
                                    <Select
                                        value={f.propertyId}
                                        onValueChange={(v) => {
                                            const next = [...filters];
                                            next[idx] = { ...f, propertyId: v };
                                            persist({ filters: next });
                                        }}
                                    >
                                        <SelectTrigger className="h-7 w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {properties.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={f.op}
                                        onValueChange={(v) => {
                                            const next = [...filters];
                                            next[idx] = { ...f, op: v as ViewFilterOp };
                                            persist({ filters: next });
                                        }}
                                    >
                                        <SelectTrigger className="h-7 w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FILTER_OPS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>
                                                    {o.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {needsValue && (
                                        (() => {
                                            const filterProp = properties.find(
                                                (p) => p.id === f.propertyId,
                                            );
                                            const isRelationOp =
                                                filterProp?.type === "RELATION" &&
                                                (f.op === "linksTo" ||
                                                    f.op === "doesNotLinkTo");
                                            if (isRelationOp) {
                                                return (
                                                    <RelationFilterValue
                                                        config={filterProp?.config}
                                                        value={
                                                            typeof f.value === "string"
                                                                ? f.value
                                                                : ""
                                                        }
                                                        onChange={(v) => {
                                                            const next = [...filters];
                                                            next[idx] = { ...f, value: v };
                                                            persist({ filters: next });
                                                        }}
                                                    />
                                                );
                                            }
                                            return (
                                                <Input
                                                    defaultValue={
                                                        typeof f.value === "string" ||
                                                        typeof f.value === "number"
                                                            ? String(f.value)
                                                            : ""
                                                    }
                                                    onBlur={(e) => {
                                                        const next = [...filters];
                                                        next[idx] = {
                                                            ...f,
                                                            value: e.target.value,
                                                        };
                                                        persist({ filters: next });
                                                    }}
                                                    className="h-7 flex-1"
                                                    placeholder="value"
                                                />
                                            );
                                        })()
                                    )}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            persist({
                                                filters: filters.filter((_, i) => i !== idx),
                                            })
                                        }
                                        aria-label="Remove filter"
                                        className="text-neutral-400 hover:text-red-500"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </Section>

                    {/* Hidden columns */}
                    <Section title="Properties">
                        {properties.length === 0 && (
                            <p className="text-xs italic text-neutral-500">
                                No properties
                            </p>
                        )}
                        {properties.map((p) => {
                            const visible = !hidden.includes(p.id);
                            return (
                                <label
                                    key={p.id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                >
                                    <Checkbox
                                        checked={visible}
                                        onCheckedChange={(c) => {
                                            const next =
                                                c === true
                                                    ? hidden.filter((id) => id !== p.id)
                                                    : [...hidden, p.id];
                                            persist({ hiddenPropertyIds: next });
                                        }}
                                    />
                                    <span className="text-xs">{p.name}</span>
                                </label>
                            );
                        })}
                    </Section>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function RelationFilterValue({
    config,
    value,
    onChange,
}: {
    config: unknown;
    value: string;
    onChange: (v: string) => void;
}) {
    const { targetDatabaseId } = parseRelationConfig(config);
    const { data: rows } = useQuery({
        queryKey: ["relation-rows-filter", targetDatabaseId],
        queryFn: () =>
            targetDatabaseId
                ? getRelationRowsLite(targetDatabaseId, { pageSize: 200 })
                : Promise.resolve([] as { id: string; title: string }[]),
        enabled: !!targetDatabaseId,
        staleTime: 30 * 1000,
    });
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-7 flex-1">
                <SelectValue placeholder="Pick row…" />
            </SelectTrigger>
            <SelectContent>
                {(rows || []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                        {r.title}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function Section({
    title,
    onAdd,
    children,
}: {
    title: string;
    onAdd?: () => void;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-[10px] font-semibold uppercase text-neutral-500">
                    {title}
                </h4>
                {onAdd && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="text-xs text-primary hover:underline"
                    >
                        <Plus className="inline h-3 w-3" /> Add
                    </button>
                )}
            </div>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}
