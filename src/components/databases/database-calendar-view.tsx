"use client";

import { useMemo, useState } from "react";
import { DatabasePropertyType } from "@prisma/client";
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    parseISO,
} from "date-fns";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseCalendarConfig } from "@/lib/database-view-config";
import { useUpdateView } from "@/hooks/use-databases";

interface DbProperty {
    id: string;
    name: string;
    type: DatabasePropertyType;
    config: unknown;
}

interface DbRow {
    id: string;
    values: { propertyId: string; value: unknown }[];
}

interface DatabaseCalendarViewProps {
    databaseId: string;
    viewId: string;
    viewConfig: unknown;
    properties: DbProperty[];
    rows: DbRow[];
    onOpenRow?: (rowId: string) => void;
}

export function DatabaseCalendarView({
    databaseId,
    viewId,
    viewConfig,
    properties,
    rows,
    onOpenRow,
}: DatabaseCalendarViewProps) {
    const updateView = useUpdateView(databaseId);
    const { datePropertyId } = parseCalendarConfig(viewConfig);
    const dateProps = properties.filter((p) => p.type === "DATE");
    const dateProp = properties.find(
        (p) => p.id === datePropertyId && p.type === "DATE",
    );
    const titleProp = properties.find((p) => p.type === "TEXT");

    const [cursor, setCursor] = useState(new Date());

    // Build the month grid
    const { days, weeks } = useMemo(() => {
        const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
        const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
        const out: Date[] = [];
        let d = gridStart;
        while (d <= gridEnd) {
            out.push(d);
            d = addDays(d, 1);
        }
        const wks: Date[][] = [];
        for (let i = 0; i < out.length; i += 7) wks.push(out.slice(i, i + 7));
        return { days: out, weeks: wks };
    }, [cursor]);

    // Group rows by ISO date
    const rowsByDay = useMemo(() => {
        const map = new Map<string, DbRow[]>();
        if (!dateProp) return map;
        for (const row of rows) {
            const v = row.values.find((x) => x.propertyId === dateProp.id)?.value;
            if (typeof v !== "string" || !v) continue;
            try {
                const key = format(parseISO(v), "yyyy-MM-dd");
                const arr = map.get(key) || [];
                arr.push(row);
                map.set(key, arr);
            } catch {
                // skip
            }
        }
        return map;
    }, [rows, dateProp]);

    if (dateProps.length === 0) {
        return (
            <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                Add a Date property to show rows on a calendar.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Date property</span>
                    <Select
                        value={datePropertyId || ""}
                        onValueChange={(v) =>
                            updateView.mutate({
                                viewId,
                                config: { ...parseCalendarConfig(viewConfig), datePropertyId: v } as any,
                            })
                        }
                    >
                        <SelectTrigger className="h-7 w-40">
                            <SelectValue placeholder="Pick property" />
                        </SelectTrigger>
                        <SelectContent>
                            {dateProps.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCursor((c) => subMonths(c, 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center text-sm font-medium">
                        {format(cursor, "MMMM yyyy")}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCursor((c) => addMonths(c, 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {!dateProp ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                    Pick a Date property to display rows.
                </div>
            ) : (
                <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                    <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-[10px] font-medium uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                            <div key={d} className="px-2 py-1.5">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {days.map((day) => {
                            const inMonth = isSameMonth(day, cursor);
                            const key = format(day, "yyyy-MM-dd");
                            const dayRows = rowsByDay.get(key) || [];
                            return (
                                <div
                                    key={key}
                                    className={`min-h-[96px] border-b border-r border-neutral-200 p-1.5 dark:border-neutral-800 ${
                                        inMonth
                                            ? "bg-white dark:bg-neutral-950"
                                            : "bg-neutral-50/50 dark:bg-neutral-900/30"
                                    }`}
                                >
                                    <div
                                        className={`mb-1 text-xs ${
                                            isSameDay(day, new Date())
                                                ? "font-bold text-primary"
                                                : inMonth
                                                  ? "text-neutral-700 dark:text-neutral-300"
                                                  : "text-neutral-400"
                                        }`}
                                    >
                                        {format(day, "d")}
                                    </div>
                                    <div className="space-y-0.5">
                                        {dayRows.slice(0, 3).map((row) => {
                                            const title = titleProp
                                                ? row.values.find(
                                                      (v) => v.propertyId === titleProp.id,
                                                  )?.value
                                                : undefined;
                                            return (
                                                <button
                                                    type="button"
                                                    key={row.id}
                                                    onClick={() => onOpenRow?.(row.id)}
                                                    className="block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[10px] text-primary hover:bg-primary/20"
                                                >
                                                    {typeof title === "string" && title
                                                        ? title
                                                        : "Untitled"}
                                                </button>
                                            );
                                        })}
                                        {dayRows.length > 3 && (
                                            <div className="text-[9px] text-neutral-400">
                                                +{dayRows.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
