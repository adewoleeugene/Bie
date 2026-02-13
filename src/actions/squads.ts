"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionResult } from "@/types";
import {
    createSquadSchema,
    updateSquadSchema,
    deleteSquadSchema,
    CreateSquadInput,
    UpdateSquadInput,
    DeleteSquadInput,
} from "@/lib/validators/squad";
import { Squad } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Helper to get user's organization
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

export async function createSquad(
    input: CreateSquadInput
): Promise<ActionResult<Squad>> {
    try {
        const validated = createSquadSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        const squad = await db.squad.create({
            data: {
                name: validated.name,
                description: validated.description,
                organizationId,
                members: {
                    create: validated.memberIds.map((userId) => ({
                        userId,
                    })),
                },
            },
            include: {
                members: {
                    include: {
                        user: true,
                    },
                },
                _count: {
                    select: { projects: true },
                },
            },
        });

        revalidatePath("/squads");
        return { success: true, data: squad };
    } catch (error) {
        console.error("Create squad error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create squad",
        };
    }
}

export async function updateSquad(
    input: UpdateSquadInput
): Promise<ActionResult<Squad>> {
    try {
        const validated = updateSquadSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        // Verify squad belongs to organization
        const existingSquad = await db.squad.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingSquad) {
            return { success: false, error: "Squad not found" };
        }

        // Handle members update if provided
        if (validated.memberIds) {
            // Transaction to update members
            await db.$transaction(async (tx) => {
                // Delete existing members
                await tx.squadMember.deleteMany({
                    where: { squadId: validated.id },
                });

                // Add new members
                if (validated.memberIds && validated.memberIds.length > 0) {
                    await tx.squadMember.createMany({
                        data: validated.memberIds.map((userId) => ({
                            squadId: validated.id,
                            userId,
                        })),
                    });
                }
            });
        }

        const squad = await db.squad.update({
            where: { id: validated.id },
            data: {
                name: validated.name,
                description: validated.description,
            },
            include: {
                members: {
                    include: {
                        user: true,
                    },
                },
                _count: {
                    select: { projects: true },
                },
            },
        });

        revalidatePath("/squads");
        revalidatePath(`/squads/${validated.id}`);
        return { success: true, data: squad };
    } catch (error) {
        console.error("Update squad error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update squad",
        };
    }
}

export async function deleteSquad(
    input: DeleteSquadInput
): Promise<ActionResult> {
    try {
        const validated = deleteSquadSchema.parse(input);
        const { organizationId } = await getUserOrganization();

        const existingSquad = await db.squad.findFirst({
            where: {
                id: validated.id,
                organizationId,
            },
        });

        if (!existingSquad) {
            return { success: false, error: "Squad not found" };
        }

        await db.squad.delete({
            where: { id: validated.id },
        });

        revalidatePath("/squads");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Delete squad error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete squad",
        };
    }
}

export async function getSquads() {
    try {
        const { organizationId } = await getUserOrganization();

        const squads = await db.squad.findMany({
            where: {
                organizationId,
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                email: true,
                            },
                        },
                    },
                },
                _count: {
                    select: { projects: true },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        return squads;
    } catch (error) {
        console.error("Get squads error:", error);
        return [];
    }
}

export async function getSquad(id: string) {
    try {
        const { organizationId } = await getUserOrganization();

        const squad = await db.squad.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                email: true,
                            },
                        },
                    },
                },
                projects: {
                    include: {
                        lead: {
                            select: {
                                id: true,
                                name: true,
                                image: true
                            }
                        },
                        _count: {
                            select: { tasks: true }
                        }
                    }
                }
            },
        });

        return squad;
    } catch (error) {
        console.error("Get squad error:", error);
        return null;
    }
}
