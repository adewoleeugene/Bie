/**
 * Permission helper for resources that can be ORG-visible or PRIVATE.
 *
 * Rules:
 *   - ORG visibility: any member of the resource's organization can view +
 *     edit (current default; matches the pre-permissions behavior).
 *   - PRIVATE visibility: only the creator/author plus explicit members can
 *     access. Members may have role VIEWER (read-only) or EDITOR (read+write).
 *
 * The helper takes a small "shape" object so the same logic works for both
 * WikiPage and WikiDatabase without coupling to a Prisma type.
 */

import { ResourceMemberRole, ResourceVisibility } from "@prisma/client";

interface ResourceShape {
    visibility: ResourceVisibility;
    organizationId: string;
    creatorId: string;
    members: { userId: string; role: ResourceMemberRole }[];
}

interface ViewerShape {
    userId: string;
    organizationId: string;
}

export type AccessLevel = "none" | "view" | "edit";

export function resolveAccess(
    resource: ResourceShape,
    viewer: ViewerShape,
): AccessLevel {
    if (resource.organizationId !== viewer.organizationId) return "none";
    if (resource.visibility === ResourceVisibility.ORG) return "edit";

    // PRIVATE
    if (resource.creatorId === viewer.userId) return "edit";
    const member = resource.members.find((m) => m.userId === viewer.userId);
    if (!member) return "none";
    return member.role === ResourceMemberRole.VIEWER ? "view" : "edit";
}

export function canView(level: AccessLevel): boolean {
    return level !== "none";
}

export function canEdit(level: AccessLevel): boolean {
    return level === "edit";
}
