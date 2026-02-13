"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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
