"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getUserOrganization() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) throw new Error("No organization");
    return { userId: user.id, organizationId: user.memberships[0].organizationId };
}

// ─── Assistant Message Persistence ───────────────────────

export async function saveAssistantMessage(role: string, content: string, metadata?: any) {
    try {
        const { userId } = await getUserOrganization();
        await db.assistantMessage.create({
            data: { role, content, metadata, userId },
        });
        return { success: true };
    } catch (error) {
        console.error("Save assistant message error:", error);
        return { success: false };
    }
}

export async function getAssistantHistory(limit = 50) {
    try {
        const { userId } = await getUserOrganization();
        return await db.assistantMessage.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    } catch {
        return [];
    }
}

// ─── Bottleneck Detection ────────────────────────────────

export interface BottleneckInsight {
    type: "bottleneck" | "overload" | "stale" | "blocked";
    title: string;
    description: string;
    severity: "low" | "medium" | "high";
    linkUrl?: string;
}

export async function getBottleneckInsights(): Promise<BottleneckInsight[]> {
    try {
        const { organizationId } = await getUserOrganization();
        const insights: BottleneckInsight[] = [];

        const now = new Date();

        // 1. Tasks stuck IN_REVIEW for > 3 days
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const staleReviews = await db.task.count({
            where: {
                organizationId,
                status: "IN_REVIEW",
                updatedAt: { lt: threeDaysAgo },
            },
        });
        if (staleReviews > 0) {
            insights.push({
                type: "bottleneck",
                title: `${staleReviews} task${staleReviews > 1 ? "s" : ""} stuck in review`,
                description: `${staleReviews} task${staleReviews > 1 ? "s have" : " has"} been in review for over 3 days. Consider prioritizing reviews.`,
                severity: staleReviews >= 5 ? "high" : "medium",
            });
        }

        // 2. Tasks with no assignee that are overdue
        const unassignedOverdue = await db.task.count({
            where: {
                organizationId,
                status: { notIn: ["DONE", "ARCHIVED"] },
                dueDate: { lt: now },
                assignees: { none: {} },
            },
        });
        if (unassignedOverdue > 0) {
            insights.push({
                type: "blocked",
                title: `${unassignedOverdue} overdue task${unassignedOverdue > 1 ? "s" : ""} unassigned`,
                description: "These tasks are past due with no one assigned. They need an owner.",
                severity: "high",
            });
        }

        // 3. Team member overload (> 10 active tasks)
        const memberLoads = await db.taskAssignee.groupBy({
            by: ["userId"],
            where: {
                task: {
                    organizationId,
                    status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
                },
            },
            _count: { userId: true },
        });

        for (const load of memberLoads) {
            if (load._count.userId > 10) {
                const user = await db.user.findUnique({
                    where: { id: load.userId },
                    select: { name: true },
                });
                insights.push({
                    type: "overload",
                    title: `${user?.name || "A team member"} has ${load._count.userId} active tasks`,
                    description: "This person may be overloaded. Consider redistributing work.",
                    severity: load._count.userId > 15 ? "high" : "medium",
                });
            }
        }

        // 4. Stale tasks (IN_PROGRESS but not updated in 7+ days)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const staleTasks = await db.task.count({
            where: {
                organizationId,
                status: "IN_PROGRESS",
                updatedAt: { lt: sevenDaysAgo },
            },
        });
        if (staleTasks > 0) {
            insights.push({
                type: "stale",
                title: `${staleTasks} in-progress task${staleTasks > 1 ? "s" : ""} stale for 7+ days`,
                description: "These tasks haven't been updated recently. They may be blocked or abandoned.",
                severity: staleTasks >= 5 ? "high" : "low",
            });
        }

        return insights;
    } catch (error) {
        console.error("Get bottleneck insights error:", error);
        return [];
    }
}

// ─── Task Estimation ─────────────────────────────────────

export async function getTaskEstimation(taskTitle: string, projectId?: string) {
    try {
        const { organizationId } = await getUserOrganization();

        // Find similar completed tasks to estimate duration
        const similarTasks = await db.task.findMany({
            where: {
                organizationId,
                status: "DONE",
                ...(projectId ? { projectId } : {}),
            },
            select: {
                title: true,
                estimatedHours: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
        });

        // Calculate average completion time for tasks that have time data
        const tasksWithTime = similarTasks.filter(
            (t) => t.estimatedHours && t.estimatedHours > 0
        );

        if (tasksWithTime.length === 0) {
            return { estimatedHours: null, basedOn: 0, confidence: "low" as const };
        }

        const avgHours =
            tasksWithTime.reduce((sum, t) => sum + (t.estimatedHours || 0), 0) /
            tasksWithTime.length;

        // Calculate actual completion time
        const completionTimes = similarTasks
            .map((t) => {
                const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
                return hours;
            })
            .filter((h) => h > 0 && h < 500); // filter outliers

        const avgCompletionHours =
            completionTimes.length > 0
                ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
                : null;

        return {
            estimatedHours: Math.round(avgHours * 10) / 10,
            avgCompletionHours: avgCompletionHours ? Math.round(avgCompletionHours * 10) / 10 : null,
            basedOn: tasksWithTime.length,
            confidence: tasksWithTime.length >= 10 ? "high" as const : tasksWithTime.length >= 3 ? "medium" as const : "low" as const,
        };
    } catch (error) {
        console.error("Get task estimation error:", error);
        return { estimatedHours: null, basedOn: 0, confidence: "low" as const };
    }
}

// ─── Resource Allocation Insights ────────────────────────

export interface ResourceInsight {
    userId: string;
    userName: string;
    activeTaskCount: number;
    overdueCount: number;
    estimatedHoursRemaining: number;
    status: "available" | "busy" | "overloaded";
}

export async function getResourceAllocation(): Promise<ResourceInsight[]> {
    try {
        const { organizationId } = await getUserOrganization();
        const now = new Date();

        const members = await db.organizationMember.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: { id: true, name: true },
                    include: {
                        taskAssignees: {
                            where: {
                                task: {
                                    organizationId,
                                    status: { notIn: ["DONE", "ARCHIVED"] },
                                },
                            },
                            include: {
                                task: {
                                    select: {
                                        estimatedHours: true,
                                        dueDate: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        return members.map((m) => {
            const tasks = m.user.taskAssignees;
            const activeCount = tasks.length;
            const overdueCount = tasks.filter(
                (t) => t.task.dueDate && new Date(t.task.dueDate) < now
            ).length;
            const hoursRemaining = tasks.reduce(
                (sum, t) => sum + (t.task.estimatedHours || 0),
                0
            );

            let status: ResourceInsight["status"] = "available";
            if (activeCount > 10) status = "overloaded";
            else if (activeCount > 5) status = "busy";

            return {
                userId: m.user.id,
                userName: m.user.name || "Unknown",
                activeTaskCount: activeCount,
                overdueCount,
                estimatedHoursRemaining: Math.round(hoursRemaining * 10) / 10,
                status,
            };
        });
    } catch (error) {
        console.error("Get resource allocation error:", error);
        return [];
    }
}
