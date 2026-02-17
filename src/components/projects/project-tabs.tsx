"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTabsProps {
    projectId: string;
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
    const pathname = usePathname();
    const isOverview = pathname === `/projects/${projectId}`;
    const isBoard = pathname?.includes("/board");
    const isTable = pathname?.includes("/table");

    return (
        <div className="border-b bg-white px-6 py-3 dark:bg-neutral-950">
            <div className="flex items-center gap-2">
                <Link href={`/projects/${projectId}`}>
                    <Button
                        variant={isOverview ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(isOverview && "bg-neutral-100")}
                    >
                        <Info className="mr-2 h-4 w-4" />
                        Overview
                    </Button>
                </Link>
                <Link href={`/projects/${projectId}/board`}>
                    <Button
                        variant={isBoard ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(isBoard && "bg-neutral-100")}
                    >
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        Board
                    </Button>
                </Link>
                <Link href={`/projects/${projectId}/table`}>
                    <Button
                        variant={isTable ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(isTable && "bg-neutral-100")}
                    >
                        <Table className="mr-2 h-4 w-4" />
                        Table
                    </Button>
                </Link>
            </div>
        </div>
    );
}
