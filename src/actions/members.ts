"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { OrgRole, ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { buildNotificationEmail, sendEmail } from "@/lib/email";

const INVITE_DAYS = 14;

function normalizedEmail(email: string) {
    return email.toLowerCase().trim();
}

function inviteExpiry() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_DAYS);
    return expiresAt;
}

function inviteToken() {
    return randomBytes(32).toString("hex");
}

function inviteLink(token: string) {
    return `/invite/${token}`;
}

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
        role: user.memberships[0].role,
    };
}

export async function getOrganizationMembers() {
    try {
        const { organizationId } = await getUserOrganization();

        // Get members via OrganizationMember relation
        const members = await db.organizationMember.findMany({
            where: {
                organizationId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                joinedAt: "asc",
            },
        });

        // Which projects (in this workspace) each member belongs to.
        const projectMembers = await db.projectMember.findMany({
            where: {
                project: { organizationId },
                userId: { in: members.map((m) => m.user.id) },
            },
            select: {
                userId: true,
                role: true,
                project: { select: { id: true, name: true } },
            },
        });

        const projectsByUser = new Map<string, { id: string; name: string; role: ProjectRole }[]>();
        for (const pm of projectMembers) {
            const list = projectsByUser.get(pm.userId) ?? [];
            list.push({ id: pm.project.id, name: pm.project.name, role: pm.role });
            projectsByUser.set(pm.userId, list);
        }

        // Map to simpler user objects
        return members.map((member) => ({
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            image: member.user.image,
            role: member.role,
            projects: projectsByUser.get(member.user.id) ?? [],
        }));
    } catch (error) {
        console.error("Get members error:", error);
        return [];
    }
}

// ─── Pending invites & shareable links ──────────────────

function inviteRoleLabel(invitation: {
    scope: "ORGANIZATION" | "PROJECT";
    role: OrgRole;
    projectRole: ProjectRole | null;
}) {
    return invitation.scope === "PROJECT"
        ? invitation.projectRole ?? ProjectRole.EDITOR
        : invitation.role;
}

export async function getWorkspaceInvites() {
    try {
        const { organizationId, role } = await getUserOrganization();

        if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN) {
            return { pending: [], links: [] };
        }

        const invitations = await db.organizationInvitation.findMany({
            where: {
                organizationId,
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: {
                project: { select: { name: true } },
                invitedBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const pending = invitations
            .filter((i) => i.email)
            .map((i) => ({
                id: i.id,
                email: i.email as string,
                scope: i.scope,
                projectName: i.project?.name ?? null,
                role: inviteRoleLabel(i),
                invitedByName: i.invitedBy?.name ?? null,
                createdAt: i.createdAt,
            }));

        const links = invitations
            .filter((i) => !i.email)
            .map((i) => ({
                id: i.id,
                token: i.token,
                scope: i.scope,
                projectName: i.project?.name ?? null,
                role: inviteRoleLabel(i),
            }));

        return { pending, links };
    } catch (error) {
        console.error("Get workspace invites error:", error);
        return { pending: [], links: [] };
    }
}

export async function revokeInvitation(invitationId: string) {
    try {
        const { organizationId, role } = await getUserOrganization();

        if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can revoke invites" };
        }

        const invitation = await db.organizationInvitation.findFirst({
            where: { id: invitationId, organizationId },
            select: { id: true },
        });

        if (!invitation) {
            return { success: false, error: "Invite not found" };
        }

        await db.organizationInvitation.delete({ where: { id: invitation.id } });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Revoke invitation error:", error);
        return { success: false, error: "Failed to revoke invite" };
    }
}

// ─── Invite Member ──────────────────────────────────────

export async function inviteMember(email: string, role: OrgRole = OrgRole.MEMBER) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();
        const targetEmail = normalizedEmail(email);

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can invite members" };
        }

        // Prevent non-owners from inviting as OWNER
        if (role === OrgRole.OWNER && callerRole !== OrgRole.OWNER) {
            return { success: false, error: "Only owners can invite new owners" };
        }

        const targetUser = await db.user.findUnique({
            where: { email: targetEmail },
        });

        if (!targetUser) {
            const existingInvite = await db.organizationInvitation.findFirst({
                where: {
                    email: targetEmail,
                    organizationId,
                    scope: "ORGANIZATION",
                    acceptedAt: null,
                    expiresAt: { gt: new Date() },
                },
                select: { token: true },
            });

            if (existingInvite) {
                return { success: true, inviteUrl: inviteLink(existingInvite.token) };
            }

            const organization = await db.organization.findUnique({
                where: { id: organizationId },
                select: { name: true },
            });

            const invitation = await db.organizationInvitation.create({
                data: {
                    email: targetEmail,
                    scope: "ORGANIZATION",
                    token: inviteToken(),
                    role,
                    organizationId,
                    invitedById: userId,
                    expiresAt: inviteExpiry(),
                },
            });

            const inviteUrl = inviteLink(invitation.token);
            const emailBody = buildNotificationEmail({
                title: `You're invited to ${organization?.name ?? "a workspace"} on Bie`,
                body: `Create an account or sign in with ${targetEmail} to accept this workspace invitation.`,
                linkUrl: inviteUrl,
            });
            await sendEmail({ to: targetEmail, ...emailBody });

            revalidatePath("/settings");
            return { success: true, inviteUrl };
        }

        const existing = await db.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: targetUser.id,
                },
            },
        });

        if (existing) {
            return { success: false, error: "User is already a member of this workspace" };
        }

        await db.organizationMember.create({
            data: {
                organizationId,
                userId: targetUser.id,
                role,
            },
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Invite member error:", error);
        return { success: false, error: "Failed to invite member" };
    }
}

