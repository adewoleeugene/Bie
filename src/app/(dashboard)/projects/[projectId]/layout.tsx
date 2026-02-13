"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProjectLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const projectId = params.projectId as string;

    const isBoard = pathname?.includes("/board");
    const isTable = pathname?.includes("/table");

    return (
        <div className="flex h-full flex-col">
            <div className="border-b bg-white px-6 py-3 dark:bg-neutral-950">
                <div className="flex items-center gap-2">
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
            <div className="flex-1 overflow-hidden">{children}</div>
        </div>
    );
}
