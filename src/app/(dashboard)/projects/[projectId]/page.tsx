"use client";

import { useProject } from "@/hooks/use-projects";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Users, Calendar, ListChecks, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { MilestoneList } from "@/components/milestones/milestone-list";
import { useState } from "react";
import Link from "next/link";
import { TaskStatus, ProjectStatus } from "@prisma/client";

// Status → label + accent color, drawn from the Blitzit token palette.
const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
    BACKLOG: { label: "Backlog", color: "var(--muted-foreground)" },
    TODO: { label: "To Do", color: "var(--bz-peri)" },
    IN_PROGRESS: { label: "In Progress", color: "var(--bz-blue)" },
    IN_REVIEW: { label: "In Review", color: "var(--bz-amber)" },
    DONE: { label: "Done", color: "var(--bz-green)" },
    ARCHIVED: { label: "Archived", color: "var(--muted-foreground)" },
};

const STATUS_ORDER: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "ARCHIVED"];

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
    ACTIVE: "var(--bz-green)",
    PAUSED: "var(--bz-amber)",
    COMPLETED: "var(--bz-blue)",
    ARCHIVED: "var(--muted-foreground)",
};

function StatCard({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <div className="mt-3">{children}</div>
            </CardContent>
        </Card>
    );
}

export default function ProjectDashboardPage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const { data: project, isLoading, error } = useProject(projectId);
    const [showEditDialog, setShowEditDialog] = useState(false);

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid gap-4 md:grid-cols-4">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (error || !project) {
        return <div className="p-6">Project not found</div>;
    }

    const counts = STATUS_ORDER.map((status) => ({
        status,
        count: project.taskStats.find((s: any) => s.status === status)?._count._all || 0,
    }));
    const totalTasks = counts.reduce((acc, c) => acc + c.count, 0);
    const completedTasks = counts.find((c) => c.status === "DONE")?.count || 0;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const activeCounts = counts.filter((c) => c.count > 0);

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <ProjectDialog project={project} open={showEditDialog} onOpenChange={setShowEditDialog} />

            <div className="space-y-6 p-6 max-w-[1400px] w-full mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
                            <Badge
                                variant="outline"
                                className="shrink-0 gap-1.5 border-transparent"
                                style={{
                                    color: PROJECT_STATUS_COLOR[project.status as ProjectStatus],
                                    backgroundColor: `color-mix(in oklab, ${PROJECT_STATUS_COLOR[project.status as ProjectStatus]} 14%, transparent)`,
                                }}
                            >
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: "currentColor" }}
                                />
                                {project.status}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground truncate">
                            {project.description || "No description provided."}
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => setShowEditDialog(true)} className="shrink-0">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </div>

                {/* Key metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Tasks" icon={ListChecks}>
                        <div className="flex items-baseline gap-2">
                            <span className="tabular text-4xl font-bold leading-none">{totalTasks}</span>
                            <span className="text-sm text-muted-foreground">
                                {completedTasks} done
                            </span>
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${progress}%`,
                                    backgroundColor: "var(--bz-green)",
                                }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            <span className="tabular">{Math.round(progress)}%</span> complete
                        </p>
                    </StatCard>

                    <StatCard label="Active Sprint" icon={Calendar}>
                        {project.activeSprint ? (
                            <div className="space-y-1">
                                <div className="text-base font-semibold truncate">{project.activeSprint.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    Ends {new Date(project.activeSprint.endDate).toLocaleDateString()}
                                </div>
                                <Link
                                    href={`/projects/${project.id}/board?sprint=${project.activeSprint.id}`}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                    View board <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">No active sprint</div>
                        )}
                    </StatCard>

                    <StatCard label="Project Lead" icon={User}>
                        {project.lead ? (
                            <div className="flex items-center gap-2.5">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={project.lead.image || undefined} />
                                    <AvatarFallback>
                                        {project.lead.name?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="text-sm font-medium truncate">{project.lead.name}</div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Unassigned</div>
                        )}
                    </StatCard>

                    <StatCard label="Squads" icon={Users}>
                        {project.squads && project.squads.length > 0 ? (
                            <div className="space-y-3">
                                {project.squads.map((squad: any) => (
                                    <div key={squad.id} className="flex items-center justify-between gap-2">
                                        <Link
                                            href={`/squads/${squad.id}`}
                                            className="text-sm font-medium hover:underline truncate"
                                        >
                                            {squad.name}
                                        </Link>
                                        <div className="flex -space-x-2 shrink-0">
                                            {squad.members?.slice(0, 4).map((m: any) => (
                                                <Avatar key={m.user.id} className="h-6 w-6 ring-2 ring-background">
                                                    <AvatarImage src={m.user.image} />
                                                    <AvatarFallback className="text-[10px]">
                                                        {m.user.name?.substring(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Unassigned</div>
                        )}
                    </StatCard>
                </div>

                {/* Distribution + activity */}
                <div className="grid gap-6 lg:grid-cols-5">
                    {/* Task distribution */}
                    <Card className="lg:col-span-3">
                        <CardHeader>
                            <CardTitle className="text-base">Task Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {totalTasks === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <ListChecks className="h-8 w-8 text-muted-foreground/50" />
                                    <p className="mt-3 text-sm text-muted-foreground">No tasks yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {/* Segmented bar */}
                                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                        {activeCounts.map(({ status, count }) => (
                                            <div
                                                key={status}
                                                className="h-full first:rounded-l-full last:rounded-r-full"
                                                style={{
                                                    width: `${(count / totalTasks) * 100}%`,
                                                    backgroundColor: STATUS_META[status].color,
                                                }}
                                                title={`${STATUS_META[status].label}: ${count}`}
                                            />
                                        ))}
                                    </div>

                                    {/* Legend rows */}
                                    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                                        {activeCounts.map(({ status, count }) => (
                                            <div key={status} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: STATUS_META[status].color }}
                                                    />
                                                    <span className="text-sm truncate">{STATUS_META[status].label}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="tabular text-sm font-medium">{count}</span>
                                                    <span className="tabular text-xs text-muted-foreground w-9 text-right">
                                                        {Math.round((count / totalTasks) * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent activity */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {project.recentActivity.map((activity: any) => (
                                    <div key={activity.id} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8 mt-0.5 shrink-0">
                                            <AvatarImage src={activity.user.image} />
                                            <AvatarFallback>{activity.user.name?.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-0.5 min-w-0">
                                            <p className="text-sm leading-snug">
                                                <span className="font-medium">{activity.user.name}</span>{" "}
                                                <span className="text-muted-foreground">
                                                    {activity.action === "STATUS_CHANGE"
                                                        ? "changed status of"
                                                        : activity.action === "ASSIGNED"
                                                            ? "assigned"
                                                            : activity.action === "EDITED" && (activity.metadata as any)?.isCreation
                                                                ? "created"
                                                                : activity.action === "EDITED"
                                                                    ? "edited"
                                                                    : "commented on"}
                                                </span>{" "}
                                                <span className="font-medium">{activity.task.title}</span>
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

                {/* Milestones */}
                <Card>
                    <CardContent>
                        <MilestoneList projectId={projectId} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
