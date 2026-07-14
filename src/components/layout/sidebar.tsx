"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Settings,
    Users,
    BookOpen,
    Sun,
    TrendingUp,
    MessageSquare,
    Database,
    Trash2,
    PanelLeftClose,
    PanelLeft,
    Notebook,
} from "lucide-react";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { FavoritesSection } from "@/components/layout/favorites-section";
import { useDeleteProject } from "@/hooks/use-projects";
import { useChatUnreadCount } from "@/hooks/use-chat";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Project {
    id: string;
    name: string;
    _count?: { tasks: number };
    sprints?: { id: string; name: string }[];
}

interface SidebarProps {
    projects: Project[];
}

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string; // Blitzit chip color
    match?: (p: string | null) => boolean;
};

const PRIMARY: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, accent: "var(--bz-blue)", match: (p) => p === "/" },
    { href: "/my-day", label: "Today", icon: Sun, accent: "var(--bz-amber)" },
    { href: "/sprintboard", label: "Sprints", icon: LayoutDashboard, accent: "var(--bz-lime)" },
    { href: "/analytics", label: "Insights", icon: TrendingUp, accent: "var(--bz-peri)" },
];

const SECONDARY: NavItem[] = [
    { href: "/wiki", label: "Wiki", icon: BookOpen, accent: "var(--bz-mint)", match: (p) => !!p?.startsWith("/wiki") },
    { href: "/squads", label: "Squads", icon: Users, accent: "var(--bz-lime)", match: (p) => !!p?.startsWith("/squads") },
    { href: "/chat", label: "Chat", icon: MessageSquare, accent: "var(--bz-pink)" },
    { href: "/reflections", label: "Journal", icon: Notebook, accent: "var(--bz-amber)", match: (p) => !!p?.startsWith("/reflections") },
];

const UTILITY: NavItem[] = [
    { href: "/databases", label: "Collections", icon: Database, accent: "var(--bz-peri)", match: (p) => !!p?.startsWith("/databases") },
    { href: "/trash", label: "Trash", icon: Trash2, accent: "var(--bz-amber)", match: (p) => !!p?.startsWith("/trash") },
];

function NavRow({
    item,
    active,
    collapsed,
    badgeCount,
}: {
    item: NavItem;
    active: boolean;
    collapsed: boolean;
    badgeCount?: number;
}) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            prefetch={false}
            title={collapsed ? item.label : undefined}
            className={cn(
                "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all",
                "text-neutral-400 hover:text-white hover:bg-white/[0.04]",
                active && "text-white bg-white/[0.06]",
            )}
        >
            {/* Active accent bar */}
            <span
                aria-hidden
                className={cn(
                    "absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full transition-all",
                    active ? "w-[3px]" : "w-0 group-hover:w-[2px]",
                )}
                style={{ background: item.accent, boxShadow: active ? `0 0 12px ${item.accent}` : undefined }}
            />
            <span
                className="shrink-0"
                style={active ? { color: item.accent } : undefined}
            >
                <Icon className="h-[18px] w-[18px] transition-colors" />
            </span>
            {!collapsed && <span className="truncate font-medium tracking-tight">{item.label}</span>}
            {Boolean(badgeCount) && (
                <span
                    className={cn(
                        "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--bz-pink)] px-1.5 text-[10px] font-semibold text-white",
                        collapsed && "absolute right-1 top-1 h-4 min-w-4 px-1 text-[9px]",
                    )}
                >
                    {badgeCount && badgeCount > 99 ? "99+" : badgeCount}
                </span>
            )}
        </Link>
    );
}

