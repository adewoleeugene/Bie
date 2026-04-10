"use client";

import { useMemo } from "react";
import { DatabasePropertyType } from "@prisma/client";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    useDraggable,
} from "@dnd-kit/core";
import {
    parseSelectConfig,
    parseStatusConfig,
    SELECT_DOT_CLASSES,
} from "@/lib/database-types";
import { parseBoardConfig } from "@/lib/database-view-config";
import { ValueDisplay } from "@/components/databases/value-display";
import { useSetRowValue, useUpdateView } from "@/hooks/use-databases";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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

interface DatabaseBoardViewProps {
    databaseId: string;
    viewId: string;
    viewConfig: unknown;
    properties: DbProperty[];
    rows: DbRow[];
}

const UNGROUPED = "__ungrouped__";

export function DatabaseBoardView({
    databaseId,
    viewId,
    viewConfig,
    properties,
    rows,
}: DatabaseBoardViewProps) {
    const updateView = useUpdateView(databaseId);
    const setValue = useSetRowValue(databaseId);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    const { groupByPropertyId } = parseBoardConfig(viewConfig);
    const groupByProp = properties.find(
        (p) =>
            p.id === groupByPropertyId &&
            (p.type === "SELECT" || p.type === "STATUS"),
    );

    const selectProps = properties.filter(
        (p) => p.type === "SELECT" || p.type === "STATUS",
    );

    // Name / title property = first text property for card labels
    const titleProp = properties.find((p) => p.type === "TEXT");

    // Build columns
    const columns = useMemo(() => {
        if (!groupByProp) return [];
        const opts =
            groupByProp.type === "STATUS"
                ? parseStatusConfig(groupByProp.config).options.map((o) => ({
                      id: o.id,
                      name: o.name,
                      color: o.color,
                  }))
                : parseSelectConfig(groupByProp.config).options;
        const cols: {
            id: string;
            label: string;
            colorClass: string | null;
            rows: DbRow[];
        }[] = opts.map((o) => ({
            id: o.id,
            label: o.name,
            colorClass: SELECT_DOT_CLASSES[o.color],
            rows: [],
        }));
        cols.push({ id: UNGROUPED, label: "No value", colorClass: null, rows: [] });
        for (const row of rows) {
            const v = row.values.find((x) => x.propertyId === groupByProp.id)?.value;
            const key = typeof v === "string" && opts.some((o) => o.id === v) ? v : UNGROUPED;
            cols.find((c) => c.id === key)?.rows.push(row);
        }
        return cols;
    }, [groupByProp, rows]);

    const handleDragEnd = (e: DragEndEvent) => {
        if (!groupByProp) return;
        const rowId = String(e.active.id);
        const newColId = e.over ? String(e.over.id) : null;
        if (!newColId) return;
        const value = newColId === UNGROUPED ? null : newColId;
        setValue.mutate({
            rowId,
            propertyId: groupByProp.id,
            value: value as any,
        });
    };

    if (selectProps.length === 0) {
        return (
            <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                Add a Select or Status property to group cards on the board.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Group by</span>
                <Select
                    value={groupByPropertyId || ""}
                    onValueChange={(v) =>
                        updateView.mutate({
                            viewId,
                            config: { groupByPropertyId: v } as any,
                        })
                    }
                >
                    <SelectTrigger className="h-7 w-40">
                        <SelectValue placeholder="Pick property" />
                    </SelectTrigger>
                    <SelectContent>
                        {selectProps.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {!groupByProp ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                    Pick a Select property to group by.
                </div>
            ) : (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {columns.map((col) => (
                            <BoardColumn
                                key={col.id}
                                id={col.id}
                                label={col.label}
                                colorClass={col.colorClass}
                                count={col.rows.length}
                            >
                                {col.rows.map((row) => (
                                    <BoardCard
                                        key={row.id}
                                        row={row}
                                        titleProp={titleProp}
                                        visibleProps={properties.filter(
                                            (p) => p.id !== groupByProp.id && p.id !== titleProp?.id,
                                        )}
                                    />
                                ))}
                            </BoardColumn>
                        ))}
                    </div>
                </DndContext>
            )}
        </div>
    );
}

function BoardColumn({
    id,
    label,
    colorClass,
    count,
    children,
}: {
    id: string;
    label: string;
    colorClass: string | null;
    count: number;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`flex min-h-[180px] w-64 flex-shrink-0 flex-col rounded-md border p-2 ${
                isOver
                    ? "border-primary bg-primary/5"
                    : "border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/30"
            }`}
        >
            <div className="mb-2 flex items-center gap-2 px-1">
                {colorClass && (
                    <span className={`h-2 w-2 rounded-full ${colorClass}`} />
                )}
                <span className="text-xs font-medium">{label}</span>
                <span className="text-xs text-neutral-400">{count}</span>
            </div>
            <div className="flex flex-col gap-2">{children}</div>
        </div>
    );
}

function BoardCard({
    row,
    titleProp,
    visibleProps,
}: {
    row: DbRow;
    titleProp: DbProperty | undefined;
    visibleProps: DbProperty[];
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({ id: row.id });
    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          }
        : undefined;
    const titleValue = titleProp
        ? row.values.find((v) => v.propertyId === titleProp.id)?.value
        : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`cursor-grab rounded-md border border-neutral-200 bg-white p-2 text-sm shadow-sm hover:border-primary dark:border-neutral-800 dark:bg-neutral-950 ${
                isDragging ? "opacity-50" : ""
            }`}
        >
            <div className="mb-1 text-sm font-medium">
                {typeof titleValue === "string" && titleValue
                    ? titleValue
                    : "Untitled"}
            </div>
            {visibleProps.length > 0 && (
                <div className="space-y-1">
                    {visibleProps.slice(0, 4).map((p) => {
                        const v = row.values.find((x) => x.propertyId === p.id)?.value;
                        return (
                            <div key={p.id} className="flex items-center gap-1">
                                <ValueDisplay property={p} value={v} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
