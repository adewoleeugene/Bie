"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useEstimateVsActual } from "@/hooks/use-time-entries";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

function formatHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function EstimateVsActual({ projectId }: { projectId?: string }) {
    const { data: items, isLoading } = useEstimateVsActual(projectId);

    if (isLoading || !items || items.length === 0) return null;

    const chartData = items.map((item) => ({
        name: item.taskTitle.length > 25 ? item.taskTitle.slice(0, 25) + "..." : item.taskTitle,
        estimated: parseFloat((item.estimatedHours).toFixed(1)),
        actual: parseFloat((item.actualMinutes / 60).toFixed(1)),
    }));

    const totalEstimated = items.reduce((sum, i) => sum + i.estimatedHours, 0);
    const totalActualHours = items.reduce((sum, i) => sum + i.actualMinutes / 60, 0);
    const variance = totalEstimated > 0
        ? ((totalActualHours - totalEstimated) / totalEstimated) * 100
        : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Estimate vs Actual
                    </span>
                    <div className="flex items-center gap-3 text-sm font-normal">
                        <span className="text-neutral-500">
                            Est: <span className="font-medium text-neutral-900 dark:text-neutral-100">{totalEstimated.toFixed(1)}h</span>
                        </span>
                        <span className="text-neutral-500">
                            Actual: <span className="font-medium text-neutral-900 dark:text-neutral-100">{totalActualHours.toFixed(1)}h</span>
                        </span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "gap-1 text-xs",
                                variance > 10 && "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800",
                                variance < -10 && "text-green-600 border-green-200 dark:text-green-400 dark:border-green-800",
                                Math.abs(variance) <= 10 && "text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800"
                            )}
                        >
                            {variance > 10 ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : variance < -10 ? (
                                <TrendingDown className="h-3 w-3" />
                            ) : (
                                <Minus className="h-3 w-3" />
                            )}
                            {variance > 0 ? "+" : ""}{variance.toFixed(0)}%
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45)}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" tickFormatter={(v) => `${v}h`} />
                        <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                        <Tooltip
                            formatter={(value, name) => [
                                `${value}h`,
                                name === "estimated" ? "Estimated" : "Actual",
                            ]}
                        />
                        <Legend />
                        <Bar dataKey="estimated" fill="#94a3b8" name="Estimated" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="actual" fill="#f97316" name="Actual" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
