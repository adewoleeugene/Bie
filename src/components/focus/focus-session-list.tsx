"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useFocusSessions, useFocusStats, useDeleteFocusSession } from "@/hooks/use-focus-sessions";

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

export function FocusSessionList() {
    const { data: sessions, isLoading } = useFocusSessions({ limit: 50 });
    const { data: stats } = useFocusStats();
    const deleteSession = useDeleteFocusSession();

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
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Zap className="h-8 w-8 text-orange-500" />
                    Focus Sessions
                </h1>
                <p className="text-neutral-500 mt-1">
                    Track your deep work and stay productive with pomodoro sessions.
                </p>
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

            {/* Session History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Session History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!sessions || sessions.length === 0 ? (
                        <div className="text-center py-12">
                            <Coffee className="h-12 w-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" />
                            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                No focus sessions yet
                            </h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                Start a pomodoro or free focus session from the timer in the top bar.
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
            </Card>
        </div>
    );
}
