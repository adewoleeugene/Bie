import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiPageView } from "@/components/wiki/wiki-page-view";
import { resolveInheritedAccess } from "@/lib/permissions";
import { loadPageAccessChain } from "@/lib/wiki-access";
import { AccessRequestStatus } from "@prisma/client";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ pageId: string }>;
}): Promise<Metadata> {
    const { pageId } = await params;
    const page = await db.wikiPage.findUnique({
        where: { id: pageId },
        select: { title: true },
    });
    return {
        title: page?.title ?? "Wiki Page",
    };
}

export default async function WikiPageDetail({
    params,
}: {
    params: Promise<{ pageId: string }>;
}) {
    const { pageId } = await params;
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    const me = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });
    if (!me || me.memberships.length === 0) {
        redirect("/login");
    }

    const page = await db.wikiPage.findUnique({
        where: { id: pageId },
        include: {
            author: true,
            versions: {
                include: {
                    editedBy: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: 20,
            },
            members: { select: { userId: true, role: true } },
        },
    });

    if (!page || page.deletedAt) {
        redirect("/wiki");
    }

    // Access inherits down the tree: a folder share cascades to its contents.
    const chain = await loadPageAccessChain(page.id);
    const access = resolveInheritedAccess(chain, {
        userId: me.id,
        organizationId: me.memberships[0].organizationId,
        orgRole: me.memberships[0].role,
    });

    // No access at all — bounce to the wiki home rather than leaking the page.
    if (access === "none") {
        redirect("/wiki");
    }

    const canEdit = access === "edit";
    let hasPendingRequest = false;
    if (!canEdit) {
        const existing = await db.wikiPageAccessRequest.findUnique({
            where: { pageId_userId: { pageId: page.id, userId: me.id } },
            select: { status: true },
        });
        hasPendingRequest = existing?.status === AccessRequestStatus.PENDING;
    }

    // `members` was only needed for the access check; strip it so the object
    // matches WikiPageView's expected shape.
    const { members: _members, ...pageForView } = page;

    return (
        <WikiPageView
            page={pageForView}
            canEdit={canEdit}
            hasPendingRequest={hasPendingRequest}
        />
    );
}
