"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DatabasePropertyType } from "@prisma/client";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectCell } from "@/components/databases/select-cell";
import { PersonCell } from "@/components/databases/person-cell";
import { ImageCell } from "@/components/databases/image-cell";
import { RelationCell } from "@/components/databases/relation-cell";
import { StatusCell } from "@/components/databases/status-cell";
import { isRollupValue } from "@/lib/database-rollup";
import { RollupValueRenderer } from "@/components/databases/database-table-view";
import { BlockEditor } from "@/components/wiki/block-editor-lazy";
import { useSetRowContent } from "@/hooks/use-databases";
import { parseFormulaConfig } from "@/lib/database-types";
import { evaluateFormula } from "@/lib/formula-engine";

interface DbProperty {
    id: string;
    name: string;
    type: DatabasePropertyType;
    config: unknown;
}

interface DbValue {
    propertyId: string;
    value: unknown;
}

interface DbRow {
    id: string;
    values: DbValue[];
    content?: unknown;
}

interface RowDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    databaseId: string;
    row: DbRow | null;
    properties: DbProperty[];
    onSetValue: (rowId: string, propertyId: string, value: unknown) => void;
    onAddOption: (
        propertyId: string,
        currentConfig: unknown,
        option: unknown,
    ) => Promise<void>;
}

/**
 * Notion-style row page in a wide side sheet.
 *
 * Layout:
 *   - Big title: the value of the first TEXT property (the row's "name").
 *     Editing the title saves through the same setRowValue callback.
 *   - Properties panel: every other property as label + cell editor stacked
 *     vertically.
 *   - Divider
 *   - BlockNote editor: the row's long-form body, persisted via setRowContent.
 *     Edits debounce-save 800 ms after the last keystroke.
 */
