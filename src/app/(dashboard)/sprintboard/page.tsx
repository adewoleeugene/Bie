"use client";

import { KanbanBoard } from "@/components/kanban/board";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useSprints } from "@/hooks/use-sprints";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SprintBoardPage() {
    // State for filtering
    const [projectFilter, setProjectFilter] = useState<string | "all" | "general">("all");
    const [sprintFilter, setSprintFilter] = useState<string | "all">("all");
    const [taskFilters, setTaskFilters] = useState<TaskFilters>({
        statuses: [],
        priorities: [],
        assigneeIds: [],
        dateRange: {},
    });

    // Determine what to pass to useTasks
    const projectIdArg = projectFilter === "all" ? undefined : (projectFilter === "general" ? null : projectFilter);
    const sprintIdArg = sprintFilter === "all" ? undefined : sprintFilter;

    const { data: tasks, isLoading } = useTasks(projectIdArg, { sprintId: sprintIdArg });
    const { data: projects } = useProjects();
    const sprintProjectFilter = projectFilter !== "all" && projectFilter !== "general" ? projectFilter : undefined;
    const { data: sprints } = useSprints(sprintProjectFilter);

    // Apply advanced filters client-side
    const filteredTasks = applyTaskFilters(tasks || [], taskFilters);

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
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Sprint Board</h1>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-500">Filter by:</span>
                            <Select
                                value={projectFilter}
                                onValueChange={(val) => setProjectFilter(val as string)}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="All Projects" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Projects & General</SelectItem>
                                    <SelectItem value="general">General Tasks (No Project)</SelectItem>
                                    {projects?.map((project: any) => (
                                        <SelectItem key={project.id} value={project.id}>
                                            {project.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {sprints && sprints.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <Select
                                    value={sprintFilter}
                                    onValueChange={(val) => setSprintFilter(val)}
                                >
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue placeholder="All Sprints" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sprints</SelectItem>
                                        {sprints.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-xs">{s.name}</span>
                                                        {s.status === "ACTIVE" && (
                                                            <Badge variant="default" className="h-3 px-1 text-[8px]">
                                                                Active
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {!sprintProjectFilter && s.project?.name ? `${s.project.name} · ` : ""}
                                                        {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <TaskForm
                        projectId={projectFilter !== "all" && projectFilter !== "general" ? projectFilter : undefined}
                        sprintId={sprintFilter !== "all" ? sprintFilter : undefined}
                    />
                </div>

                {/* Advanced Filters Bar */}
                <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} />
            </div>
            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={filteredTasks} />
            </div>
        </div>
    );
}
