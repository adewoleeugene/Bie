"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, LayoutDashboard, Settings, Users } from "lucide-react";

interface Project {
    id: string;
    name: string;
    _count?: {
        tasks: number;
    };
    sprints?: { id: string; name: string }[];
}

interface SidebarProps {
    projects: Project[];
}

export function Sidebar({ projects }: SidebarProps) {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-64 flex-col border-r bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="p-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900">
                        <span className="text-lg font-bold">C</span>
                    </div>
                    <span className="text-xl font-bold">ChristBase</span>
                </Link>
            </div>

            <Separator />

            <nav className="flex-1 space-y-1 p-4">
                <Link href="/">
                    <Button
                        variant={pathname === "/" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                    >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </Button>
                </Link>

                <Link href="/squads">
                    <Button
                        variant={pathname === "/squads" || pathname?.startsWith("/squads/") ? "secondary" : "ghost"}
                        className="w-full justify-start"
                    >
                        <Users className="mr-2 h-4 w-4" />
                        Squads
                    </Button>
                </Link>

                <div className="pt-4">
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Projects
                    </h3>
                    <div className="space-y-1">
                        {projects.map((project) => {
                            const isActive = pathname?.includes(project.id);
                            return (
                                <div key={project.id} className="space-y-1">
                                    <Link href={`/projects/${project.id}`}>
                                        <Button
                                            variant={isActive ? "secondary" : "ghost"}
                                            className="w-full justify-start"
                                        >
                                            <FolderKanban className="mr-2 h-4 w-4" />
                                            <span className="flex-1 truncate text-left">
                                                {project.name}
                                            </span>
                                            {project._count && (
                                                <span className="text-xs text-neutral-500">
                                                    {project._count.tasks}
                                                </span>
                                            )}
                                        </Button>
                                    </Link>
                                    {isActive && (
                                        <div className="ml-4 space-y-1 border-l pl-2">
                                            <Link href={`/projects/${project.id}/board`}>
                                                <Button
                                                    variant={pathname?.includes("/board") ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className="h-8 w-full justify-start text-xs font-normal"
                                                >
                                                    Board
                                                </Button>
                                            </Link>
                                            <Link href={`/projects/${project.id}/table`}>
                                                <Button
                                                    variant={pathname?.includes("/table") ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className="h-8 w-full justify-start text-xs font-normal"
                                                >
                                                    Table
                                                </Button>
                                            </Link>
                                            <Link href={`/projects/${project.id}/sprints`}>
                                                <Button
                                                    variant={pathname?.includes("/sprints") ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className="h-8 w-full justify-start text-xs font-normal"
                                                >
                                                    <span className="flex-1 text-left">Sprints</span>
                                                    {project.sprints && project.sprints.length > 0 && (
                                                        <Badge variant="default" className="ml-2 h-4 px-1 text-[10px]">
                                                            Active
                                                        </Badge>
                                                    )}
                                                </Button>
                                            </Link>
                                            <Link href={`/projects/${project.id}/backlog`}>
                                                <Button
                                                    variant={pathname?.includes("/backlog") ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className="h-8 w-full justify-start text-xs font-normal"
                                                >
                                                    Backlog
                                                </Button>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <Separator />

            <div className="p-4">
                <Link href="/settings">
                    <Button
                        variant={pathname === "/settings" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </Link>
            </div>
        </div>
    );
}
