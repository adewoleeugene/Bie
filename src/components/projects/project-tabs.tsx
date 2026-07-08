"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Table, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectInviteDialog } from "@/components/projects/project-invite-dialog";

interface ProjectTabsProps {
    projectId: string;
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
    const pathname = usePathname();

    const tabs = [
        { label: "Overview", icon: Info, href: `/projects/${projectId}`, active: pathname === `/projects/${projectId}` },
        { label: "Board", icon: LayoutGrid, href: `/projects/${projectId}/board`, active: !!pathname?.includes("/board") },
        { label: "Table", icon: Table, href: `/projects/${projectId}/table`, active: !!pathname?.includes("/table") },
    ];

    return (
        <div className="border-b bg-background px-6 py-3">
            <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                aria-current={tab.active ? "page" : undefined}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                    tab.active
                                        ? "bg-accent text-accent-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>
                <ProjectInviteDialog projectId={projectId} />
            </div>
        </div>
    );
}
