"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

interface TocItem {
    id: string;
    text: string;
    level: number;
}

function extractHeadings(content: any): TocItem[] {
    if (!content || !Array.isArray(content)) return [];

    const headings: TocItem[] = [];

    for (const block of content) {
        if (block.type === "heading" && block.props?.level) {
            const text = (block.content || [])
                .map((c: any) => (typeof c === "string" ? c : c.text || ""))
                .join("");

            if (text.trim()) {
                headings.push({
                    id: block.id || `heading-${headings.length}`,
                    text: text.trim(),
                    level: block.props.level,
                });
            }
        }
    }

    return headings;
}

interface TableOfContentsProps {
    content: any;
}

export function TableOfContents({ content }: TableOfContentsProps) {
    const headings = useMemo(() => extractHeadings(content), [content]);

    if (headings.length < 2) return null;

    const scrollToHeading = (id: string) => {
        const el = document.querySelector(`[data-id="${id}"]`) || document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="border rounded-lg p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 mb-3">
                <List className="h-3.5 w-3.5" />
                Contents
            </h4>
            <nav className="space-y-1">
                {headings.map((heading) => (
                    <button
                        key={heading.id}
                        className={cn(
                            "block w-full text-left text-sm hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors truncate",
                            "text-neutral-500",
                            heading.level === 1 && "font-medium pl-0",
                            heading.level === 2 && "pl-3",
                            heading.level === 3 && "pl-6 text-xs"
                        )}
                        onClick={() => scrollToHeading(heading.id)}
                    >
                        {heading.text}
                    </button>
                ))}
            </nav>
        </div>
    );
}
