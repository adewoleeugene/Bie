"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { OrgRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_WORKSPACE_COOKIE, activeMembership, getUserWorkspaces } from "@/lib/user-organization";

function setActiveWorkspaceCookie(
    store: Awaited<ReturnType<typeof cookies>>,
    organizationId: string,
) {
    store.set(ACTIVE_WORKSPACE_COOKIE, organizationId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
    });
}

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
    setActiveWorkspaceCookie(store, organizationId);

    revalidatePath("/", "layout");
    return { success: true };
}

/**
 * Leave the workspace the user is currently in (the active one). Removes the
 * caller's own membership — distinct from removing someone else. Two guards:
 *   - You can't leave your PERSONAL workspace (it's your home base).
 *   - The sole OWNER must transfer ownership or delete the workspace first,
 *     so an org is never left ownerless.
 * On success, lands the user on another workspace (personal preferred).
 */
export async function leaveWorkspace() {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            memberships: {
                include: {
                    organization: { select: { id: true, name: true, type: true } },
                },
            },
        },
    });
    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const active = await activeMembership(user.memberships);
    if (!active) {
        return { success: false, error: "No active workspace" };
    }

    if (active.organization.type === "PERSONAL") {
        return { success: false, error: "You can't leave your personal workspace." };
    }

    // Never leave an organization without an owner.
    if (active.role === OrgRole.OWNER) {
        const ownerCount = await db.organizationMember.count({
            where: { organizationId: active.organizationId, role: OrgRole.OWNER },
        });
        if (ownerCount <= 1) {
            return {
                success: false,
                error: "You're the only owner — transfer ownership or delete the workspace before leaving.",
            };
        }
    }

    await db.organizationMember.delete({
        where: {
            organizationId_userId: { organizationId: active.organizationId, userId: user.id },
        },
    });

    // Land the user somewhere valid: prefer their personal workspace.
    const remaining = user.memberships.filter(
        (m) => m.organizationId !== active.organizationId,
    );
    const fallback =
        remaining.find((m) => m.organization.type === "PERSONAL") ?? remaining[0];

    const store = await cookies();
    if (fallback) {
        setActiveWorkspaceCookie(store, fallback.organizationId);
    } else {
        store.delete(ACTIVE_WORKSPACE_COOKIE);
    }

    revalidatePath("/", "layout");
    return { success: true, workspaceName: active.organization.name };
}
