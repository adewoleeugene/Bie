"use client";

import { useState } from "react";
import Link from "next/link";
import { WikiPage, User } from "@prisma/client";
import { ChevronRight, ChevronDown, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { WikiPageDialog } from "./wiki-page-dialog";

type WikiPageWithChildren = WikiPage & {
    author: User;
    childPages?: WikiPageWithChildren[];
};

interface WikiSidebarProps {
    pages: WikiPageWithChildren[];
    organizationId: string;
    projectId?: string;
    currentPageId?: string;
    basePath: string;
}

interface WikiTreeItemProps {
    page: WikiPageWithChildren;
    organizationId: string;
    projectId?: string;
    currentPageId?: string;
    basePath: string;
    level?: number;
}

function WikiTreeItem({
    page,
    organizationId,
    projectId,
    currentPageId,
    basePath,
    level = 0,
}: WikiTreeItemProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = page.childPages && page.childPages.length > 0;
    const isActive = currentPageId === page.id;

    return (
        <div>
            <div
                className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer",
                    isActive && "bg-accent",
                    level > 0 && "ml-4"
                )}
            >
                {hasChildren ? (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-0.5 hover:bg-accent-foreground/10 rounded"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                ) : (
                    <div className="w-5" />
                )}
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Link
                    href={`${basePath}/${page.id}`}
                    className="flex-1 text-sm truncate"
                >
                    {page.title}
                </Link>
                <WikiPageDialog
                    organizationId={organizationId}
                    projectId={projectId}
                    parentPageId={page.id}
                    namespace={page.namespace}
                    trigger={
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent-foreground/10 rounded">
                            <Plus className="h-3 w-3" />
                        </button>
                    }
                />
            </div>
            {hasChildren && isExpanded && (
                <div className="mt-1">
                    {page.childPages!.map((child) => (
                        <WikiTreeItem
                            key={child.id}
                            page={child}
                            organizationId={organizationId}
                            projectId={projectId}
                            currentPageId={currentPageId}
                            basePath={basePath}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function WikiSidebar({
    pages,
    organizationId,
    projectId,
    currentPageId,
    basePath,
}: WikiSidebarProps) {
    // Build tree structure
    const rootPages = pages.filter((p) => !p.parentPageId);
    const pageMap = new Map(pages.map((p) => [p.id, p]));

    // Attach children to parents
    pages.forEach((page) => {
        if (page.parentPageId) {
            const parent = pageMap.get(page.parentPageId);
            if (parent) {
                if (!parent.childPages) {
                    parent.childPages = [];
                }
                parent.childPages.push(page);
            }
        }
    });

    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Wiki Pages</h2>
                <WikiPageDialog
                    organizationId={organizationId}
                    projectId={projectId}
                    namespace={projectId ? "PROJECT" : "COMPANY"}
                    trigger={
                        <button className="p-1 hover:bg-accent rounded">
                            <Plus className="h-4 w-4" />
                        </button>
                    }
                />
            </div>
            <div className="space-y-1">
                {rootPages.map((page) => (
                    <WikiTreeItem
                        key={page.id}
                        page={page}
                        organizationId={organizationId}
                        projectId={projectId}
                        currentPageId={currentPageId}
                        basePath={basePath}
                    />
                ))}
            </div>
        </div>
    );
}
