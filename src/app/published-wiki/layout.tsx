import { Inter } from "next/font/google";
import { db } from "@/lib/db";
import { WikiNamespace } from "@prisma/client";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";
import { PublicWikiSearch } from "@/components/wiki/public-wiki-search";
import "../globals.css";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "Knowledge Base",
    description: "Documentation and help center",
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
        },
        include: {
            author: true,
        },
        orderBy: [{ parentPageId: "asc" }, { sortOrder: "asc" }],
    });

    return (
        <div className={`min-h-screen bg-background font-sans antialiased ${inter.className} flex flex-col selection:bg-primary/10`}>
            {/* Header */}
            <header className="sticky top-0 z-50 border-b bg-background/60 backdrop-blur-xl px-6 lg:px-10 py-3 flex items-center justify-between shrink-0">
                <Link href="/published-wiki" className="flex items-center gap-3 group transition-opacity hover:opacity-80">
                    {organization.logoUrl ? (
                        <div className="relative h-9 w-9 rounded-xl overflow-hidden border shadow-sm group-hover:shadow-md transition-shadow">
                            <Image
                                src={organization.logoUrl}
                                alt={organization.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-sm">
                            {organization.name.charAt(0)}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-bold text-base tracking-tight leading-none">{organization.name}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black opacity-60">Knowledge Base</span>
                    </div>
                </Link>

                <div className="flex items-center gap-6">
                    <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
                        <Link href="/published-wiki" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
                    </nav>
                    <div className="h-4 w-px bg-border hidden md:block" />
                    <PublicWikiSearch organizationId={organization.id} />
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <aside className="hidden md:block w-72 border-r bg-muted/20">
                    <div className="h-full overflow-y-auto py-6">
                        <WikiSidebar
                            pages={pages as any}
                            organizationId={organization.id}
                            basePath="/published-wiki"
                            readOnly={true}
                        />
                    </div>
                </aside>

                <main className="flex-1 overflow-auto bg-background relative flex flex-col">
                    <div className="flex-1">
                        {children}
                    </div>

                    {/* Footer */}
                    <footer className="mt-auto border-t py-12 px-8 lg:px-16 bg-muted/10">
                        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center font-bold text-xs">
                                    {organization.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold tracking-tight">© {new Date().getFullYear()} {organization.name}</span>
                                    <span className="text-[10px] uppercase font-black tracking-widest opacity-50">All rights reserved</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs font-medium">
                                <span>Powered by</span>
                                <span className="font-black tracking-tighter text-base">Bie</span>
                            </div>
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    );
}
