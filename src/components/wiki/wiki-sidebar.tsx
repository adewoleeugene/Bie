"use client";

import { useState } from "react";
import Link from "next/link";
import { WikiPage, User, WikiNamespace } from "@prisma/client";
import { ChevronRight, ChevronDown, FileText, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createWikiPage } from "@/actions/wiki";

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
    readOnly?: boolean;
}

interface WikiTreeItemProps {
    page: WikiPageWithChildren;
    organizationId: string;
    projectId?: string;
    currentPageId?: string;
    basePath: string;
    level?: number;
    readOnly?: boolean;
}

function WikiTreeItem({
    page,
    organizationId,
    projectId,
    currentPageId,
    basePath,
    level = 0,
    readOnly = false,
}: WikiTreeItemProps) {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const hasChildren = page.childPages && page.childPages.length > 0;
    const isActive = currentPageId === page.id;

    const handleQuickAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCreating(true);
        const result = await createWikiPage({
            title: "Untitled",
            organizationId,
            projectId,
            parentPageId: page.id,
            namespace: page.namespace,
        });
        if (result.success && result.data) {
            router.push(`${basePath}/${result.data.id}`);
            router.refresh();
        }
        setIsCreating(false);
    };

    return (
        <div>
            <div
                className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors",
                    isActive && "bg-neutral-100 dark:bg-neutral-800 font-medium",
                )}
                style={{ paddingLeft: `${(level * 16) + 8}px` }}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        className="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />
                        )}
                    </button>
                ) : (
                    <div className="w-4.5" />
                )}
                <FileText className={cn("h-4 w-4", isActive ? "text-primary" : "text-neutral-400")} />
                <Link
                    href={`${basePath}/${page.id}`}
                    className="flex-1 text-sm truncate text-neutral-700 dark:text-neutral-300"
                >
                    {page.title}
                </Link>
                {!readOnly && (
                    <button
                        onClick={handleQuickAdd}
                        disabled={isCreating}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 className="h-3 w-3 animate-spin text-neutral-400" /> : <Plus className="h-3 w-3 text-neutral-500" />}
                    </button>
                )}
            </div>
            {hasChildren && isExpanded && (
                <div className="mt-0.5">
                    {page.childPages!.map((child) => (
                        <WikiTreeItem
                            key={child.id}
                            page={child}
                            organizationId={organizationId}
                            projectId={projectId}
                            currentPageId={currentPageId}
                            basePath={basePath}
                            level={level + 1}
                            readOnly={readOnly}
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
    readOnly = false,
}: WikiSidebarProps) {
    const router = useRouter();
    const [isCreatingRoot, setIsCreatingRoot] = useState(false);

    const handleQuickAddRoot = async () => {
        setIsCreatingRoot(true);
        const result = await createWikiPage({
            title: "Untitled",
            organizationId,
            projectId,
            namespace: projectId ? WikiNamespace.PROJECT : WikiNamespace.COMPANY,
        });
        if (result.success && result.data) {
            router.push(`${basePath}/${result.data.id}`);
            router.refresh();
        }
        setIsCreatingRoot(false);
    };

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
                // Avoid duplicates in tree building if pages are already linked
                if (!parent.childPages.some(cp => cp.id === page.id)) {
                    parent.childPages.push(page);
                }
            }
        }
    });

    return (
        <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col h-full overflow-hidden">
            <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-neutral-900 dark:text-neutral-100 px-2 tracking-tight text-sm uppercase opacity-50">Wiki</h2>
                    {!readOnly && (
                        <button
                            onClick={handleQuickAddRoot}
                            disabled={isCreatingRoot}
                            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
                        >
                            {isCreatingRoot ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : <Plus className="h-4 w-4 text-neutral-500" />}
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-0.5 overflow-y-auto">
                    {rootPages.map((page) => (
                        <WikiTreeItem
                            key={page.id}
                            page={page}
                            organizationId={organizationId}
                            projectId={projectId}
                            currentPageId={currentPageId}
                            basePath={basePath}
                            readOnly={readOnly}
                        />
                    ))}
                    {rootPages.length === 0 && (
                        <div className="px-3 py-8 text-center">
                            <p className="text-xs text-neutral-400">No pages yet.</p>
                            <Button
                                variant="link"
                                size="sm"
                                className="text-xs"
                                onClick={handleQuickAddRoot}
                            >
                                Create your first page
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
