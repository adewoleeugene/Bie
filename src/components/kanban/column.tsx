"use client";

import { useDroppable } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskStatus } from "@prisma/client";
import { TaskCard } from "./task-card";
import { TaskWithRelations } from "@/types/task";

interface KanbanColumnProps {
    id: TaskStatus;
    title: string;
    tasks: (TaskWithRelations & { depth: number })[];
    onTaskClick: (task: TaskWithRelations) => void;
    showSubtasks?: boolean;
    expandedParents?: Set<string>;
    onToggleParent?: (parentId: string) => void;
    visibleProperties?: {
        assignees: boolean;
        priority: boolean;
        dueDate: boolean;
        subtaskProgress: boolean;
    };
}

export function KanbanColumn({
    id,
    title,
    tasks,
    onTaskClick,
    showSubtasks,
    expandedParents,
    onToggleParent,
    visibleProperties
}: KanbanColumnProps) {
    const { setNodeRef } = useDroppable({
        id: `column-${id}`,
    });

    return (
        <div className="flex w-[320px] flex-col gap-3 rounded-xl bg-neutral-100/50 dark:bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                        {title}
                    </h3>
                    <span className="rounded-full bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        {tasks.length}
                    </span>
                </div>
            </div>

            <div ref={setNodeRef} className="flex flex-1 flex-col gap-3 min-h-[150px]">
                <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => onTaskClick(task)}
                            depth={task.depth}
                            hasSubtasks={task.subtasks?.length > 0}
                            isExpanded={expandedParents?.has(task.id)}
                            showSubtasks={showSubtasks}
                            onToggleExpand={onToggleParent ? () => onToggleParent(task.id) : undefined}
                            visibleProperties={visibleProperties}
                        />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}
