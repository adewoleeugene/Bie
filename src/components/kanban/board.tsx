"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { TaskStatusColumn } from "@prisma/client";
import { KanbanColumn } from "./column";
import { TaskCard } from "./task-card";
import {
    useBulkReorderTasks,
    useCreateTaskStatusColumn,
    useDeleteTaskStatusColumn,
    useTaskStatusColumns,
} from "@/hooks/use-tasks";
import { TaskWithRelations } from "@/types/task";
import { createPortal } from "react-dom";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Layers, Settings2, Layout, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface KanbanBoardProps {
    tasks: TaskWithRelations[];
    projectId?: string;
    sprintId?: string;
}

const DEFAULT_COLUMN_FALLBACKS: Array<Pick<TaskStatusColumn, "id" | "name" | "status" | "color" | "sortOrder">> = [
    { id: "legacy-BACKLOG", name: "Backlog", status: "BACKLOG", color: "#858585", sortOrder: 0 },
    { id: "legacy-TODO", name: "To Do", status: "TODO", color: "#0099ff", sortOrder: 1 },
    { id: "legacy-IN_PROGRESS", name: "In Progress", status: "IN_PROGRESS", color: "#f6b73c", sortOrder: 2 },
    { id: "legacy-IN_REVIEW", name: "In Review", status: "IN_REVIEW", color: "#df5cff", sortOrder: 3 },
    { id: "legacy-DONE", name: "Done", status: "DONE", color: "#20d990", sortOrder: 4 },
];

