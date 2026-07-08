"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskStatus } from "@prisma/client";
import { TaskCard } from "./task-card";
import { TaskWithRelations } from "@/types/task";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface KanbanColumnProps {
    id: string;
    title: string;
    status?: TaskStatus | null;
    accent?: string | null;
    tasks: (TaskWithRelations & { depth: number })[];
    onTaskClick: (task: TaskWithRelations) => void;
    onDelete?: () => void;
    canDelete?: boolean;
    isDeleting?: boolean;
    projectId?: string;
    sprintId?: string;
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
    status,
    accent: accentProp,
    tasks,
    onTaskClick,
    onDelete,
    canDelete,
    isDeleting,
    projectId,
    sprintId,
    showSubtasks,
    expandedParents,
    onToggleParent,
    visibleProperties,
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${id}` });
    const accent = accentProp || (status ? STATUS_ACCENT[status] : undefined) || "var(--bz-blue)";
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
                <div className="flex shrink-0 items-center gap-1">
                    {canDelete && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-red-400"
                                    aria-label={`Delete ${title} column`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete column?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This removes the “{title}” column. Empty custom columns can be deleted; move any tasks out first.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={onDelete}
                                        disabled={isDeleting}
                                        className="bg-red-600 text-white hover:bg-red-700"
                                    >
                                        {isDeleting ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <TaskForm
                        projectId={projectId}
                        sprintId={sprintId}
                        defaultStatus={status || "TODO"}
                        defaultStatusColumnId={id}
                        trigger={
                            <button
                                type="button"
                                className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-white"
                                aria-label={`Add task to ${title}`}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        }
                    />
                </div>
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
                    <div className="flex flex-1 flex-col items-start gap-1 p-1">
                        <span
                            className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                                color: accent,
                                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                            }}
                        >
                            {title}
                        </span>
                        <TaskForm
                            projectId={projectId}
                            sprintId={sprintId}
                            defaultStatus={status || "TODO"}
                            defaultStatusColumnId={id}
                            trigger={
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors hover:bg-white/[0.04]"
                                    style={{ color: accent }}
                                >
                                    <Plus className="h-4 w-4" />
                                    New task
                                </button>
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
