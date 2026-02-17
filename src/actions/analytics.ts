"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionResult } from "@/types";
import { startOfDay, endOfDay, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export type DateRange = "today" | "week" | "month" | "quarter" | "year" | "custom";

interface DateRangeParams {
    range: DateRange;
    startDate?: Date;
    endDate?: Date;
}

function getDateRange(params: DateRangeParams): { start: Date; end: Date } {
    const now = new Date();

    switch (params.range) {
        case "today":
            return { start: startOfDay(now), end: endOfDay(now) };
        case "week":
            return { start: startOfWeek(now), end: endOfWeek(now) };
        case "month":
            return { start: startOfMonth(now), end: endOfMonth(now) };
        case "quarter":
            return { start: subMonths(now, 3), end: now };
        case "year":
            return { start: subMonths(now, 12), end: now };
        case "custom":
            return {
                start: params.startDate || subMonths(now, 1),
                end: params.endDate || now,
            };
        default:
            return { start: startOfMonth(now), end: endOfMonth(now) };
    }
}

export async function getOverviewMetrics(
    params: DateRangeParams = { range: "month" }
): Promise<ActionResult<{
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    activeSprints: number;
    teamMembers: number;
    overdueTasks: number;
    avgCompletionTime: number; // in hours
    tasksCreatedThisPeriod: number;
}>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;
        const { start, end } = getDateRange(params);

        // Total tasks in organization
        const totalTasks = await db.task.count({
            where: { organizationId: orgId },
        });

        // Tasks created in this period
        const tasksCreatedThisPeriod = await db.task.count({
            where: {
                organizationId: orgId,
                createdAt: { gte: start, lte: end },
            },
        });

        // Completed tasks (all time)
        const completedTasks = await db.task.count({
            where: {
                organizationId: orgId,
                status: "DONE",
            },
        });

        // Completion rate
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Active sprints
        const activeSprints = await db.sprint.count({
            where: {
                organizationId: orgId,
                status: "ACTIVE",
            },
        });

        // Team members
        const teamMembers = await db.organizationMember.count({
            where: { organizationId: orgId },
        });

        // Overdue tasks
        const overdueTasks = await db.task.count({
            where: {
                organizationId: orgId,
                status: { notIn: ["DONE", "ARCHIVED"] },
                dueDate: { lt: new Date() },
            },
        });

        // Average completion time (tasks completed in this period)
        const completedTasksInPeriod = await db.task.findMany({
            where: {
                organizationId: orgId,
                status: "DONE",
                updatedAt: { gte: start, lte: end },
            },
            select: {
                createdAt: true,
                updatedAt: true,
            },
        });

        const avgCompletionTime = completedTasksInPeriod.length > 0
            ? completedTasksInPeriod.reduce((acc, task) => {
                const diff = task.updatedAt.getTime() - task.createdAt.getTime();
                return acc + diff / (1000 * 60 * 60); // Convert to hours
            }, 0) / completedTasksInPeriod.length
            : 0;

        return {
            success: true,
            data: {
                totalTasks,
                completedTasks,
                completionRate: Math.round(completionRate * 10) / 10,
                activeSprints,
                teamMembers,
                overdueTasks,
                avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
                tasksCreatedThisPeriod,
            },
        };
    } catch (error) {
        console.error("Error fetching overview metrics:", error);
        return { success: false, error: "Failed to fetch overview metrics" };
    }
}

export async function getTaskCompletionTrend(
    params: DateRangeParams = { range: "month" }
): Promise<ActionResult<Array<{ date: string; completed: number; created: number }>>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;
        const { start, end } = getDateRange(params);

        // Get all tasks created or completed in the date range
        const tasks = await db.task.findMany({
            where: {
                organizationId: orgId,
                OR: [
                    { createdAt: { gte: start, lte: end } },
                    {
                        status: "DONE",
                        updatedAt: { gte: start, lte: end },
                    },
                ],
            },
            select: {
                createdAt: true,
                updatedAt: true,
                status: true,
            },
        });

        // Group by date
        const dateMap = new Map<string, { completed: number; created: number }>();

        tasks.forEach((task) => {
            // Count created
            const createdDate = task.createdAt.toISOString().split("T")[0];
            if (task.createdAt >= start && task.createdAt <= end) {
                const existing = dateMap.get(createdDate) || { completed: 0, created: 0 };
                dateMap.set(createdDate, { ...existing, created: existing.created + 1 });
            }

            // Count completed
            if (task.status === "DONE" && task.updatedAt >= start && task.updatedAt <= end) {
                const completedDate = task.updatedAt.toISOString().split("T")[0];
                const existing = dateMap.get(completedDate) || { completed: 0, created: 0 };
                dateMap.set(completedDate, { ...existing, completed: existing.completed + 1 });
            }
        });

        // Convert to array and sort
        const trend = Array.from(dateMap.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { success: true, data: trend };
    } catch (error) {
        console.error("Error fetching task completion trend:", error);
        return { success: false, error: "Failed to fetch task completion trend" };
    }
}

export async function getStatusDistribution(): Promise<ActionResult<Array<{ status: string; count: number; percentage: number }>>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;

        const tasks = await db.task.groupBy({
            by: ["status"],
            where: { organizationId: orgId },
            _count: { status: true },
        });

        const total = tasks.reduce((sum, item) => sum + item._count.status, 0);

        const distribution = tasks.map((item) => ({
            status: item.status,
            count: item._count.status,
            percentage: total > 0 ? Math.round((item._count.status / total) * 100 * 10) / 10 : 0,
        }));

        return { success: true, data: distribution };
    } catch (error) {
        console.error("Error fetching status distribution:", error);
        return { success: false, error: "Failed to fetch status distribution" };
    }
}

