"use client";

import { useState, useEffect } from "react";
import { DatabasePropertyType } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import {
    parseSelectConfig,
    SELECT_COLORS,
    SELECT_DOT_CLASSES,
    SelectColor,
    SelectOption,
    newOptionId,
    parseRelationConfig,
    parseRollupConfig,
    ROLLUP_AGGREGATIONS,
    RollupAggregation,
    parseStatusConfig,
    defaultStatusConfig,
    StatusOption,
    StatusGroup,
    StatusConfig,
    parseFormulaConfig,
} from "@/lib/database-types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDatabases } from "@/hooks/use-databases";
import { useQuery } from "@tanstack/react-query";
import { getDatabasePropertiesLite, setRelationPaired } from "@/actions/databases";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface PropertySettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    property: {
        id: string;
        name: string;
        type: DatabasePropertyType;
        config: unknown;
    };
    /**
     * Other properties on the *same* database. Needed by the rollup config
     * UI to enumerate the available RELATION columns to follow.
     */
    siblingProperties?: { id: string; name: string; type: DatabasePropertyType; config: unknown }[];
    onSave: (args: { name: string; config?: unknown }) => Promise<void> | void;
}

export function PropertySettingsDialog({
    open,
    onOpenChange,
    property,
    siblingProperties,
    onSave,
}: PropertySettingsDialogProps) {
    const isSelect =
        property.type === "SELECT" || property.type === "MULTI_SELECT";
    const isRelation = property.type === "RELATION";
    const isRollup = property.type === "ROLLUP";
    const isStatus = property.type === "STATUS";
    const isFormula = property.type === "FORMULA";

    const [name, setName] = useState(property.name);
    const [options, setOptions] = useState<SelectOption[]>(
        parseSelectConfig(property.config).options,
    );
    const [statusConfig, setStatusConfig] = useState<StatusConfig>(
        property.type === "STATUS"
            ? parseStatusConfig(property.config)
            : defaultStatusConfig(),
    );
    const [targetDatabaseId, setTargetDatabaseId] = useState<string>(
        parseRelationConfig(property.config).targetDatabaseId || "",
    );

    // Rollup state
    const initialRollup = parseRollupConfig(property.config);
    const [relationPropertyId, setRelationPropertyId] = useState<string>(
        initialRollup.relationPropertyId || "",
    );
    const [targetPropertyId, setTargetPropertyId] = useState<string>(
        initialRollup.targetPropertyId || "",
    );
    const [aggregation, setAggregation] = useState<RollupAggregation>(
        initialRollup.aggregation || "count",
    );

    // Formula state
    const [formulaExpression, setFormulaExpression] = useState(
        parseFormulaConfig(property.config).expression,
    );

    const { data: allDatabases } = useDatabases();

    // The followed RELATION property — needed to know which target database
    // to load properties from for the rollup target picker.
    const followedRelation = (siblingProperties || []).find(
        (p) => p.id === relationPropertyId && p.type === "RELATION",
    );
    const followedTargetDbId = followedRelation
        ? parseRelationConfig(followedRelation.config).targetDatabaseId
        : undefined;

    const { data: targetProperties } = useQuery({
        queryKey: ["database-properties-lite", followedTargetDbId],
        queryFn: () =>
            followedTargetDbId
                ? getDatabasePropertiesLite(followedTargetDbId)
                : Promise.resolve([]),
        enabled: !!followedTargetDbId && isRollup,
    });

    useEffect(() => {
        setName(property.name);
        setOptions(parseSelectConfig(property.config).options);
        setTargetDatabaseId(parseRelationConfig(property.config).targetDatabaseId || "");
        const r = parseRollupConfig(property.config);
        setRelationPropertyId(r.relationPropertyId || "");
        setTargetPropertyId(r.targetPropertyId || "");
        setAggregation(r.aggregation || "count");
        setStatusConfig(
            property.type === "STATUS"
                ? parseStatusConfig(property.config)
                : defaultStatusConfig(),
        );
        setFormulaExpression(parseFormulaConfig(property.config).expression);
    }, [property]);

    const addOption = () => {
        setOptions((prev) => [
            ...prev,
            {
                id: newOptionId(),
                name: "Untitled",
                color: SELECT_COLORS[prev.length % SELECT_COLORS.length],
            },
        ]);
    };

    const updateOption = (id: string, patch: Partial<SelectOption>) => {
        setOptions((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        );
    };

    const deleteOption = (id: string) => {
        setOptions((prev) => prev.filter((o) => o.id !== id));
    };

    const save = async () => {
        let config: unknown = undefined;
        if (isSelect) config = { options };
        if (isRelation) config = { targetDatabaseId };
        if (isRollup)
            config = {
                relationPropertyId,
                targetPropertyId,
                aggregation,
            };
        if (isStatus) config = statusConfig;
        if (isFormula) config = { expression: formulaExpression };
        await onSave({
            name: name.trim() || property.name,
            config,
        });
        onOpenChange(false);
    };

    const updateStatusOption = (id: string, patch: Partial<StatusOption>) => {
        setStatusConfig((cfg) => ({
            ...cfg,
            options: cfg.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        }));
    };
    const deleteStatusOption = (id: string) => {
        setStatusConfig((cfg) => ({
            ...cfg,
            options: cfg.options.filter((o) => o.id !== id),
        }));
    };
    const addStatusOption = (groupId: string) => {
        const group = statusConfig.groups.find((g) => g.id === groupId);
        if (!group) return;
        setStatusConfig((cfg) => ({
            ...cfg,
            options: [
                ...cfg.options,
                {
                    id: newOptionId(),
                    name: "Untitled",
                    color: group.color,
                    groupId,
                },
            ],
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Property settings</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium uppercase text-neutral-500">
                            Name
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    {isRelation && (
                        <div className="space-y-2">
                            <div>
                                <label className="text-xs font-medium uppercase text-neutral-500">
                                    Target database
                                </label>
                                <Select
                                    value={targetDatabaseId}
                                    onValueChange={setTargetDatabaseId}
                                >
                                    <SelectTrigger className="mt-1 h-8">
                                        <SelectValue placeholder="Pick a database…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(allDatabases || []).map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="mt-1 text-[10px] text-neutral-500">
                                    Rows in this column link to rows in the chosen database.
                                </p>
                            </div>
                            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
                                <Checkbox
                                    checked={!!parseRelationConfig(property.config).pairedPropertyId}
                                    onCheckedChange={async (c) => {
                                        const result = await setRelationPaired({
                                            propertyId: property.id,
                                            paired: c === true,
                                        });
                                        if (!result.success) {
                                            toast.error(result.error || "Failed");
                                        } else {
                                            toast.success(
                                                c === true
                                                    ? "Bidirectional pairing enabled"
                                                    : "Pairing removed",
                                            );
                                        }
                                    }}
                                />
                                <div>
                                    <div className="text-xs font-medium">
                                        Bidirectional (synced)
                                    </div>
                                    <div className="text-[10px] text-neutral-500">
                                        Auto-create a mirror relation on the target so links are visible from both sides.
                                    </div>
                                </div>
                            </label>
                        </div>
                    )}

                    {isRollup && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium uppercase text-neutral-500">
                                    Relation
                                </label>
                                <Select
                                    value={relationPropertyId}
                                    onValueChange={setRelationPropertyId}
                                >
                                    <SelectTrigger className="mt-1 h-8">
                                        <SelectValue placeholder="Pick a relation column…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(siblingProperties || [])
                                            .filter((p) => p.type === "RELATION")
                                            .map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <p className="mt-1 text-[10px] text-neutral-500">
                                    Which relation column to follow.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium uppercase text-neutral-500">
                                    Property to roll up
                                </label>
                                <Select
                                    value={targetPropertyId}
                                    onValueChange={setTargetPropertyId}
                                    disabled={!relationPropertyId}
                                >
                                    <SelectTrigger className="mt-1 h-8">
                                        <SelectValue placeholder="Pick a property…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(targetProperties || [])
                                            .filter((p) => p.type !== "RELATION")
                                            .map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                    {p.type === "ROLLUP" ? " (rollup)" : ""}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium uppercase text-neutral-500">
                                    Aggregation
                                </label>
                                <Select
                                    value={aggregation}
                                    onValueChange={(v) =>
                                        setAggregation(v as RollupAggregation)
                                    }
                                >
                                    <SelectTrigger className="mt-1 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLLUP_AGGREGATIONS.map((a) => (
                                            <SelectItem key={a.value} value={a.value}>
                                                {a.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {isStatus && (
                        <div className="space-y-3">
                            {statusConfig.groups.map((g) => {
                                const groupOptions = statusConfig.options.filter(
                                    (o) => o.groupId === g.id,
                                );
                                return (
                                    <div key={g.id}>
                                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-neutral-500">
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${SELECT_DOT_CLASSES[g.color]}`}
                                            />
                                            {g.name}
                                        </div>
                                        <div className="space-y-1.5">
                                            {groupOptions.map((o) => (
                                                <div
                                                    key={o.id}
                                                    className="flex items-center gap-2"
                                                >
                                                    <ColorPicker
                                                        color={o.color}
                                                        onChange={(c) =>
                                                            updateStatusOption(o.id, { color: c })
                                                        }
                                                    />
                                                    <Input
                                                        value={o.name}
                                                        onChange={(e) =>
                                                            updateStatusOption(o.id, {
                                                                name: e.target.value,
                                                            })
                                                        }
                                                        className="h-7 flex-1"
                                                    />
                                                    <Select
                                                        value={o.groupId}
                                                        onValueChange={(v) =>
                                                            updateStatusOption(o.id, { groupId: v })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-7 w-28">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {statusConfig.groups.map((gg) => (
                                                                <SelectItem
                                                                    key={gg.id}
                                                                    value={gg.id}
                                                                >
                                                                    {gg.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteStatusOption(o.id)}
                                                        className="text-neutral-400 hover:text-red-500"
                                                        aria-label="Delete option"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-neutral-500"
                                                onClick={() => addStatusOption(g.id)}
                                            >
                                                <Plus className="mr-1 h-3 w-3" /> Add option
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {isSelect && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-medium uppercase text-neutral-500">
                                    Options
                                </label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={addOption}
                                >
                                    <Plus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                {options.length === 0 && (
                                    <p className="text-xs italic text-neutral-500">
                                        No options yet.
                                    </p>
                                )}
                                {options.map((o) => (
                                    <div key={o.id} className="flex items-center gap-2">
                                        <ColorPicker
                                            color={o.color}
                                            onChange={(c) => updateOption(o.id, { color: c })}
                                        />
                                        <Input
                                            value={o.name}
                                            onChange={(e) =>
                                                updateOption(o.id, { name: e.target.value })
                                            }
                                            className="h-7 flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => deleteOption(o.id)}
                                            className="text-neutral-400 hover:text-red-500"
                                            aria-label="Delete option"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {isFormula && (
                        <div>
                            <label className="text-xs font-medium uppercase text-neutral-500">
                                Formula
                            </label>
                            <textarea
                                value={formulaExpression}
                                onChange={(e) => setFormulaExpression(e.target.value)}
                                placeholder='e.g. prop("Price") * prop("Quantity")'
                                rows={3}
                                className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">
                                Use <code className="rounded bg-muted px-1">prop(&quot;Name&quot;)</code> to reference other properties.
                                Supports math (<code className="rounded bg-muted px-1">+ - * /</code>),
                                comparisons (<code className="rounded bg-muted px-1">== != &gt; &lt;</code>),
                                <code className="rounded bg-muted px-1">if(cond, then, else)</code>,
                                and functions like <code className="rounded bg-muted px-1">concat</code>,{" "}
                                <code className="rounded bg-muted px-1">round</code>,{" "}
                                <code className="rounded bg-muted px-1">length</code>,{" "}
                                <code className="rounded bg-muted px-1">upper</code>,{" "}
                                <code className="rounded bg-muted px-1">empty</code>.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={save}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ColorPicker({
    color,
    onChange,
}: {
    color: SelectColor;
    onChange: (c: SelectColor) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((s) => !s)}
                className={`h-4 w-4 rounded-full border border-neutral-200 ${SELECT_DOT_CLASSES[color]}`}
                aria-label="Pick color"
            />
            {open && (
                <div className="absolute left-0 top-6 z-10 grid grid-cols-4 gap-1 rounded-md border border-neutral-200 bg-white p-1.5 shadow-md dark:border-neutral-800 dark:bg-neutral-950">
                    {SELECT_COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => {
                                onChange(c);
                                setOpen(false);
                            }}
                            className={`h-4 w-4 rounded-full border border-neutral-200 ${SELECT_DOT_CLASSES[c]}`}
                            aria-label={c}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
