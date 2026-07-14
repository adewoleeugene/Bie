"use client";

import { useState } from "react";
import { useDeleteTask } from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
import { Trash2, Maximize2 } from "lucide-react";
import { TaskWithRelations } from "@/types/task";
import { TaskDetailBody } from "@/components/tasks/task-detail-body";
import { useRouter } from "next/navigation";

interface TaskDetailSheetProps {
    task: TaskWithRelations | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailSheetProps) {
    const router = useRouter();
    const deleteTask = useDeleteTask();
    const [selectedSubtask, setSelectedSubtask] = useState<TaskWithRelations | null>(null);

    if (!task) return null;

    const handleDelete = () => {
        deleteTask.mutate(
            { id: task.id },
            {
                onSuccess: () => onOpenChange(false),
            },
        );
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="sm:max-w-[720px] w-full p-0 flex flex-col gap-0 border-l border-neutral-200 dark:border-neutral-800">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 bg-white dark:bg-neutral-950">
                        <div className="flex items-center gap-2 text-sm text-neutral-500 overflow-hidden">
                            {task.parentTask && (
                                <>
                                    <span className="truncate max-w-[150px]">{task.parentTask.title}</span>
                                    <span className="text-neutral-300">/</span>
                                </>
                            )}
                            <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {task.title}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1.5 text-neutral-500"
                                onClick={() => router.push(`/tasks/${task.id}`)}
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                                Open as page
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-neutral-400 hover:text-red-500"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action is permanent and will remove all associated content and subtasks.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <TaskDetailBody task={task} onOpenSubtask={setSelectedSubtask} />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Nested Subtask Detail Sheet — resolve the live copy off the
                (live) parent so edits inside it show while it stays open. */}
            {selectedSubtask && (
                <TaskDetailSheet
                    task={{ ...selectedSubtask, ...(task?.subtasks?.find((s) => s.id === selectedSubtask.id) ?? {}) } as TaskWithRelations}
                    open={!!selectedSubtask}
                    onOpenChange={(o) => !o && setSelectedSubtask(null)}
                />
            )}
        </>
    );
}