export async function getPriorityBreakdown(): Promise<ActionResult<Array<{ priority: string; count: number; percentage: number }>>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;

        const tasks = await db.task.groupBy({
            by: ["priority"],
            where: { organizationId: orgId },
            _count: { priority: true },
        });

        const total = tasks.reduce((sum, item) => sum + item._count.priority, 0);

        const breakdown = tasks.map((item) => ({
            priority: item.priority,
            count: item._count.priority,
            percentage: total > 0 ? Math.round((item._count.priority / total) * 100 * 10) / 10 : 0,
        }));

        return { success: true, data: breakdown };
    } catch (error) {
        console.error("Error fetching priority breakdown:", error);
        return { success: false, error: "Failed to fetch priority breakdown" };
    }
}

export async function getTeamProductivity(
    params: DateRangeParams = { range: "month" }
): Promise<ActionResult<Array<{
    userId: string;
    userName: string;
    userImage: string | null;
    tasksCompleted: number;
    tasksAssigned: number;
    focusTime: number; // in minutes
    loggedTime: number; // in minutes
}>>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;
        const { start, end } = getDateRange(params);

        // Get all team members
        const members = await db.organizationMember.findMany({
            where: { organizationId: orgId },
            include: { user: true },
        });

        const productivity = await Promise.all(
            members.map(async (member) => {
                // Tasks completed
                const tasksCompleted = await db.task.count({
                    where: {
                        organizationId: orgId,
                        status: "DONE",
                        updatedAt: { gte: start, lte: end },
                        assignees: {
                            some: { userId: member.userId },
                        },
                    },
                });

                // Tasks currently assigned
                const tasksAssigned = await db.taskAssignee.count({
                    where: {
                        userId: member.userId,
                        task: {
                            organizationId: orgId,
                            status: { notIn: ["DONE", "ARCHIVED"] },
                        },
                    },
                });

                // Focus time
                const focusSessions = await db.focusSession.aggregate({
                    where: {
                        userId: member.userId,
                        startedAt: { gte: start, lte: end },
                        completed: true,
                    },
                    _sum: { duration: true },
                });

                // Logged time
                const timeEntries = await db.timeEntry.aggregate({
                    where: {
                        userId: member.userId,
                        startedAt: { gte: start, lte: end },
                    },
                    _sum: { duration: true },
                });

                return {
                    userId: member.userId,
                    userName: member.user.name,
                    userImage: member.user.image,
                    tasksCompleted,
                    tasksAssigned,
                    focusTime: focusSessions._sum.duration || 0,
                    loggedTime: timeEntries._sum.duration || 0,
                };
            })
        );

        return { success: true, data: productivity };
    } catch (error) {
        console.error("Error fetching team productivity:", error);
        return { success: false, error: "Failed to fetch team productivity" };
    }
}

export async function getSprintVelocity(): Promise<ActionResult<Array<{
    sprintId: string;
    sprintName: string;
    tasksCompleted: number;
    tasksPlanned: number;
    completionRate: number;
    startDate: Date;
    endDate: Date;
}>>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;

        // Get last 6 sprints
        const sprints = await db.sprint.findMany({
            where: { organizationId: orgId },
            orderBy: { startDate: "desc" },
            take: 6,
            include: {
                tasks: {
                    select: {
                        status: true,
                    },
                },
            },
        });

        const velocity = sprints.map((sprint) => {
            const tasksPlanned = sprint.tasks.length;
            const tasksCompleted = sprint.tasks.filter((t) => t.status === "DONE").length;
            const completionRate = tasksPlanned > 0 ? (tasksCompleted / tasksPlanned) * 100 : 0;

            return {
                sprintId: sprint.id,
                sprintName: sprint.name,
                tasksCompleted,
                tasksPlanned,
                completionRate: Math.round(completionRate * 10) / 10,
                startDate: sprint.startDate,
                endDate: sprint.endDate,
            };
        }).reverse(); // Oldest to newest for chart

        return { success: true, data: velocity };
    } catch (error) {
        console.error("Error fetching sprint velocity:", error);
        return { success: false, error: "Failed to fetch sprint velocity" };
    }
}

export async function getProjectProgress(): Promise<ActionResult<Array<{
    projectId: string;
    projectName: string;
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
    overdueTasks: number;
}>>> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const orgId = user.memberships[0].organizationId;

        const projects = await db.project.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["ACTIVE", "PAUSED"] },
            },
            include: {
                tasks: {
                    select: {
                        status: true,
                        dueDate: true,
                    },
                },
            },
        });

        const progress = projects.map((project) => {
            const totalTasks = project.tasks.length;
            const completedTasks = project.tasks.filter((t) => t.status === "DONE").length;
            const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            const overdueTasks = project.tasks.filter(
                (t) => t.status !== "DONE" && t.dueDate && t.dueDate < new Date()
            ).length;

            return {
                projectId: project.id,
                projectName: project.name,
                totalTasks,
                completedTasks,
                progressPercentage: Math.round(progressPercentage * 10) / 10,
                overdueTasks,
            };
        });

        return { success: true, data: progress };
    } catch (error) {
        console.error("Error fetching project progress:", error);
        return { success: false, error: "Failed to fetch project progress" };
    }
}
