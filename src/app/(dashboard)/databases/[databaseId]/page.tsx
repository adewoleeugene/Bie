"use client";

import { use, useState, useEffect } from "react";
import { DatabaseViewType } from "@prisma/client";
import {
    useDatabase,
    useUpdateDatabase,
    useDeleteDatabase,
    useCreateView,
    useDeleteView,
} from "@/hooks/use-databases";
import { DatabaseTableView } from "@/components/databases/database-table-view";
import { DatabaseBoardView } from "@/components/databases/database-board-view";
import { DatabaseGalleryView } from "@/components/databases/database-gallery-view";
import { DatabaseCalendarView } from "@/components/databases/database-calendar-view";
import { DatabaseTimelineView } from "@/components/databases/database-timeline-view";
import { RowDetailSheet } from "@/components/databases/row-detail-sheet";
import { useSetRowValue, useUpdateProperty } from "@/hooks/use-databases";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MoreHorizontal,
    Trash2,
    Database as DatabaseIcon,
    Plus,
    LayoutGrid,
    Columns3,
    Calendar,
    Rows3,
    Share2,
    GanttChart,
} from "lucide-react";
import { ShareDialog, ShareMember } from "@/components/sharing/share-dialog";
import {
    addDatabaseMember,
    getDatabaseSharing,
    removeDatabaseMember,
    setDatabaseVisibility,
    transferDatabaseOwnership,
} from "@/actions/databases";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResourceMemberRole, ResourceVisibility } from "@prisma/client";
import { useViewerUserId } from "@/hooks/use-viewer";
import { useRouter } from "next/navigation";
import {
    parseSelectConfig,
    parseStatusConfig,
    SelectOption,
    StatusOption,
} from "@/lib/database-types";
import { parseViewOptions } from "@/lib/database-view-config";
import { applyViewOptions } from "@/lib/database-row-pipeline";
import { ViewOptionsPopover } from "@/components/databases/view-options-popover";
import { useFavorites, useToggleFavorite } from "@/hooks/use-favorites";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
    params: Promise<{ databaseId: string }>;
}

const VIEW_ICONS: Record<DatabaseViewType, React.ComponentType<{ className?: string }>> = {
    TABLE: Rows3,
    BOARD: Columns3,
    GALLERY: LayoutGrid,
    CALENDAR: Calendar,
    TIMELINE: GanttChart,
};

