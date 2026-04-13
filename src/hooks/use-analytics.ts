"use client";

import { useQuery } from "@tanstack/react-query";
import {
    getOverviewMetrics,
    getTaskCompletionTrend,
    getStatusDistribution,
    getPriorityBreakdown,
    getTeamProductivity,
    getSprintVelocity,
    getProjectProgress,
    getSprintBurndown,
    getSprintHealth,
    getPeakProductivityHours,
    getCompletionForecast,
    type DateRange,
} from "@/actions/analytics";

interface DateRangeParams {
    range: DateRange;
    startDate?: Date;
    endDate?: Date;
}

export function useOverviewMetrics(params: DateRangeParams = { range: "month" }) {
    return useQuery({
        queryKey: ["analytics", "overview", params],
        queryFn: async () => {
            const result = await getOverviewMetrics(params);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useTaskCompletionTrend(params: DateRangeParams = { range: "month" }) {
    return useQuery({
        queryKey: ["analytics", "task-completion-trend", params],
        queryFn: async () => {
            const result = await getTaskCompletionTrend(params);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useStatusDistribution() {
    return useQuery({
        queryKey: ["analytics", "status-distribution"],
        queryFn: async () => {
            const result = await getStatusDistribution();
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function usePriorityBreakdown() {
    return useQuery({
        queryKey: ["analytics", "priority-breakdown"],
        queryFn: async () => {
            const result = await getPriorityBreakdown();
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useTeamProductivity(params: DateRangeParams = { range: "month" }) {
    return useQuery({
        queryKey: ["analytics", "team-productivity", params],
        queryFn: async () => {
            const result = await getTeamProductivity(params);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useSprintVelocity() {
    return useQuery({
        queryKey: ["analytics", "sprint-velocity"],
        queryFn: async () => {
            const result = await getSprintVelocity();
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useProjectProgress() {
    return useQuery({
        queryKey: ["analytics", "project-progress"],
        queryFn: async () => {
            const result = await getProjectProgress();
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useSprintBurndown(sprintId: string) {
    return useQuery({
        queryKey: ["analytics", "sprint-burndown", sprintId],
        queryFn: async () => {
            const result = await getSprintBurndown(sprintId);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
        enabled: !!sprintId,
    });
}

export function useSprintHealthData(sprintId: string) {
    return useQuery({
        queryKey: ["analytics", "sprint-health", sprintId],
        queryFn: async () => {
            const result = await getSprintHealth(sprintId);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
        enabled: !!sprintId,
    });
}

export function usePeakProductivityHours(params: DateRangeParams = { range: "month" }) {
    return useQuery({
        queryKey: ["analytics", "peak-hours", params],
        queryFn: async () => {
            const result = await getPeakProductivityHours(params);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useCompletionForecast(projectId: string) {
    return useQuery({
        queryKey: ["analytics", "forecast", projectId],
        queryFn: async () => {
            const result = await getCompletionForecast(projectId);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
        enabled: !!projectId,
    });
}
