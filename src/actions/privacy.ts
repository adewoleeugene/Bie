"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { OrgRole } from "@prisma/client";
import { z } from "zod";
import type { ActionResult } from "@/types";
import { activeMembership } from "@/lib/user-organization";

const privacyRequestSchema = z.object({
    kind: z.enum(["EXPORT", "DELETION"]),
    details: z.string().trim().max(2000).optional().default(""),
});

type PrivacyRequestKind = z.infer<typeof privacyRequestSchema>["kind"];

export interface PrivacyRequestListItem {
    id: string;
    kind: PrivacyRequestKind;
    status: string;
    details: string | null;
    createdAt: string;
    completedAt: string | null;
}

export interface OrganizationPrivacyRequestItem extends PrivacyRequestListItem {
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
}

async function getCurrentUserContext() {
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
                orderBy: {
                    joinedAt: "asc",
                },
            },
        },
    });

    if (!user || user.memberships.length === 0) {
        throw new Error("No organization found");
    }

    return {
        user,
        primaryOrganizationId: (await activeMembership(user.memberships)).organizationId,
        organizationIds: user.memberships.map((membership) => membership.organizationId),
        primaryRole: (await activeMembership(user.memberships)).role,
    };
}

export async function getPrivacyRequests(): Promise<PrivacyRequestListItem[]> {
    try {
        const { user } = await getCurrentUserContext();
        const requests = await db.privacyRequest.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        return requests.map((request) => ({
            id: request.id,
            kind: request.kind as PrivacyRequestKind,
            status: request.status,
            details: request.details,
            createdAt: request.createdAt.toISOString(),
            completedAt: request.completedAt?.toISOString() ?? null,
        }));
    } catch (error) {
        console.error("Get privacy requests error:", error);
        return [];
    }
}

export async function createPrivacyRequest(input: {
    kind: PrivacyRequestKind;
    details?: string;
}): Promise<ActionResult<{ id: string }>> {
    try {
        const validated = privacyRequestSchema.parse(input);
        const { user, primaryOrganizationId } = await getCurrentUserContext();

        const request = await db.privacyRequest.create({
            data: {
                userId: user.id,
                organizationId: primaryOrganizationId,
                kind: validated.kind,
                details: validated.details || null,
            },
        });

        const subject =
            validated.kind === "DELETION"
                ? "ChristBase account deletion request"
                : "ChristBase data export request";
        const lines = [
            `User: ${user.name} <${user.email}>`,
            `Organization: ${(await activeMembership(user.memberships))?.organization.name || "Unknown"}`,
            `Request type: ${validated.kind}`,
            `Request ID: ${request.id}`,
            validated.details ? "" : null,
            validated.details ? "Details:" : null,
            validated.details || null,
        ].filter(Boolean) as string[];

        await sendEmail({
            to: "privacy@christex.foundation",
            subject,
            text: lines.join("\n"),
            html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
        });

        revalidatePath("/settings");
        return { success: true, data: { id: request.id } };
    } catch (error) {
        console.error("Create privacy request error:", error);
        return { success: false, error: "Failed to submit privacy request" };
    }
}

