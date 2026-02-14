"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
    Sun,
    Calendar,
    GripVertical,
    Plus,
    CheckCircle2,
    Circle,
    AlertTriangle,
    Clock,
    Flame,
    Target,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useFocusStats } from "@/hooks/use-focus-sessions";
import { useTimeTrackingStats } from "@/hooks/use-time-entries";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: typeof ArrowUp }> = {
    P0: { label: "Critical", color: "text-red-500", icon: ArrowUp },
    P1: { label: "High", color: "text-orange-500", icon: ArrowUp },
    P2: { label: "Medium", color: "text-yellow-500", icon: ArrowDown },
    P3: { label: "Low", color: "text-green-500", icon: ArrowDown },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    BACKLOG: { label: "Backlog", color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
    TODO: { label: "To Do", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    IN_PROGRESS: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    IN_REVIEW: { label: "Review", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    DONE: { label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface TaskWithRelations {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string | Date | null;
    estimatedHours?: number | null;
    project?: { id: string; name: string } | null;
    assignees?: { user: { id: string; name: string; image?: string | null } }[];
}

export function MyDayView() {
    const { data: allTasks, isLoading } = useTasks();
    const { data: focusStats } = useFocusStats();
    const { data: timeStats } = useTimeTrackingStats();
    const updateTask = useUpdateTask();

    const [showCompleted, setShowCompleted] = useState(false);

    // Today's date
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    // Get tasks for "My Day" — tasks that are assigned to user and either:
    // - Due today or overdue
    // - IN_PROGRESS or TODO
    // - Started today
    const myDayTasks = useMemo(() => {
        if (!allTasks) return [];

        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        return (allTasks as TaskWithRelations[])
            .filter((task) => {
                // Exclude archived
                if (task.status === "ARCHIVED") return false;
                // Exclude done unless showing completed
                if (task.status === "DONE" && !showCompleted) return false;

                // Include if due today or overdue
                if (task.dueDate) {
                    const due = new Date(task.dueDate);
                    if (due < todayEnd) return true;
                }

                // Include if in progress or todo
                if (task.status === "IN_PROGRESS" || task.status === "TODO") return true;

                return false;
            })
            .sort((a, b) => {
                // Sort: overdue first, then by priority, then by status
                const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
                const statusOrder: Record<string, number> = {
                    IN_PROGRESS: 0,
                    TODO: 1,
                    IN_REVIEW: 2,
                    BACKLOG: 3,
                    DONE: 4,
                };

                // Overdue first
                const aDue = a.dueDate ? new Date(a.dueDate) : null;
                const bDue = b.dueDate ? new Date(b.dueDate) : null;
                const aOverdue = aDue && aDue < todayStart;
                const bOverdue = bDue && bDue < todayStart;
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;

                // Then by priority
                const aPrio = priorityOrder[a.priority] ?? 2;
                const bPrio = priorityOrder[b.priority] ?? 2;
                if (aPrio !== bPrio) return aPrio - bPrio;

                // Then by status
                const aStatus = statusOrder[a.status] ?? 3;
                const bStatus = statusOrder[b.status] ?? 3;
                return aStatus - bStatus;
            });
    }, [allTasks, showCompleted, today]);

    const overdueTasks = myDayTasks.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    });

    const handleToggleDone = async (task: TaskWithRelations) => {
        const newStatus = task.status === "DONE" ? "TODO" : "DONE";
        await updateTask.mutateAsync({
            id: task.id,
            status: newStatus,
        });
    };

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Sun className="h-8 w-8 text-amber-500" />
                        My Day
                    </h1>
                    <p className="text-neutral-500 mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {todayStr}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCompleted(!showCompleted)}
                    >
                        {showCompleted ? "Hide Completed" : "Show Completed"}
                    </Button>
                </div>
            </div>

            {/* Daily Stats Summary */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-amber-200 dark:border-amber-900/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-neutral-950">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Tasks Today</p>
                                <p className="text-2xl font-bold mt-1">{myDayTasks.filter(t => t.status !== "DONE").length}</p>
                            </div>
                            <Target className="h-8 w-8 text-amber-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 dark:border-green-900/30 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-neutral-950">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-green-600 dark:text-green-400">Completed</p>
                                <p className="text-2xl font-bold mt-1">
                                    {allTasks?.filter((t) => t.status === "DONE").length || 0}
                                </p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-200 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-neutral-950">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Focus Time</p>
                                <p className="text-2xl font-bold mt-1">
                                    {focusStats ? formatDuration(focusStats.todayMinutes) : "0m"}
                                </p>
                            </div>
                            <Flame className="h-8 w-8 text-orange-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-blue-200 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-neutral-950">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Time Tracked</p>
                                <p className="text-2xl font-bold mt-1">
                                    {timeStats ? formatDuration(timeStats.todayMinutes) : "0m"}
                                </p>
                            </div>
                            <Clock className="h-8 w-8 text-blue-400 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Overdue Alert */}
            {overdueTasks.length > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-4">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">
                            {overdueTasks.length} overdue {overdueTasks.length === 1 ? "task" : "tasks"}
                        </span>
                    </div>
                </div>
            )}

            {/* Task List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Today&apos;s Tasks
                        </span>
                        <Badge variant="secondary">
                            {myDayTasks.length} {myDayTasks.length === 1 ? "task" : "tasks"}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {myDayTasks.length === 0 ? (
                        <div className="text-center py-12">
                            <Sun className="h-12 w-12 mx-auto text-amber-300 dark:text-amber-700 mb-4" />
                            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                No tasks for today
                            </h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                Set tasks to &quot;Todo&quot; or &quot;In Progress&quot; to see them here, or add due dates.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {myDayTasks.map((task) => {
                                const isDone = task.status === "DONE";
                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                const prioConfig = PRIORITY_CONFIG[task.priority];
                                const statusConfig = STATUS_CONFIG[task.status];

                                return (
                                    <div
                                        key={task.id}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-lg border p-3 transition-all",
                                            "hover:bg-neutral-50 dark:hover:bg-neutral-900/50",
                                            isDone && "opacity-60",
                                            isOverdue && !isDone && "border-red-200 dark:border-red-800"
                                        )}
                                    >
                                        <div className="opacity-0 group-hover:opacity-50 cursor-grab">
                                            <GripVertical className="h-4 w-4" />
                                        </div>

                                        <Checkbox
                                            checked={isDone}
                                            onCheckedChange={() => handleToggleDone(task)}
                                            className="h-5 w-5"
                                        />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "font-medium text-sm",
                                                    isDone && "line-through text-neutral-400"
                                                )}>
                                                    {task.title}
                                                </span>
                                                {isOverdue && !isDone && (
                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                        Overdue
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {task.project && (
                                                    <span className="text-xs text-neutral-400">
                                                        {task.project.name}
                                                    </span>
                                                )}
                                                {task.dueDate && (
                                                    <span className={cn(
                                                        "text-xs",
                                                        isOverdue ? "text-red-500" : "text-neutral-400"
                                                    )}>
                                                        Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {prioConfig && (
                                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-0.5", prioConfig.color)}>
                                                    {task.priority}
                                                </Badge>
                                            )}
                                            {statusConfig && (
                                                <Badge className={cn("text-[10px] px-1.5 py-0", statusConfig.color)}>
                                                    {statusConfig.label}
                                                </Badge>
                                            )}
                                            {task.estimatedHours && (
                                                <span className="text-xs text-neutral-400 flex items-center gap-0.5">
                                                    <Clock className="h-3 w-3" />
                                                    {task.estimatedHours}h
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
