import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";
import { WikiNamespace } from "@prisma/client";
import { activeMembership } from "@/lib/user-organization";

export const metadata: Metadata = {
    title: "Wiki",
    description: "Company knowledge base and documentation",
};

export default async function WikiLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
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
        redirect("/login");
    }

    const organizationId = (await activeMembership(user.memberships)).organizationId;

    const pages = await db.wikiPage.findMany({
        where: {
            organizationId,
            namespace: WikiNamespace.COMPANY,
            deletedAt: null,
        },
        include: {
            author: true,
        },
        orderBy: [{ parentPageId: "asc" }, { sortOrder: "asc" }],
    });

    return (
        <div className="flex h-full">
            <WikiSidebar
                pages={pages}
                organizationId={organizationId}
                basePath="/wiki"
            />
            <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        </div>
    );
}
