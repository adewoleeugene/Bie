"use client";

import { DatabasePropertyType } from "@prisma/client";
import { ValueDisplay } from "@/components/databases/value-display";
import { parseGalleryConfig } from "@/lib/database-view-config";
import { useUpdateView } from "@/hooks/use-databases";
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

interface DatabaseGalleryViewProps {
    databaseId: string;
    viewId: string;
    viewConfig: unknown;
    properties: DbProperty[];
    rows: DbRow[];
    onOpenRow?: (rowId: string) => void;
}

export function DatabaseGalleryView({
    databaseId,
    viewId,
    viewConfig,
    properties,
    rows,
    onOpenRow,
}: DatabaseGalleryViewProps) {
    const updateView = useUpdateView(databaseId);
    const cfg = parseGalleryConfig(viewConfig);

    const titleProp = properties.find((p) => p.type === "TEXT");
    const coverProp = properties.find(
        (p) => p.id === cfg.coverPropertyId && p.type === "IMAGE",
    );
    const imageProps = properties.filter((p) => p.type === "IMAGE");
    const detailProps = properties.filter(
        (p) => p.id !== titleProp?.id && p.id !== coverProp?.id,
    );

    return (
        <div className="space-y-3">
            {imageProps.length > 0 && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Cover</span>
                    <Select
                        value={cfg.coverPropertyId || "__none"}
                        onValueChange={(v) =>
                            updateView.mutate({
                                viewId,
                                config: {
                                    ...cfg,
                                    coverPropertyId: v === "__none" ? undefined : v,
                                } as any,
                            })
                        }
                    >
                        <SelectTrigger className="h-7 w-40">
                            <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none">None</SelectItem>
                            {imageProps.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {rows.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
                    No rows yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rows.map((row) => {
                        const title = titleProp
                            ? row.values.find((v) => v.propertyId === titleProp.id)?.value
                            : undefined;
                        const coverUrl =
                            coverProp &&
                            (row.values.find((v) => v.propertyId === coverProp.id)?.value as
                                | string
                                | undefined);
                        return (
                            <button
                                key={row.id}
                                type="button"
                                onClick={() => onOpenRow?.(row.id)}
                                className="overflow-hidden rounded-md border border-neutral-200 bg-white text-left shadow-sm transition hover:border-primary hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
                            >
                                {coverProp && (
                                    <div className="h-32 w-full bg-neutral-100 dark:bg-neutral-900">
                                        {coverUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={coverUrl}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : null}
                                    </div>
                                )}
                                <div className="p-3">
                                    <h3 className="mb-2 truncate text-sm font-medium">
                                        {typeof title === "string" && title
                                            ? title
                                            : "Untitled"}
                                    </h3>
                                    <div className="space-y-1.5">
                                        {detailProps.slice(0, 5).map((p) => {
                                            const v = row.values.find(
                                                (x) => x.propertyId === p.id,
                                            )?.value;
                                            return (
                                                <div
                                                    key={p.id}
                                                    className="flex items-start gap-2"
                                                >
                                                    <span className="w-16 flex-shrink-0 text-[10px] uppercase text-neutral-400">
                                                        {p.name}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <ValueDisplay
                                                            property={p}
                                                            value={v}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
