"use client";

import Link from "next/link";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { Skeleton } from "@/components/ui/skeleton";
import {
    CheckCircle2,
    Circle,
    Clock,
    FolderKanban,
    ArrowUpRight,
    Zap,
    BookOpen,
} from "lucide-react";

type StatTileProps = {
    label: string;
    value: number;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
};

function StatTile({ label, value, href, icon: Icon, accent }: StatTileProps) {
    return (
        <Link
            href={href}
            className="bz-card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5"
            style={{ borderColor: "var(--border)" }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-[0.10] blur-2xl transition-opacity group-hover:opacity-[0.18]"
                style={{ background: accent }}
            />
            <div className="flex items-start justify-between">
                <div>
                    <div
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: accent }}
                    >
                        {label}
                    </div>
                    <div className="mono mt-2 text-[34px] font-semibold leading-none text-white">
                        {value}
                    </div>
                </div>
                <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                        background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                        border: `1px solid color-mix(in oklab, ${accent} 30%, transparent)`,
                        color: accent,
                    }}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[11px] text-neutral-500 transition-colors group-hover:text-white">
                View
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
        </Link>
    );
}

type QuickActionProps = {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    description: string;
};

function QuickAction({ label, href, icon: Icon, accent, description }: QuickActionProps) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-4 rounded-lg border border-[color:var(--border)] bg-white/[0.015] p-4 transition-all hover:bg-white/[0.04]"
        >
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                    background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                    border: `1px solid color-mix(in oklab, ${accent} 30%, transparent)`,
                    color: accent,
                }}
            >
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white">{label}</div>
                <div className="text-[11px] text-neutral-500">{description}</div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-neutral-600 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
        </Link>
    );
}

export function DashboardView() {
    const { data: tasks, isLoading: tasksLoading } = useTasks();
    const { data: projects, isLoading: projectsLoading } = useProjects();

    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    const isLoading = tasksLoading || projectsLoading;

    const stats = {
        totalTasks: tasks?.length ?? 0,
        completedTasks: (tasks ?? []).filter((t: any) => t.status === "DONE").length,
        inProgress: (tasks ?? []).filter((t: any) => t.status === "IN_PROGRESS").length,
        totalProjects: projects?.length ?? 0,
    };

    return (
        <div className="mx-auto max-w-6xl space-y-10 p-10">
            {/* Header */}
            <header>
                <div className="mono mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    {today}
                </div>
                <h1 className="text-[40px] font-semibold leading-none tracking-tight text-white">
                    Dashboard.
                </h1>
                <p className="mt-3 max-w-md text-sm text-neutral-500">
                    Welcome back. Here&apos;s the state of your workspace.
                </p>
            </header>

            {/* Stats — clickable */}
            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-[132px] rounded-xl bg-white/[0.04]" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Total tasks"
                        value={stats.totalTasks}
                        href="/sprintboard"
                        icon={Circle}
                        accent="var(--bz-blue)"
                    />
                    <StatTile
                        label="In progress"
                        value={stats.inProgress}
                        href="/sprintboard"
                        icon={Clock}
                        accent="var(--bz-amber)"
                    />
                    <StatTile
                        label="Completed"
                        value={stats.completedTasks}
                        href="/my-day"
                        icon={CheckCircle2}
                        accent="var(--bz-green)"
                    />
                    <StatTile
                        label="Projects"
                        value={stats.totalProjects}
                        href="/sprintboard"
                        icon={FolderKanban}
                        accent="var(--bz-pink)"
                    />
                </div>
            )}

            {/* Quick actions */}
            <section>
                <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        Quick actions
                    </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <QuickAction
                        label="Plan today"
                        description="Pick the tasks that matter."
                        href="/my-day"
                        icon={CheckCircle2}
                        accent="var(--bz-blue)"
                    />
                    <QuickAction
                        label="Start a focus session"
                        description="25-minute Pomodoro, distraction-free."
                        href="/my-day"
                        icon={Zap}
                        accent="var(--bz-pink)"
                    />
                    <QuickAction
                        label="Open sprint board"
                        description="See what your squad is shipping."
                        href="/sprintboard"
                        icon={FolderKanban}
                        accent="var(--bz-lime)"
                    />
                    <QuickAction
                        label="Browse the wiki"
                        description="Find docs, decisions, runbooks."
                        href="/wiki"
                        icon={BookOpen}
                        accent="var(--bz-mint)"
                    />
                </div>
            </section>
        </div>
    );
}