// ─── Shareable Invite Link ──────────────────────────────

// Shareable links are not tied to an email — anyone signed in who opens them joins
// the workspace at the given role. They stay reusable, so we give them a long life.
function shareableExpiry() {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    return expiresAt;
}

export async function createInviteLink(role: OrgRole = OrgRole.MEMBER) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can create invite links" };
        }

        if (role === OrgRole.OWNER && callerRole !== OrgRole.OWNER) {
            return { success: false, error: "Only owners can create owner invite links" };
        }

        // Reuse an existing open link for this role so the URL stays stable.
        const existing = await db.organizationInvitation.findFirst({
            where: {
                organizationId,
                scope: "ORGANIZATION",
                email: null,
                role,
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: { token: true },
        });

        if (existing) {
            return { success: true, inviteUrl: inviteLink(existing.token) };
        }

        const invitation = await db.organizationInvitation.create({
            data: {
                email: null,
                scope: "ORGANIZATION",
                token: inviteToken(),
                role,
                organizationId,
                invitedById: userId,
                expiresAt: shareableExpiry(),
            },
        });

        return { success: true, inviteUrl: inviteLink(invitation.token) };
    } catch (error) {
        console.error("Create invite link error:", error);
        return { success: false, error: "Failed to create invite link" };
    }
}

export async function inviteProjectMember(
    projectId: string,
    email: string,
    role: ProjectRole = ProjectRole.EDITOR
) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();
        const targetEmail = normalizedEmail(email);

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can invite project members" };
        }

        const project = await db.project.findFirst({
            where: { id: projectId, organizationId },
            select: { id: true, name: true, organization: { select: { name: true } } },
        });

        if (!project) {
            return { success: false, error: "Project not found" };
        }

        const targetUser = await db.user.findUnique({
            where: { email: targetEmail },
        });

        if (targetUser) {
            await db.$transaction(async (tx) => {
                await tx.organizationMember.upsert({
                    where: {
                        organizationId_userId: {
                            organizationId,
                            userId: targetUser.id,
                        },
                    },
                    update: {},
                    create: {
                        organizationId,
                        userId: targetUser.id,
                        role: OrgRole.GUEST,
                    },
                });

                await tx.projectMember.upsert({
                    where: {
                        projectId_userId: {
                            projectId,
                            userId: targetUser.id,
                        },
                    },
                    update: { role },
                    create: {
                        projectId,
                        userId: targetUser.id,
                        role,
                    },
                });
            });

            revalidatePath(`/projects/${projectId}`);
            return { success: true };
        }

        const existingInvite = await db.organizationInvitation.findFirst({
            where: {
                email: targetEmail,
                organizationId,
                projectId,
                scope: "PROJECT",
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: { token: true },
        });

        if (existingInvite) {
            return { success: true, inviteUrl: inviteLink(existingInvite.token) };
        }

        const invitation = await db.organizationInvitation.create({
            data: {
                email: targetEmail,
                scope: "PROJECT",
                token: inviteToken(),
                role: OrgRole.GUEST,
                projectRole: role,
                organizationId,
                projectId,
                invitedById: userId,
                expiresAt: inviteExpiry(),
            },
        });

        const emailBody = buildNotificationEmail({
            title: `You're invited to ${project.name}`,
            body: `Create an account or sign in with ${targetEmail} to access this project in ${project.organization.name}.`,
            linkUrl: inviteLink(invitation.token),
        });
        await sendEmail({ to: targetEmail, ...emailBody });

        revalidatePath(`/projects/${projectId}`);
        return { success: true, inviteUrl: inviteLink(invitation.token) };
    } catch (error) {
        console.error("Invite project member error:", error);
        return { success: false, error: "Failed to invite project member" };
    }
}

