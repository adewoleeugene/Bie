"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getDailyReflection,
    getReflectionHistory,
    upsertDailyReflection,
} from "@/actions/reflections";

export function useDailyReflection(date?: string) {
    return useQuery({
        queryKey: ["daily-reflection", date || "today"],
        queryFn: () => getDailyReflection(date),
    });
}

export function useReflectionHistory(limit = 30) {
    return useQuery({
        queryKey: ["reflection-history", limit],
        queryFn: () => getReflectionHistory(limit),
    });
}

export function useUpsertReflection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof upsertDailyReflection>[0]) =>
            upsertDailyReflection(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["daily-reflection"] });
            qc.invalidateQueries({ queryKey: ["reflection-history"] });
        },
    });
}
