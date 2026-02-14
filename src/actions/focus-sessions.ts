"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import { FocusSession, FocusSessionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

    return {
        userId: user.id,
        organizationId: user.memberships[0].organizationId,
    };
}

export interface StartFocusSessionInput {
    taskId?: string | null;
    type: FocusSessionType;
    notes?: string | null;
}

export async function startFocusSession(
    input: StartFocusSessionInput
): Promise<ActionResult<FocusSession>> {
    try {
        const { userId } = await getUserOrganization();

        // Check if there's already an active session
        const activeSession = await db.focusSession.findFirst({
            where: {
                userId,
                endedAt: null,
            },
        });

        if (activeSession) {
            return {
                success: false,
                error: "You already have an active focus session. End it before starting a new one.",
            };
        }

        const session = await db.focusSession.create({
            data: {
                userId,
                taskId: input.taskId || null,
                type: input.type,
                notes: input.notes || null,
                startedAt: new Date(),
                pomodoroCount: 0,
                completed: false,
            },
            include: {
                task: true,
            },
        });

        revalidatePath("/focus");
        return { success: true, data: session };
    } catch (error) {
        console.error("Start focus session error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to start focus session",
        };
    }
}

export interface EndFocusSessionInput {
    sessionId: string;
    notes?: string | null;
    pomodoroCount?: number;
    completed?: boolean;
}

export async function endFocusSession(
    input: EndFocusSessionInput
): Promise<ActionResult<FocusSession>> {
    try {
        const { userId } = await getUserOrganization();

        const existingSession = await db.focusSession.findFirst({
            where: {
                id: input.sessionId,
                userId,
            },
        });

        if (!existingSession) {
            return { success: false, error: "Focus session not found" };
        }

        if (existingSession.endedAt) {
            return { success: false, error: "Focus session already ended" };
        }

        const endedAt = new Date();
        const duration = Math.round(
            (endedAt.getTime() - existingSession.startedAt.getTime()) / 1000 / 60
        );

        const session = await db.focusSession.update({
            where: { id: input.sessionId },
            data: {
                endedAt,
                duration,
                notes: input.notes ?? existingSession.notes,
                pomodoroCount: input.pomodoroCount ?? existingSession.pomodoroCount,
                completed: input.completed ?? true,
            },
            include: {
                task: true,
            },
        });

        // Auto-create a time entry from the focus session
        if (existingSession.taskId) {
            await db.timeEntry.create({
                data: {
                    userId,
                    taskId: existingSession.taskId,
                    startedAt: existingSession.startedAt,
                    endedAt,
                    duration,
                    description: `Focus session: ${existingSession.type === "POMODORO" ? "Pomodoro" : "Free focus"}`,
                    source: "FOCUS_SESSION",
                },
            });
        }

        revalidatePath("/focus");
        revalidatePath("/time-tracking");
        return { success: true, data: session };
    } catch (error) {
        console.error("End focus session error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to end focus session",
        };
    }
}

export async function getActiveFocusSession(): Promise<FocusSession | null> {
    try {
        const { userId } = await getUserOrganization();

        const session = await db.focusSession.findFirst({
            where: {
                userId,
                endedAt: null,
            },
            include: {
                task: true,
            },
        });

        return session;
    } catch (error) {
        console.error("Get active focus session error:", error);
        return null;
    }
}

export async function getFocusSessions(options?: {
    limit?: number;
    taskId?: string;
}): Promise<FocusSession[]> {
    try {
        const { userId } = await getUserOrganization();

        const where: Record<string, unknown> = { userId };
        if (options?.taskId) {
            where.taskId = options.taskId;
        }

        const sessions = await db.focusSession.findMany({
            where,
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        priority: true,
                    },
                },
            },
            orderBy: { startedAt: "desc" },
            take: options?.limit || 50,
        });

        return sessions;
    } catch (error) {
        console.error("Get focus sessions error:", error);
        return [];
    }
}

export async function deleteFocusSession(
    sessionId: string
): Promise<ActionResult> {
    try {
        const { userId } = await getUserOrganization();

        const session = await db.focusSession.findFirst({
            where: {
                id: sessionId,
                userId,
            },
        });

        if (!session) {
            return { success: false, error: "Focus session not found" };
        }

        await db.focusSession.delete({
            where: { id: sessionId },
        });

        revalidatePath("/focus");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete focus session error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete focus session",
        };
    }
}

export async function getFocusStats(): Promise<{
    todayMinutes: number;
    todaySessions: number;
    weekMinutes: number;
    weekSessions: number;
    totalMinutes: number;
    totalSessions: number;
    todayPomodoros: number;
    streak: number;
}> {
    try {
        const { userId } = await getUserOrganization();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);

        const [todaySessions, weekSessions, allSessions] = await Promise.all([
            db.focusSession.findMany({
                where: {
                    userId,
                    startedAt: { gte: todayStart },
                    completed: true,
                },
            }),
            db.focusSession.findMany({
                where: {
                    userId,
                    startedAt: { gte: weekStart },
                    completed: true,
                },
            }),
            db.focusSession.findMany({
                where: {
                    userId,
                    completed: true,
                },
            }),
        ]);

        // Calculate streak — consecutive days with at least one session
        let streak = 0;
        const checkDate = new Date(todayStart);

        while (true) {
            const dayStart = new Date(checkDate);
            const dayEnd = new Date(checkDate);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const hasSession = allSessions.some(
                (s) => s.startedAt >= dayStart && s.startedAt < dayEnd
            );

            if (hasSession) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return {
            todayMinutes: todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            todaySessions: todaySessions.length,
            weekMinutes: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            weekSessions: weekSessions.length,
            totalMinutes: allSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            totalSessions: allSessions.length,
            todayPomodoros: todaySessions.reduce((sum, s) => sum + s.pomodoroCount, 0),
            streak,
        };
    } catch (error) {
        console.error("Get focus stats error:", error);
        return {
            todayMinutes: 0,
            todaySessions: 0,
            weekMinutes: 0,
            weekSessions: 0,
            totalMinutes: 0,
            totalSessions: 0,
            todayPomodoros: 0,
            streak: 0,
        };
    }
}
