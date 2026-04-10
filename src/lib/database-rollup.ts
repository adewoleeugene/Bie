/**
 * Pure rollup computation.
 *
 * Given a list of related target-row values, return the aggregated result
 * for the requested aggregation function. Used by `getDatabase` to project
 * rollup results into source rows at read time.
 */

import { DatabasePropertyType } from "@prisma/client";
import { RollupAggregation } from "@/lib/database-types";

/**
 * Result shape stored in the synthetic value of a ROLLUP cell. The display
 * components branch on `kind`:
 *   - "number"   → render as a number
 *   - "text"     → render as text (used by min/max on dates)
 *   - "list"     → render as a list of strings (show_original)
 *   - "empty"    → render dash
 */
export type RollupValue =
    | { kind: "number"; value: number }
    | { kind: "text"; value: string }
    | { kind: "list"; values: string[] }
    | { kind: "empty" };

function asNumber(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
        return Number(v);
    if (typeof v === "boolean") return v ? 1 : 0;
    return null;
}

function asString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
    return null;
}

function compareGeneric(a: unknown, b: unknown): number {
    const an = asNumber(a);
    const bn = asNumber(b);
    if (an !== null && bn !== null) return an - bn;
    const as = asString(a) || "";
    const bs = asString(b) || "";
    return as.localeCompare(bs);
}

export function computeRollup(
    values: unknown[],
    aggregation: RollupAggregation,
    targetType: DatabasePropertyType | undefined,
): RollupValue {
    const nonEmpty = values.filter(
        (v) => v !== null && v !== undefined && v !== "",
    );

    switch (aggregation) {
        case "count":
            return { kind: "number", value: values.length };
        case "count_unique": {
            const seen = new Set<string>();
            for (const v of nonEmpty) seen.add(JSON.stringify(v));
            return { kind: "number", value: seen.size };
        }
        case "sum": {
            const nums = nonEmpty
                .map(asNumber)
                .filter((n): n is number => n !== null);
            if (nums.length === 0) return { kind: "empty" };
            return { kind: "number", value: nums.reduce((a, b) => a + b, 0) };
        }
        case "average": {
            const nums = nonEmpty
                .map(asNumber)
                .filter((n): n is number => n !== null);
            if (nums.length === 0) return { kind: "empty" };
            return {
                kind: "number",
                value: nums.reduce((a, b) => a + b, 0) / nums.length,
            };
        }
        case "min": {
            if (nonEmpty.length === 0) return { kind: "empty" };
            const sorted = [...nonEmpty].sort(compareGeneric);
            const first = sorted[0];
            if (targetType === "DATE" && typeof first === "string") {
                return { kind: "text", value: first };
            }
            const n = asNumber(first);
            if (n !== null) return { kind: "number", value: n };
            return { kind: "text", value: asString(first) ?? "" };
        }
        case "max": {
            if (nonEmpty.length === 0) return { kind: "empty" };
            const sorted = [...nonEmpty].sort(compareGeneric);
            const last = sorted[sorted.length - 1];
            if (targetType === "DATE" && typeof last === "string") {
                return { kind: "text", value: last };
            }
            const n = asNumber(last);
            if (n !== null) return { kind: "number", value: n };
            return { kind: "text", value: asString(last) ?? "" };
        }
        case "show_original": {
            const strs: string[] = [];
            for (const v of nonEmpty) {
                const s = asString(v);
                if (s !== null && s !== "") strs.push(s);
            }
            if (strs.length === 0) return { kind: "empty" };
            return { kind: "list", values: strs };
        }
        default:
            return { kind: "empty" };
    }
}

export function isRollupValue(v: unknown): v is RollupValue {
    return (
        !!v &&
        typeof v === "object" &&
        "kind" in (v as Record<string, unknown>) &&
        ["number", "text", "list", "empty"].includes(
            (v as { kind: string }).kind,
        )
    );
}
