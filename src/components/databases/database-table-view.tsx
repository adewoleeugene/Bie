"use client";

import { useState } from "react";
import { DatabasePropertyType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Settings, Maximize2, Download } from "lucide-react";
import { exportDatabaseToCSV } from "@/lib/export";
import {
    useAddProperty,
    useAddRow,
    useDeleteProperty,
    useDeleteRow,
    useSetRowValue,
    useUpdateProperty,
} from "@/hooks/use-databases";
import { SelectCell } from "@/components/databases/select-cell";
import { PersonCell } from "@/components/databases/person-cell";
import { ImageCell } from "@/components/databases/image-cell";
import { RelationCell } from "@/components/databases/relation-cell";
import { StatusCell } from "@/components/databases/status-cell";
import { isRollupValue, RollupValue } from "@/lib/database-rollup";
import { StatusOption } from "@/lib/database-types";
import { PropertySettingsDialog } from "@/components/databases/property-settings-dialog";
import { RowDetailSheet } from "@/components/databases/row-detail-sheet";
import { parseSelectConfig, parseStatusConfig, parseFormulaConfig, SelectOption } from "@/lib/database-types";
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
}

interface DatabaseTableViewProps {
    databaseId: string;
    properties: DbProperty[];
    rows: DbRow[];
    /**
     * Compact mode used by wiki embeds:
     * - hides add-row / add-property buttons
     * - hides per-row delete and the expand gutter
     * - caps rows to `rowLimit`
     */
    compact?: boolean;
    rowLimit?: number;
    hiddenPropertyIds?: string[];
}

const PROPERTY_TYPE_LABELS: Record<DatabasePropertyType, string> = {
    TEXT: "Text",
    NUMBER: "Number",
    SELECT: "Select",
    MULTI_SELECT: "Multi-select",
    DATE: "Date",
    CHECKBOX: "Checkbox",
    PERSON: "Person",
    URL: "URL",
    EMAIL: "Email",
    IMAGE: "Image",
    RELATION: "Relation",
    ROLLUP: "Rollup",
    STATUS: "Status",
    FORMULA: "Formula",
};

/** Build a name→value map for formula evaluation from a row's values. */
function buildPropValues(
    row: DbRow,
    properties: DbProperty[],
): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const p of properties) {
        const v = row.values.find((val) => val.propertyId === p.id);
        map[p.name] = v?.value ?? null;
    }
    return map;
}

