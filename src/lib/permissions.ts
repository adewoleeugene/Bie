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

import { OrgRole, ResourceMemberRole, ResourceVisibility } from "@prisma/client";

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

export type AccessLevel = "none" | "view" | "edit";

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
    return level === "edit";
}
