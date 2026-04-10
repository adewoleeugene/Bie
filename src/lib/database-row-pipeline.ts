/**
 * Pure pipeline that applies a view's filters + sorts to a row list.
 *
 * Used by table, board, gallery, calendar — anywhere we render rows for a
 * specific view.
 */

import { ViewFilter, ViewOptions, ViewSort } from "@/lib/database-view-config";
import { DatabasePropertyType } from "@prisma/client";

interface DbProperty {
    id: string;
    type: DatabasePropertyType;
}

interface DbRow {
    id: string;
    values: { propertyId: string; value: unknown }[];
}

function getValue(row: DbRow, propertyId: string): unknown {
    return row.values.find((v) => v.propertyId === propertyId)?.value;
}

function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function passesFilter(row: DbRow, filter: ViewFilter): boolean {
    const v = getValue(row, filter.propertyId);
    switch (filter.op) {
        case "isEmpty":
            return isEmpty(v);
        case "isNotEmpty":
            return !isEmpty(v);
        case "equals":
            if (v === null || v === undefined) return filter.value === v;
            if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
                return String(v) === String(filter.value);
            if (Array.isArray(v))
                return v.some((x) => String(x) === String(filter.value));
            return false;
        case "notEquals":
            return !passesFilter(row, { ...filter, op: "equals" });
        case "contains": {
            // String contains for primitives.
            if (typeof v === "string") {
                const needle = String(filter.value ?? "").toLowerCase();
                return v.toLowerCase().includes(needle);
            }
            // Array contains (multi-select / relation): true if any element
            // matches as a string substring.
            if (Array.isArray(v)) {
                const needle = String(filter.value ?? "").toLowerCase();
                return v.some((x) => String(x).toLowerCase().includes(needle));
            }
            return false;
        }
        case "linksTo":
            // RELATION semantics: the value array contains the target row id.
            if (!Array.isArray(v)) return false;
            return v.includes(filter.value);
        case "doesNotLinkTo":
            if (!Array.isArray(v)) return true;
            return !v.includes(filter.value);
        default:
            return true;
    }
}

function compareValues(
    a: unknown,
    b: unknown,
    type: DatabasePropertyType,
): number {
    const aE = isEmpty(a);
    const bE = isEmpty(b);
    if (aE && bE) return 0;
    if (aE) return 1; // empties last
    if (bE) return -1;

    switch (type) {
        case "NUMBER":
            return (Number(a) || 0) - (Number(b) || 0);
        case "DATE": {
            const da = typeof a === "string" ? Date.parse(a) : 0;
            const db = typeof b === "string" ? Date.parse(b) : 0;
            return da - db;
        }
        case "CHECKBOX":
            return Number(!!a) - Number(!!b);
        case "RELATION":
        case "MULTI_SELECT": {
            // Sort by number of linked / selected items.
            const al = Array.isArray(a) ? a.length : 0;
            const bl = Array.isArray(b) ? b.length : 0;
            return al - bl;
        }
        default:
            return String(a).localeCompare(String(b));
    }
}

export function applyViewOptions(
    rows: DbRow[],
    properties: DbProperty[],
    options: ViewOptions,
): DbRow[] {
    let result = rows;

    if (options.filters && options.filters.length > 0) {
        result = result.filter((r) =>
            options.filters!.every((f) => passesFilter(r, f)),
        );
    }

    if (options.sorts && options.sorts.length > 0) {
        const propertyTypeById = new Map<string, DatabasePropertyType>();
        for (const p of properties) propertyTypeById.set(p.id, p.type);
        // Stable sort by applying sorts in reverse priority.
        result = [...result].sort((rowA, rowB) => {
            for (const sort of options.sorts!) {
                const type = propertyTypeById.get(sort.propertyId);
                if (!type) continue;
                const a = getValue(rowA, sort.propertyId);
                const b = getValue(rowB, sort.propertyId);
                const cmp = compareValues(a, b, type);
                if (cmp !== 0) return sort.direction === "desc" ? -cmp : cmp;
            }
            return 0;
        });
    }

    return result;
}
