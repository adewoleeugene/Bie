"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import { TimeEntry } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { activeMembership } from "@/lib/user-organization";
import { taskAccessWhere } from "@/lib/permissions";

async function getUserOrganization() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: true,
                },
            },
        },
    });

    if (!user || user.memberships.length === 0) {
        throw new Error("No organization found");
    }

    const membership = await activeMembership(user.memberships);

    return {
        userId: user.id,
        organizationId: membership.organizationId,
        role: membership.role,
    };
}

export interface CreateTimeEntryInput {
    taskId: string;
    startedAt: string;
    endedAt?: string | null;
    duration?: number | null; // minutes
    description?: string | null;
}

export async function createTimeEntry(
    input: CreateTimeEntryInput
): Promise<ActionResult<TimeEntry>> {
    try {
        const viewer = await getUserOrganization();
        const { userId } = viewer;

        const task = await db.task.findFirst({
            where: {
                id: input.taskId,
                ...taskAccessWhere({
                    userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
            select: { id: true },
        });

        if (!task) {
            return { success: false, error: "Task not found" };
        }

        const startedAt = new Date(input.startedAt);
        const endedAt = input.endedAt ? new Date(input.endedAt) : null;
        const duration =
            input.duration ||
            (endedAt
                ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000 / 60)
                : null);

        const entry = await db.timeEntry.create({
            data: {
                userId,
                taskId: input.taskId,
                startedAt,
                endedAt,
                duration,
                description: input.description || null,
                source: "MANUAL",
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
            },
        });

        revalidatePath("/time-tracking");
        return { success: true, data: entry };
    } catch (error) {
        console.error("Create time entry error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create time entry",
        };
    }
}

export interface UpdateTimeEntryInput {
    id: string;
    description?: string | null;
    duration?: number | null;
}

export async function updateTimeEntry(
    input: UpdateTimeEntryInput
): Promise<ActionResult<TimeEntry>> {
    try {
        const viewer = await getUserOrganization();
        const { userId } = viewer;

        const existing = await db.timeEntry.findFirst({
            where: {
                id: input.id,
                userId,
                task: taskAccessWhere({
                    userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
        });

        if (!existing) {
            return { success: false, error: "Time entry not found" };
        }

        const updateData: Record<string, unknown> = {};
        if (input.description !== undefined) updateData.description = input.description;
        if (input.duration !== undefined) updateData.duration = input.duration;

        const entry = await db.timeEntry.update({
            where: { id: input.id },
            data: updateData,
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
            },
        });

        revalidatePath("/time-tracking");
        return { success: true, data: entry };
    } catch (error) {
        console.error("Update time entry error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update time entry",
        };
    }
}

export async function deleteTimeEntry(
    entryId: string
): Promise<ActionResult> {
    try {
        const viewer = await getUserOrganization();
        const { userId } = viewer;

        const existing = await db.timeEntry.findFirst({
            where: {
                id: entryId,
                userId,
                task: taskAccessWhere({
                    userId,
                    organizationId: viewer.organizationId,
                    orgRole: viewer.role,
                }),
            },
        });

        if (!existing) {
            return { success: false, error: "Time entry not found" };
        }

        await db.timeEntry.delete({
            where: { id: entryId },
        });

        revalidatePath("/time-tracking");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete time entry error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete time entry",
        };
    }
}

export async function getTimeEntries(options?: {
    taskId?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
}): Promise<TimeEntry[]> {
    try {
        const viewer = await getUserOrganization();
        const { userId } = viewer;

        const where: Record<string, unknown> = {
            userId,
            task: taskAccessWhere({
                userId,
                organizationId: viewer.organizationId,
                orgRole: viewer.role,
            }),
        };
        if (options?.taskId) where.taskId = options.taskId;
        if (options?.startDate || options?.endDate) {
            const dateFilter: Record<string, Date> = {};
            if (options.startDate) dateFilter.gte = new Date(options.startDate);
            if (options.endDate) dateFilter.lte = new Date(options.endDate);
            where.startedAt = dateFilter;
        }

        const entries = await db.timeEntry.findMany({
            where,
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        priority: true,
                        project: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { startedAt: "desc" },
            take: options?.limit || 100,
        });

        return entries;
    } catch (error) {
        console.error("Get time entries error:", error);
        return [];
    }
}

export interface EstimateVsActualItem {
    taskId: string;
    taskTitle: string;
    projectName: string | null;
    estimatedHours: number;
    actualMinutes: number;
}

export async function getEstimateVsActual(projectId?: string): Promise<EstimateVsActualItem[]> {
    try {
        const { userId, organizationId, role } = await getUserOrganization();

        const where = {
            ...taskAccessWhere({ userId, organizationId, orgRole: role }),
            estimatedHours: { not: null },
        };
        if (projectId) where.projectId = projectId;

        const tasks = await db.task.findMany({
            where,
            select: {
                id: true,
                title: true,
                estimatedHours: true,
                project: { select: { name: true } },
                timeEntries: { select: { duration: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 30,
        });

        return tasks
            .filter((t) => t.estimatedHours != null)
            .map((t) => ({
                taskId: t.id,
                taskTitle: t.title,
                projectName: t.project?.name || null,
                estimatedHours: t.estimatedHours!,
                actualMinutes: t.timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
            }))
            .filter((t) => t.actualMinutes > 0 || t.estimatedHours > 0);
    } catch (error) {
        console.error("Get estimate vs actual error:", error);
        return [];
    }
}

export async function getTimeTrackingStats(): Promise<{
    todayMinutes: number;
    weekMinutes: number;
    monthMinutes: number;
    taskBreakdown: { taskId: string; taskTitle: string; totalMinutes: number }[];
}> {
    try {
        const viewer = await getUserOrganization();
        const { userId } = viewer;
        const accessibleTask = taskAccessWhere({
            userId,
            organizationId: viewer.organizationId,
            orgRole: viewer.role,
        });

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [todayEntries, weekEntries, monthEntries] = await Promise.all([
            db.timeEntry.findMany({
                where: { userId, startedAt: { gte: todayStart }, task: accessibleTask },
            }),
            db.timeEntry.findMany({
                where: { userId, startedAt: { gte: weekStart }, task: accessibleTask },
            }),
            db.timeEntry.findMany({
                where: { userId, startedAt: { gte: monthStart }, task: accessibleTask },
                include: {
                    task: { select: { id: true, title: true } },
                },
            }),
        ]);

        // Build task breakdown from month entries
        const taskMap = new Map<string, { taskTitle: string; totalMinutes: number }>();
        for (const entry of monthEntries as (TimeEntry & { task: { id: string; title: string } })[]) {
            const key = entry.taskId;
            const existing = taskMap.get(key);
            if (existing) {
                existing.totalMinutes += entry.duration || 0;
            } else {
                taskMap.set(key, {
                    taskTitle: entry.task?.title || "Unknown Task",
                    totalMinutes: entry.duration || 0,
                });
            }
        }

        const taskBreakdown = Array.from(taskMap.entries())
            .map(([taskId, data]) => ({
                taskId,
                taskTitle: data.taskTitle,
                totalMinutes: data.totalMinutes,
            }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .slice(0, 10);

        return {
            todayMinutes: todayEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
            weekMinutes: weekEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
            monthMinutes: monthEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
            taskBreakdown,
        };
    } catch (error) {
        console.error("Get time tracking stats error:", error);
        return {
            todayMinutes: 0,
            weekMinutes: 0,
            monthMinutes: 0,
            taskBreakdown: [],
        };
    }
}
