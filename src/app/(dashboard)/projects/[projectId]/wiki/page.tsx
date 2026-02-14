import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiNamespace } from "@prisma/client";

export default async function ProjectWikiIndex({
    params,
}: {
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

    // Get the first wiki page or redirect to create one
    const firstPage = await db.wikiPage.findFirst({
        where: {
            organizationId,
            namespace: WikiNamespace.PROJECT,
            projectId: projectId,
            parentPageId: null,
        },
        orderBy: {
            sortOrder: "asc",
        },
    });

    if (firstPage) {
        redirect(`/projects/${projectId}/wiki/${firstPage.id}`);
    }

    // No pages yet, show empty state
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold">Project Wiki</h1>
                <p className="text-muted-foreground">
                    Create pages to document your project
                </p>
            </div>
        </div>
    );
}
