"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Timer,
    Flame,
    Target,
    Clock,
    Trash2,
    Calendar,
    Zap,
    TrendingUp,
    Coffee,
    Play,
    Search,
    ChevronDown,
    ChevronUp,
    FolderOpen,
    AlertCircle,
} from "lucide-react";
import { useFocusSessions, useFocusStats, useDeleteFocusSession } from "@/hooks/use-focus-sessions";
import { useTasks } from "@/hooks/use-tasks";
import { PomodoroTimer } from "./pomodoro-timer";

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

const priorityColors: Record<string, string> = {
    P0: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    P1: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900",
    P2: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900",
    P3: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
};

const statusColors: Record<string, string> = {
    TODO: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    REVIEW: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    DONE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    BACKLOG: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

export function FocusSessionList() {
    const { data: sessions, isLoading: sessionsLoading } = useFocusSessions({ limit: 50 });
    const { data: stats } = useFocusStats();
    const { data: allTasks, isLoading: tasksLoading } = useTasks();
    const deleteSession = useDeleteFocusSession();

    const [searchQuery, setSearchQuery] = useState("");
    const [filterProject, setFilterProject] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("active");
    const [showHistory, setShowHistory] = useState(false);
    const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
    const [focusMode, setFocusMode] = useState<"pomodoro" | "free">("pomodoro");

    const isLoading = sessionsLoading || tasksLoading;

    // Get unique projects from tasks
    const projects = allTasks
        ? Array.from(
            new Map(
                allTasks
                    .filter((t: any) => t.project)
                    .map((t: any) => [t.project.id, { id: t.project.id, name: t.project.name }])
            ).values()
        )
        : [];

    // Filter tasks — show non-done tasks by default
    const filteredTasks = (allTasks || []).filter((task: any) => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesTitle = task.title.toLowerCase().includes(query);
            const matchesProject = task.project?.name?.toLowerCase().includes(query);
            if (!matchesTitle && !matchesProject) return false;
        }

        // Project filter
        if (filterProject !== "all") {
            if (filterProject === "unassigned") {
                if (task.projectId) return false;
            } else {
                if (task.projectId !== filterProject) return false;
            }
        }

        // Status filter
        if (filterStatus === "active") {
            return task.status !== "DONE";
        } else if (filterStatus === "done") {
            return task.status === "DONE";
        }

        return true;
    });

    // Group tasks by project
    const tasksByProject = filteredTasks.reduce((acc: Record<string, any[]>, task: any) => {
        const projectName = task.project?.name || "Personal / Unassigned";
        if (!acc[projectName]) acc[projectName] = [];
        acc[projectName].push(task);
        return acc;
    }, {});

    // Sort tasks within each project by priority
    Object.keys(tasksByProject).forEach((project) => {
        tasksByProject[project].sort((a: any, b: any) => {
            const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
            return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        });
    });

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
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
                        <Zap className="h-8 w-8 text-orange-500" />
                        Focus
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Pick a task and start a focus session. Track your deep work across all projects.
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-orange-200 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">
                                Today
                            </CardTitle>
                            <Flame className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatDuration(stats.todayMinutes)}</div>
                            <p className="text-xs text-neutral-500 mt-1">
                                {stats.todaySessions} {stats.todaySessions === 1 ? "session" : "sessions"} • {stats.todayPomodoros} 🍅
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                This Week
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatDuration(stats.weekMinutes)}</div>
                            <p className="text-xs text-neutral-500 mt-1">
                                {stats.weekSessions} sessions
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-green-200 dark:border-green-900/30 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                                All Time
                            </CardTitle>
                            <Clock className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatDuration(stats.totalMinutes)}</div>
                            <p className="text-xs text-neutral-500 mt-1">
                                {stats.totalSessions} sessions
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-200 dark:border-purple-900/30 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">
                                Streak
                            </CardTitle>
                            <Target className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.streak} {stats.streak === 1 ? "day" : "days"}</div>
                            <p className="text-xs text-neutral-500 mt-1">
                                Consecutive focus days
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Task List — Start Focus */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-orange-500" />
                            Start Focus on a Task
                        </CardTitle>
                        <div className="text-sm text-neutral-500">
                            {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mt-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Search tasks..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                        >
                            <option value="all">All Projects</option>
                            <option value="unassigned">Personal / Unassigned</option>
                            {projects.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <select
                            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="active">Active Tasks</option>
                            <option value="done">Completed</option>
                            <option value="all">All Tasks</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredTasks.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="h-12 w-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" />
                            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                No tasks found
                            </h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                {searchQuery
                                    ? "Try a different search term."
                                    : "Create tasks in your projects to start focusing."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(tasksByProject).map(([projectName, tasks]) => (
                                <div key={projectName}>
                                    {/* Project Group Header */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <FolderOpen className="h-4 w-4 text-neutral-400" />
                                        <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                                            {projectName}
                                        </span>
                                        <span className="text-xs text-neutral-400">
                                            {(tasks as any[]).length}
                                        </span>
                                    </div>

                                    {/* Tasks in this project */}
                                    <div className="space-y-2">
                                        {(tasks as any[]).map((task: any) => {
                                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";

                                            return (
                                                <div
                                                    key={task.id}
                                                    className={cn(
                                                        "flex items-center justify-between rounded-xl border p-4 group",
                                                        "hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-all",
                                                        "hover:shadow-sm",
                                                        isOverdue && "border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium truncate">
                                                                {task.title}
                                                            </span>
                                                            {isOverdue && (
                                                                <Badge variant="destructive" className="text-xs">
                                                                    Overdue
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn("text-xs", priorityColors[task.priority])}
                                                            >
                                                                {task.priority}
                                                            </Badge>
                                                            <Badge
                                                                variant="secondary"
                                                                className={cn("text-xs", statusColors[task.status])}
                                                            >
                                                                {task.status === "TODO" ? "To Do" :
                                                                    task.status === "IN_PROGRESS" ? "In Progress" :
                                                                        task.status === "REVIEW" ? "Review" :
                                                                            task.status === "DONE" ? "Done" :
                                                                                task.status}
                                                            </Badge>
                                                            {task.dueDate && (
                                                                <span className={cn(
                                                                    "text-xs",
                                                                    isOverdue ? "text-red-500 font-medium" : "text-neutral-400"
                                                                )}>
                                                                    Due {formatDate(task.dueDate)}
                                                                </span>
                                                            )}
                                                            {task.timeEstimate && (
                                                                <span className="text-xs text-neutral-400 flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {task.timeEstimate}h est.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Focus Buttons */}
                                                    <div className="flex items-center gap-2 ml-4 shrink-0">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30"
                                                            onClick={() => {
                                                                setFocusTaskId(task.id);
                                                                setFocusMode("free");
                                                            }}
                                                        >
                                                            <Timer className="h-3.5 w-3.5" />
                                                            Free
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                                                            onClick={() => {
                                                                setFocusTaskId(task.id);
                                                                setFocusMode("pomodoro");
                                                            }}
                                                        >
                                                            <Play className="h-3.5 w-3.5" />
                                                            Focus
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Session History (Collapsible) */}
            <Card>
                <CardHeader>
                    <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Session History
                            {sessions && sessions.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {sessions.length}
                                </Badge>
                            )}
                        </CardTitle>
                        {showHistory ? (
                            <ChevronUp className="h-5 w-5 text-neutral-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-neutral-400" />
                        )}
                    </button>
                </CardHeader>
                {showHistory && (
                    <CardContent>
                        {!sessions || sessions.length === 0 ? (
                            <div className="text-center py-12">
                                <Coffee className="h-12 w-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" />
                                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                    No focus sessions yet
                                </h3>
                                <p className="text-sm text-neutral-500 mt-1">
                                    Click &quot;Focus&quot; on any task above to start your first session.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((session) => {
                                    const task = (session as unknown as { task?: { id: string; title: string; status: string; priority: string } }).task;
                                    return (
                                        <div
                                            key={session.id}
                                            className={cn(
                                                "flex items-center justify-between rounded-xl border p-4",
                                                "hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors",
                                                !session.endedAt && "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className={cn(
                                                        "flex h-10 w-10 items-center justify-center rounded-full",
                                                        session.type === "POMODORO"
                                                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-500"
                                                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-500"
                                                    )}
                                                >
                                                    {session.type === "POMODORO" ? (
                                                        <Target className="h-5 w-5" />
                                                    ) : (
                                                        <Timer className="h-5 w-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {session.type === "POMODORO" ? "Pomodoro" : "Free Focus"}
                                                        </span>
                                                        {!session.endedAt && (
                                                            <Badge variant="default" className="bg-orange-500 text-xs">
                                                                Active
                                                            </Badge>
                                                        )}
                                                        {session.completed && (
                                                            <Badge variant="secondary" className="text-xs gap-1">
                                                                <Flame className="h-3 w-3" />
                                                                Completed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-xs text-neutral-500">
                                                            {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
                                                        </span>
                                                        {task && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {task.title}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {session.notes && (
                                                        <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                                                            {session.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="font-mono font-medium tabular-nums">
                                                        {session.duration ? formatDuration(session.duration) : "—"}
                                                    </div>
                                                    {session.type === "POMODORO" && session.pomodoroCount > 0 && (
                                                        <div className="text-xs text-orange-500 mt-0.5">
                                                            {session.pomodoroCount} 🍅
                                                        </div>
                                                    )}
                                                </div>
                                                {session.endedAt && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-neutral-400 hover:text-red-500"
                                                        onClick={() => deleteSession.mutate(session.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Inline Pomodoro Timer — opens when a task is selected */}
            {focusTaskId && (
                <PomodoroTimer
                    preSelectedTaskId={focusTaskId}
                    preSelectedMode={focusMode}
                    isOpen={true}
                    onClose={() => setFocusTaskId(null)}
                />
            )}
        </div>
    );
}
