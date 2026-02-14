import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";
import { WikiNamespace } from "@prisma/client";

export default async function ProjectWikiLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;
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

    const organizationId = user.memberships[0].organizationId;

    const pages = await db.wikiPage.findMany({
        where: {
            organizationId,
            namespace: WikiNamespace.PROJECT,
            projectId: projectId,
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
                projectId={projectId}
                basePath={`/projects/${projectId}/wiki`}
            />
            <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        </div>
    );
}
