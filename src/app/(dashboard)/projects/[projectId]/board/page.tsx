"use client";

import { KanbanBoard } from "@/components/kanban/board";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { useSprints, useSprint, useCompleteSprint } from "@/hooks/use-sprints";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function BoardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = params.projectId as string;
    const sprintId = searchParams.get("sprint");

    const { data: tasks, isLoading: tasksLoading } = useTasks(projectId, { sprintId: sprintId || undefined });
    const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
    const { data: sprint, isLoading: sprintLoading } = useSprint(sprintId || "");
    const completeSprint = useCompleteSprint();

    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [taskFilters, setTaskFilters] = useState<TaskFilters>({
        statuses: [],
        priorities: [],
        assigneeIds: [],
        dateRange: {},
    });

    const isLoading = tasksLoading || sprintsLoading || (!!sprintId && sprintLoading);

    const handleSprintChange = (newSprintId: string) => {
        if (newSprintId === "all") {
            router.push(`/projects/${projectId}/board`);
        } else {
            router.push(`/projects/${projectId}/board?sprint=${newSprintId}`);
        }
    };

    const handleCompleteSprint = async () => {
        if (!sprintId) return;
        await completeSprint.mutateAsync({ id: sprintId });
        setShowCompleteDialog(false);
        // Optionally redirect to sprints list or clear filter
        router.push(`/projects/${projectId}/sprints`);
    };

    const doneTasks = tasks?.filter((t: any) => t.status === "DONE") || [];
    const incompleteTasks = tasks?.filter((t: any) => t.status !== "DONE" && t.status !== "ARCHIVED") || [];
    // Sort sprints: most recent first (by startDate), take top 3
    const sortedSprints = [...(sprints || [])].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const recentSprints = sortedSprints.slice(0, 3);

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-96 w-80" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b bg-white p-6 dark:bg-neutral-950">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Board View</h1>

                        {/* Sprint Selector */}
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Select
                                value={sprintId || "all"}
                                onValueChange={handleSprintChange}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select Sprint" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tasks</SelectItem>
                                    {recentSprints.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{s.name}</span>
                                                    {s.status === "ACTIVE" && (
                                                        <Badge variant="default" className="h-4 px-1 text-[10px]">
                                                            Active
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {sortedSprints.length > 3 && (
                                        <div className="border-t px-2 py-1.5">
                                            <Link
                                                href={`/projects/${projectId}/sprints`}
                                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                View all sprints
                                            </Link>
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Complete Sprint Button */}
                        {sprintId && sprint?.status !== "COMPLETED" && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCompleteDialog(true)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Complete Sprint
                            </Button>
                        )}
                    </div>
                    <TaskForm projectId={projectId} sprintId={sprintId || undefined} />
                </div>
                <div className="px-6 pb-3">
                    <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={applyTaskFilters(tasks || [], taskFilters)} />
            </div>

            {/* Complete Sprint Dialog */}
            <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Complete Sprint: {sprint?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the sprint as completed and archive {doneTasks.length} task(s) in the DONE column.
                            {incompleteTasks.length > 0 && ` ${incompleteTasks.length} incomplete task(s) will remain in their current state.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCompleteSprint}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Complete Sprint
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
