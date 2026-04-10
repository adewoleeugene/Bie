"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskStatus } from "@prisma/client";
import { TaskCard } from "./task-card";
import { TaskWithRelations } from "@/types/task";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

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

const STATUS_ACCENT: Record<string, string> = {
    BACKLOG: "#858585",
    TODO: "var(--bz-blue)",
    IN_PROGRESS: "var(--bz-amber)",
    IN_REVIEW: "var(--bz-pink)",
    DONE: "var(--bz-green)",
    ARCHIVED: "#474747",
};

export function KanbanColumn({
    id,
    title,
    tasks,
    onTaskClick,
    showSubtasks,
    expandedParents,
    onToggleParent,
    visibleProperties,
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${id}` });
    const accent = STATUS_ACCENT[id] ?? "var(--bz-blue)";
    const isEmpty = tasks.length === 0;

    return (
        <div
            className={cn(
                "flex w-[300px] shrink-0 flex-col rounded-2xl border transition-colors",
                "border-[color:var(--border)] bg-white/[0.015]",
                isOver && "border-[color:var(--bz-blue)]/70 bg-white/[0.04]",
            )}
        >
            {/* Column header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-2xl border-b border-[color:var(--border)] bg-[color:var(--card)]/70 px-4 py-3 backdrop-blur">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
                    />
                    <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                        {title}
                    </h3>
                    <span className="mono text-[11px] text-neutral-500">
                        {String(tasks.length).padStart(2, "0")}
                    </span>
                </div>
                <button
                    type="button"
                    className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-white"
                    aria-label={`Add task to ${title}`}
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Accent rail */}
            <div
                aria-hidden
                className="h-[2px] w-full"
                style={{
                    background: `linear-gradient(90deg, ${accent}, transparent)`,
                    opacity: isOver ? 1 : 0.55,
                }}
            />

            <div
                ref={setNodeRef}
                className="flex flex-1 flex-col gap-1 p-2 min-h-[200px]"
            >
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

                {isEmpty && (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] p-6 text-center">
                        <div
                            className="mb-2 h-1 w-8 rounded-full opacity-50"
                            style={{ background: accent }}
                        />
                        <p className="text-[11px] text-neutral-600">Drop tasks here</p>
                    </div>
                )}
            </div>
        </div>
    );
}
