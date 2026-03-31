import { useState, useMemo } from "react";
import Link from "next/link";
import { WikiPage, User, WikiNamespace } from "@prisma/client";
import { ChevronRight, ChevronDown, FileText, Plus, Hash, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
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
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = page.childPages && page.childPages.length > 0;
    const isActive = currentPageId === page.id;

    return (
        <div className="flex flex-col">
            <div
                className={cn(
                    "group flex items-center gap-2 py-1.5 rounded-md cursor-pointer transition-all duration-200",
                    isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={{ paddingLeft: `${(level * 12) + 8}px`, paddingRight: '8px' }}
            >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="p-0.5 hover:bg-primary/20 rounded transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                            )}
                        </button>
                    ) : (
                        <div className="w-4.5" />
                    )}

                    {level === 0 ? (
                        <Folder className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/50")} />
                    ) : (
                        <FileText className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/50")} />
                    )}

                    <Link
                        href={`${basePath}/${page.id}`}
                        className="flex-1 text-sm truncate py-0.5"
                    >
                        {page.title}
                    </Link>
                </div>

                {!readOnly && (
                    <WikiPageDialog
                        organizationId={organizationId}
                        projectId={projectId}
                        parentPageId={page.id}
                        namespace={page.namespace}
                        trigger={
                            <button
                                aria-label="Add subpage"
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded-md border shadow-sm transition-all"
                            >
                                <Plus className="h-3 w-3 text-muted-foreground" />
                            </button>
                        }
                    />
                )}
            </div>

            {hasChildren && isExpanded && (
                <div className="flex flex-col">
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
    pages: rawPages,
    organizationId,
    projectId,
    currentPageId,
    basePath,
    readOnly = false,
}: WikiSidebarProps) {
    // Build tree structure efficiently using useMemo
    const tree = useMemo(() => {
        const pagesMap = new Map<string, WikiPageWithChildren>();

        // First pass: create deep copies to avoid mutating original objects
        rawPages.forEach(p => {
            pagesMap.set(p.id, { ...p, childPages: [] });
        });

        const rootNodes: WikiPageWithChildren[] = [];

        // Second pass: associate children with parents
        pagesMap.forEach(page => {
            if (page.parentPageId && pagesMap.has(page.parentPageId)) {
                pagesMap.get(page.parentPageId)!.childPages!.push(page);
            } else {
                rootNodes.push(page);
            }
        });

        return rootNodes;
    }, [rawPages]);

    return (
        <div className="w-72 border-r bg-muted/30 flex flex-col h-full overflow-hidden">
            <div className="p-4 flex flex-col gap-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-1 bg-primary rounded-full" />
                        <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                            {projectId ? "Project Wiki" : "Knowledge Base"}
                        </h2>
                    </div>
                    {!readOnly && (
                        <WikiPageDialog
                            organizationId={organizationId}
                            projectId={projectId}
                            namespace={projectId ? WikiNamespace.PROJECT : WikiNamespace.COMPANY}
                            trigger={
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            }
                        />
                    )}
                </div>

                <div className="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar">
                    {tree.map((page) => (
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

                    {tree.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-xl bg-muted/50">
                            <Hash className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-xs text-muted-foreground text-center mb-4 leading-relaxed">
                                No pages published in this section yet.
                            </p>
                            {!readOnly && (
                                <WikiPageDialog
                                    organizationId={organizationId}
                                    projectId={projectId}
                                    namespace={projectId ? WikiNamespace.PROJECT : WikiNamespace.COMPANY}
                                    trigger={
                                        <Button variant="secondary" size="sm" className="w-full text-xs">
                                            Start with first page
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
