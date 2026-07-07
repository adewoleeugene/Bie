import { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

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

    return db.organization.create({
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
