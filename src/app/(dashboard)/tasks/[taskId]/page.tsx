"use client";

import { useParams, useRouter } from "next/navigation";
import { useTask, useDeleteTask, useDuplicateTask } from "@/hooks/use-tasks";
import { TaskDetailBody } from "@/components/tasks/task-detail-body";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowLeft, Trash2, Copy } from "lucide-react";
import Link from "next/link";
import type { TaskWithRelations } from "@/types/task";

export default function TaskPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.taskId as string;
    const { data: task, isLoading } = useTask(taskId);
    const deleteTask = useDeleteTask();
    const duplicateTask = useDuplicateTask();

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-3xl px-8 py-10 space-y-6">
                <Skeleton className="h-10 w-2/3 bg-white/[0.05]" />
                <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-7 w-full bg-white/[0.04]" />
                    ))}
                </div>
                <Skeleton className="h-40 w-full bg-white/[0.04]" />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-8 py-24 text-center">
                <p className="text-sm text-muted-foreground">
                    This task doesn&apos;t exist or you don&apos;t have access to it.
                </p>
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                    Go back
                </Button>
            </div>
        );
    }

    const handleDelete = () => {
        deleteTask.mutate(
            { id: task.id },
            {
                onSuccess: () => router.push("/sprintboard"),
            },
        );
    };

    const backHref = task.projectId
        ? `/projects/${task.projectId}/board`
        : task.sprintId
        ? "/sprintboard"
        : "/sprintboard";

    return (
        <div className="flex h-full flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-2">
                <div className="flex items-center gap-2 overflow-hidden text-sm text-neutral-500">
                    <Link
                        href={backHref}
                        className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </Link>
                    {task.parentTask && (
                        <>
                            <span className="text-neutral-300">/</span>
                            <Link
                                href={`/tasks/${task.parentTask.id}`}
                                className="truncate max-w-[180px] rounded px-1.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                {task.parentTask.title}
                            </Link>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-neutral-100"
                        title="Duplicate task"
                        disabled={duplicateTask.isPending}
                        onClick={() =>
                            duplicateTask.mutate(
                                { id: task.id },
                                {
                                    onSuccess: (result) => {
                                        if (result.success && result.data) {
                                            router.push(`/tasks/${result.data.id}`);
                                        }
                                    },
                                },
                            )
                        }
                    >
                        <Copy className="h-4 w-4" />
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
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <TaskDetailBody
                    task={task as unknown as TaskWithRelations}
                    onOpenSubtask={(subtask) => router.push(`/tasks/${subtask.id}`)}
                />
            </div>
        </div>
    );
}
