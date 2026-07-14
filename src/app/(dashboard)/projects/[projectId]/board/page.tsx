"use client";

import { KanbanBoard } from "@/components/kanban/board";
import { TaskForm } from "@/components/tasks/task-form";
import { SmartTaskInput } from "@/components/tasks/smart-task-input";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { useSprints, useSprint, useCompleteSprint } from "@/hooks/use-sprints";
import { useSquads } from "@/hooks/use-squads";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle2, ExternalLink, Download, Plus } from "lucide-react";
import Link from "next/link";
import { SprintDialog } from "@/components/sprints/sprint-dialog";
import { AddTasksDialog } from "@/components/sprints/add-tasks-dialog";
import { exportTasksToCSV } from "@/lib/export";
import { cn } from "@/lib/utils";
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
import { useEffect, useState } from "react";

type CarryOver = "next" | "backlog" | "leave";

export default function BoardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = params.projectId as string;
    const sprintId = searchParams.get("sprint");

    const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks(projectId, { sprintId: sprintId || undefined });
    const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
    const { data: sprint, isLoading: sprintLoading } = useSprint(sprintId || "");
    const { data: squads } = useSquads();
    const completeSprint = useCompleteSprint();

    // Map each squad to its members' userIds so the squad filter can match tasks
    // by assignee (tasks have no direct squad relation).
    const squadMembers = (squads || []).reduce<Record<string, string[]>>((acc, squad: any) => {
        acc[squad.id] = (squad.members || []).map((m: any) => m.userId || m.user?.id).filter(Boolean);
        return acc;
    }, {});

    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [showSprintDialog, setShowSprintDialog] = useState(false);
    const [showAddTasks, setShowAddTasks] = useState(false);
    const [sprintSelectOpen, setSprintSelectOpen] = useState(false);
    const [carryOver, setCarryOver] = useState<CarryOver>("next");
    const [taskFilters, setTaskFilters] = useState<TaskFilters>({
        statuses: [],
        priorities: [],
        assigneeIds: [],
        squadIds: [],
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

    const doneTasks = tasks?.filter((t: any) => t.status === "DONE") || [];
    const incompleteTasks = tasks?.filter((t: any) => t.status !== "DONE" && t.status !== "ARCHIVED") || [];

    // Where incomplete tasks roll over to: prefer another active sprint, else the
    // earliest planned one. Used to label the "next sprint" option.
    const rolloverTarget = [...(sprints || [])]
        .filter((s) => s.id !== sprintId && (s.status === "ACTIVE" || s.status === "PLANNING"))
        .sort((a, b) =>
            a.status === b.status
                ? new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
                : a.status === "ACTIVE" ? -1 : 1
        )[0];

    // When opening the complete dialog, default to rolling into the next sprint if
    // one exists, otherwise send unfinished work to the backlog.
    useEffect(() => {
        if (showCompleteDialog) {
            setCarryOver(rolloverTarget ? "next" : "backlog");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCompleteDialog]);

    const handleCompleteSprint = async () => {
        if (!sprintId) return;
        await completeSprint.mutateAsync({
            id: sprintId,
            carryOver: incompleteTasks.length > 0 ? carryOver : "leave",
        });
        setShowCompleteDialog(false);
        // Optionally redirect to sprints list or clear filter
        router.push(`/projects/${projectId}/sprints`);
    };
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

    // A failed fetch must not look like an empty board — surface it and offer
    // a retry (the query also keeps retrying in the background).
    if (tasksError && !tasks) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <div>
                    <p className="text-sm font-medium text-white">Couldn&apos;t load the board.</p>
                    <p className="mt-1 text-xs text-neutral-500">
                        The server is busy right now — your tasks are safe. Retrying automatically.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refetchTasks()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--bz-blue)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--bz-blue)]/90"
                >
                    Retry now
                </button>
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
                                onClick={() => setShowAddTasks(true)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-[12px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add tasks
                            </button>
                        )}

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
                            onClick={() => exportTasksToCSV(applyTaskFilters(tasks || [], taskFilters, squadMembers))}
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
                    <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} showSquadFilter />
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                {sprintId && (tasks?.length ?? 0) === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <div>
                            <p className="text-sm font-medium text-white">This sprint has no tasks yet.</p>
                            <p className="mt-1 text-xs text-neutral-500">
                                Pull existing tasks in to start planning the sprint.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddTasks(true)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--bz-blue)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--bz-blue)]/90"
                        >
                            <Plus className="h-4 w-4" />
                            Add tasks to sprint
                        </button>
                    </div>
                ) : (
                    <KanbanBoard
                        tasks={applyTaskFilters(tasks || [], taskFilters, squadMembers)}
                        projectId={projectId}
                        sprintId={sprintId || undefined}
                    />
                )}
            </div>

            {/* Create Sprint Dialog */}
            <SprintDialog
                projectId={projectId}
                open={showSprintDialog}
                onOpenChange={setShowSprintDialog}
                defaultStatus="ACTIVE"
            />

            {/* Add Tasks to Sprint Dialog */}
            {sprintId && (
                <AddTasksDialog
                    projectId={projectId}
                    sprintId={sprintId}
                    sprintName={sprint?.name}
                    open={showAddTasks}
                    onOpenChange={setShowAddTasks}
                />
            )}

            {/* Complete Sprint Dialog */}
            <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Complete Sprint: {sprint?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This marks the sprint as completed and archives {doneTasks.length} finished task(s) from the DONE column.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {incompleteTasks.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                What should happen to the {incompleteTasks.length} unfinished task(s)?
                            </p>
                            <div className="space-y-1.5">
                                {[
                                    ...(rolloverTarget
                                        ? [{
                                            value: "next" as CarryOver,
                                            label: `Move to ${rolloverTarget.name}`,
                                            hint: "Roll unfinished work into the next sprint",
                                        }]
                                        : []),
                                    {
                                        value: "backlog" as CarryOver,
                                        label: "Send to Backlog",
                                        hint: "Unassign them from any sprint",
                                    },
                                    {
                                        value: "leave" as CarryOver,
                                        label: "Leave in this sprint",
                                        hint: "Keep them attached to the completed sprint",
                                    },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setCarryOver(opt.value)}
                                        className={cn(
                                            "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                                            carryOver === opt.value
                                                ? "border-[color:var(--bz-blue)] bg-[color:var(--bz-blue)]/10"
                                                : "border-[color:var(--border)] hover:bg-white/[0.03]"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                                carryOver === opt.value ? "border-[color:var(--bz-blue)]" : "border-neutral-500"
                                            )}
                                        >
                                            {carryOver === opt.value && (
                                                <span className="h-2 w-2 rounded-full bg-[color:var(--bz-blue)]" />
                                            )}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">{opt.label}</span>
                                            <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

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
