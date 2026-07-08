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

const EMPTY_WORKSPACES = {
    workspaces: [] as { id: string; name: string; type: "PERSONAL" | "ORGANIZATION" }[],
    invitedProjects: [] as { id: string; name: string; organizationId: string; workspaceName: string }[],
    currentId: null as string | null,
    currentName: null as string | null,
};

/**
 * Everything the current user can switch to: their personal workspace, any
 * workspaces they're a full member of, and any projects they were invited to
 * as a guest (where they don't have the whole workspace).
 */
export async function getUserWorkspaces() {
    const session = await auth();
    if (!session?.user?.email) return EMPTY_WORKSPACES;

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) return EMPTY_WORKSPACES;

    const memberships = await db.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: { select: { id: true, name: true, type: true } } },
        orderBy: { joinedAt: "asc" },
    });
    if (memberships.length === 0) return EMPTY_WORKSPACES;

    const current = await activeMembership(memberships, selectCurrentMembership(memberships));

    // Full workspaces: personal + anywhere the user is more than a guest.
    // Personal first so it reads as the home base.
    const workspaces = memberships
        .filter((m) => m.organization.type === "PERSONAL" || m.role !== "GUEST")
        .sort((a, b) => (a.organization.type === "PERSONAL" ? -1 : b.organization.type === "PERSONAL" ? 1 : 0))
        .map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            type: m.organization.type,
        }));

    // Guest orgs only surface through the specific projects the user was invited to.
    const guestOrgIds = memberships.filter((m) => m.role === "GUEST").map((m) => m.organizationId);
    let invitedProjects: typeof EMPTY_WORKSPACES.invitedProjects = [];
    if (guestOrgIds.length > 0) {
        const projectMembers = await db.projectMember.findMany({
            where: {
                userId: user.id,
                project: { organizationId: { in: guestOrgIds } },
            },
            select: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        organization: { select: { name: true } },
                    },
                },
            },
        });
        invitedProjects = projectMembers.map((pm) => ({
            id: pm.project.id,
            name: pm.project.name,
            organizationId: pm.project.organizationId,
            workspaceName: pm.project.organization.name,
        }));
    }

    return {
        workspaces,
        invitedProjects,
        currentId: current?.organizationId ?? null,
        currentName: current?.organization.name ?? null,
    };
}
