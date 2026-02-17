"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { addDays, format, subWeeks } from "date-fns";
import { DateRangePicker } from "@/components/analytics/date-range-picker";
import { OverviewCards } from "@/components/analytics/overview-cards";
import { TaskCompletionChart } from "@/components/analytics/task-completion-chart";
import { StatusDistributionChart } from "@/components/analytics/status-distribution";
import { SprintVelocityChart } from "@/components/analytics/sprint-velocity-chart";
import { TeamProductivity } from "@/components/analytics/team-productivity";
import { ProjectProgressList } from "@/components/analytics/project-progress-list";
import { ExportButton } from "@/components/analytics/export-button";
import {
    useOverviewMetrics,
    useTaskCompletionTrend,
    useStatusDistribution,
    useSprintVelocity,
    useTeamProductivity,
    useProjectProgress
} from "@/hooks/use-analytics";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function AnalyticsPage() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subWeeks(new Date(), 4),
        to: new Date(),
    });

    // Calculate params for hooks
    const hookParams = {
        range: "custom" as const,
        startDate: dateRange?.from,
        endDate: dateRange?.to,
    };

    // Fetch data
    const { data: overview, isLoading: loadingOverview } = useOverviewMetrics(hookParams);
    const { data: taskTrend, isLoading: loadingTrend } = useTaskCompletionTrend(hookParams);
    const { data: statusDist, isLoading: loadingStatus } = useStatusDistribution();
    const { data: sprintVel, isLoading: loadingSprint } = useSprintVelocity();
    const { data: teamProd, isLoading: loadingTeam } = useTeamProductivity(hookParams);
    const { data: projectProg, isLoading: loadingProjects } = useProjectProgress();

    if (loadingOverview || loadingTrend || loadingStatus || loadingSprint || loadingTeam || loadingProjects) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <LoadingSpinner className="h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
                    <p className="text-muted-foreground mt-1">
                        Track key metrics, team performance, and project progress.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <DateRangePicker date={dateRange} setDate={setDateRange} />
                    <ExportButton data={{ overview, taskTrend, statusDist, sprintVel, teamProd, projectProg }} />
                </div>
            </div>

            {/* Overview Cards */}
            {overview && <OverviewCards metrics={overview} />}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Task Completion Trend */}
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow">
                    {taskTrend && <TaskCompletionChart data={taskTrend} />}
                </div>

                {/* Status Distribution */}
                <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow">
                    {statusDist && <StatusDistributionChart data={statusDist} />}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Sprint Velocity */}
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow">
                    {sprintVel && <SprintVelocityChart data={sprintVel} />}
                </div>

                {/* Team Productivity */}
                <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow">
                    {teamProd && <TeamProductivity data={teamProd} />}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow">
                    {projectProg && <ProjectProgressList data={projectProg} />}
                </div>
            </div>
        </div>
    );
}
