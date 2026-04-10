/**
 * Shared types & helpers for database property configs / values.
 *
 * Property `config` is `Json?` in Prisma; this file gives it shape.
 */

export interface SelectOption {
    id: string;
    name: string;
    color: SelectColor;
}

export interface SelectConfig {
    options: SelectOption[];
}

export type SelectColor =
    | "gray"
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "blue"
    | "purple"
    | "pink";

export const SELECT_COLORS: SelectColor[] = [
    "gray",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
];

export const SELECT_COLOR_CLASSES: Record<SelectColor, string> = {
    gray: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
    green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
    pink: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
};

export const SELECT_DOT_CLASSES: Record<SelectColor, string> = {
    gray: "bg-neutral-400",
    red: "bg-red-500",
    orange: "bg-orange-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
};

export function parseSelectConfig(raw: unknown): SelectConfig {
    if (!raw || typeof raw !== "object") return { options: [] };
    const options = (raw as { options?: unknown }).options;
    if (!Array.isArray(options)) return { options: [] };
    return {
        options: options.filter(
            (o): o is SelectOption =>
                !!o &&
                typeof o === "object" &&
                typeof (o as SelectOption).id === "string" &&
                typeof (o as SelectOption).name === "string" &&
                typeof (o as SelectOption).color === "string",
        ),
    };
}

export function newOptionId(): string {
    return Math.random().toString(36).slice(2, 10);
}

/** Config blob for a RELATION property.
 *
 * Bidirectional/synced relations:
 *   - The "primary" property (the one originally created) carries
 *     `targetDatabaseId` and owns the edges in the join table.
 *   - The "paired" property (auto-created on the target database when the
 *     user enables bidirectional) carries `pairedPropertyId` pointing at
 *     the primary. It does not own edges — it reads them from the join table
 *     in reverse via the primary's id.
 *   - Both sides set `pairedPropertyId` pointing at each other.
 */
export interface RelationConfig {
    targetDatabaseId?: string;
    pairedPropertyId?: string;
}

export function parseRelationConfig(raw: unknown): RelationConfig {
    if (!raw || typeof raw !== "object") return {};
    const o = raw as Record<string, unknown>;
    return {
        targetDatabaseId:
            typeof o.targetDatabaseId === "string" ? o.targetDatabaseId : undefined,
        pairedPropertyId:
            typeof o.pairedPropertyId === "string" ? o.pairedPropertyId : undefined,
    };
}

/** Aggregation functions supported by ROLLUP properties. */
export type RollupAggregation =
    | "count"
    | "count_unique"
    | "sum"
    | "average"
    | "min"
    | "max"
    | "show_original";

export const ROLLUP_AGGREGATIONS: { value: RollupAggregation; label: string }[] = [
    { value: "count", label: "Count" },
    { value: "count_unique", label: "Count unique" },
    { value: "sum", label: "Sum" },
    { value: "average", label: "Average" },
    { value: "min", label: "Min" },
    { value: "max", label: "Max" },
    { value: "show_original", label: "Show original" },
];

/** Config blob for a ROLLUP property. */
export interface RollupConfig {
    /** RELATION property on the source database whose links we follow. */
    relationPropertyId?: string;
    /** Property on the target database whose values we aggregate. */
    targetPropertyId?: string;
    aggregation?: RollupAggregation;
}

export function parseRollupConfig(raw: unknown): RollupConfig {
    if (!raw || typeof raw !== "object") return {};
    const o = raw as Record<string, unknown>;
    return {
        relationPropertyId:
            typeof o.relationPropertyId === "string"
                ? o.relationPropertyId
                : undefined,
        targetPropertyId:
            typeof o.targetPropertyId === "string" ? o.targetPropertyId : undefined,
        aggregation:
            typeof o.aggregation === "string"
                ? (o.aggregation as RollupAggregation)
                : undefined,
    };
}

/** Config for a FORMULA property. Stores the expression string. */
export interface FormulaConfig {
    expression: string;
}

export function parseFormulaConfig(raw: unknown): FormulaConfig {
    if (!raw || typeof raw !== "object") return { expression: "" };
    const o = raw as Record<string, unknown>;
    return {
        expression: typeof o.expression === "string" ? o.expression : "",
    };
}

/** A single STATUS option lives inside a status group. */
export interface StatusOption {
    id: string;
    name: string;
    color: SelectColor;
    /** Group id this option belongs to. */
    groupId: string;
}

/** Status groups (Notion: To-do / In progress / Done). */
export interface StatusGroup {
    id: string;
    name: string;
    color: SelectColor;
}

export interface StatusConfig {
    groups: StatusGroup[];
    options: StatusOption[];
}

export const DEFAULT_STATUS_GROUPS: StatusGroup[] = [
    { id: "todo", name: "To-do", color: "gray" },
    { id: "in_progress", name: "In progress", color: "blue" },
    { id: "done", name: "Done", color: "green" },
];

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
    { id: "not_started", name: "Not started", color: "gray", groupId: "todo" },
    { id: "in_progress_opt", name: "In progress", color: "blue", groupId: "in_progress" },
    { id: "done_opt", name: "Done", color: "green", groupId: "done" },
];

export function defaultStatusConfig(): StatusConfig {
    return {
        groups: DEFAULT_STATUS_GROUPS.map((g) => ({ ...g })),
        options: DEFAULT_STATUS_OPTIONS.map((o) => ({ ...o })),
    };
}

export function parseStatusConfig(raw: unknown): StatusConfig {
    if (!raw || typeof raw !== "object") return defaultStatusConfig();
    const o = raw as { groups?: unknown; options?: unknown };
    const groups = Array.isArray(o.groups)
        ? (o.groups as unknown[]).filter(
              (g): g is StatusGroup =>
                  !!g &&
                  typeof g === "object" &&
                  typeof (g as StatusGroup).id === "string" &&
                  typeof (g as StatusGroup).name === "string" &&
                  typeof (g as StatusGroup).color === "string",
          )
        : [];
    const options = Array.isArray(o.options)
        ? (o.options as unknown[]).filter(
              (op): op is StatusOption =>
                  !!op &&
                  typeof op === "object" &&
                  typeof (op as StatusOption).id === "string" &&
                  typeof (op as StatusOption).name === "string" &&
                  typeof (op as StatusOption).color === "string" &&
                  typeof (op as StatusOption).groupId === "string",
          )
        : [];
    if (groups.length === 0) return defaultStatusConfig();
    return { groups, options };
}
