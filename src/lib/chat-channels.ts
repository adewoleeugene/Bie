import { ConversationType, OrgRole, Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function ensureGeneralChannel(
    db: DbClient,
    organizationId: string,
    createdById?: string | null,
) {
    const existing = await db.conversation.findFirst({
        where: {
            organizationId,
            type: ConversationType.CHANNEL,
            name: "general",
            isPrivate: false,
        },
        select: { id: true },
    });

    if (existing) return existing;

    return db.conversation.create({
        data: {
            type: ConversationType.CHANNEL,
            name: "general",
            topic: "Workspace-wide conversation",
            isPrivate: false,
            organizationId,
            createdById: createdById ?? null,
        },
        select: { id: true },
    });
}

export async function joinPublicChannelsForMember(
    db: DbClient,
    organizationId: string,
    userId: string,
    role: OrgRole | string,
) {
    if (role === OrgRole.GUEST || role === "GUEST") return;

    await ensureGeneralChannel(db, organizationId, userId);

    const publicChannels = await db.conversation.findMany({
        where: {
            organizationId,
            type: ConversationType.CHANNEL,
            isPrivate: false,
            archived: false,
        },
        select: { id: true },
    });

    await Promise.all(
        publicChannels.map((channel) =>
            db.conversationMember.upsert({
                where: {
                    conversationId_userId: {
                        conversationId: channel.id,
                        userId,
                    },
                },
                update: {},
                create: {
                    conversationId: channel.id,
                    userId,
                },
            }),
        ),
    );
}

export async function joinPublicChannelsForExistingMembers(db: DbClient, organizationId: string) {
    const members = await db.organizationMember.findMany({
        where: {
            organizationId,
            role: { not: OrgRole.GUEST },
        },
        select: { userId: true, role: true },
    });

    const creator = members[0]?.userId ?? null;
    await ensureGeneralChannel(db, organizationId, creator);

    const publicChannels = await db.conversation.findMany({
        where: {
            organizationId,
            type: ConversationType.CHANNEL,
            isPrivate: false,
            archived: false,
        },
        select: { id: true },
    });

    await Promise.all(
        publicChannels.flatMap((channel) =>
            members.map((member) =>
                db.conversationMember.upsert({
                    where: {
                        conversationId_userId: {
                            conversationId: channel.id,
                            userId: member.userId,
                        },
                    },
                    update: {},
                    create: {
                        conversationId: channel.id,
                        userId: member.userId,
                    },
                }),
            ),
        ),
    );

    return publicChannels;
}

export const joinGeneralChannelForMember = joinPublicChannelsForMember;
export const joinGeneralChannelsForExistingMembers = joinPublicChannelsForExistingMembers;
