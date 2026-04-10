"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DatabasePropertyType } from "@prisma/client";
import {
    addDays,
    differenceInCalendarDays,
    format,
    isFirstDayOfMonth,
    isSameDay,
    parseISO,
    startOfDay,
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
import {
    parseTimelineConfig,
    TimelineZoom,
} from "@/lib/database-view-config";
import { useSetRowValue, useUpdateView } from "@/hooks/use-databases";
import {
    parseSelectConfig,
    parseStatusConfig,
    SELECT_DOT_CLASSES,
} from "@/lib/database-types";

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

interface DatabaseTimelineViewProps {
    databaseId: string;
    viewId: string;
    viewConfig: unknown;
    properties: DbProperty[];
    rows: DbRow[];
    onOpenRow?: (rowId: string) => void;
}

/** Per-zoom visual constants. */
const ZOOM_SETTINGS: Record<
    TimelineZoom,
    { dayWidth: number; viewportDays: number; pageDays: number; labelEvery: number }
> = {
    day: { dayWidth: 36, viewportDays: 60, pageDays: 14, labelEvery: 1 },
    week: { dayWidth: 14, viewportDays: 120, pageDays: 28, labelEvery: 7 },
    month: { dayWidth: 5, viewportDays: 365, pageDays: 60, labelEvery: 30 },
};

const ROW_HEIGHT = 40;

/** Convert an absolute X offset (inside the grid) to a whole number of days. */
function pxToDays(px: number, dayWidth: number): number {
    return Math.round(px / dayWidth);
}

/** ISO date string (yyyy-MM-dd) usable as a DATE property value. */
function toIsoDate(d: Date): string {
    return format(d, "yyyy-MM-dd");
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
    rowId: string;
    mode: DragMode;
    originStartDays: number; // offset from cursor, in days
    originEndDays: number;
    pointerOriginX: number;
    deltaDays: number; // live delta while dragging
}

export function DatabaseTimelineView({
    databaseId,
    viewId,
    viewConfig,
    properties,
    rows,
    onOpenRow,
}: DatabaseTimelineViewProps) {
    const updateView = useUpdateView(databaseId);
    const setRowValue = useSetRowValue(databaseId);

    const cfg = parseTimelineConfig(viewConfig);
    const zoom: TimelineZoom = cfg.zoom || "day";
    const Z = ZOOM_SETTINGS[zoom];

    const dateProps = properties.filter((p) => p.type === "DATE");
    const startProp = properties.find(
        (p) => p.id === cfg.startDatePropertyId && p.type === "DATE",
    );
    const endProp = properties.find(
        (p) => p.id === cfg.endDatePropertyId && p.type === "DATE",
    );
    const titleProp = properties.find((p) => p.type === "TEXT");
    const groupableProps = properties.filter(
        (p) => p.type === "SELECT" || p.type === "STATUS",
    );
    const groupByProp = properties.find(
        (p) =>
            p.id === cfg.groupByPropertyId &&
            (p.type === "SELECT" || p.type === "STATUS"),
    );

    const [cursor, setCursor] = useState(() =>
        addDays(startOfDay(new Date()), -Math.floor(Z.viewportDays / 6)),
    );
    // Re-anchor cursor when zoom changes so the window makes sense.
    const prevZoom = useRef(zoom);
    useEffect(() => {
        if (prevZoom.current !== zoom) {
            setCursor(
                addDays(
                    startOfDay(new Date()),
                    -Math.floor(ZOOM_SETTINGS[zoom].viewportDays / 6),
                ),
            );
            prevZoom.current = zoom;
        }
    }, [zoom]);

    const [drag, setDrag] = useState<DragState | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);

    const days = useMemo(() => {
        const out: Date[] = [];
        for (let i = 0; i < Z.viewportDays; i++) {
            out.push(addDays(cursor, i));
        }
        return out;
    }, [cursor, Z.viewportDays]);

    // Compute (start, end) offsets in days from cursor for every row.
    interface Bar {
        row: DbRow;
        startDays: number;
        endDays: number;
    }
    const allBars = useMemo(() => {
        if (!startProp) return [] as Bar[];
        const out: Bar[] = [];
        for (const row of rows) {
            const startVal = row.values.find(
                (v) => v.propertyId === startProp.id,
            )?.value;
            if (typeof startVal !== "string" || !startVal) continue;
            let start: Date;
            try {
                start = startOfDay(parseISO(startVal));
            } catch {
                continue;
            }
            let end = start;
            if (endProp) {
                const endVal = row.values.find(
                    (v) => v.propertyId === endProp.id,
                )?.value;
                if (typeof endVal === "string" && endVal) {
                    try {
                        end = startOfDay(parseISO(endVal));
                        if (end < start) end = start;
                    } catch {
                        // ignore malformed
                    }
                }
            }
            out.push({
                row,
                startDays: differenceInCalendarDays(start, cursor),
                endDays: differenceInCalendarDays(end, cursor),
            });
        }
        return out;
    }, [rows, startProp, endProp, cursor]);

    // Group bars for swimlanes.
    interface Swimlane {
        key: string;
        label: string;
        colorClass: string | null;
        bars: Bar[];
    }
    const swimlanes = useMemo<Swimlane[]>(() => {
        if (!groupByProp) {
            return [{ key: "__all", label: "", colorClass: null, bars: allBars }];
        }
        const opts =
            groupByProp.type === "STATUS"
                ? parseStatusConfig(groupByProp.config).options.map((o) => ({
                      id: o.id,
                      name: o.name,
                      color: o.color,
                  }))
                : parseSelectConfig(groupByProp.config).options;
        const lanes: Swimlane[] = opts.map((o) => ({
            key: o.id,
            label: o.name,
            colorClass: SELECT_DOT_CLASSES[o.color],
            bars: [],
        }));
        lanes.push({ key: "__none", label: "No value", colorClass: null, bars: [] });
        for (const bar of allBars) {
            const v = bar.row.values.find(
                (x) => x.propertyId === groupByProp.id,
            )?.value;
            const key =
                typeof v === "string" && opts.some((o) => o.id === v)
                    ? v
                    : "__none";
            lanes.find((l) => l.key === key)?.bars.push(bar);
        }
        // Hide empty lanes except the "No value" bucket.
        return lanes.filter((l) => l.bars.length > 0 || l.key === "__none");
    }, [allBars, groupByProp]);

    // Unscheduled = any row we couldn't turn into a bar (missing start OR
    // missing both OR malformed dates).
    const unscheduled = useMemo(() => {
        if (!startProp) return rows;
        const scheduledIds = new Set(allBars.map((b) => b.row.id));
        return rows.filter((r) => !scheduledIds.has(r.id));
    }, [rows, startProp, allBars]);

    // ─── Drag handling ────────────────────────────────────────────────────

    useEffect(() => {
        if (!drag) return;
        const handleMove = (e: PointerEvent) => {
            const dx = e.clientX - drag.pointerOriginX;
            setDrag((s) => (s ? { ...s, deltaDays: pxToDays(dx, Z.dayWidth) } : s));
        };
        const handleUp = async () => {
            // Commit drag via setRowValue(s).
            if (!startProp) {
                setDrag(null);
                return;
            }
            const d = drag;
            setDrag(null);
            let newStartDays = d.originStartDays;
            let newEndDays = d.originEndDays;
            if (d.mode === "move") {
                newStartDays += d.deltaDays;
                newEndDays += d.deltaDays;
            } else if (d.mode === "resize-end") {
                newEndDays = Math.max(d.originStartDays, newEndDays + d.deltaDays);
            } else if (d.mode === "resize-start") {
                newStartDays = Math.min(
                    d.originEndDays,
                    newStartDays + d.deltaDays,
                );
            }
            const newStart = addDays(cursor, newStartDays);
            const newEnd = addDays(cursor, newEndDays);
            const writes: Promise<unknown>[] = [];
            const shouldWriteStart =
                (d.mode === "move" || d.mode === "resize-start") &&
                d.deltaDays !== 0;
            const shouldWriteEnd =
                (d.mode === "move" || d.mode === "resize-end") &&
                d.deltaDays !== 0;
            if (shouldWriteStart && startProp) {
                writes.push(
                    setRowValue.mutateAsync({
                        rowId: d.rowId,
                        propertyId: startProp.id,
                        value: toIsoDate(newStart) as any,
                    }),
                );
            }
            if (shouldWriteEnd && endProp) {
                writes.push(
                    setRowValue.mutateAsync({
                        rowId: d.rowId,
                        propertyId: endProp.id,
                        value: toIsoDate(newEnd) as any,
                    }),
                );
            }
            await Promise.all(writes);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };
    }, [drag, cursor, Z.dayWidth, startProp, endProp, setRowValue]);

    if (dateProps.length === 0) {
        return (
            <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                Add a Date property to use the timeline.
            </div>
        );
    }

    const today = startOfDay(new Date());
    const cursorEnd = addDays(cursor, Z.viewportDays - 1);
    const gridWidth = Z.viewportDays * Z.dayWidth;

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-500">Start</span>
                    <Select
                        value={cfg.startDatePropertyId || ""}
                        onValueChange={(v) =>
                            updateView.mutate({
                                viewId,
                                config: { ...cfg, startDatePropertyId: v } as any,
                            })
                        }
                    >
                        <SelectTrigger className="h-7 w-28">
                            <SelectValue placeholder="—" />
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
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-500">End</span>
                    <Select
                        value={cfg.endDatePropertyId || "__none"}
                        onValueChange={(v) =>
                            updateView.mutate({
                                viewId,
                                config: {
                                    ...cfg,
                                    endDatePropertyId:
                                        v === "__none" ? undefined : v,
                                } as any,
                            })
                        }
                    >
                        <SelectTrigger className="h-7 w-28">
                            <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none">None</SelectItem>
                            {dateProps
                                .filter((p) => p.id !== cfg.startDatePropertyId)
                                .map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
                {groupableProps.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-neutral-500">Group</span>
                        <Select
                            value={cfg.groupByPropertyId || "__none"}
                            onValueChange={(v) =>
                                updateView.mutate({
                                    viewId,
                                    config: {
                                        ...cfg,
                                        groupByPropertyId:
                                            v === "__none" ? undefined : v,
                                    } as any,
                                })
                            }
                        >
                            <SelectTrigger className="h-7 w-28">
                                <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none">None</SelectItem>
                                {groupableProps.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-500">Zoom</span>
                    <Select
                        value={zoom}
                        onValueChange={(v) =>
                            updateView.mutate({
                                viewId,
                                config: {
                                    ...cfg,
                                    zoom: v as TimelineZoom,
                                } as any,
                            })
                        }
                    >
                        <SelectTrigger className="h-7 w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="week">Week</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCursor((c) => addDays(c, -Z.pageDays))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-neutral-500">
                        {format(cursor, "MMM d")} – {format(cursorEnd, "MMM d, yyyy")}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCursor((c) => addDays(c, Z.pageDays))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                            setCursor(
                                addDays(
                                    startOfDay(new Date()),
                                    -Math.floor(Z.viewportDays / 6),
                                ),
                            )
                        }
                    >
                        Today
                    </Button>
                </div>
            </div>

            {!startProp ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                    Pick a start date property to display rows.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
                    {/* Header strip */}
                    <div
                        className="relative flex select-none border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
                        style={{ width: gridWidth }}
                    >
                        {days.map((d, i) => {
                            const isToday = isSameDay(d, today);
                            const monthBoundary = isFirstDayOfMonth(d);
                            const showLabel = i % Z.labelEvery === 0;
                            return (
                                <div
                                    key={d.toISOString()}
                                    className={`flex-shrink-0 border-r border-neutral-200 py-1 text-center dark:border-neutral-800 ${
                                        isToday
                                            ? "bg-primary/10 font-bold text-primary"
                                            : ""
                                    } ${monthBoundary ? "border-l-2 border-l-neutral-400 dark:border-l-neutral-600" : ""}`}
                                    style={{ width: Z.dayWidth }}
                                >
                                    {showLabel && (
                                        <>
                                            {zoom === "day" && (
                                                <>
                                                    <div className="text-[9px] uppercase text-neutral-400">
                                                        {format(d, "EEE")}
                                                    </div>
                                                    <div className="text-[11px]">
                                                        {format(d, "d")}
                                                    </div>
                                                </>
                                            )}
                                            {zoom === "week" && (
                                                <div className="whitespace-nowrap text-[10px]">
                                                    {format(d, "MMM d")}
                                                </div>
                                            )}
                                            {zoom === "month" && (
                                                <div className="whitespace-nowrap text-[10px] font-medium">
                                                    {format(d, "MMM")}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Grid + bars */}
                    <div ref={gridRef} className="relative" style={{ width: gridWidth }}>
                        {swimlanes.map((lane) => (
                            <SwimlaneBand
                                key={lane.key}
                                lane={lane}
                                Z={Z}
                                viewportDays={Z.viewportDays}
                                today={today}
                                cursor={cursor}
                                titleProp={titleProp}
                                drag={drag}
                                onStartDrag={(rowId, mode, startDays, endDays, e) => {
                                    e.preventDefault();
                                    setDrag({
                                        rowId,
                                        mode,
                                        originStartDays: startDays,
                                        originEndDays: endDays,
                                        pointerOriginX: e.clientX,
                                        deltaDays: 0,
                                    });
                                }}
                                onOpenRow={onOpenRow}
                                showHeader={!!groupByProp}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Unscheduled rows */}
            {unscheduled.length > 0 && startProp && (
                <div>
                    <h3 className="mb-2 text-[10px] font-semibold uppercase text-neutral-500">
                        Unscheduled ({unscheduled.length})
                    </h3>
                    <div className="space-y-1">
                        {unscheduled.slice(0, 10).map((row) => {
                            const titleValue = titleProp
                                ? row.values.find((v) => v.propertyId === titleProp.id)
                                      ?.value
                                : undefined;
                            return (
                                <button
                                    type="button"
                                    key={row.id}
                                    onClick={() => onOpenRow?.(row.id)}
                                    className="block w-full truncate rounded border border-dashed border-neutral-200 px-2 py-1 text-left text-xs text-neutral-600 hover:border-primary hover:text-primary dark:border-neutral-800 dark:text-neutral-400"
                                >
                                    {typeof titleValue === "string" && titleValue
                                        ? titleValue
                                        : "Untitled"}
                                </button>
                            );
                        })}
                        {unscheduled.length > 10 && (
                            <p className="text-[10px] text-neutral-400">
                                +{unscheduled.length - 10} more
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

interface Bar {
    row: DbRow;
    startDays: number;
    endDays: number;
}

function SwimlaneBand({
    lane,
    Z,
    viewportDays,
    today,
    cursor,
    titleProp,
    drag,
    onStartDrag,
    onOpenRow,
    showHeader,
}: {
    lane: { key: string; label: string; colorClass: string | null; bars: Bar[] };
    Z: (typeof ZOOM_SETTINGS)[TimelineZoom];
    viewportDays: number;
    today: Date;
    cursor: Date;
    titleProp: DbProperty | undefined;
    drag: DragState | null;
    onStartDrag: (
        rowId: string,
        mode: DragMode,
        startDays: number,
        endDays: number,
        e: React.PointerEvent,
    ) => void;
    onOpenRow?: (rowId: string) => void;
    showHeader: boolean;
}) {
    const laneHeight = Math.max(lane.bars.length * ROW_HEIGHT, ROW_HEIGHT);

    return (
        <div>
            {showHeader && (
                <div
                    className="sticky left-0 z-[1] flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50/80 px-2 py-1 text-[10px] font-semibold uppercase text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80"
                    style={{ width: Z.viewportDays * Z.dayWidth }}
                >
                    {lane.colorClass && (
                        <span className={`h-1.5 w-1.5 rounded-full ${lane.colorClass}`} />
                    )}
                    {lane.label}
                    <span className="text-neutral-400">· {lane.bars.length}</span>
                </div>
            )}
            <div
                className="relative border-b border-neutral-100 dark:border-neutral-900"
                style={{ height: laneHeight }}
            >
                {/* Vertical grid lines */}
                {Array.from({ length: viewportDays }).map((_, idx) => {
                    const d = addDays(cursor, idx);
                    const isToday = isSameDay(d, today);
                    return (
                        <div
                            key={idx}
                            className={`absolute top-0 h-full border-r border-neutral-100 dark:border-neutral-900 ${
                                isToday ? "bg-primary/5" : ""
                            }`}
                            style={{ left: idx * Z.dayWidth, width: Z.dayWidth }}
                        />
                    );
                })}

                {lane.bars.map((bar, idx) => {
                    const liveDelta =
                        drag && drag.rowId === bar.row.id ? drag.deltaDays : 0;
                    let startDays = bar.startDays;
                    let endDays = bar.endDays;
                    if (drag && drag.rowId === bar.row.id) {
                        if (drag.mode === "move") {
                            startDays += liveDelta;
                            endDays += liveDelta;
                        } else if (drag.mode === "resize-end") {
                            endDays = Math.max(startDays, endDays + liveDelta);
                        } else if (drag.mode === "resize-start") {
                            startDays = Math.min(endDays, startDays + liveDelta);
                        }
                    }

                    // Clip to viewport
                    const visibleStart = Math.max(0, startDays);
                    const visibleEnd = Math.min(endDays + 1, viewportDays); // +1: end is inclusive
                    if (visibleEnd <= visibleStart) return null;
                    const left = visibleStart * Z.dayWidth + 2;
                    const width = (visibleEnd - visibleStart) * Z.dayWidth - 4;
                    if (width <= 0) return null;

                    const titleValue = titleProp
                        ? bar.row.values.find((v) => v.propertyId === titleProp.id)
                              ?.value
                        : undefined;

                    return (
                        <div
                            key={bar.row.id}
                            className="absolute flex items-center rounded bg-primary text-[11px] font-medium text-primary-foreground shadow-sm transition"
                            style={{
                                left,
                                top: idx * ROW_HEIGHT + 6,
                                width,
                                height: ROW_HEIGHT - 12,
                            }}
                            title={typeof titleValue === "string" ? titleValue : "Untitled"}
                        >
                            {/* Left resize handle */}
                            <div
                                onPointerDown={(e) =>
                                    onStartDrag(
                                        bar.row.id,
                                        "resize-start",
                                        bar.startDays,
                                        bar.endDays,
                                        e,
                                    )
                                }
                                className="h-full w-1.5 shrink-0 cursor-ew-resize rounded-l hover:bg-white/20"
                            />
                            {/* Body (click or drag-to-move) */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    // Only treat as click when no drag happened.
                                    if (drag && drag.rowId === bar.row.id) return;
                                    e.stopPropagation();
                                    onOpenRow?.(bar.row.id);
                                }}
                                onPointerDown={(e) => {
                                    if ((e.target as HTMLElement).closest(".cursor-ew-resize"))
                                        return;
                                    onStartDrag(
                                        bar.row.id,
                                        "move",
                                        bar.startDays,
                                        bar.endDays,
                                        e,
                                    );
                                }}
                                className="h-full flex-1 cursor-grab truncate px-2 text-left hover:brightness-110 active:cursor-grabbing"
                            >
                                {typeof titleValue === "string" && titleValue
                                    ? titleValue
                                    : "Untitled"}
                            </button>
                            {/* Right resize handle */}
                            <div
                                onPointerDown={(e) =>
                                    onStartDrag(
                                        bar.row.id,
                                        "resize-end",
                                        bar.startDays,
                                        bar.endDays,
                                        e,
                                    )
                                }
                                className="h-full w-1.5 shrink-0 cursor-ew-resize rounded-r hover:bg-white/20"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
