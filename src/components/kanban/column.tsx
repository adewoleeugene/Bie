
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskStatus } from "@prisma/client";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import { TaskWithRelations } from "@/types/task";

interface KanbanColumnProps {
    id: TaskStatus;
    title: string;
    tasks: TaskWithRelations[];
    onTaskClick?: (task: TaskWithRelations) => void;
    showSubtasks?: boolean;
    expandedParents?: Set<string>;
    onToggleParent?: (parentId: string) => void;
}

export function KanbanColumn({
    id,
    title,
    tasks,
    onTaskClick,
    showSubtasks,
    expandedParents,
    onToggleParent
}: KanbanColumnProps) {
    const { setNodeRef } = useDroppable({
        id: `column-${id}`,
    });

    return (
        <div className="flex h-full w-80 min-w-[320px] flex-col rounded-lg bg-neutral-100/50 p-4 dark:bg-neutral-800/50">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-700 dark:text-neutral-200">
                    {title}
                </h3>
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    {tasks.filter(t => !t.parentTaskId).length}
                </span>
            </div>

            <div ref={setNodeRef} className="flex flex-1 flex-col gap-3 min-h-[500px]">
                <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => {
                        const isSubtask = !!task.parentTaskId;
                        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                        const isExpanded = expandedParents?.has(task.id);

                        return (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onClick={() => onTaskClick?.(task)}
                                isSubtask={isSubtask}
                                hasSubtasks={hasSubtasks}
                                isExpanded={isExpanded}
                                showSubtasks={showSubtasks}
                                onToggleExpand={onToggleParent ? () => onToggleParent(task.id) : undefined}
                            />
                        );
                    })}
                </SortableContext>
            </div>
        </div>
    );
}
