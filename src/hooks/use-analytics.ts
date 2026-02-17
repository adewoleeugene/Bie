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
