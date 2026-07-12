"use client";

import { useState } from "react";
import {
    TrendingUp,
    Clock,
    Flame,
    Target,
    Timer,
    Calendar,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusStats, useFocusSessions } from "@/hooks/use-focus-sessions";

function formatDuration(minutes: number): string {
    if (!minutes) return "0m";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(d: string | Date): string {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(d: string | Date): string {
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    accent,
}: {
    label: string;
    value: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
}) {
    return (
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <Icon className={cn("h-4 w-4", accent)} />
            </div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
    );
}

export function FocusInsights() {
    const { data: stats } = useFocusStats();
    const { data: sessions } = useFocusSessions({ limit: 30 });
    const [showHistory, setShowHistory] = useState(false);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Focus</h3>

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    label="This week"
                    value={formatDuration(stats?.weekMinutes ?? 0)}
                    sub={`${stats?.weekSessions ?? 0} sessions`}
                    icon={TrendingUp}
                    accent="text-blue-500"
                />
                <StatCard
                    label="All time"
                    value={formatDuration(stats?.totalMinutes ?? 0)}
                    sub={`${stats?.totalSessions ?? 0} sessions`}
                    icon={Clock}
                    accent="text-green-500"
                />
                <StatCard
                    label="Streak"
                    value={`${stats?.streak ?? 0} ${stats?.streak === 1 ? "day" : "days"}`}
                    sub="Consecutive focus days"
                    icon={Flame}
                    accent="text-orange-500"
                />
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <button
                    type="button"
                    onClick={() => setShowHistory((s) => !s)}
                    className="flex w-full items-center justify-between p-4 text-left"
                >
                    <span className="flex items-center gap-2 font-medium">
                        <Calendar className="h-5 w-5" />
                        Session history
                        {sessions && sessions.length > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {sessions.length}
                            </span>
                        )}
                    </span>
                    {showHistory ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                </button>

                {showHistory && (
                    <div className="border-t p-4">
                        {!sessions || sessions.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                No focus sessions yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sessions.map((session) => {
                                    const task = (session as unknown as { task?: { title: string } }).task;
                                    return (
                                        <div
                                            key={session.id}
                                            className="flex items-center justify-between rounded-lg border p-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={cn(
                                                        "flex h-9 w-9 items-center justify-center rounded-full",
                                                        session.type === "POMODORO"
                                                            ? "bg-orange-100 text-orange-500 dark:bg-orange-900/30"
                                                            : "bg-blue-100 text-blue-500 dark:bg-blue-900/30",
                                                    )}
                                                >
                                                    {session.type === "POMODORO" ? (
                                                        <Target className="h-4 w-4" />
                                                    ) : (
                                                        <Timer className="h-4 w-4" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        {session.type === "POMODORO" ? "Pomodoro" : "Free focus"}
                                                        {task && (
                                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                                {task.title}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                        {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="font-mono text-sm font-medium tabular-nums">
                                                {session.duration ? formatDuration(session.duration) : "—"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