export async function createProjectInviteLink(
    projectId: string,
    role: ProjectRole = ProjectRole.EDITOR
) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can create invite links" };
        }

        const project = await db.project.findFirst({
            where: { id: projectId, organizationId },
            select: { id: true },
        });

        if (!project) {
            return { success: false, error: "Project not found" };
        }

        // Reuse an existing open link for this project + role so the URL stays stable.
        const existing = await db.organizationInvitation.findFirst({
            where: {
                organizationId,
                projectId,
                scope: "PROJECT",
                email: null,
                projectRole: role,
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: { token: true },
        });

        if (existing) {
            return { success: true, inviteUrl: inviteLink(existing.token) };
        }

        const invitation = await db.organizationInvitation.create({
            data: {
                email: null,
                scope: "PROJECT",
                token: inviteToken(),
                role: OrgRole.GUEST,
                projectRole: role,
                organizationId,
                projectId,
                invitedById: userId,
                expiresAt: shareableExpiry(),
            },
        });

        return { success: true, inviteUrl: inviteLink(invitation.token) };
    } catch (error) {
        console.error("Create project invite link error:", error);
        return { success: false, error: "Failed to create invite link" };
    }
}

// ─── Remove Member ──────────────────────────────────────

export async function removeMember(targetUserId: string) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can remove members" };
        }

        if (targetUserId === userId) {
            return { success: false, error: "You cannot remove yourself" };
        }

        // Prevent removing the last owner
        const targetMembership = await db.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: targetUserId,
                },
            },
        });

        if (!targetMembership) {
            return { success: false, error: "Member not found" };
        }

        if (targetMembership.role === OrgRole.OWNER) {
            const ownerCount = await db.organizationMember.count({
                where: { organizationId, role: OrgRole.OWNER },
            });
            if (ownerCount <= 1) {
                return { success: false, error: "Cannot remove the last owner" };
            }
        }

        // Admins cannot remove owners
        if (callerRole === OrgRole.ADMIN && targetMembership.role === OrgRole.OWNER) {
            return { success: false, error: "Admins cannot remove owners" };
        }

        await db.organizationMember.delete({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: targetUserId,
                },
            },
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Remove member error:", error);
        return { success: false, error: "Failed to remove member" };
    }
}

// ─── Update Member Role ─────────────────────────────────

export async function updateMemberRole(targetUserId: string, newRole: OrgRole) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can change roles" };
        }

        // Only owners can promote to OWNER or ADMIN
        if ((newRole === OrgRole.OWNER || newRole === OrgRole.ADMIN) && callerRole !== OrgRole.OWNER) {
            return { success: false, error: "Only owners can promote to this role" };
        }

        // Prevent downgrading the last owner
        if (targetUserId === userId && callerRole === OrgRole.OWNER && newRole !== OrgRole.OWNER) {
            const ownerCount = await db.organizationMember.count({
                where: { organizationId, role: OrgRole.OWNER },
            });
            if (ownerCount <= 1) {
                return { success: false, error: "Cannot downgrade the last owner" };
            }
        }

        await db.organizationMember.update({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: targetUserId,
                },
            },
            data: { role: newRole },
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Update member role error:", error);
        return { success: false, error: "Failed to update role" };
    }
}
