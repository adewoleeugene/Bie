"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface StatusDistributionChartProps {
    data: Array<{ status: string; count: number; percentage: number }>;
}

const COLORS = {
    BACKLOG: "hsl(var(--muted))",
    TODO: "hsl(217, 91%, 60%)", // Blue
    IN_PROGRESS: "hsl(47, 95%, 58%)", // Yellow
    IN_REVIEW: "hsl(270, 95%, 60%)", // Purple
    DONE: "hsl(142, 71%, 45%)", // Green
    ARCHIVED: "hsl(var(--muted-foreground))",
};

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
    // Format label for display
    const formatLabel = (status: string) => {
        return status.replace("_", " ");
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Status Distribution
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="count"
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[entry.status as keyof typeof COLORS] || "hsl(var(--primary))"}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "0.5rem",
                                }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                            />
                            <Legend
                                formatter={(value) => formatLabel(value)}
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
