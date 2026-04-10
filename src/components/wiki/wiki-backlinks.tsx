"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getWikiBacklinks } from "@/actions/wiki";
import { Link2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WikiBacklinksProps {
    pageId: string;
}

export function WikiBacklinks({ pageId }: WikiBacklinksProps) {
    const { data, isLoading } = useQuery({
        queryKey: ["wiki-backlinks", pageId],
        queryFn: () => getWikiBacklinks(pageId),
        enabled: !!pageId,
    });

    const backlinks = data?.data ?? [];

    if (isLoading) return null;
    if (backlinks.length === 0) return null;

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" />
                Linked from
            </h3>
            <ul className="space-y-1">
                {backlinks.map((page) => (
                    <li key={page.id}>
                        <Link
                            href={`/wiki/${page.id}`}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        >
                            <span className="truncate font-medium">{page.title}</span>
                            <span className="ml-2 shrink-0 text-xs text-neutral-500">
                                {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
