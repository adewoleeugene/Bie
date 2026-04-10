"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getViewerUserId(): Promise<string | null> {
    try {
        const session = await auth();
        if (!session?.user?.email) return null;
        const me = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        return me?.id ?? null;
    } catch (error) {
        console.error("getViewerUserId error:", error);
        return null;
    }
}
