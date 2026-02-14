import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiPageView } from "@/components/wiki/wiki-page-view";

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
        },
    });

    if (!page) {
        redirect("/wiki");
    }

    return <WikiPageView page={page} />;
}
