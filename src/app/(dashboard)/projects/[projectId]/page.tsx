"use client";

import { useProject } from "@/hooks/use-projects";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Settings, User, Users, Calendar, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { useState } from "react";
import Link from "next/link";
import { TaskStatus } from "@prisma/client";

export default function ProjectDashboardPage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const { data: project, isLoading, error } = useProject(projectId);
    const [showEditDialog, setShowEditDialog] = useState(false);

    if (isLoading) {
        return <div className="p-6 space-y-6">
            <Skeleton className="h-12 w-1/3" />
            <div className="grid gap-4 md:grid-cols-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64" />
        </div>;
    }

    if (error || !project) {
        return <div className="p-6">Project not found</div>;
    }

    // Calculate progress
    const totalTasks = project.taskStats.reduce((acc: number, curr: any) => acc + curr._count._all, 0);
    const completedTasks = project.taskStats.find((s: any) => s.status === 'DONE')?._count._all || 0;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return (
        <div className="flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-900/50 overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-6 border-b bg-background">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                        <Badge variant="outline">{project.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{project.description || "No description provided."}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setShowEditDialog(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </div>
            </div>

            <ProjectDialog
                project={project}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
            />

            <div className="p-6 space-y-6">
                {/* Key Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalTasks}</div>
                            <Progress value={progress} className="mt-2 h-2" />
                            <p className="text-xs text-muted-foreground mt-2">
                                {Math.round(progress)}% Completed
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Sprint</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {project.activeSprint ? (
                                <div className="space-y-1">
                                    <div className="text-lg font-semibold truncate">{project.activeSprint.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Ends {new Date(project.activeSprint.endDate).toLocaleDateString()}
                                    </div>
                                    <Link
                                        href={`/projects/${project.id}/board?sprint=${project.activeSprint.id}`}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        View Board →
                                    </Link>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No active sprint</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Project Lead</CardTitle>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {project.lead ? (
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={project.lead.image || undefined} />
                                        <AvatarFallback>{project.lead.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-sm font-medium">{project.lead.name}</div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">Unassigned</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Squad</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {project.squad ? (
                                <div className="space-y-2">
                                    <Link href={`/squads/${project.squad.id}`} className="text-sm font-medium hover:underline block">
                                        {project.squad.name}
                                    </Link>
                                    <div className="flex -space-x-2">
                                        {project.squad.members?.slice(0, 4).map((m: any) => (
                                            <Avatar key={m.user.id} className="h-6 w-6 ring-2 ring-background">
                                                <AvatarImage src={m.user.image} />
                                                <AvatarFallback className="text-[10px]">{m.user.name?.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">Unassigned</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Task Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Task Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {Object.values(TaskStatus).map((status) => {
                                    const count = project.taskStats.find((s: any) => s.status === status)?._count._all || 0;
                                    if (count === 0) return null;
                                    return (
                                        <div key={status} className="flex items-center justify-between">
                                            <div className="text-sm font-medium">{status.replace('_', ' ')}</div>
                                            <div className="text-sm text-muted-foreground">{count}</div>
                                        </div>
                                    )
                                })}
                                {totalTasks === 0 && <div className="text-sm text-muted-foreground">No tasks yet.</div>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {project.recentActivity.map((activity: any) => (
                                    <div key={activity.id} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8 mt-0.5">
                                            <AvatarImage src={activity.user.image} />
                                            <AvatarFallback>{activity.user.name?.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                {activity.user.name} <span className="text-muted-foreground font-normal">
                                                    {activity.action === "STATUS_CHANGE" ? "changed status of" :
                                                        activity.action === "ASSIGNED" ? "assigned" :
                                                            (activity.action === "EDITED" && (activity.metadata as any)?.isCreation) ? "created" :
                                                                activity.action === "EDITED" ? "edited" : "commented on"}
                                                </span> {activity.task.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {project.recentActivity.length === 0 && (
                                    <div className="text-sm text-muted-foreground">No recent activity.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