export function Sidebar({ projects }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const deleteProject = useDeleteProject();
    const { data: chatUnreadCount = 0 } = useChatUnreadCount();
    const [collapsed, setCollapsed] = useState(false);

    const isActive = (item: NavItem) =>
        item.match ? item.match(pathname) : pathname === item.href;

    return (
        <aside
            className={cn(
                "flex h-full flex-col border-r border-[color:var(--border)] bg-[color:var(--sidebar)] transition-[width] duration-200",
                collapsed ? "w-[68px]" : "w-[244px]",
            )}
        >
            {/* Brand */}
            <div className="flex items-center justify-between px-3 pt-4 pb-3">
                <Link href="/" className="flex items-center gap-2.5 px-1.5">
                    <div
                        className="relative flex h-8 w-8 items-center justify-center rounded-[10px] text-white font-bold"
                        style={{
                            background: "linear-gradient(135deg, var(--bz-blue), #006bff)",
                            boxShadow: "0 4px 16px -4px rgba(0,153,255,0.55), inset 0 1px 0 rgba(255,255,255,0.2)",
                        }}
                    >
                        B
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[color:var(--bz-mint)] ring-2 ring-[color:var(--sidebar)]" />
                    </div>
                    {!collapsed && (
                        <div className="leading-none">
                            <div className="text-[15px] font-semibold tracking-tight text-white">Bie</div>
                            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                                Christex Foundation
                            </div>
                        </div>
                    )}
                </Link>
                <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    className="rounded-md p-1.5 text-neutral-500 hover:bg-white/[0.05] hover:text-white"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
            </div>

            <div className="bz-divider mx-3" />

            {/* Nav */}
            <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
                {!collapsed && (
                    <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                        Workspace
                    </div>
                )}
                <div className="space-y-0.5">
                    {PRIMARY.map((item) => (
                        <NavRow key={item.href} item={item} active={isActive(item)} collapsed={collapsed} />
                    ))}
                </div>

                <div className="mt-5">
                    {!collapsed && (
                        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                            Knowledge
                        </div>
                    )}
                    <div className="space-y-0.5">
                        {SECONDARY.map((item) => (
                            <NavRow
                                key={item.href}
                                item={item}
                                active={isActive(item)}
                                collapsed={collapsed}
                                badgeCount={item.href === "/chat" ? chatUnreadCount : undefined}
                            />
                        ))}
                    </div>
                </div>

                {!collapsed && (
                    <div className="mt-5">
                        <FavoritesSection />
                    </div>
                )}

                {/* Projects */}
                <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between px-2">
                        {!collapsed && (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                                Projects
                            </span>
                        )}
                        <ProjectDialog />
                    </div>
                    <div className="space-y-0.5">
                        {projects.map((project, idx) => {
                            const accent = [
                                "var(--bz-blue)",
                                "var(--bz-mint)",
                                "var(--bz-lime)",
                                "var(--bz-pink)",
                                "var(--bz-amber)",
                                "var(--bz-peri)",
                            ][idx % 6];
                            const active = pathname?.includes(project.id) ?? false;
                            return (
                                <div key={project.id} className="group/project relative">
                                    <Link
                                        href={`/projects/${project.id}`}
                                        prefetch={false}
                                        title={collapsed ? project.name : undefined}
                                        className={cn(
                                            "relative flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                                            "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                                            !collapsed && "pr-8",
                                            active && "bg-white/[0.06] text-white",
                                        )}
                                    >
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-[3px]"
                                            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                                        />
                                        {!collapsed && (
                                            <>
                                                <span className="flex-1 truncate font-medium">{project.name}</span>
                                                {project._count && (
                                                    <span className="mono text-[11px] text-neutral-500 transition-opacity group-hover/project:opacity-0">
                                                        {project._count.tasks}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Link>
                                    {!collapsed && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button
                                                    type="button"
                                                    title="Delete project"
                                                    aria-label={`Delete ${project.name}`}
                                                    disabled={deleteProject.isPending}
                                                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-opacity hover:bg-white/[0.05] hover:text-red-400 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-40 group-hover/project:opacity-100"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete project?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        &quot;{project.name}&quot; will be permanently deleted with its related data. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={async () => {
                                                            const result = await deleteProject.mutateAsync({ id: project.id });
                                                            if (result.success) {
                                                                if (active) router.push("/");
                                                                router.refresh();
                                                            }
                                                        }}
                                                        className="bg-red-600 text-white hover:bg-red-700"
                                                    >
                                                        Delete project
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            );
                        })}
                        {projects.length === 0 && !collapsed && (
                            <div className="px-2.5 py-2 text-[12px] text-neutral-600">
                                No projects yet
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-5">
                    {!collapsed && (
                        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                            More
                        </div>
                    )}
                    <div className="space-y-0.5">
                        {UTILITY.map((item) => (
                            <NavRow key={item.href} item={item} active={isActive(item)} collapsed={collapsed} />
                        ))}
                    </div>
                </div>
            </nav>

            <div className="bz-divider mx-3" />

            {/* Footer */}
            <div className="px-3 py-3">
                <Link
                    href="/settings"
                    prefetch={false}
                    title={collapsed ? "Settings" : undefined}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white",
                        pathname === "/settings" && "bg-white/[0.06] text-white",
                    )}
                >
                    <Settings className="h-[18px] w-[18px]" />
                    {!collapsed && <span className="font-medium">Settings</span>}
                </Link>
            </div>
        </aside>
    );
}
