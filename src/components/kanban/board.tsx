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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { TaskStatus } from "@prisma/client";
import { KanbanColumn } from "./column";
import { TaskCard } from "./task-card";
import { useReorderTask } from "@/hooks/use-tasks";
import { TaskWithRelations } from "@/types/task";
import { createPortal } from "react-dom";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Button } from "@/components/ui/button";
import { Layers, MoreHorizontal, Settings2, Eye, Layout } from "lucide-react";
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
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
    { id: "BACKLOG", title: "Backlog" },
    { id: "TODO", title: "To Do" },
    { id: "IN_PROGRESS", title: "In Progress" },
    { id: "IN_REVIEW", title: "In Review" },
    { id: "DONE", title: "Done" },
];

export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
    const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks);
    const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
    const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);

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

    const reorderTask = useReorderTask();

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
        COLUMNS.forEach(col => {
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

    // Logic for drag and drop (simplified to rely on local state updates during hover)
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
                    newTasks[activeIndex] = { ...activeTask, status: overColumnId };
                    return newTasks;
                }
            } else {
                const overIndex = prev.findIndex((t) => t.id === overId);
                const overTask = prev[overIndex];
                if (activeTask.status !== overTask.status) {
                    const newTasks = [...prev];
                    newTasks[activeIndex] = { ...activeTask, status: overTask.status };
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

        reorderTask.mutate({
            id: activeId,
            status: targetStatus,
            sortOrder: 1 // Simple reorder for now
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
            <div className="flex items-center justify-between px-6 pt-4 pb-0">
                <div className="flex items-center gap-2">
                    {totalSubtasks > 0 && (
                        <Button
                            variant={showSubtasks ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={toggleShowSubtasks}
                        >
                            <Layers className="h-3 w-3" />
                            Sub-items
                            <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                                {totalSubtasks}
                            </span>
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                        <Layout className="h-3 w-3" />
                        Group by: Status
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                                <Settings2 className="h-3 w-3" />
                                Properties
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Visible Properties</DropdownMenuLabel>
                            <DropdownMenuSeparator />
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
            </div>

            <div className="flex h-full gap-4 overflow-x-auto p-6">
                {COLUMNS.map((column) => (
                    <KanbanColumn
                        key={column.id}
                        id={column.id}
                        title={column.title}
                        tasks={tasksByStatus[column.id]}
                        onTaskClick={setSelectedTask}
                        showSubtasks={showSubtasks}
                        expandedParents={expandedParents}
                        onToggleParent={toggleParent}
                        visibleProperties={visibleProperties}
                    />
                ))}
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
