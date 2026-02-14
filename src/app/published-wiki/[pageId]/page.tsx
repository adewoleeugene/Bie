import { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WikiPageView } from "@/components/wiki/wiki-page-view";

interface PageProps {
    params: Promise<{ pageId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { pageId } = await params;
    const page = await db.wikiPage.findUnique({
        where: { id: pageId },
        select: { title: true },
    });

    if (!page) return { title: "Wiki Page" };

    return {
        title: `${page.title} | ChristBase Wiki`,
        description: `View ${page.title} on ChristBase Wiki`,
    };
}

export default async function PublishedWikiPageDetail({ params }: PageProps) {
    const { pageId } = await params;

    const page = await db.wikiPage.findFirst({
        where: {
            id: pageId,
            published: true,
        } as any,
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
        redirect("/published-wiki");
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <WikiPageView page={page as any} readOnly={true} />
        </div>
    );
}
