"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TaskCompletionChartProps {
    data: Array<{ date: string; completed: number; created: number }>;
}

export function TaskCompletionChart({ data }: TaskCompletionChartProps) {
    // Format dates for display
    const formattedData = data.map((item) => ({
        ...item,
        date: new Date(item.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        }),
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Task Completion Trend
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={formattedData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                        <XAxis
                            dataKey="date"
                            className="text-xs"
                            tick={{ fill: "currentColor" }}
                        />
                        <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "0.5rem",
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="completed"
                            stroke="hsl(142, 76%, 36%)"
                            strokeWidth={2}
                            name="Completed"
                            dot={{ fill: "hsl(142, 76%, 36%)", r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="created"
                            stroke="hsl(221, 83%, 53%)"
                            strokeWidth={2}
                            name="Created"
                            dot={{ fill: "hsl(221, 83%, 53%)", r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
