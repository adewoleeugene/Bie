"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { OrgRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

        // Map to simpler user objects
        return members.map((member) => ({
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            image: member.user.image,
            role: member.role,
        }));
    } catch (error) {
        console.error("Get members error:", error);
        return [];
    }
}

// ─── Invite Member ──────────────────────────────────────

export async function inviteMember(email: string, role: OrgRole = OrgRole.MEMBER) {
    try {
        const { userId, organizationId, role: callerRole } = await getUserOrganization();

        if (callerRole !== OrgRole.OWNER && callerRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can invite members" };
        }

        // Prevent non-owners from inviting as OWNER
        if (role === OrgRole.OWNER && callerRole !== OrgRole.OWNER) {
            return { success: false, error: "Only owners can invite new owners" };
        }

        const targetUser = await db.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!targetUser) {
            return { success: false, error: "No user found with that email. They must create an account first." };
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