export function RowDetailSheet({
    open,
    onOpenChange,
    databaseId,
    row,
    properties,
    onSetValue,
    onAddOption,
}: RowDetailSheetProps) {
    const setContent = useSetRowContent(databaseId);

    // Debounced content save
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRowId = useRef<string | null>(null);
    useEffect(() => {
        // When the open row changes, cancel any pending save from the previous row.
        if (row?.id !== lastSavedRowId.current) {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            lastSavedRowId.current = row?.id ?? null;
        }
    }, [row?.id]);

    const handleContentChange = (content: unknown) => {
        if (!row) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            setContent.mutate({ rowId: row.id, content: content as any });
        }, 800);
    };

    const titleProp = useMemo(
        () => properties.find((p) => p.type === "TEXT") || null,
        [properties],
    );
    const otherProps = useMemo(
        () => properties.filter((p) => p.id !== titleProp?.id),
        [properties, titleProp],
    );

    if (!row) return null;

    const valueFor = (propertyId: string) =>
        row.values.find((v) => v.propertyId === propertyId)?.value;

    const titleValue = titleProp ? valueFor(titleProp.id) : undefined;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-[760px]">
                <SheetHeader className="sr-only">
                    <SheetTitle>Row</SheetTitle>
                </SheetHeader>

                <div className="mx-auto max-w-[680px] space-y-6 pt-6">
                    {/* Big title */}
                    {titleProp && (
                        <Input
                            key={`title-${row.id}`}
                            defaultValue={
                                typeof titleValue === "string" ? titleValue : ""
                            }
                            placeholder="Untitled"
                            onBlur={(e) =>
                                onSetValue(row.id, titleProp.id, e.target.value)
                            }
                            className="h-auto border-0 bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0"
                        />
                    )}

                    {/* Properties panel */}
                    {otherProps.length > 0 && (
                        <div className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                            {otherProps.map((p) => (
                                <div
                                    key={p.id}
                                    className="grid grid-cols-[120px_1fr] items-start gap-3"
                                >
                                    <label className="pt-1 text-xs uppercase text-neutral-500">
                                        {p.name}
                                    </label>
                                    <div>
                                        {p.type === "FORMULA" ? (
                                            <FormulaReadoutInSheet
                                                property={p}
                                                row={row}
                                                allProperties={properties}
                                            />
                                        ) : (
                                        <FieldEditor
                                            property={p}
                                            rowId={row.id}
                                            value={valueFor(p.id)}
                                            onChange={(v) => onSetValue(row.id, p.id, v)}
                                            onAddOption={(opt) =>
                                                onAddOption(p.id, p.config, opt)
                                            }
                                        />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Long-form body */}
                    <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                        <BlockEditor
                            key={`body-${row.id}`}
                            initialContent={row.content as any}
                            onChange={handleContentChange}
                            editable
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function FieldEditor({
    property,
    rowId,
    value,
    onChange,
    onAddOption,
}: {
    property: DbProperty;
    rowId?: string;
    value: unknown;
    onChange: (v: unknown) => void;
    onAddOption: (opt: unknown) => Promise<void>;
}) {
    switch (property.type) {
        case "TEXT":
        case "URL":
        case "EMAIL":
            return (
                <Input
                    defaultValue={typeof value === "string" ? value : ""}
                    onBlur={(e) => onChange(e.target.value)}
                />
            );
        case "NUMBER":
            return (
                <Input
                    type="number"
                    defaultValue={typeof value === "number" ? value : ""}
                    onBlur={(e) =>
                        onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                />
            );
        case "DATE":
            return (
                <Input
                    type="date"
                    defaultValue={typeof value === "string" ? value : ""}
                    onBlur={(e) => onChange(e.target.value || null)}
                />
            );
        case "CHECKBOX":
            return (
                <Checkbox
                    checked={value === true}
                    onCheckedChange={(c) => onChange(c === true)}
                />
            );
        case "SELECT":
        case "MULTI_SELECT":
            return (
                <SelectCell
                    config={property.config}
                    value={value}
                    multi={property.type === "MULTI_SELECT"}
                    onChangeValue={onChange}
                    onAddOption={onAddOption}
                />
            );
        case "PERSON":
            return <PersonCell value={value} onChangeValue={onChange} />;
        case "RELATION":
            return (
                <RelationCell
                    config={property.config}
                    value={value}
                    onChangeValue={onChange}
                />
            );
        case "STATUS":
            return (
                <StatusCell
                    config={property.config}
                    value={value}
                    onChangeValue={onChange}
                    onAddOption={(opt) => onAddOption(opt) as Promise<void>}
                />
            );
        case "ROLLUP":
            return isRollupValue(value) ? (
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    <RollupValueRenderer value={value} />
                </div>
            ) : (
                <div className="text-sm text-neutral-400">—</div>
            );
        case "FORMULA":
            // Handled at parent level with full row context.
            return <div className="text-sm text-neutral-400">—</div>;
        case "IMAGE":
            return (
                <ImageCell
                    rowId={rowId}
                    value={value}
                    onChange={onChange}
                    size="large"
                />
            );
        default:
            return null;
    }
}

function FormulaReadoutInSheet({
    property,
    row,
    allProperties,
}: {
    property: DbProperty;
    row: DbRow;
    allProperties: DbProperty[];
}) {
    const { expression } = parseFormulaConfig(property.config);
    if (!expression) {
        return <div className="text-sm italic text-neutral-400">No formula</div>;
    }
    const propValues: Record<string, unknown> = {};
    for (const p of allProperties) {
        const v = row.values.find((val) => val.propertyId === p.id);
        propValues[p.name] = v?.value ?? null;
    }
    const { value, error } = evaluateFormula(expression, propValues);
    if (error) {
        return (
            <div className="text-sm text-red-500" title={error}>
                Error: {error}
            </div>
        );
    }
    if (value === null || value === undefined) {
        return <div className="text-sm text-neutral-400">—</div>;
    }
    if (typeof value === "boolean") {
        return <div className="text-sm">{value ? "True" : "False"}</div>;
    }
    if (typeof value === "number") {
        return (
            <div className="text-sm tabular-nums">
                {Number.isInteger(value) ? value : value.toFixed(2)}
            </div>
        );
    }
    return <div className="text-sm">{String(value)}</div>;
}
