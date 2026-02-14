import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WikiNamespace } from "@prisma/client";

export default async function PublishedWikiPage() {
    // Find organization by slug
    const organization = await db.organization.findUnique({
        where: { slug: "christex" },
    });

    if (!organization) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Organization Not Found</h1>
                    <p className="text-muted-foreground">
                        The ChristBase wiki is currently unconfigured.
                    </p>
                </div>
            </div>
        );
    }

    // Get the first wiki page or redirect to create one
    const firstPage = await db.wikiPage.findFirst({
        where: {
            organizationId: organization.id,
            namespace: WikiNamespace.COMPANY,
            parentPageId: null,
            published: true,
        } as any,
        orderBy: {
            sortOrder: "asc",
        },
    });

    if (firstPage) {
        redirect(`/published-wiki/${firstPage.id}`);
    }

    // No pages yet, show empty state
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold">Welcome to the ChristBase Wiki</h1>
                <p className="text-muted-foreground">
                    There are no published pages yet.
                </p>
            </div>
        </div>
    );
}