export function DatabaseTableView({
    databaseId,
    properties: rawProperties,
    rows: rawRows,
    compact = false,
    rowLimit,
    hiddenPropertyIds,
}: DatabaseTableViewProps) {
    const properties = hiddenPropertyIds && hiddenPropertyIds.length > 0
        ? rawProperties.filter((p) => !hiddenPropertyIds.includes(p.id))
        : rawProperties;
    const rows = rowLimit ? rawRows.slice(0, rowLimit) : rawRows;
    const addProperty = useAddProperty(databaseId);
    const updateProperty = useUpdateProperty(databaseId);
    const deleteProperty = useDeleteProperty(databaseId);
    const addRow = useAddRow(databaseId);
    const deleteRow = useDeleteRow(databaseId);
    const setValue = useSetRowValue(databaseId);

    const [newPropName, setNewPropName] = useState("");
    const [newPropType, setNewPropType] = useState<DatabasePropertyType>(
        DatabasePropertyType.TEXT,
    );
    const [showAddProp, setShowAddProp] = useState(false);
    const [editingProperty, setEditingProperty] = useState<DbProperty | null>(null);
    const [openRowId, setOpenRowId] = useState<string | null>(null);

    const valueFor = (row: DbRow, propertyId: string) =>
        row.values.find((v) => v.propertyId === propertyId)?.value;

    const handleAddSelectOption = async (
        propertyId: string,
        currentConfig: unknown,
        option: SelectOption,
    ) => {
        const cfg = parseSelectConfig(currentConfig);
        const next = { options: [...cfg.options, option] };
        await updateProperty.mutateAsync({ propertyId, config: next as any });
    };

    const handleAddStatusOption = async (
        propertyId: string,
        currentConfig: unknown,
        option: StatusOption,
    ) => {
        const cfg = parseStatusConfig(currentConfig);
        const next = { ...cfg, options: [...cfg.options, option] };
        await updateProperty.mutateAsync({ propertyId, config: next as any });
    };

    const openRow = rows.find((r) => r.id === openRowId) || null;

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-800">
                            {!compact && <th className="w-8 px-2 py-2"></th>}
                            {properties.map((p) => (
                                <th
                                    key={p.id}
                                    className="px-3 py-2 text-left font-medium text-neutral-600 dark:text-neutral-300"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-col">
                                            <span>{p.name}</span>
                                            <span className="text-[10px] uppercase text-neutral-400">
                                                {PROPERTY_TYPE_LABELS[p.type]}
                                            </span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="text-neutral-400 hover:text-primary"
                                                    aria-label="Property menu"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => setEditingProperty(p)}
                                                >
                                                    <Settings className="mr-2 h-4 w-4" />
                                                    Edit property
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => deleteProperty.mutate(p.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete property
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </th>
                            ))}
                            {!compact && <th className="px-3 py-2 text-left">
                                {showAddProp ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={newPropName}
                                            onChange={(e) => setNewPropName(e.target.value)}
                                            placeholder="Name"
                                            className="h-7 w-32"
                                        />
                                        <Select
                                            value={newPropType}
                                            onValueChange={(v) =>
                                                setNewPropType(v as DatabasePropertyType)
                                            }
                                        >
                                            <SelectTrigger className="h-7 w-28">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(PROPERTY_TYPE_LABELS).map(
                                                    ([k, label]) => (
                                                        <SelectItem key={k} value={k}>
                                                            {label}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            onClick={async () => {
                                                if (!newPropName.trim()) return;
                                                await addProperty.mutateAsync({
                                                    databaseId,
                                                    name: newPropName.trim(),
                                                    type: newPropType,
                                                });
                                                setNewPropName("");
                                                setShowAddProp(false);
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setShowAddProp(true)}
                                    >
                                        <Plus className="mr-1 h-3 w-3" /> Property
                                    </Button>
                                )}
                            </th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.id}
                                className="group border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
                            >
                                {!compact && <td className="px-2 py-1 align-top">
                                    <button
                                        type="button"
                                        onClick={() => setOpenRowId(row.id)}
                                        className="rounded p-1 text-neutral-300 opacity-0 transition-opacity hover:bg-neutral-200 hover:text-primary group-hover:opacity-100 dark:hover:bg-neutral-800"
                                        aria-label="Open row"
                                    >
                                        <Maximize2 className="h-3 w-3" />
                                    </button>
                                </td>}
                                {properties.map((p) => (
                                    <td key={p.id} className="px-2 py-1 align-top">
                                        {p.type === "FORMULA" ? (
                                            <FormulaCell
                                                property={p}
                                                row={row}
                                                allProperties={properties}
                                            />
                                        ) : (
                                        <CellEditor
                                            property={p}
                                            rowId={row.id}
                                            value={valueFor(row, p.id)}
                                            onChange={(value) =>
                                                setValue.mutate({
                                                    rowId: row.id,
                                                    propertyId: p.id,
                                                    value: value as any,
                                                })
                                            }
                                            onAddSelectOption={(opt) =>
                                                handleAddSelectOption(p.id, p.config, opt)
                                            }
                                            onAddStatusOption={(opt) =>
                                                handleAddStatusOption(p.id, p.config, opt)
                                            }
                                        />
                                        )}
                                    </td>
                                ))}
                                {!compact && <td className="px-2 py-1 text-right align-top">
                                    <button
                                        type="button"
                                        onClick={() => deleteRow.mutate(row.id)}
                                        className="text-neutral-300 hover:text-red-500"
                                        aria-label="Delete row"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </td>}
                            </tr>
                        ))}
                        {!compact && <tr>
                            <td
                                colSpan={properties.length + 2}
                                className="px-2 py-2"
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-neutral-500"
                                    onClick={() => addRow.mutate()}
                                >
                                    <Plus className="mr-1 h-3 w-3" /> New row
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-neutral-500 ml-2"
                                    onClick={() => exportDatabaseToCSV(properties, rows)}
                                >
                                    <Download className="mr-1 h-3 w-3" /> Export CSV
                                </Button>
                            </td>
                        </tr>}
                    </tbody>
                </table>
            </div>

            {editingProperty && (
                <PropertySettingsDialog
                    open={!!editingProperty}
                    onOpenChange={(o) => !o && setEditingProperty(null)}
                    property={editingProperty}
                    siblingProperties={rawProperties}
                    onSave={async ({ name, config }) => {
                        await updateProperty.mutateAsync({
                            propertyId: editingProperty.id,
                            name,
                            ...(config !== undefined ? { config: config as any } : {}),
                        });
                    }}
                />
            )}

            <RowDetailSheet
                open={!!openRowId}
                onOpenChange={(o) => !o && setOpenRowId(null)}
                databaseId={databaseId}
                row={openRow}
                properties={properties}
                onSetValue={(rowId, propertyId, value) =>
                    setValue.mutate({ rowId, propertyId, value: value as any })
                }
                onAddOption={(propertyId, currentConfig, option) =>
                    handleAddSelectOption(propertyId, currentConfig, option as SelectOption)
                }
            />
        </>
    );
}