export default function DatabaseDetailPage({ params }: PageProps) {
    const { databaseId } = use(params);
    const router = useRouter();
    const { data: database, isLoading } = useDatabase(databaseId);
    const update = useUpdateDatabase(databaseId);
    const del = useDeleteDatabase();
    const createView = useCreateView(databaseId);
    const deleteView = useDeleteView(databaseId);
    const updateProperty = useUpdateProperty(databaseId);
    const setRowValue = useSetRowValue(databaseId);

    const { data: favorites } = useFavorites();
    const toggleFavorite = useToggleFavorite();
    const isFavorited = favorites?.some((f: any) => f.itemId === databaseId && f.itemType === "database");

    const [editingName, setEditingName] = useState(false);
    const [activeViewId, setActiveViewId] = useState<string | null>(null);
    const [showNewView, setShowNewView] = useState(false);
    const [newViewName, setNewViewName] = useState("");
    const [newViewType, setNewViewType] = useState<DatabaseViewType>("TABLE");
    const [openRowId, setOpenRowId] = useState<string | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const qc = useQueryClient();
    const viewerUserId = useViewerUserId();
    const { data: sharing, refetch: refetchSharing } = useQuery({
        queryKey: ["database-sharing", databaseId],
        queryFn: () => getDatabaseSharing(databaseId),
        enabled: shareOpen,
    });

    useEffect(() => {
        if (database?.views.length && !activeViewId) {
            setActiveViewId(database.views[0].id);
        }
    }, [database, activeViewId]);

    if (isLoading) {
        return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
    }
    if (!database) {
        return <div className="p-8 text-sm text-neutral-500">Collection not found.</div>;
    }

    const activeView =
        database.views.find((v) => v.id === activeViewId) || database.views[0];
    const openRow = database.rows.find((r) => r.id === openRowId) || null;

    // Apply this view's filters + sorts to the row list. Hidden columns are
    // applied per-view-component (passed via prop).
    const viewOptions = activeView ? parseViewOptions(activeView.config) : {};
    const visibleRows = activeView
        ? applyViewOptions(database.rows, database.properties, viewOptions)
        : database.rows;
    const hiddenIds = viewOptions.hiddenPropertyIds || [];

    const handleCreateView = async () => {
        if (!newViewName.trim()) return;
        const result = await createView.mutateAsync({
            databaseId,
            name: newViewName.trim(),
            type: newViewType,
        });
        if (result.success && result.data) {
            setActiveViewId(result.data.id);
            setNewViewName("");
            setShowNewView(false);
        }
    };

    const handleAddSelectOption = async (
        propertyId: string,
        currentConfig: unknown,
        option: unknown,
    ) => {
        // Dispatch by the property type so the same callback can write
        // either select or status option shapes from the row sheet.
        const property = database?.properties.find((p) => p.id === propertyId);
        if (property?.type === "STATUS") {
            const cfg = parseStatusConfig(currentConfig);
            const next = {
                ...cfg,
                options: [...cfg.options, option as StatusOption],
            };
            await updateProperty.mutateAsync({
                propertyId,
                config: next as any,
            });
            return;
        }
        const cfg = parseSelectConfig(currentConfig);
        const next = {
            options: [...cfg.options, option as SelectOption],
        };
        await updateProperty.mutateAsync({
            propertyId,
            config: next as any,
        });
    };

    return (
        <div className="mx-auto max-w-7xl p-8">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <DatabaseIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    {editingName ? (
                        <Input
                            defaultValue={database.name}
                            autoFocus
                            onBlur={(e) => {
                                if (e.target.value && e.target.value !== database.name) {
                                    update.mutate({ name: e.target.value });
                                }
                                setEditingName(false);
                            }}
                            className="text-2xl font-semibold"
                        />
                    ) : (
                        <h1
                            className="cursor-text text-2xl font-semibold"
                            onClick={() => setEditingName(true)}
                        >
                            {database.name}
                        </h1>
                    )}
                    {database.description && (
                        <p className="text-sm text-neutral-500">{database.description}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() =>
                        database && toggleFavorite.mutate({
                            itemType: "database",
                            itemId: databaseId,
                            itemTitle: database.name,
                            itemUrl: `/databases/${databaseId}`,
                        })
                    }
                    className="rounded p-1.5 hover:bg-muted transition-colors"
                    title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star
                        className={cn(
                            "h-4 w-4",
                            isFavorited
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                        )}
                    />
                </button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShareOpen(true)}
                >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            className="text-red-600"
                            onClick={async () => {
                                const result = await del.mutateAsync(databaseId);
                                if (result.success) router.push("/databases");
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete collection
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* View tabs */}
            <div className="mb-3 flex items-center gap-0.5 border-b border-neutral-200 dark:border-neutral-800">
                {database.views.map((v) => {
                    const Icon = VIEW_ICONS[v.type];
                    const active = activeView?.id === v.id;
                    return (
                        <div key={v.id} className="group relative">
                            <button
                                type="button"
                                onClick={() => setActiveViewId(v.id)}
                                className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                                    active
                                        ? "border-primary text-primary"
                                        : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {v.name}
                            </button>
                            {active && database.views.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        deleteView.mutate(v.id);
                                        setActiveViewId(
                                            database.views.find((x) => x.id !== v.id)?.id || null,
                                        );
                                    }}
                                    className="absolute -right-1 top-0 hidden text-neutral-300 hover:text-red-500 group-hover:block"
                                    aria-label="Delete view"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setShowNewView(true)}
                    className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                >
                    <Plus className="h-3 w-3" /> View
                </button>
                {activeView && (
                    <div className="ml-auto pb-1">
                        <ViewOptionsPopover
                            databaseId={databaseId}
                            viewId={activeView.id}
                            viewConfig={activeView.config}
                            properties={database.properties}
                        />
                    </div>
                )}
            </div>

            {/* Active view */}
            {activeView?.type === "TABLE" && (
                <DatabaseTableView
                    databaseId={databaseId}
                    properties={database.properties}
                    rows={visibleRows}
                    hiddenPropertyIds={hiddenIds}
                />
            )}
            {activeView?.type === "BOARD" && (
                <DatabaseBoardView
                    databaseId={databaseId}
                    viewId={activeView.id}
                    viewConfig={activeView.config}
                    properties={database.properties}
                    rows={visibleRows}
                />
            )}
            {activeView?.type === "GALLERY" && (
                <DatabaseGalleryView
                    databaseId={databaseId}
                    viewId={activeView.id}
                    viewConfig={activeView.config}
                    properties={database.properties}
                    rows={visibleRows}
                    onOpenRow={(id) => setOpenRowId(id)}
                />
            )}
            {activeView?.type === "CALENDAR" && (
                <DatabaseCalendarView
                    databaseId={databaseId}
                    viewId={activeView.id}
                    viewConfig={activeView.config}
                    properties={database.properties}
                    rows={visibleRows}
                    onOpenRow={(id) => setOpenRowId(id)}
                />
            )}
            {activeView?.type === "TIMELINE" && (
                <DatabaseTimelineView
                    databaseId={databaseId}
                    viewId={activeView.id}
                    viewConfig={activeView.config}
                    properties={database.properties}
                    rows={visibleRows}
                    onOpenRow={(id) => setOpenRowId(id)}
                />
            )}

            {/* Shared row detail sheet for gallery/calendar */}
            <RowDetailSheet
                open={!!openRowId}
                onOpenChange={(o) => !o && setOpenRowId(null)}
                databaseId={databaseId}
                row={openRow}
                properties={database.properties}
                onSetValue={(rowId, propertyId, value) =>
                    setRowValue.mutate({ rowId, propertyId, value: value as any })
                }
                onAddOption={(propertyId, currentConfig, option) =>
                    handleAddSelectOption(propertyId, currentConfig, option)
                }
            />

            {/* Share dialog */}
            <ShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                title={database.name}
                visibility={(sharing?.visibility ?? "ORG") as ResourceVisibility}
                members={(sharing?.members ?? []) as ShareMember[]}
                ownerId={sharing?.createdById}
                viewerUserId={viewerUserId}
                onSetVisibility={async (v) => {
                    await setDatabaseVisibility({ databaseId, visibility: v });
                    await refetchSharing();
                    qc.invalidateQueries({ queryKey: ["database", databaseId] });
                }}
                onAddMember={async (userId, role) => {
                    await addDatabaseMember({ databaseId, userId, role });
                    await refetchSharing();
                }}
                onRemoveMember={async (userId) => {
                    await removeDatabaseMember({ databaseId, userId });
                    await refetchSharing();
                }}
                onTransferOwnership={async (newOwnerId) => {
                    await transferDatabaseOwnership({ databaseId, newOwnerId });
                    await refetchSharing();
                    qc.invalidateQueries({ queryKey: ["database", databaseId] });
                    qc.invalidateQueries({ queryKey: ["databases"] });
                }}
            />

            {/* New view dialog */}
            <Dialog open={showNewView} onOpenChange={setShowNewView}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>New view</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            placeholder="View name"
                            value={newViewName}
                            onChange={(e) => setNewViewName(e.target.value)}
                        />
                        <Select
                            value={newViewType}
                            onValueChange={(v) => setNewViewType(v as DatabaseViewType)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TABLE">Table</SelectItem>
                                <SelectItem value="BOARD">Board</SelectItem>
                                <SelectItem value="GALLERY">Gallery</SelectItem>
                                <SelectItem value="CALENDAR">Calendar</SelectItem>
                                <SelectItem value="TIMELINE">Timeline</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNewView(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateView}
                            disabled={!newViewName.trim() || createView.isPending}
                        >
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
