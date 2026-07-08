"use client";

import { useMemo, useState, useEffect } from "react";
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
import { TaskStatus } from "@prisma/client";
import { KanbanColumn } from "./column";
import { TaskCard } from "./task-card";
import { useBulkReorderTasks } from "@/hooks/use-tasks";
import { TaskWithRelations } from "@/types/task";
import { createPortal } from "react-dom";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Layers, Settings2, Layout, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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

const DEFAULT_COLUMN_IDS: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const ALL_COLUMNS: { id: TaskStatus; title: string }[] = [
    { id: "BACKLOG", title: "Backlog" },
    { id: "TODO", title: "To Do" },
    { id: "IN_PROGRESS", title: "In Progress" },
    { id: "IN_REVIEW", title: "In Review" },
    { id: "DONE", title: "Done" },
    { id: "ARCHIVED", title: "Archived" },
];

export function KanbanBoard({ tasks: initialTasks, projectId, sprintId }: KanbanBoardProps) {
    const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks);
    const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
    const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
    const [visibleColumnIds, setVisibleColumnIds] = useState<TaskStatus[]>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("kanban-visible-columns");
            if (saved) {
                const parsed = JSON.parse(saved) as TaskStatus[];
                const validIds = ALL_COLUMNS.map((column) => column.id);
                const savedIds = parsed.filter((id) => validIds.includes(id));
                if (savedIds.length > 0) return savedIds;
            }
        }

        return DEFAULT_COLUMN_IDS;
    });

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

    useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('kanban-show-subtasks', JSON.stringify(showSubtasks));
        }
    }, [showSubtasks]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("kanban-visible-columns", JSON.stringify(visibleColumnIds));
        }
    }, [visibleColumnIds]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('kanban-expanded-parents', JSON.stringify(Array.from(expandedParents)));
        }
    }, [expandedParents]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Recursive helper to flatten tasks with depth calculation
    const tasksByStatus = useMemo(() => {
        const grouped: Record<TaskStatus, (TaskWithRelations & { depth: number })[]> = {
            BACKLOG: [], TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [], ARCHIVED: [],
        };

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
        ALL_COLUMNS.forEach(col => {
            const columnTasks = tasks.filter(t => t.status === col.id);
            const topLevelInCol = columnTasks.filter(t => !t.parentTaskId);
            topLevelInCol.sort((a, b) => a.sortOrder - b.sortOrder);

            topLevelInCol.forEach(parent => {
                grouped[col.id].push({ ...parent, depth: 0 });
                if (showSubtasks && expandedParents.has(parent.id)) {
                    grouped[col.id].push(...buildHierarchy(parent.id, 1).filter(t => t.status === col.id));
                }
            });
        });

        return grouped;
    }, [tasks, showSubtasks, expandedParents]);

    const visibleColumns = useMemo(
        () => visibleColumnIds
            .map((id) => ALL_COLUMNS.find((column) => column.id === id))
            .filter((column): column is { id: TaskStatus; title: string } => Boolean(column)),
        [visibleColumnIds]
    );

    const hiddenColumns = useMemo(
        () => ALL_COLUMNS.filter((column) => !visibleColumnIds.includes(column.id)),
        [visibleColumnIds]
    );

    const addColumn = (status: TaskStatus) => {
        setVisibleColumnIds((current) => (
            current.includes(status) ? current : [...current, status]
        ));
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

            if (isOverColumn) {
                const overColumnId = over.id.toString().replace("column-", "") as TaskStatus;
                if (activeTask.status !== overColumnId) {
                    const newTasks = [...prev];
                    // Move to end of new column temporarily
                    const highestOrder = Math.max(0, ...newTasks.filter(t => t.status === overColumnId).map(t => t.sortOrder));
                    newTasks[activeIndex] = { ...activeTask, status: overColumnId, sortOrder: highestOrder + 1 };
                    return newTasks;
                }
            } else {
                const overIndex = prev.findIndex((t) => t.id === overId);
                const overTask = prev[overIndex];
                if (activeTask.status !== overTask.status) {
                    const newTasks = [...prev];
                    newTasks[activeIndex] = { ...activeTask, status: overTask.status, sortOrder: overTask.sortOrder };
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

        let targetStatus: TaskStatus = activeItem.status;
        if (overId.startsWith("column-")) {
            targetStatus = overId.replace("column-", "") as TaskStatus;
        } else {
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) targetStatus = overTask.status;
        }

        // We calculate new order array for targetStatus
        setTasks((prev) => {
            const workingTasks = [...prev];

            // First ensure active task is in target status
            const activeIndexFlat = workingTasks.findIndex((t) => t.id === activeId);
            if (workingTasks[activeIndexFlat].status !== targetStatus) {
                workingTasks[activeIndexFlat] = { ...workingTasks[activeIndexFlat], status: targetStatus };
            }

            // Get all tasks in target column
            const targetColTasks = workingTasks.filter(t => t.status === targetStatus);
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
                sortOrder: index,
            }));

            // Issue background API call to persist (will optimistic update again but essentially a no-op visually)
            bulkReorderTasks.mutate({ tasks: bulkUpdatePayload });

            // Update local memory with the 0,1,2 sort orders so it doesn't snap back
            return workingTasks.map(t => {
                const updatedConfig = bulkUpdatePayload.find(b => b.id === t.id);
                if (updatedConfig) {
                    return { ...t, status: updatedConfig.status, sortOrder: updatedConfig.sortOrder };
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
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-2.5">
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

            <div className="scrollbar-thin flex h-full gap-4 overflow-x-auto px-6 py-5">
                {visibleColumns.map((column) => (
                    <KanbanColumn
                        key={column.id}
                        id={column.id}
                        title={column.title}
                        tasks={tasksByStatus[column.id]}
                        onTaskClick={setSelectedTask}
                        projectId={projectId}
                        sprintId={sprintId}
                        showSubtasks={showSubtasks}
                        expandedParents={expandedParents}
                        onToggleParent={toggleParent}
                        visibleProperties={visibleProperties}
                    />
                ))}

                {hiddenColumns.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
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
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52 border-[color:var(--border)] bg-[color:var(--popover)]">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                                Add status column
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                            {hiddenColumns.map((column) => (
                                <DropdownMenuItem
                                    key={column.id}
                                    onSelect={() => addColumn(column.id)}
                                    className="gap-2"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {column.title}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
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

            <TaskDetailSheet
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />
        </DndContext>
    );
}
