"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_WORKSPACE_COOKIE, getUserWorkspaces } from "@/lib/user-organization";

export async function listWorkspaces() {
    return getUserWorkspaces();
}

export async function switchWorkspace(organizationId: string) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    // Only let the user switch into a workspace they actually belong to.
    const membership = await db.organizationMember.findUnique({
        where: {
            organizationId_userId: { organizationId, userId: user.id },
        },
        select: { organizationId: true },
    });
    if (!membership) {
        return { success: false, error: "You are not a member of this workspace" };
    }

    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, organizationId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath("/", "layout");
    return { success: true };
}
