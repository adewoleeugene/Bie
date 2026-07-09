/**
 * Permission helper for resources that can be ORG-visible or PRIVATE.
 *
 * Rules:
 *   - ORG visibility: any member of the org can view + edit.
 *   - ORG_VIEW visibility: any member of the org can view (read-only); only
 *     the creator + explicitly invited editors (and org admins) can edit.
 *   - PRIVATE visibility: only the creator/author plus explicit members can
 *     access. Members may have role VIEWER (read-only) or EDITOR (read+write).
 *   - Org ADMIN/OWNER can manage any resource in their org.
 *
 * The helper takes a small "shape" object so the same logic works for both
 * WikiPage and WikiDatabase without coupling to a Prisma type.
 */

import {
    ConversationType,
    OrgRole,
    Prisma,
    ProjectRole,
    ProjectVisibility,
    ResourceMemberRole,
    ResourceVisibility,
} from "@prisma/client";

interface ResourceShape {
    visibility: ResourceVisibility;
    organizationId: string;
    creatorId: string;
    members: { userId: string; role: ResourceMemberRole }[];
}

interface ViewerShape {
    userId: string;
    organizationId: string;
    /** Viewer's org-level role. Admins/owners manage all resources in their org. */
    orgRole?: OrgRole;
}

export type AccessLevel = "none" | "view" | "edit" | "manage";

export function resolveAccess(
    resource: ResourceShape,
    viewer: ViewerShape,
): AccessLevel {
    if (resource.organizationId !== viewer.organizationId) return "none";
    // Org admins/owners can manage any resource in their organization.
    if (viewer.orgRole === OrgRole.ADMIN || viewer.orgRole === OrgRole.OWNER) {
        return "edit";
    }
    // The creator always has full access.
    if (resource.creatorId === viewer.userId) return "edit";

    const member = resource.members.find((m) => m.userId === viewer.userId);
    const memberAccess: AccessLevel | null = member
        ? member.role === ResourceMemberRole.VIEWER
            ? "view"
            : "edit"
        : null;

    switch (resource.visibility) {
        case ResourceVisibility.ORG:
            // Whole org can view and edit.
            return "edit";
        case ResourceVisibility.ORG_VIEW:
            // Whole org can view; only invited editors (or above) can edit.
            return memberAccess === "edit" ? "edit" : "view";
        case ResourceVisibility.PRIVATE:
            // Only the creator + explicitly invited members.
            return memberAccess ?? "none";
        default:
            return "none";
    }
}

export function canView(level: AccessLevel): boolean {
    return level !== "none";
}

export function canEdit(level: AccessLevel): boolean {
    return level === "edit" || level === "manage";
}

export function canManage(level: AccessLevel): boolean {
    return level === "manage";
}

export const canComment = canView;

interface ChannelShape {
    type: ConversationType;
    isPrivate: boolean;
    archived?: boolean;
    createdById?: string | null;
    organizationId: string;
    members: { userId: string }[];
}

export type ChannelAction = "read" | "post" | "manage" | "join";

export function isOrgAdmin(role?: OrgRole) {
    return role === OrgRole.ADMIN || role === OrgRole.OWNER;
}

export function resolveChannelAccess(
    conversation: ChannelShape,
    viewer: ViewerShape,
    action: ChannelAction,
): boolean {
    if (conversation.organizationId !== viewer.organizationId) return false;
    if (conversation.archived && action === "post") return false;

    const isMember = conversation.members.some((member) => member.userId === viewer.userId);
    const isCreator = conversation.createdById === viewer.userId;

    if (conversation.type !== ConversationType.CHANNEL) {
        return action === "read" || action === "post" ? isMember : false;
    }

    if (action === "manage") {
        return isOrgAdmin(viewer.orgRole) || isCreator;
    }

    if (action === "join") {
        return !conversation.isPrivate && viewer.orgRole !== OrgRole.GUEST;
    }

    return isMember;
}

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2, manage: 3 };

function maxAccess(a: AccessLevel, b: AccessLevel): AccessLevel {
    return RANK[a] >= RANK[b] ? a : b;
}

interface ProjectShape {
    visibility: ProjectVisibility;
    organizationId: string;
    leadId?: string | null;
    members: { userId: string; role: ProjectRole }[];
}

const PROJECT_ROLE_ACCESS: Record<ProjectRole, AccessLevel> = {
    [ProjectRole.OWNER]: "manage",
    [ProjectRole.ADMIN]: "manage",
    [ProjectRole.EDITOR]: "edit",
    [ProjectRole.VIEWER]: "view",
};

export function resolveProjectAccess(
    project: ProjectShape,
    viewer: ViewerShape,
): AccessLevel {
    if (project.organizationId !== viewer.organizationId) return "none";

    const explicit = project.members.find((member) => member.userId === viewer.userId);
    let access: AccessLevel = explicit ? PROJECT_ROLE_ACCESS[explicit.role] : "none";

    if (project.leadId === viewer.userId) {
        access = maxAccess(access, "manage");
    }

    if (viewer.orgRole !== OrgRole.GUEST && isOrgAdmin(viewer.orgRole)) {
        access = maxAccess(access, "manage");
    }

    if (viewer.orgRole !== OrgRole.GUEST && project.visibility === ProjectVisibility.ORG_VISIBLE) {
        access = maxAccess(access, "edit");
    }

    return access;
}

export function canManageProject(level: AccessLevel): boolean {
    return canManage(level);
}

export function projectAccessWhere(viewer: ViewerShape): Prisma.ProjectWhereInput {
    const base = { organizationId: viewer.organizationId };

    if (viewer.orgRole !== OrgRole.GUEST && isOrgAdmin(viewer.orgRole)) {
        return base;
    }

    if (viewer.orgRole === OrgRole.GUEST) {
        return {
            ...base,
            members: { some: { userId: viewer.userId } },
        };
    }

    return {
        ...base,
        OR: [
            { visibility: ProjectVisibility.ORG_VISIBLE },
            { members: { some: { userId: viewer.userId } } },
        ],
    };
}

export function taskAccessWhere(viewer: ViewerShape): Prisma.TaskWhereInput {
    if (viewer.orgRole === OrgRole.GUEST) {
        return {
            organizationId: viewer.organizationId,
            project: projectAccessWhere(viewer),
        };
    }

    if (isOrgAdmin(viewer.orgRole)) {
        return { organizationId: viewer.organizationId };
    }

    return {
        organizationId: viewer.organizationId,
        OR: [
            { projectId: null },
            { project: projectAccessWhere(viewer) },
        ],
    };
}

/**
 * Resolve access with folder inheritance.
 *
 * `chain` is the page followed by its ancestor folders, nearest first
 * (i.e. `[page, parent, grandparent, …]`). A page's effective access is its
 * own access maxed with the access granted by each ancestor — so sharing a
 * folder cascades to everything inside it (including private docs and pages
 * added later), which is the "share a set of docs" behaviour.
 *
 * A node with `inheritAccess === false` is "protected": its own access still
 * counts, but the walk stops there, so it (and anything below it) no longer
 * inherits shares from folders above it. That's how a doc — or a whole
 * sub-folder — can be kept more private than the folder it lives in.
 */
export function resolveInheritedAccess(
    chain: (ResourceShape & { inheritAccess?: boolean })[],
    viewer: ViewerShape,
): AccessLevel {
    let best: AccessLevel = "none";
    for (const node of chain) {
        best = maxAccess(best, resolveAccess(node, viewer));
        // Protected node blocks inheritance from anything above it.
        if (node.inheritAccess === false) break;
        if (canEdit(best)) break;
    }
    return best;
}
