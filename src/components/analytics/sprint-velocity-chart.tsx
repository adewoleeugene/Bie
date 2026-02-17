"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface SprintVelocityProps {
    data: Array<{
        sprintId: string;
        sprintName: string;
        tasksCompleted: number;
        tasksPlanned: number;
        completionRate: number;
        startDate: Date;
        endDate: Date;
    }>;
}

export function SprintVelocityChart({ data }: SprintVelocityProps) {
    // Format sprint names for display (e.g., "Sprint 1")
    const formattedData = data.map((item) => ({
        ...item,
        formattedName: item.sprintName.replace("Sprint", "S"),
        planned: item.tasksPlanned,
        completed: item.tasksCompleted,
    }));

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Sprint Velocity
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={formattedData}
                            layout="vertical"
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="sprintName"
                                type="category"
                                width={100}
                                tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                            />
                            <Tooltip
                                cursor={{ fill: "hsl(var(--muted))", opacity: 0.1 }}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "0.5rem",
                                }}
                            />
                            <Legend />
                            <Bar
                                dataKey="planned"
                                fill="hsl(var(--primary) / 0.5)"
                                stackId="stack"
                                name="Planned"
                                radius={[0, 4, 4, 0]}
                            />
                            <Bar
                                dataKey="completed"
                                fill="hsl(var(--primary))"
                                stackId="stack"
                                name="Completed"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
