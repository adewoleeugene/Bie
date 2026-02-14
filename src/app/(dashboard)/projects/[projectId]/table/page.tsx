"use client";

import { TaskTable } from "@/components/tasks/task-table";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { useTasks } from "@/hooks/use-tasks";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function TablePage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const { data: tasks, isLoading } = useTasks(projectId);
    const [taskFilters, setTaskFilters] = useState<TaskFilters>({
        statuses: [],
        priorities: [],
        assigneeIds: [],
        dateRange: {},
    });

    const filteredTasks = applyTaskFilters(tasks || [], taskFilters);

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Table View</h1>
                <TaskForm projectId={projectId} />
            </div>
            <div className="mb-4">
                <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} />
            </div>
            <TaskTable tasks={filteredTasks} />
        </div>
    );
}