function CellEditor({
    property,
    rowId,
    value,
    onChange,
    onAddSelectOption,
    onAddStatusOption,
}: {
    property: DbProperty;
    rowId?: string;
    value: unknown;
    onChange: (value: unknown) => void;
    onAddSelectOption: (option: SelectOption) => Promise<void>;
    onAddStatusOption: (option: StatusOption) => Promise<void>;
}) {
    switch (property.type) {
        case "TEXT":
        case "URL":
        case "EMAIL":
            return (
                <Input
                    defaultValue={typeof value === "string" ? value : ""}
                    onBlur={(e) => onChange(e.target.value)}
                    className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0"
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
                    className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
            );
        case "DATE":
            return (
                <Input
                    type="date"
                    defaultValue={typeof value === "string" ? value : ""}
                    onBlur={(e) => onChange(e.target.value || null)}
                    className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0"
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
                    onAddOption={onAddSelectOption}
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
                    onAddOption={onAddStatusOption}
                />
            );
        case "ROLLUP":
            // Read-only — rollups are computed at read time.
            return (
                <span className="text-xs text-neutral-700 dark:text-neutral-300">
                    <RollupReadout value={value} />
                </span>
            );
        case "IMAGE":
            return (
                <ImageCell
                    rowId={rowId}
                    value={value}
                    onChange={onChange}
                    size="compact"
                />
            );
        default:
            return null;
    }
}

function RollupReadout({ value }: { value: unknown }) {
    if (!isRollupValue(value)) return <span className="text-neutral-400">—</span>;
    return <RollupValueRenderer value={value} />;
}

export function RollupValueRenderer({ value }: { value: RollupValue }) {
    if (value.kind === "empty")
        return <span className="text-neutral-400">—</span>;
    if (value.kind === "number") {
        const display = Number.isInteger(value.value)
            ? value.value
            : Math.round(value.value * 100) / 100;
        return <span className="tabular-nums">{display}</span>;
    }
    if (value.kind === "text") return <span>{value.value}</span>;
    // list
    if (value.values.length === 0)
        return <span className="text-neutral-400">—</span>;
    return (
        <span className="truncate">
            {value.values.slice(0, 3).join(", ")}
            {value.values.length > 3 && (
                <span className="text-neutral-400"> +{value.values.length - 3}</span>
            )}
        </span>
    );
}

function FormulaCell({
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
        return <span className="text-xs italic text-neutral-400">No formula</span>;
    }
    const propValues = buildPropValues(row, allProperties);
    const { value, error } = evaluateFormula(expression, propValues);
    if (error) {
        return (
            <span className="text-xs text-red-500" title={error}>
                Error
            </span>
        );
    }
    if (value === null || value === undefined) {
        return <span className="text-neutral-400">—</span>;
    }
    if (typeof value === "boolean") {
        return <span className="text-xs">{value ? "True" : "False"}</span>;
    }
    if (typeof value === "number") {
        return (
            <span className="text-xs tabular-nums text-neutral-700 dark:text-neutral-300">
                {Number.isInteger(value) ? value : value.toFixed(2)}
            </span>
        );
    }
    return (
        <span className="text-xs text-neutral-700 dark:text-neutral-300">
            {String(value)}
        </span>
    );
}
