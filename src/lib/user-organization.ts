import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { selectCurrentMembership } from "@/lib/workspaces";

export const ACTIVE_WORKSPACE_COOKIE = "activeWorkspaceId";

/**
 * Picks the membership for the user's active workspace: the one matching the
 * active-workspace cookie if they're still a member, otherwise the provided
 * fallback (or the first membership). Keeping this in one place lets every
 * server action resolve the same workspace when the user switches.
 */
export async function activeMembership<T extends { organizationId: string }>(
    memberships: T[],
    fallback?: T
): Promise<T> {
    const store = await cookies();
    const activeId = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;

    if (activeId) {
        const match = memberships.find((m) => m.organizationId === activeId);
        if (match) return match;
    }

    return fallback ?? memberships[0];
}

/** Workspaces the current user belongs to, plus which one is active. */
export async function getUserWorkspaces() {
    const session = await auth();
    if (!session?.user?.email) return { workspaces: [], currentId: null };

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) return { workspaces: [], currentId: null };

    const memberships = await db.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: { select: { id: true, name: true, type: true } } },
        orderBy: { joinedAt: "asc" },
    });
    if (memberships.length === 0) return { workspaces: [], currentId: null };

    const current = await activeMembership(memberships, selectCurrentMembership(memberships));

    return {
        workspaces: memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            type: m.organization.type,
            role: m.role,
        })),
        currentId: current?.organizationId ?? null,
    };
}