export async function getOrganizationPrivacyRequests(): Promise<OrganizationPrivacyRequestItem[]> {
    try {
        const { primaryOrganizationId, primaryRole } = await getCurrentUserContext();
        if (primaryRole !== OrgRole.OWNER && primaryRole !== OrgRole.ADMIN) {
            return [];
        }

        const requests = await db.privacyRequest.findMany({
            where: { organizationId: primaryOrganizationId },
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
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return requests.map((request) => ({
            id: request.id,
            kind: request.kind as PrivacyRequestKind,
            status: request.status,
            details: request.details,
            createdAt: request.createdAt.toISOString(),
            completedAt: request.completedAt?.toISOString() ?? null,
            user: {
                id: request.user.id,
                name: request.user.name,
                email: request.user.email,
                image: request.user.image,
            },
        }));
    } catch (error) {
        console.error("Get organization privacy requests error:", error);
        return [];
    }
}

export async function updatePrivacyRequestStatus(input: {
    requestId: string;
    status: "PENDING" | "IN_REVIEW" | "COMPLETED";
}): Promise<ActionResult> {
    try {
        const { primaryOrganizationId, primaryRole } = await getCurrentUserContext();
        if (primaryRole !== OrgRole.OWNER && primaryRole !== OrgRole.ADMIN) {
            return { success: false, error: "Only owners and admins can update privacy requests" };
        }

        const existing = await db.privacyRequest.findFirst({
            where: {
                id: input.requestId,
                organizationId: primaryOrganizationId,
            },
            select: { id: true },
        });

        if (!existing) {
            return { success: false, error: "Privacy request not found" };
        }

        await db.privacyRequest.update({
            where: { id: input.requestId },
            data: {
                status: input.status,
                completedAt: input.status === "COMPLETED" ? new Date() : null,
            },
        });

        revalidatePath("/settings");
        return { success: true, data: undefined };
    } catch (error) {
        console.error("Update privacy request status error:", error);
        return { success: false, error: "Failed to update privacy request status" };
    }
}

export async function exportPersonalData(): Promise<
    ActionResult<{ filename: string; payload: unknown }>
> {
    try {
        const { user, organizationIds } = await getCurrentUserContext();

        const [
            notificationPreferences,
            favorites,
            recentItems,
            reflections,
            focusSessions,
            timeEntries,
            assignedTasks,
            comments,
            wikiPages,
            wikiPageMemberships,
            databaseMemberships,
            attachments,
            messages,
            assistantMessages,
            privacyRequests,
        ] = await Promise.all([
            db.notificationPreference.findMany({
                where: { userId: user.id, organizationId: { in: organizationIds } },
                orderBy: [{ organizationId: "asc" }, { type: "asc" }],
            }),
            db.favorite.findMany({
                where: { userId: user.id, organizationId: { in: organizationIds } },
                orderBy: { createdAt: "desc" },
            }),
            db.recentItem.findMany({
                where: { userId: user.id, organizationId: { in: organizationIds } },
                orderBy: { visitedAt: "desc" },
                take: 200,
            }),
            db.dailyReflection.findMany({
                where: { userId: user.id, organizationId: { in: organizationIds } },
                orderBy: { date: "desc" },
            }),
            db.focusSession.findMany({
                where: { userId: user.id },
                include: {
                    task: {
                        select: { id: true, title: true, organizationId: true, projectId: true },
                    },
                },
                orderBy: { startedAt: "desc" },
            }),
            db.timeEntry.findMany({
                where: { userId: user.id },
                include: {
                    task: {
                        select: { id: true, title: true, organizationId: true, projectId: true },
                    },
                },
                orderBy: { startedAt: "desc" },
            }),
            db.taskAssignee.findMany({
                where: {
                    userId: user.id,
                    task: {
                        organizationId: { in: organizationIds },
                    },
                },
                include: {
                    task: {
                        include: {
                            project: { select: { id: true, name: true } },
                            sprint: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { assignedAt: "desc" },
            }),
            db.comment.findMany({
                where: {
                    authorId: user.id,
                    task: {
                        organizationId: { in: organizationIds },
                    },
                },
                include: {
                    task: {
                        select: { id: true, title: true, organizationId: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            db.wikiPage.findMany({
                where: {
                    authorId: user.id,
                    organizationId: { in: organizationIds },
                },
                select: {
                    id: true,
                    title: true,
                    namespace: true,
                    organizationId: true,
                    projectId: true,
                    published: true,
                    slug: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
            }),
            db.wikiPageMember.findMany({
                where: { userId: user.id },
                include: {
                    page: {
                        select: {
                            id: true,
                            title: true,
                            organizationId: true,
                            projectId: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            db.wikiDatabaseMember.findMany({
                where: { userId: user.id },
                include: {
                    database: {
                        select: {
                            id: true,
                            name: true,
                            organizationId: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            db.attachment.findMany({
                where: {
                    uploaderId: user.id,
                    organizationId: { in: organizationIds },
                },
                orderBy: { createdAt: "desc" },
            }),
            db.message.findMany({
                where: {
                    senderId: user.id,
                    conversation: {
                        organizationId: { in: organizationIds },
                    },
                },
                include: {
                    conversation: {
                        select: { id: true, name: true, organizationId: true, isGroup: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            db.assistantMessage.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
            }),
            db.privacyRequest.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
            },
            memberships: user.memberships.map((membership) => ({
                organizationId: membership.organizationId,
                organizationName: membership.organization.name,
                organizationSlug: membership.organization.slug,
                role: membership.role,
                joinedAt: membership.joinedAt.toISOString(),
            })),
            notificationPreferences,
            favorites,
            recentItems,
            reflections,
            focusSessions,
            timeEntries,
            assignedTasks: assignedTasks.map((record) => ({
                assignedAt: record.assignedAt.toISOString(),
                task: record.task,
            })),
            comments,
            wikiPages,
            wikiPageMemberships,
            databaseMemberships,
            attachments,
            messages,
            assistantMessages,
            privacyRequests,
        };

        const safeDate = new Date().toISOString().slice(0, 10);
        return {
            success: true,
            data: {
                filename: `christbase-personal-export-${safeDate}.json`,
                payload,
            },
        };
    } catch (error) {
        console.error("Export personal data error:", error);
        return { success: false, error: "Failed to export personal data" };
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
