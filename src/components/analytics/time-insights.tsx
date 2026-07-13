"use client";

import { Timer, TrendingUp, BarChart3 } from "lucide-react";
import { useTimeTrackingStats } from "@/hooks/use-time-entries";
import { LogTimeDialog } from "@/components/time-tracking/log-time-dialog";

function formatDuration(minutes: number): string {
    if (!minutes) return "0m";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({
    label,
    value,
    icon: Icon,
    accent,
}: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
}) {
    return (
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${accent}`} />
            </div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
        </div>
    );
}

export function TimeInsights() {
    const { data: stats } = useTimeTrackingStats();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">Time tracked</h3>
                <LogTimeDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    label="Today"
                    value={formatDuration(stats?.todayMinutes ?? 0)}
                    icon={Timer}
                    accent="text-blue-500"
                />
                <StatCard
                    label="This week"
                    value={formatDuration(stats?.weekMinutes ?? 0)}
                    icon={TrendingUp}
                    accent="text-indigo-500"
                />
                <StatCard
                    label="This month"
                    value={formatDuration(stats?.monthMinutes ?? 0)}
                    icon={BarChart3}
                    accent="text-violet-500"
                />
            </div>

            {stats && stats.taskBreakdown.length > 0 && (
                <div className="rounded-xl border bg-card p-5 text-card-foreground shadow">
                    <div className="mb-4 flex items-center gap-2 font-medium">
                        <BarChart3 className="h-5 w-5" />
                        Time by task (this month)
                    </div>
                    <div className="space-y-3">
                        {(() => {
                            const maxMinutes = Math.max(
                                ...stats.taskBreakdown.map((t) => t.totalMinutes),
                            );
                            return stats.taskBreakdown.map((item) => {
                                const percentage = maxMinutes
                                    ? (item.totalMinutes / maxMinutes) * 100
                                    : 0;
                                return (
                                    <div key={item.taskId} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="truncate font-medium">{item.taskTitle}</span>
                                            <span className="font-mono tabular-nums text-muted-foreground">
                                                {formatDuration(item.totalMinutes)}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
