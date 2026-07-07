"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { WikiPage, User, WikiNamespace } from "@prisma/client";
import { ChevronRight, ChevronDown, FileText, Plus, Hash, Folder, FolderPlus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { WikiPageDialog } from "./wiki-page-dialog";
import { WikiSearch } from "./wiki-search";
import { WikiTemplatesDialog } from "./wiki-templates-dialog";
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderWikiPages, createWikiPage, deleteWikiPage } from "@/actions/wiki";
import { toast } from "sonner";

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
    isDragging?: boolean;
}

function SortableTreeItem(props: WikiTreeItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <WikiTreeItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
        </div>
    );
}

function WikiTreeItem({
    page,
    organizationId,
    projectId,
    currentPageId,
    basePath,
    level = 0,
    readOnly = false,
    dragHandleProps,
}: WikiTreeItemProps & { dragHandleProps?: Record<string, any> }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const router = useRouter();
    const hasChildren = page.childPages && page.childPages.length > 0;
    const isActive = currentPageId === page.id;

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const childCount = page.childPages?.length ?? 0;
        const msg = childCount
            ? `Delete "${page.title}" and move its ${childCount} sub-page${childCount > 1 ? "s" : ""} up a level? It goes to Trash and can be restored.`
            : `Delete "${page.title}"? It goes to Trash and can be restored.`;
        if (!window.confirm(msg)) return;
        const res = await deleteWikiPage(page.id);
        if (res.success) {
            toast.success("Moved to Trash");
            if (isActive) router.push(basePath);
            router.refresh();
        } else {
            toast.error(res.error || "Failed to delete");
        }
    };

    return (
        <div className="flex flex-col">
            <div
                className={cn(
                    "group flex items-center gap-1 py-1.5 rounded-md cursor-pointer transition-all duration-200",
                    isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={{ paddingLeft: `${(level * 12) + 4}px`, paddingRight: '8px' }}
            >
                {!readOnly && dragHandleProps && (
                    <button
                        {...dragHandleProps}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-primary/20 rounded cursor-grab active:cursor-grabbing transition-opacity"
                        aria-label="Drag to reorder"
                    >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}

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

                    {page.icon ? (
                        <span className="h-4 w-4 shrink-0 text-center text-sm leading-4">{page.icon}</span>
                    ) : page.isFolder || hasChildren ? (
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
                    <div className="flex items-center gap-0.5">
                        <WikiPageDialog
                            organizationId={organizationId}
                            projectId={projectId}
                            parentPageId={page.id}
                            namespace={page.namespace}
                            trigger={
                                <button
                                    aria-label="Add subpage"
                                    title="Add page inside"
                                    onClick={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded-md border shadow-sm transition-all"
                                >
                                    <Plus className="h-3 w-3 text-muted-foreground" />
                                </button>
                            }
                        />
                        <button
                            aria-label="Delete"
                            title="Delete"
                            onClick={handleDelete}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded-md border shadow-sm transition-all"
                        >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                        </button>
                    </div>
                )}
            </div>

            {hasChildren && isExpanded && (
                <SortableContext
                    items={page.childPages!.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="flex flex-col">
                        {page.childPages!.map((child) => (
                            <SortableTreeItem
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
                </SortableContext>
            )}
        </div>
    );
}

/** Flatten tree to collect all pages grouped by parent for reorder computation */
function flattenTree(nodes: WikiPageWithChildren[]): WikiPageWithChildren[] {
    const result: WikiPageWithChildren[] = [];
    for (const node of nodes) {
        result.push(node);
        if (node.childPages?.length) {
            result.push(...flattenTree(node.childPages));
        }
    }
    return result;
}

/** Find a page in the tree by id */
function findPageInTree(nodes: WikiPageWithChildren[], id: string): WikiPageWithChildren | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.childPages?.length) {
            const found = findPageInTree(node.childPages, id);
            if (found) return found;
        }
    }
    return null;
}

/** Get siblings of a given page (pages sharing the same parent) */
function getSiblings(tree: WikiPageWithChildren[], pageId: string, parentId: string | null): WikiPageWithChildren[] {
    if (!parentId) {
        // Root-level siblings
        return tree;
    }
    const parent = findPageInTree(tree, parentId);
    return parent?.childPages ?? [];
}

export function WikiSidebar({
    pages: rawPages,
    organizationId,
    projectId,
    currentPageId,
    basePath,
    readOnly = false,
}: WikiSidebarProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

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

    const activePage = activeId ? findPageInTree(tree, activeId) : null;

    const router = useRouter();

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Find the dragged page to get its parent
        const draggedPage = findPageInTree(tree, active.id as string);
        if (!draggedPage) return;

        const parentId = draggedPage.parentPageId;
        const siblings = getSiblings(tree, active.id as string, parentId);

        const oldIndex = siblings.findIndex((s) => s.id === active.id);
        const newIndex = siblings.findIndex((s) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        // Compute new order
        const reordered = [...siblings];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        const updates = reordered.map((page, index) => ({
            id: page.id,
            sortOrder: index,
            parentPageId: parentId,
        }));

        const result = await reorderWikiPages(updates);
        if (result.success) {
            router.refresh();
        } else {
            toast.error("Failed to reorder pages");
        }
    }, [tree, router]);

    const handleUseTemplate = (content: any, title: string) => {
        sessionStorage.setItem("wiki-template-content", JSON.stringify(content));
        sessionStorage.setItem("wiki-template-title", title);
    };

    const handleNewFolder = useCallback(async () => {
        const result = await createWikiPage({
            title: "New Folder",
            organizationId,
            projectId,
            namespace: projectId ? WikiNamespace.PROJECT : WikiNamespace.COMPANY,
            isFolder: true,
        });
        if (result.success && result.data) {
            router.push(`${basePath}/${result.data.id}`);
            router.refresh();
        } else {
            toast.error(result.error || "Failed to create folder");
        }
    }, [organizationId, projectId, basePath, router]);

    const rootIds = useMemo(() => tree.map((p) => p.id), [tree]);

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
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                title="New folder"
                                onClick={handleNewFolder}
                            >
                                <FolderPlus className="h-4 w-4" />
                            </Button>
                            <WikiPageDialog
                                organizationId={organizationId}
                                projectId={projectId}
                                namespace={projectId ? WikiNamespace.PROJECT : WikiNamespace.COMPANY}
                                trigger={
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="New page">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </div>

                {/* Wiki Search */}
                <WikiSearch organizationId={organizationId} basePath={basePath} />

                {/* Templates */}
                {!readOnly && (
                    <WikiTemplatesDialog
                        organizationId={organizationId}
                        onUseTemplate={handleUseTemplate}
                    />
                )}

                {!readOnly && (
                    <Link href="/wiki/trash" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                        Trash
                    </Link>
                )}

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar">
                            {tree.map((page) => (
                                <SortableTreeItem
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
                    </SortableContext>

                    <DragOverlay>
                        {activePage ? (
                            <div className="rounded-md bg-background border shadow-lg px-3 py-1.5 text-sm flex items-center gap-2">
                                {activePage.icon ? (
                                    <span className="text-sm">{activePage.icon}</span>
                                ) : (
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="truncate max-w-[180px]">{activePage.title}</span>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
