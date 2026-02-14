"use client";

import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useSprints } from "@/hooks/use-sprints";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskForm } from "@/components/tasks/task-form";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

export default function BacklogPage() {
    const params = useParams();
    const projectId = params.projectId as string;

    // Fetch only tasks without a sprint (backlog)
    // We pass sprintId: null to filter for null sprintId explicitly if API supports it.
    // My updated getTasks supports options object with sprintId filter.
    const { data: tasks, isLoading: tasksLoading } = useTasks(projectId, { sprintId: null });
    const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
    const updateTask = useUpdateTask();

    const handleAddToSprint = async (taskId: string, sprintId: string) => {
        try {
            await updateTask.mutateAsync({
                id: taskId,
                sprintId,
                status: "TODO" // Optionally move to TODO when adding to sprint? Or keep current status. Usually keep current or move to TODO.
            });
            toast.success("Task added to sprint");
        } catch (error) {
            console.error(error);
        }
    };

    if (tasksLoading || sprintsLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    const doneTasks = tasks?.filter((t: any) => t.status === "DONE") || [];
    const incompleteTasks = tasks?.filter((t: any) => t.status !== "DONE" && t.status !== "ARCHIVED") || [];

    const activeSprints = sprints?.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PLANNING') || [];

    return (
        <div className="flex bg-neutral-50/50 dark:bg-neutral-900/50 min-h-full flex-col">
            <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Backlog</h1>
                    <p className="text-sm text-muted-foreground">Unassigned tasks ready for sprints.</p>
                </div>
                <TaskForm projectId={projectId} />
            </div>

            <div className="p-6">
                <TaskTable
                    tasks={tasks || []}
                    actionColumn={(task) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Add to Sprint</DropdownMenuLabel>
                                {activeSprints.length === 0 ? (
                                    <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                                        No active sprints
                                    </DropdownMenuItem>
                                ) : (
                                    activeSprints.map((sprint: any) => (
                                        <DropdownMenuItem
                                            key={sprint.id}
                                            onClick={() => handleAddToSprint(task.id, sprint.id)}
                                            className="flex flex-col items-start"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Plus className="h-3 w-3" />
                                                <span>{sprint.name}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground ml-5">
                                                {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                                            </span>
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                />
            </div>
        </div>
    );
}
