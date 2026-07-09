import { Prisma, PrismaClient } from "@prisma/client";
import { joinPublicChannelsForMember } from "@/lib/chat-channels";

type DbClient = PrismaClient | Prisma.TransactionClient;
type MembershipWithOrganization = {
    organizationId: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
    organization: {
        id: string;
        type: "PERSONAL" | "ORGANIZATION";
        createdAt?: Date;
    };
    joinedAt?: Date;
};

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

async function uniqueWorkspaceSlug(db: DbClient, base: string) {
    const normalizedBase = slugify(base) || "workspace";
    let slug = normalizedBase;
    let suffix = 2;

    while (await db.organization.findUnique({ where: { slug }, select: { id: true } })) {
        slug = `${normalizedBase}-${suffix}`;
        suffix += 1;
    }

    return slug;
}

export async function ensurePersonalWorkspace(
    db: DbClient,
    user: { id: string; name?: string | null; email?: string | null }
) {
    const existing = await db.organizationMember.findFirst({
        where: {
            userId: user.id,
            organization: { type: "PERSONAL", ownerId: user.id },
        },
        include: { organization: true },
    });

    if (existing) return existing.organization;

    const displayName = user.name?.trim() || user.email?.split("@")[0] || "Personal";
    const slug = await uniqueWorkspaceSlug(db, `${displayName}-personal`);

    const organization = await db.organization.create({
        data: {
            name: `${displayName}'s Space`,
            slug,
            type: "PERSONAL",
            ownerId: user.id,
            members: {
                create: {
                    userId: user.id,
                    role: "OWNER",
                },
            },
        },
    });

    await joinPublicChannelsForMember(db, organization.id, user.id, "OWNER");

    return organization;
}

export async function acceptPendingInvitesForUser(
    db: DbClient,
    user: { id: string; email?: string | null }
) {
    if (!user.email) return;

    const now = new Date();
    const invitations = await db.organizationInvitation.findMany({
        where: {
            email: user.email.toLowerCase().trim(),
            acceptedAt: null,
            expiresAt: { gt: now },
        },
    });

    for (const invitation of invitations) {
        const orgRole = invitation.scope === "PROJECT" ? "GUEST" : invitation.role;

        await db.organizationMember.upsert({
            where: {
                organizationId_userId: {
                    organizationId: invitation.organizationId,
                    userId: user.id,
                },
            },
            update: {},
            create: {
                organizationId: invitation.organizationId,
                userId: user.id,
                role: orgRole,
            },
        });

        await joinPublicChannelsForMember(db, invitation.organizationId, user.id, orgRole);

        if (invitation.scope === "PROJECT" && invitation.projectId) {
            await db.projectMember.upsert({
                where: {
                    projectId_userId: {
                        projectId: invitation.projectId,
                        userId: user.id,
                    },
                },
                update: {
                    role: invitation.projectRole ?? "EDITOR",
                },
                create: {
                    projectId: invitation.projectId,
                    userId: user.id,
                    role: invitation.projectRole ?? "EDITOR",
                },
            });
        }

        await db.organizationInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: now },
        });
    }
}

export async function acceptInviteByTokenForUser(
    db: DbClient,
    token: string,
    user: { id: string; email?: string | null; name?: string | null }
) {
    if (!user.email) {
        return { success: false, error: "Your account needs an email address to accept this invite." };
    }

    const invitation = await db.organizationInvitation.findUnique({
        where: { token },
        include: {
            organization: { select: { name: true } },
            project: { select: { name: true } },
        },
    });

    if (!invitation) {
        return { success: false, error: "This invite link is invalid." };
    }

    // Email invites are locked to their address; shareable links (email = null) accept anyone.
    const email = user.email.toLowerCase().trim();
    if (invitation.email && invitation.email !== email) {
        return { success: false, error: `This invite was sent to ${invitation.email}. Sign in with that email to accept it.` };
    }

    if (invitation.expiresAt <= new Date()) {
        return { success: false, error: "This invite link has expired." };
    }

    await ensurePersonalWorkspace(db, user);

    const orgRole = invitation.scope === "PROJECT" ? "GUEST" : invitation.role;

    await db.organizationMember.upsert({
        where: {
            organizationId_userId: {
                organizationId: invitation.organizationId,
                userId: user.id,
            },
        },
        update: {},
        create: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: orgRole,
        },
    });

    await joinPublicChannelsForMember(db, invitation.organizationId, user.id, orgRole);

    if (invitation.scope === "PROJECT" && invitation.projectId) {
        await db.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: invitation.projectId,
                    userId: user.id,
                },
            },
            update: {
                role: invitation.projectRole ?? "EDITOR",
            },
            create: {
                projectId: invitation.projectId,
                userId: user.id,
                role: invitation.projectRole ?? "EDITOR",
            },
        });
    }

    // Email invites are single-use; shareable links stay open for the next person.
    if (invitation.email && !invitation.acceptedAt) {
        await db.organizationInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
        });
    }

    return {
        success: true,
        workspaceName: invitation.organization.name,
        projectName: invitation.project?.name,
    };
}

export function selectCurrentMembership<T extends MembershipWithOrganization>(memberships: T[]) {
    return (
        memberships.find((membership) => membership.organization.type === "ORGANIZATION") ??
        memberships.find((membership) => membership.organization.type === "PERSONAL") ??
        memberships[0]
    );
}