export function KanbanBoard({ tasks: initialTasks, projectId, sprintId }: KanbanBoardProps) {
    const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks);
    const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
    const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
    const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");

    const [visibleProperties, setVisibleProperties] = useState({
        assignees: true,
        priority: true,
        dueDate: true,
        subtaskProgress: true,
    });

    const [showSubtasks, setShowSubtasks] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kanban-show-subtasks');
            return saved ? JSON.parse(saved) : true; // Default to TRUE for better Notion feel
        }
        return true;
    });

    const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kanban-expanded-parents');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });

    const bulkReorderTasks = useBulkReorderTasks();
    const { data: statusColumnsResult } = useTaskStatusColumns(projectId ?? null);
    const createStatusColumn = useCreateTaskStatusColumn();
    const deleteStatusColumn = useDeleteTaskStatusColumn();

    useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('kanban-show-subtasks', JSON.stringify(showSubtasks));
        }
    }, [showSubtasks]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('kanban-expanded-parents', JSON.stringify(Array.from(expandedParents)));
        }
    }, [expandedParents]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const { columns, columnAliases } = useMemo(() => {
        const savedColumns = statusColumnsResult?.success ? statusColumnsResult.data : [];
        const taskColumns = tasks
            .map((task) => task.statusColumn)
            .filter((column): column is TaskStatusColumn => Boolean(column));

        const columnsById = new Map<string, Pick<TaskStatusColumn, "id" | "name" | "status" | "color" | "sortOrder">>();
        [...savedColumns, ...taskColumns].forEach((column) => {
            if (!columnsById.has(column.id)) columnsById.set(column.id, column);
        });

        const orderedColumns = Array.from(columnsById.values()).sort((a, b) => a.sortOrder - b.sortOrder);

        // Collapse duplicate default columns that share the same status (a stray
        // duplicate default carries a status and can't be deleted from the UI).
        // Keep the first, and alias the duplicates' ids to it so any task still
        // pointing at a dropped column stays visible in the kept one.
        const keeperByStatus = new Map<string, string>();
        const aliases = new Map<string, string>();
        const dedupedColumns = orderedColumns.filter((column) => {
            if (!column.status) return true;
            const keeperId = keeperByStatus.get(column.status);
            if (keeperId) {
                aliases.set(column.id, keeperId);
                return false;
            }
            keeperByStatus.set(column.status, column.id);
            return true;
        });

        return {
            columns: dedupedColumns.length > 0 ? dedupedColumns : DEFAULT_COLUMN_FALLBACKS,
            columnAliases: aliases,
        };
    }, [statusColumnsResult, tasks]);

    const getTaskColumnId = useCallback((task: TaskWithRelations) => {
        if (task.statusColumnId) return columnAliases.get(task.statusColumnId) ?? task.statusColumnId;
        const fallbackColumn = columns.find((column) => column.status === task.status);
        return fallbackColumn?.id ?? columns[0]?.id ?? task.status;
    }, [columns, columnAliases]);

    // Recursive helper to flatten tasks with depth calculation
    const tasksByStatus = useMemo(() => {
        const grouped: Record<string, (TaskWithRelations & { depth: number })[]> = {};
        columns.forEach((column) => {
            grouped[column.id] = [];
        });

        const buildHierarchy = (parentId: string | null, depth: number): (TaskWithRelations & { depth: number })[] => {
            const children = tasks.filter(t => t.parentTaskId === parentId);
            children.sort((a, b) => a.sortOrder - b.sortOrder);

            const result: (TaskWithRelations & { depth: number })[] = [];

            children.forEach(child => {
                result.push({ ...child, depth });

                // If showing sub-items AND this specific parent is expanded, add its children recursively
                if (showSubtasks && expandedParents.has(child.id)) {
                    result.push(...buildHierarchy(child.id, depth + 1));
                }
            });

            return result;
        };

        // Initialize with top-level parents (no parentTaskId)
        columns.forEach(col => {
            const columnTasks = tasks.filter(t => getTaskColumnId(t) === col.id);
            const topLevelInCol = columnTasks.filter(t => !t.parentTaskId);
            topLevelInCol.sort((a, b) => a.sortOrder - b.sortOrder);

            topLevelInCol.forEach(parent => {
                grouped[col.id].push({ ...parent, depth: 0 });
                if (showSubtasks && expandedParents.has(parent.id)) {
                    grouped[col.id].push(...buildHierarchy(parent.id, 1).filter(t => getTaskColumnId(t) === col.id));
                }
            });
        });

        return grouped;
    }, [tasks, showSubtasks, expandedParents, columns, getTaskColumnId]);

    const handleAddColumnSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = newColumnName.trim();
        if (!name) return;

        const result = await createStatusColumn.mutateAsync({
            name,
            projectId: projectId ?? null,
        });

        if (result.success) {
            setNewColumnName("");
            setIsAddColumnOpen(false);
        }
    };

    const toggleParent = (parentId: string) => {
        setExpandedParents(prev => {
            const next = new Set(prev);
            if (next.has(parentId)) {
                next.delete(parentId);
            } else {
                next.add(parentId);
            }
            return next;
        });
    };

    const toggleShowSubtasks = () => {
        const newValue = !showSubtasks;
        setShowSubtasks(newValue);
        if (!newValue) {
            setExpandedParents(new Set());
        } else {
            const allParentIds = tasks.filter(t => t.subtasks?.length > 0).map(t => t.id);
            setExpandedParents(new Set(allParentIds));
        }
    };

    function handleDragStart(event: DragStartEvent) {
        const { active } = event;
        const task = tasks.find((t) => t.id === active.id);
        if (task) setActiveTask(task);
    }

    // Logic for drag over: just updates status visually if moved to empty column
    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;
        const activeId = active.id;
        const overId = over.id;
        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === "Task";
        const isOverColumn = over.id.toString().startsWith("column-");

        if (!isActiveTask) return;

        setTasks((prev) => {
            const activeIndex = prev.findIndex((t) => t.id === activeId);
            const activeTask = prev[activeIndex];
            const activeColumnId = getTaskColumnId(activeTask);

            if (isOverColumn) {
                const overColumnId = over.id.toString().replace("column-", "");
                const overColumn = columns.find((column) => column.id === overColumnId);
                if (overColumn && activeColumnId !== overColumnId) {
                    const newTasks = [...prev];
                    // Move to end of new column temporarily
                    const highestOrder = Math.max(0, ...newTasks.filter(t => getTaskColumnId(t) === overColumnId).map(t => t.sortOrder));
                    newTasks[activeIndex] = {
                        ...activeTask,
                        statusColumnId: overColumnId,
                        status: overColumn.status ?? activeTask.status,
                        sortOrder: highestOrder + 1,
                    };
                    return newTasks;
                }
            } else {
                const overIndex = prev.findIndex((t) => t.id === overId);
                const overTask = prev[overIndex];
                const overColumnId = getTaskColumnId(overTask);
                const overColumn = columns.find((column) => column.id === overColumnId);
                if (activeColumnId !== overColumnId) {
                    const newTasks = [...prev];
                    newTasks[activeIndex] = {
                        ...activeTask,
                        statusColumnId: overColumnId,
                        status: overColumn?.status ?? activeTask.status,
                        sortOrder: overTask.sortOrder,
                    };
                    return newTasks;
                }
            }
            return prev;
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeItem = tasks.find(t => t.id === activeId);
        if (!activeItem) return;

        let targetColumnId = getTaskColumnId(activeItem);
        if (overId.startsWith("column-")) {
            targetColumnId = overId.replace("column-", "");
        } else {
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) targetColumnId = getTaskColumnId(overTask);
        }
        const targetColumn = columns.find((column) => column.id === targetColumnId);
        if (!targetColumn) return;
        const targetStatus = targetColumn.status ?? activeItem.status;

        // We calculate new order array for targetStatus
        setTasks((prev) => {
            const workingTasks = [...prev];

            // First ensure active task is in target status
            const activeIndexFlat = workingTasks.findIndex((t) => t.id === activeId);
            if (getTaskColumnId(workingTasks[activeIndexFlat]) !== targetColumnId) {
                workingTasks[activeIndexFlat] = {
                    ...workingTasks[activeIndexFlat],
                    status: targetStatus,
                    statusColumnId: targetColumnId,
                };
            }

            // Get all tasks in target column
            const targetColTasks = workingTasks.filter(t => getTaskColumnId(t) === targetColumnId);
            targetColTasks.sort((a, b) => a.sortOrder - b.sortOrder);

            const activeIndex = targetColTasks.findIndex(t => t.id === activeId);
            const overIndex = targetColTasks.findIndex(t => t.id === overId);

            let newTargetColTasks = targetColTasks;

            if (activeIndex !== overIndex && overIndex !== -1) {
                // Moving within same column or precisely placing it inside
                newTargetColTasks = arrayMove(targetColTasks, activeIndex, overIndex);
            } else if (overIndex === -1 && overId.startsWith("column-")) {
                // If dropped directly onto empty column container, arrayMove is not needed, active item is already in targetColTasks
            }

            // After move, reassign numeric sortOrder to array index securely
            const bulkUpdatePayload = newTargetColTasks.map((task, index) => ({
                id: task.id,
                status: targetStatus,
                statusColumnId: targetColumnId,
                sortOrder: index,
            }));

            // Issue background API call to persist (will optimistic update again but essentially a no-op visually)
            bulkReorderTasks.mutate({ tasks: bulkUpdatePayload });

            // Update local memory with the 0,1,2 sort orders so it doesn't snap back
            return workingTasks.map(t => {
                const updatedConfig = bulkUpdatePayload.find(b => b.id === t.id);
                if (updatedConfig) {
                    return {
                        ...t,
                        status: updatedConfig.status,
                        statusColumnId: updatedConfig.statusColumnId,
                        sortOrder: updatedConfig.sortOrder,
                    };
                }
                return t;
            });
        });
    }

    const totalSubtasks = tasks.filter(t => !!t.parentTaskId).length;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-6 py-2.5">
                <div className="flex items-center gap-2">
                    {totalSubtasks > 0 && (
                        <button
                            type="button"
                            onClick={toggleShowSubtasks}
                            className={cn(
                                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                                showSubtasks
                                    ? "border-transparent bg-[color:var(--bz-blue)] text-black"
                                    : "border-[color:var(--border)] text-neutral-300 hover:bg-white/[0.04] hover:text-white",
                            )}
                        >
                            <Layers className="h-3 w-3" />
                            Sub-items
                            <span
                                className={cn(
                                    "mono ml-0.5 rounded px-1 text-[10px]",
                                    showSubtasks ? "bg-black/25 text-black" : "bg-white/10 text-neutral-400",
                                )}
                            >
                                {totalSubtasks}
                            </span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--border)] px-2.5 text-[11px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        <Layout className="h-3 w-3" />
                        Group: Status
                    </button>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                        >
                            <Settings2 className="h-3 w-3" />
                            Properties
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 border-[color:var(--border)] bg-[color:var(--popover)]">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                            Visible properties
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                        {Object.keys(visibleProperties).map((key) => (
                            <DropdownMenuCheckboxItem
                                key={key}
                                checked={visibleProperties[key as keyof typeof visibleProperties]}
                                onCheckedChange={(checked) => setVisibleProperties(prev => ({ ...prev, [key]: !!checked }))}
                            >
                                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="scrollbar-thin flex min-h-0 flex-1 items-start gap-4 overflow-auto px-6 py-5">
                {columns.map((column) => (
                    <KanbanColumn
                        key={column.id}
                        id={column.id}
                        title={column.name}
                        status={column.status}
                        accent={column.color}
                        tasks={tasksByStatus[column.id] ?? []}
                        onTaskClick={setSelectedTask}
                        canDelete={!column.status}
                        isDeleting={deleteStatusColumn.isPending}
                        onDelete={() => deleteStatusColumn.mutate({ id: column.id })}
                        projectId={projectId}
                        sprintId={sprintId}
                        showSubtasks={showSubtasks}
                        expandedParents={expandedParents}
                        onToggleParent={toggleParent}
                        visibleProperties={visibleProperties}
                    />
                ))}

                <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "flex h-12 w-[300px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed",
                                "border-[color:var(--border)] bg-white/[0.015] text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500",
                                "transition-colors hover:border-[color:var(--bz-blue)]/60 hover:bg-white/[0.035] hover:text-white"
                            )}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New column
                        </button>
                    </DialogTrigger>
                    <DialogContent className="border-[color:var(--border)] bg-[color:var(--popover)] sm:max-w-[420px]">
                        <DialogHeader>
                            <DialogTitle>Add column</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddColumnSubmit} className="space-y-4">
                            <Input
                                autoFocus
                                value={newColumnName}
                                onChange={(event) => setNewColumnName(event.target.value)}
                                placeholder="Column name"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddColumnOpen(false)}
                                    className="inline-flex h-9 items-center rounded-lg border border-[color:var(--border)] px-3 text-[12px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newColumnName.trim() || createStatusColumn.isPending}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--bz-blue)] px-3 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {createStatusColumn.isPending ? "Adding..." : "Add column"}
                                </button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            </div>

            {createPortal(
                <DragOverlay>
                    {activeTask ? (
                        <TaskCard
                            task={activeTask}
                            isDragging
                            visibleProperties={visibleProperties}
                            depth={0}
                        />
                    ) : null}
                </DragOverlay>,
                document.body
            )}

            {/* selectedTask is a click-time snapshot — hand the sheet the live
                copy so edits made inside it (assignees, status) show while
                it stays open. */}
            <TaskDetailSheet
                task={selectedTask ? tasks.find((t) => t.id === selectedTask.id) ?? selectedTask : null}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />
        </DndContext>
    );
}
