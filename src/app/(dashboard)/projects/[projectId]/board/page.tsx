"use client";

import { KanbanBoard } from "@/components/kanban/board";
import { TaskForm } from "@/components/tasks/task-form";
import { SmartTaskInput } from "@/components/tasks/smart-task-input";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { useSprints, useSprint, useCompleteSprint } from "@/hooks/use-sprints";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, ExternalLink, Download, ArrowUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { SprintDialog } from "@/components/sprints/sprint-dialog";
import { exportTasksToCSV } from "@/lib/export";
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
    const [showSprintDialog, setShowSprintDialog] = useState(false);
    const [sprintSelectOpen, setSprintSelectOpen] = useState(false);
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
            <div className="p-8">
                <div className="mb-6 space-y-3">
                    <Skeleton className="h-3 w-32 bg-white/[0.05]" />
                    <Skeleton className="h-9 w-64 bg-white/[0.05]" />
                </div>
                <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-[420px] w-[300px] rounded-2xl bg-white/[0.04]" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <header className="border-b border-[color:var(--border)] px-8 pb-3 pt-5">
                <div className="flex items-center justify-between gap-6">
                    <div className="min-w-0">
                        <div className="mono mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                            Board
                            {sprint && (
                                <>
                                    <span className="text-neutral-700">/</span>
                                    <span style={{ color: "var(--bz-amber)" }}>{sprint.name}</span>
                                </>
                            )}
                        </div>
                        <h1 className="truncate text-[26px] font-semibold leading-none tracking-tight text-white">
                            {sprint?.name ?? "All tasks."}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-white/[0.02] pl-3 pr-1 py-1">
                            <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                            <span className="mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                                Sprint
                            </span>
                            <Select value={sprintId || "all"} onValueChange={handleSprintChange} open={sprintSelectOpen} onOpenChange={setSprintSelectOpen}>
                                <SelectTrigger className="h-7 min-w-[180px] border-none bg-transparent text-[12px] focus:ring-0">
                                    <SelectValue placeholder="Select sprint" />
                                </SelectTrigger>
                                <SelectContent className="border-[color:var(--border)] bg-[color:var(--popover)]">
                                    <SelectItem value="all">All tasks</SelectItem>
                                    {recentSprints.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium">{s.name}</span>
                                                    {s.status === "ACTIVE" && (
                                                        <span
                                                            className="rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-wider"
                                                            style={{
                                                                color: "var(--bz-amber)",
                                                                background: "color-mix(in oklab, var(--bz-amber) 14%, transparent)",
                                                                border: "1px solid color-mix(in oklab, var(--bz-amber) 35%, transparent)",
                                                            }}
                                                        >
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="mono text-[10px] text-neutral-500">
                                                    {new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    <div className="mt-1 space-y-0.5 border-t border-[color:var(--border)] px-2 py-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSprintSelectOpen(false);
                                                setShowSprintDialog(true);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-xs font-medium text-neutral-300 transition-colors hover:text-white"
                                        >
                                            <Plus className="h-3 w-3" />
                                            New sprint
                                        </button>
                                        {sortedSprints.length > 3 && (
                                            <Link
                                                href={`/projects/${projectId}/sprints`}
                                                className="flex items-center gap-2 px-1 py-1 text-xs text-neutral-500 transition-colors hover:text-white"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                View all sprints
                                            </Link>
                                        )}
                                    </div>
                                </SelectContent>
                            </Select>
                        </div>

                        {sprintId && sprint?.status !== "COMPLETED" && (
                            <button
                                type="button"
                                onClick={() => setShowCompleteDialog(true)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
                                style={{ color: "var(--bz-green)" }}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Complete sprint
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => exportTasksToCSV(applyTaskFilters(tasks || [], taskFilters))}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-[12px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </button>

                        <TaskForm projectId={projectId} sprintId={sprintId || undefined} />
                    </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <SmartTaskInput projectId={projectId} sprintId={sprintId || undefined} />
                    </div>
                    <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} />
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={applyTaskFilters(tasks || [], taskFilters)} />
            </div>

            {/* Create Sprint Dialog */}
            <SprintDialog
                projectId={projectId}
                open={showSprintDialog}
                onOpenChange={setShowSprintDialog}
                defaultStatus="ACTIVE"
            />

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
                            className="bg-[color:var(--bz-green)] text-black hover:bg-[color:var(--bz-green)]/85"
                        >
                            Complete Sprint
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
