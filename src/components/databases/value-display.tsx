"use client";

import { DatabasePropertyType } from "@prisma/client";
import {
    parseRelationConfig,
    parseSelectConfig,
    parseStatusConfig,
    SELECT_COLOR_CLASSES,
    SELECT_DOT_CLASSES,
} from "@/lib/database-types";
import { useMembers } from "@/hooks/use-members";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Link2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getRelationRowsLite } from "@/actions/databases";
import { isRollupValue } from "@/lib/database-rollup";
import { RollupValueRenderer } from "@/components/databases/database-table-view";

interface DbProperty {
    id: string;
    name: string;
    type: DatabasePropertyType;
    config: unknown;
}

export function ValueDisplay({
    property,
    value,
}: {
    property: DbProperty;
    value: unknown;
}) {
    switch (property.type) {
        case "TEXT":
        case "URL":
        case "EMAIL":
            return typeof value === "string" && value ? (
                <span className="truncate text-xs">{value}</span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        case "NUMBER":
            return typeof value === "number" ? (
                <span className="text-xs tabular-nums">{value}</span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        case "DATE":
            if (typeof value !== "string" || !value)
                return <span className="text-xs text-neutral-400">—</span>;
            try {
                return (
                    <span className="text-xs">{format(parseISO(value), "PP")}</span>
                );
            } catch {
                return <span className="text-xs">{value}</span>;
            }
        case "CHECKBOX":
            return value === true ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        case "SELECT": {
            const { options } = parseSelectConfig(property.config);
            const opt = options.find((o) => o.id === value);
            return opt ? (
                <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${SELECT_COLOR_CLASSES[opt.color]}`}
                >
                    {opt.name}
                </span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        }
        case "MULTI_SELECT": {
            const { options } = parseSelectConfig(property.config);
            const ids = Array.isArray(value) ? (value as string[]) : [];
            const chosen = ids
                .map((id) => options.find((o) => o.id === id))
                .filter((o): o is NonNullable<typeof o> => !!o);
            if (chosen.length === 0)
                return <span className="text-xs text-neutral-400">—</span>;
            return (
                <div className="flex flex-wrap gap-1">
                    {chosen.map((o) => (
                        <span
                            key={o.id}
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${SELECT_COLOR_CLASSES[o.color]}`}
                        >
                            {o.name}
                        </span>
                    ))}
                </div>
            );
        }
        case "PERSON":
            return <PersonDisplay userId={typeof value === "string" ? value : null} />;
        case "RELATION":
            return (
                <RelationDisplay
                    config={property.config}
                    ids={Array.isArray(value) ? (value as string[]) : []}
                />
            );
        case "STATUS": {
            const { options } = parseStatusConfig(property.config);
            const opt = options.find((o) => o.id === value);
            return opt ? (
                <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${SELECT_COLOR_CLASSES[opt.color]}`}
                >
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${SELECT_DOT_CLASSES[opt.color]}`}
                    />
                    {opt.name}
                </span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        }
        case "ROLLUP":
            return isRollupValue(value) ? (
                <span className="text-xs text-neutral-700 dark:text-neutral-300">
                    <RollupValueRenderer value={value} />
                </span>
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        case "IMAGE":
            return typeof value === "string" && value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={value}
                    alt=""
                    className="h-6 w-6 rounded object-cover"
                />
            ) : (
                <span className="text-xs text-neutral-400">—</span>
            );
        default:
            return null;
    }
}

function RelationDisplay({
    config,
    ids,
}: {
    config: unknown;
    ids: string[];
}) {
    const { targetDatabaseId } = parseRelationConfig(config);
    const { data: rows } = useQuery({
        queryKey: ["relation-rows", targetDatabaseId],
        queryFn: () =>
            targetDatabaseId
                ? getRelationRowsLite(targetDatabaseId)
                : Promise.resolve([] as { id: string; title: string }[]),
        enabled: !!targetDatabaseId && ids.length > 0,
        staleTime: 30 * 1000,
    });
    if (ids.length === 0)
        return <span className="text-xs text-neutral-400">—</span>;
    const titleById = new Map<string, string>();
    for (const r of rows || []) titleById.set(r.id, r.title);
    return (
        <div className="flex flex-wrap gap-1">
            {ids.slice(0, 3).map((id) => (
                <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                >
                    <Link2 className="h-2 w-2" />
                    {titleById.get(id) || "…"}
                </span>
            ))}
            {ids.length > 3 && (
                <span className="text-[10px] text-neutral-500">+{ids.length - 3}</span>
            )}
        </div>
    );
}

function PersonDisplay({ userId }: { userId: string | null }) {
    const { data: members } = useMembers();
    if (!userId) return <span className="text-xs text-neutral-400">—</span>;
    const m = members?.find((x) => x.id === userId);
    if (!m) return <span className="text-xs text-neutral-400">Unknown</span>;
    return (
        <div className="flex items-center gap-1.5">
            <Avatar className="h-4 w-4">
                <AvatarImage src={m.image || undefined} />
                <AvatarFallback className="text-[8px]">
                    {(m.name || "?").substring(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs">{m.name}</span>
        </div>
    );
}
