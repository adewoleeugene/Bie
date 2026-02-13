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
import { Layers } from "lucide-react";

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
    
    // Load show subtasks preference from localStorage
    const [showSubtasks, setShowSubtasks] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kanban-show-subtasks');
            return saved ? JSON.parse(saved) : false;
        }
        return false;
    });
    
    // Track which parent tasks are expanded
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

    // Save preferences to localStorage
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
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Organize tasks by status with parent-child nesting
    const tasksByStatus = useMemo(() => {
        const grouped: Record<TaskStatus, TaskWithRelations[]> = {
            BACKLOG: [],
            TODO: [],
            IN_PROGRESS: [],
            IN_REVIEW: [],
            DONE: [],
            ARCHIVED: [],
        };

        // Separate parents and subtasks
        const parentTasks = tasks.filter(t => !t.parentTaskId);
        const subtaskMap = new Map<string, TaskWithRelations[]>();
        
        tasks.forEach(task => {
            if (task.parentTaskId) {
                if (!subtaskMap.has(task.parentTaskId)) {
                    subtaskMap.set(task.parentTaskId, []);
                }
                subtaskMap.get(task.parentTaskId)!.push(task);
            }
        });

        // Build nested structure for each column
        parentTasks.forEach((parent) => {
            if (grouped[parent.status]) {
                grouped[parent.status].push(parent);
                
                // If showing subtasks and parent is expanded, add its subtasks
                if (showSubtasks && expandedParents.has(parent.id)) {
                    const childTasks = subtaskMap.get(parent.id) || [];
                    // Sort subtasks by sortOrder
                    childTasks.sort((a, b) => a.sortOrder - b.sortOrder);
                    grouped[parent.status].push(...childTasks);
                }
            }
        });

        // Sort parents by sortOrder within each column
        Object.keys(grouped).forEach((key) => {
            const statusTasks = grouped[key as TaskStatus];
            // Extract parents only for sorting
            const parents = statusTasks.filter(t => !t.parentTaskId);
            parents.sort((a, b) => a.sortOrder - b.sortOrder);
            
            // Rebuild with sorted parents and their children
            const sorted: TaskWithRelations[] = [];
            parents.forEach(parent => {
                sorted.push(parent);
                if (showSubtasks && expandedParents.has(parent.id)) {
                    const children = statusTasks.filter(t => t.parentTaskId === parent.id);
                    sorted.push(...children);
                }
            });
            
            grouped[key as TaskStatus] = sorted;
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
        // If hiding subtasks, collapse all parents
        if (!newValue) {
            setExpandedParents(new Set());
        } else {
            // If showing subtasks, expand all parents by default
            const allParentIds = tasks.filter(t => !t.parentTaskId).map(t => t.id);
            setExpandedParents(new Set(allParentIds));
        }
    };

    function handleDragStart(event: DragStartEvent) {
        const { active } = event;
        const task = tasks.find((t) => t.id === active.id);
        if (task) {
            setActiveTask(task);
        }
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === "Task";
        const isOverTask = over.data.current?.type === "Task";
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
                return prev;
            }

            if (isOverTask) {
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

        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const activeItem = tasks[activeIndex];

        let targetStatus: TaskStatus = activeItem.status;

        if (overId.startsWith("column-")) {
            targetStatus = overId.replace("column-", "") as TaskStatus;
        } else {
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) targetStatus = overTask.status;
        }

        const tasksInTargetColumn = tasksByStatus[targetStatus].filter(t => t.id !== activeId);

        let newSortOrder = tasksInTargetColumn.length + 1;

        if (!overId.startsWith("column-")) {
            const overTask = tasksInTargetColumn.find(t => t.id === overId);
            if (overTask) {
                newSortOrder = overTask.sortOrder;
            }
        } else {
            if (tasksInTargetColumn.length > 0) {
                const lastTask = tasksInTargetColumn[tasksInTargetColumn.length - 1];
                newSortOrder = lastTask.sortOrder + 1;
            } else {
                newSortOrder = 1;
            }
        }

        reorderTask.mutate({
            id: activeId,
            status: targetStatus,
            sortOrder: newSortOrder
        });
    }

    // Count subtasks across all tasks
    const totalSubtasks = tasks.filter(t => !!t.parentTaskId).length;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            {/* Sub-tasks toggle */}
            {totalSubtasks > 0 && (
                <div className="flex items-center gap-2 px-6 pt-4 pb-0">
                    <Button
                        variant={showSubtasks ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={toggleShowSubtasks}
                    >
                        <Layers className="h-3 w-3" />
                        Sub-tasks
                        <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                            {totalSubtasks}
                        </span>
                    </Button>
                </div>
            )}

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
                    />
                ))}
            </div>

            {createPortal(
                <DragOverlay>
                    {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
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
