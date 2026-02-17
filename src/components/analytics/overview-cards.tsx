"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    CheckCircle2,
    ListTodo,
    TrendingUp,
    Users,
    AlertCircle,
    Clock,
    Target,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: "blue" | "green" | "orange" | "purple" | "red" | "indigo" | "yellow";
}

const colorClasses = {
    blue: "border-blue-200 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-neutral-950",
    green: "border-green-200 dark:border-green-900/30 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-neutral-950",
    orange: "border-orange-200 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-neutral-950",
    purple: "border-purple-200 dark:border-purple-900/30 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-neutral-950",
    red: "border-red-200 dark:border-red-900/30 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-neutral-950",
    indigo: "border-indigo-200 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-neutral-950",
    yellow: "border-yellow-200 dark:border-yellow-900/30 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-neutral-950",
};

const iconColorClasses = {
    blue: "text-blue-500",
    green: "text-green-500",
    orange: "text-orange-500",
    purple: "text-purple-500",
    red: "text-red-500",
    indigo: "text-indigo-500",
    yellow: "text-yellow-500",
};

const titleColorClasses = {
    blue: "text-blue-700 dark:text-blue-400",
    green: "text-green-700 dark:text-green-400",
    orange: "text-orange-700 dark:text-orange-400",
    purple: "text-purple-700 dark:text-purple-400",
    red: "text-red-700 dark:text-red-400",
    indigo: "text-indigo-700 dark:text-indigo-400",
    yellow: "text-yellow-700 dark:text-yellow-400",
};

function MetricCard({ title, value, subtitle, icon, trend, color = "blue" }: MetricCardProps) {
    return (
        <Card className={cn(colorClasses[color])}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={cn("text-sm font-medium", titleColorClasses[color])}>
                    {title}
                </CardTitle>
                <div className={iconColorClasses[color]}>{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {subtitle && (
                    <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>
                )}
                {trend && (
                    <div className="flex items-center gap-1 mt-2">
                        <TrendingUp
                            className={cn(
                                "h-3 w-3",
                                trend.isPositive ? "text-green-500" : "text-red-500 rotate-180"
                            )}
                        />
                        <span
                            className={cn(
                                "text-xs font-medium",
                                trend.isPositive ? "text-green-600" : "text-red-600"
                            )}
                        >
                            {trend.isPositive ? "+" : ""}{trend.value}%
                        </span>
                        <span className="text-xs text-neutral-500">vs last period</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface OverviewCardsProps {
    metrics: {
        totalTasks: number;
        completedTasks: number;
        completionRate: number;
        activeSprints: number;
        teamMembers: number;
        overdueTasks: number;
        avgCompletionTime: number;
        tasksCreatedThisPeriod: number;
    };
}

export function OverviewCards({ metrics }: OverviewCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
                title="Total Tasks"
                value={metrics.totalTasks}
                subtitle={`${metrics.tasksCreatedThisPeriod} created this period`}
                icon={<ListTodo className="h-4 w-4" />}
                color="blue"
            />

            <MetricCard
                title="Completion Rate"
                value={`${metrics.completionRate}%`}
                subtitle={`${metrics.completedTasks} tasks completed`}
                icon={<CheckCircle2 className="h-4 w-4" />}
                color="green"
            />

            <MetricCard
                title="Active Sprints"
                value={metrics.activeSprints}
                subtitle="Currently in progress"
                icon={<Zap className="h-4 w-4" />}
                color="purple"
            />

            <MetricCard
                title="Team Members"
                value={metrics.teamMembers}
                subtitle="Active contributors"
                icon={<Users className="h-4 w-4" />}
                color="indigo"
            />

            <MetricCard
                title="Overdue Tasks"
                value={metrics.overdueTasks}
                subtitle="Require attention"
                icon={<AlertCircle className="h-4 w-4" />}
                color={metrics.overdueTasks > 0 ? "red" : "green"}
            />

            <MetricCard
                title="Avg Completion Time"
                value={`${metrics.avgCompletionTime}h`}
                subtitle="From creation to done"
                icon={<Clock className="h-4 w-4" />}
                color="orange"
            />

            <MetricCard
                title="Tasks This Period"
                value={metrics.tasksCreatedThisPeriod}
                subtitle="New tasks created"
                icon={<Target className="h-4 w-4" />}
                color="yellow"
            />

            <MetricCard
                title="Productivity Score"
                value={Math.round(metrics.completionRate)}
                subtitle="Based on completion rate"
                icon={<TrendingUp className="h-4 w-4" />}
                color={metrics.completionRate >= 70 ? "green" : metrics.completionRate >= 50 ? "yellow" : "red"}
            />
        </div>
    );
}
