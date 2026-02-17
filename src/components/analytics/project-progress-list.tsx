"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FolderKanban } from "lucide-react";

interface ProjectProgressProps {
    data: Array<{
        projectId: string;
        projectName: string;
        totalTasks: number;
        completedTasks: number;
        progressPercentage: number;
        overdueTasks: number;
    }>;
}

export function ProjectProgressList({ data }: ProjectProgressProps) {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5" />
                    Project Status
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {data.map((project) => (
                        <div key={project.projectId} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium truncate max-w-[180px]">
                                        {project.projectName}
                                    </span>
                                    {project.overdueTasks > 0 && (
                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                            {project.overdueTasks} overdue
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">
                                    {project.progressPercentage}%
                                </span>
                            </div>
                            <Progress value={project.progressPercentage} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                    {project.completedTasks} of {project.totalTasks} tasks
                                </span>
                                {project.progressPercentage === 100 && (
                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Complete
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {data.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No active projects found.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
