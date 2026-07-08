"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { activeMembership } from "@/lib/user-organization";

async function getMe() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });
    if (!user || user.memberships.length === 0) throw new Error("No organization");
    return { userId: user.id, organizationId: (await activeMembership(user.memberships)).organizationId };
}

function startOfDay(date?: Date): Date {
    const d = date ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function upsertDailyReflection(data: {
    date?: string; // ISO date string — defaults to today
    content?: string;
    mood?: number | null;
    energyLevel?: number | null;
    highlights?: string | null;
    improvements?: string | null;
}) {
    try {
        const { userId, organizationId } = await getMe();
        const date = data.date ? startOfDay(new Date(data.date)) : startOfDay();

        const reflection = await db.dailyReflection.upsert({
            where: {
                userId_date: { userId, date },
            },
            create: {
                userId,
                organizationId,
                date,
                content: data.content ?? "",
                mood: data.mood ?? null,
                energyLevel: data.energyLevel ?? null,
                highlights: data.highlights ?? null,
                improvements: data.improvements ?? null,
            },
            update: {
                ...(data.content !== undefined ? { content: data.content } : {}),
                ...(data.mood !== undefined ? { mood: data.mood } : {}),
                ...(data.energyLevel !== undefined ? { energyLevel: data.energyLevel } : {}),
                ...(data.highlights !== undefined ? { highlights: data.highlights } : {}),
                ...(data.improvements !== undefined ? { improvements: data.improvements } : {}),
            },
        });

        revalidatePath("/my-day");
        revalidatePath("/reflections");
        return { success: true, data: reflection };
    } catch (error) {
        console.error("upsertDailyReflection error:", error);
        return { success: false, error: "Failed to save reflection" };
    }
}

export async function getDailyReflection(date?: string) {
    try {
        const { userId } = await getMe();
        const d = date ? startOfDay(new Date(date)) : startOfDay();

        const reflection = await db.dailyReflection.findUnique({
            where: {
                userId_date: { userId, date: d },
            },
        });

        return reflection ?? null;
    } catch (error) {
        console.error("getDailyReflection error:", error);
        return null;
    }
}

export async function getReflectionHistory(limit = 30) {
    try {
        const { userId } = await getMe();

        const reflections = await db.dailyReflection.findMany({
            where: { userId },
            orderBy: { date: "desc" },
            take: limit,
        });

        return reflections ?? [];
    } catch (error) {
        console.error("getReflectionHistory error:", error);
        return [];
    }
}
