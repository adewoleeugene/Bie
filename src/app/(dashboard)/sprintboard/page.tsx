"use client";

import { KanbanBoard } from "@/components/kanban/board";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useSprints } from "@/hooks/use-sprints";
import { Calendar, FolderKanban, Layers3 } from "lucide-react";

export default function SprintBoardPage() {
    const [projectFilter, setProjectFilter] = useState<string | "all" | "general">("all");
    const [sprintFilter, setSprintFilter] = useState<string | "all">("all");
    const [taskFilters, setTaskFilters] = useState<TaskFilters>({
        statuses: [],
        priorities: [],
        assigneeIds: [],
        dateRange: {},
    });

    const projectIdArg =
        projectFilter === "all" ? undefined : projectFilter === "general" ? null : projectFilter;
    const sprintIdArg = sprintFilter === "all" ? undefined : sprintFilter;

    const { data: tasks, isLoading } = useTasks(projectIdArg, { sprintId: sprintIdArg });
    const { data: projects } = useProjects();
    const sprintProjectFilter =
        projectFilter !== "all" && projectFilter !== "general" ? projectFilter : undefined;
    const { data: sprints } = useSprints(sprintProjectFilter);

    const filteredTasks = useMemo(
        () => applyTaskFilters(tasks || [], taskFilters),
        [tasks, taskFilters],
    );

    const summary = useMemo(() => {
        const t = filteredTasks;
        return {
            total: t.length,
            doing: t.filter((x: any) => x.status === "IN_PROGRESS").length,
            review: t.filter((x: any) => x.status === "IN_REVIEW").length,
            done: t.filter((x: any) => x.status === "DONE").length,
        };
    }, [filteredTasks]);

    const activeProject = useMemo(() => {
        if (projectFilter === "all" || projectFilter === "general") return null;
        return (projects as any[] | undefined)?.find((p) => p.id === projectFilter) ?? null;
    }, [projects, projectFilter]);

    const activeSprint = useMemo(() => {
        if (sprintFilter === "all") return null;
        return (sprints as any[] | undefined)?.find((s) => s.id === sprintFilter) ?? null;
    }, [sprints, sprintFilter]);

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="mb-8 space-y-3">
                    <Skeleton className="h-3 w-32 bg-white/[0.05]" />
                    <Skeleton className="h-10 w-64 bg-white/[0.05]" />
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
            {/* ===== Header ===== */}
            <header className="border-b border-[color:var(--border)] px-8 pb-5 pt-7">
                <div className="flex items-end justify-between gap-6">
                    <div>
                        <div className="mono mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                            <Layers3 className="h-3 w-3" />
                            Sprint board
                            {activeProject && (
                                <>
                                    <span className="text-neutral-700">/</span>
                                    <span className="text-neutral-300">{activeProject.name}</span>
                                </>
                            )}
                            {activeSprint && (
                                <>
                                    <span className="text-neutral-700">/</span>
                                    <span style={{ color: "var(--bz-amber)" }}>{activeSprint.name}</span>
                                </>
                            )}
                        </div>
                        <h1 className="text-[36px] font-semibold leading-none tracking-tight text-white">
                            {activeSprint?.name ?? activeProject?.name ?? "All work."}
                        </h1>
                        <div className="mono mt-3 flex items-center gap-5 text-[11px] text-neutral-500">
                            <span>
                                <span className="text-white">{summary.total}</span> tasks
                            </span>
                            <span className="h-3 w-px bg-[color:var(--border)]" />
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: "var(--bz-amber)", boxShadow: "0 0 8px var(--bz-amber)" }}
                                />
                                <span className="text-white">{summary.doing}</span> doing
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: "var(--bz-pink)", boxShadow: "0 0 8px var(--bz-pink)" }}
                                />
                                <span className="text-white">{summary.review}</span> in review
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: "var(--bz-green)", boxShadow: "0 0 8px var(--bz-green)" }}
                                />
                                <span className="text-white">{summary.done}</span> done
                            </span>
                        </div>
                    </div>

                    <TaskForm
                        projectId={
                            projectFilter !== "all" && projectFilter !== "general"
                                ? projectFilter
                                : undefined
                        }
                        sprintId={sprintFilter !== "all" ? sprintFilter : undefined}
                    />
                </div>

                {/* Scope filters row */}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-white/[0.02] pl-3 pr-1 py-1">
                        <FolderKanban className="h-3.5 w-3.5 text-neutral-500" />
                        <span className="mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                            Project
                        </span>
                        <Select
                            value={projectFilter}
                            onValueChange={(val) => setProjectFilter(val as string)}
                        >
                            <SelectTrigger className="h-7 min-w-[180px] border-none bg-transparent text-[12px] focus:ring-0">
                                <SelectValue placeholder="All projects" />
                            </SelectTrigger>
                            <SelectContent className="border-[color:var(--border)] bg-[color:var(--popover)]">
                                <SelectItem value="all">All projects &amp; general</SelectItem>
                                <SelectItem value="general">General (no project)</SelectItem>
                                {projects?.map((project: any) => (
                                    <SelectItem key={project.id} value={project.id}>
                                        {project.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {sprints && sprints.length > 0 && (
                        <div className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-white/[0.02] pl-3 pr-1 py-1">
                            <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                            <span className="mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                                Sprint
                            </span>
                            <Select value={sprintFilter} onValueChange={(val) => setSprintFilter(val)}>
                                <SelectTrigger className="h-7 min-w-[200px] border-none bg-transparent text-[12px] focus:ring-0">
                                    <SelectValue placeholder="All sprints" />
                                </SelectTrigger>
                                <SelectContent className="border-[color:var(--border)] bg-[color:var(--popover)]">
                                    <SelectItem value="all">All sprints</SelectItem>
                                    {sprints.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium">{s.name}</span>
                                                    {s.status === "ACTIVE" && (
                                                        <span
                                                            className="rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-wider"
                                                            style={{
                                                                color: "var(--bz-amber)",
                                                                background:
                                                                    "color-mix(in oklab, var(--bz-amber) 14%, transparent)",
                                                                border:
                                                                    "1px solid color-mix(in oklab, var(--bz-amber) 35%, transparent)",
                                                            }}
                                                        >
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="mono text-[10px] text-neutral-500">
                                                    {!sprintProjectFilter && s.project?.name
                                                        ? `${s.project.name} · `
                                                        : ""}
                                                    {new Date(s.startDate).toLocaleDateString()} —{" "}
                                                    {new Date(s.endDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="ml-auto">
                        <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} />
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={filteredTasks} />
            </div>
        </div>
    );
}
