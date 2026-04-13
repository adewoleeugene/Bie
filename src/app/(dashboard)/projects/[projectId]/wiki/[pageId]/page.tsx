import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WikiPageView } from "@/components/wiki/wiki-page-view";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ projectId: string; pageId: string }>;
}): Promise<Metadata> {
    const { pageId } = await params;
    const page = await db.wikiPage.findUnique({
        where: { id: pageId },
        select: { title: true },
    });
    return { title: page?.title ?? "Wiki Page" };
}

export default async function ProjectWikiPageDetail({
    params,
}: {
    params: Promise<{ projectId: string; pageId: string }>;
}) {
    const { projectId, pageId } = await params;
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

    if (!page || page.projectId !== projectId) {
        redirect(`/projects/${projectId}/wiki`);
    }

    return <WikiPageView page={page} />;
}
