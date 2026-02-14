import { Inter } from "next/font/google";
import { db } from "@/lib/db";
import { WikiNamespace } from "@prisma/client";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";
import { PublicWikiSearch } from "@/components/wiki/public-wiki-search";
import "../globals.css";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "ChristBase Wiki",
    description: "Published documentation and wiki for ChristBase",
};

export default async function PublishedWikiLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const organization = await db.organization.findUnique({
        where: { slug: "christex" },
    });

    if (!organization) {
        return (
            <div className={`min-h-screen bg-background font-sans antialiased ${inter.className} flex items-center justify-center`}>
                <div className="text-center">Organization not configured.</div>
            </div>
        );
    }

    const pages = await db.wikiPage.findMany({
        where: {
            organizationId: organization.id,
            namespace: WikiNamespace.COMPANY,
            published: true,
        } as any,
        include: {
            author: true,
        },
        orderBy: [{ parentPageId: "asc" }, { sortOrder: "asc" }],
    });

    return (
        <div className={`min-h-screen bg-background font-sans antialiased ${inter.className} flex flex-col selection:bg-primary/10`}>
            {/* Glassmorphism Header */}
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {organization.logoUrl ? (
                        <div className="relative h-8 w-8 rounded-lg overflow-hidden border">
                            <Image
                                src={organization.logoUrl}
                                alt={organization.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {organization.name.charAt(0)}
                        </div>
                    )}
                    <div className="font-semibold text-lg tracking-tight">{organization.name} Wiki</div>
                </div>

                <div className="flex items-center gap-4">
                    <PublicWikiSearch organizationId={organization.id} />
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <aside className="hidden md:block w-70 border-r bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="h-full overflow-y-auto">
                        <WikiSidebar
                            pages={pages as any}
                            organizationId={organization.id}
                            basePath="/published-wiki"
                            readOnly={true}
                        />
                    </div>
                </aside>

                <main className="flex-1 overflow-auto bg-background relative">
                    <div className="max-w-4xl mx-auto min-h-full flex flex-col">
                        <div className="flex-1 p-8 lg:p-12">
                            {children}
                        </div>

                        {/* Powered by Footer */}
                        <footer className="mt-auto border-t py-8 px-12 opacity-50 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 text-sm">
                                <span>Powered by</span>
                                <span className="font-bold tracking-tight">ChristBase</span>
                            </div>
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
