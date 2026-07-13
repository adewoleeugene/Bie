"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import {
    TrendingUp,
    Calendar,
    ChevronDown,
    Flame,
    Target,
    Timer,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { DateRangePicker } from "@/components/analytics/date-range-picker";
import { ExportButton } from "@/components/analytics/export-button";
import { ReportBuilder } from "@/components/analytics/report-builder";
import {
    useOverviewMetrics,
    useTaskCompletionTrend,
    useStatusDistribution,
    useSprintVelocity,
    useTeamProductivity,
    useProjectProgress,
} from "@/hooks/use-analytics";
import { useTimeTrackingStats, useEstimateVsActual } from "@/hooks/use-time-entries";
import { useFocusStats, useFocusSessions } from "@/hooks/use-focus-sessions";

// ----- config -------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    BACKLOG:     { label: "Backlog",  color: "#858585" },
    TODO:        { label: "To do",    color: "var(--bz-blue)" },
    IN_PROGRESS: { label: "Doing",    color: "var(--bz-amber)" },
    IN_REVIEW:   { label: "Review",   color: "var(--bz-pink)" },
    DONE:        { label: "Done",     color: "var(--bz-green)" },
    ARCHIVED:    { label: "Archived", color: "#5a5a5a" },
};

// ----- helpers ------------------------------------------------------------

function formatDuration(minutes: number): string {
    if (!minutes) return "0m";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Cycle times can span weeks — switch to days past 48h so the strip stays scannable.
function formatCycle(hours: number): string {
    if (!hours) return "0h";
    if (hours >= 48) return `${Math.round(hours / 24)}d`;
    return `${Math.round(hours)}h`;
}

function formatHoursShort(hours: number): string {
    const rounded = Math.round(hours * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
}

function formatDay(d: string | Date): string {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(d: string | Date): string {
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ----- small UI primitives ------------------------------------------------

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{
                color,
                background: `color-mix(in oklab, ${color} 12%, transparent)`,
                border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
            }}
        >
            {children}
        </span>
    );
}

function StatCell({ value, label, color }: { value: string | number; label: string; color?: string }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span
                className="mono text-[20px] font-semibold leading-none"
                style={{ color: color ?? "#fff" }}
            >
                {value}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-500">
                {label}
            </span>
        </div>
    );
}

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {children}
            </h2>
            {right}
        </div>
    );
}

// Collapsible list section — same pattern as Today's reflection row.
function CollapsibleSection({
    title,
    count,
    children,
}: {
    title: string;
    count?: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <section className="overflow-hidden rounded-xl border border-[color:var(--border)]">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
            >
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    {title}
                    {typeof count === "number" && (
                        <span className="mono ml-2 tracking-normal text-neutral-400">{count}</span>
                    )}
                </h2>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-neutral-500 transition-transform",
                        open && "rotate-180",
                    )}
                />
            </button>
            {open && (
                <div className="divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
                    {children}
                </div>
            )}
        </section>
    );
}

// Thin horizontal meter used across sections.
function Meter({ pct, color }: { pct: number; color: string }) {
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
            />
        </div>
    );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-4 py-8 text-center text-[13px] text-neutral-500">{children}</div>
    );
}

// ----- main view ----------------------------------------------------------

export function InsightsView() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subWeeks(new Date(), 4),
        to: new Date(),
    });

    const hookParams = {
        range: "custom" as const,
        startDate: dateRange?.from,
        endDate: dateRange?.to,
    };

    const { data: overview, isLoading: loadingOverview } = useOverviewMetrics(hookParams);
    const { data: taskTrend, isLoading: loadingTrend } = useTaskCompletionTrend(hookParams);
    const { data: statusDist, isLoading: loadingStatus } = useStatusDistribution();
    const { data: sprintVel, isLoading: loadingSprint } = useSprintVelocity();
    const { data: teamProd, isLoading: loadingTeam } = useTeamProductivity(hookParams);
    const { data: projectProg, isLoading: loadingProjects } = useProjectProgress();
    const { data: timeStats } = useTimeTrackingStats();
    const { data: estimateItems } = useEstimateVsActual();
    const { data: focusStats } = useFocusStats();

    const isLoading =
        loadingOverview || loadingTrend || loadingStatus || loadingSprint || loadingTeam || loadingProjects;

    if (isLoading) {
        return (
            <div className="mx-auto max-w-3xl p-10">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 rounded-xl bg-white/[0.04]" />
                    ))}
                </div>
            </div>
        );
    }

    const rangeLabel =
        dateRange?.from && dateRange?.to
            ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
            : "All time";

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-10">
            {/* ===== Header ===== */}
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <div>
                    <div className="mono mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                        <Calendar className="mr-1.5 -mt-0.5 inline h-3 w-3" />
                        {rangeLabel}
                    </div>
                    <h1 className="flex items-center gap-3 text-[34px] font-semibold leading-none tracking-tight text-white">
                        Insights
                        <TrendingUp className="h-7 w-7" style={{ color: "var(--bz-peri)" }} />
                    </h1>
                    {overview && (
                        <p className="mt-3 text-[13px] text-neutral-400">
                            {overview.completedTasks} of {overview.totalTasks} tasks done
                            {overview.overdueTasks > 0 && (
                                <>
                                    {" · "}
                                    <span style={{ color: "var(--bz-red)" }}>
                                        {overview.overdueTasks} overdue
                                    </span>
                                </>
                            )}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <DateRangePicker date={dateRange} setDate={setDateRange} />
                    <ReportBuilder />
                    <ExportButton
                        data={{ overview, taskTrend, statusDist, sprintVel, teamProd, projectProg }}
                    />
                </div>
            </header>

            {/* ===== Compact stat strip ===== */}
            {overview && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-[color:var(--border)] px-4 py-3">
                    <StatCell value={overview.totalTasks} label="tasks" />
                    <span className="h-4 w-px bg-[color:var(--border)]" />
                    <StatCell value={`${overview.completionRate}%`} label="done" />
                    <span className="h-4 w-px bg-[color:var(--border)]" />
                    <StatCell
                        value={overview.overdueTasks}
                        label="overdue"
                        color={overview.overdueTasks > 0 ? "var(--bz-red)" : undefined}
                    />
                    <span className="h-4 w-px bg-[color:var(--border)]" />
                    <StatCell value={formatCycle(overview.avgCompletionTime)} label="avg cycle" />
                    <span className="h-4 w-px bg-[color:var(--border)]" />
                    <StatCell value={overview.activeSprints} label="sprints" />
                    <span className="h-4 w-px bg-[color:var(--border)]" />
                    <StatCell value={overview.teamMembers} label="people" />
                </div>
            )}

            {/* ===== Time tracked ===== */}
            <section>
                <SectionHeader
                    right={
                        <span className="text-[11px] text-neutral-500">
                            auto-logged from focus sessions
                        </span>
                    }
                >
                    Time tracked
                </SectionHeader>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-[color:var(--border)] px-4 py-3">
                        <StatCell value={formatDuration(timeStats?.todayMinutes ?? 0)} label="today" />
                        <span className="h-4 w-px bg-[color:var(--border)]" />
                        <StatCell value={formatDuration(timeStats?.weekMinutes ?? 0)} label="week" />
                        <span className="h-4 w-px bg-[color:var(--border)]" />
                        <StatCell value={formatDuration(timeStats?.monthMinutes ?? 0)} label="month" />
                    </div>
                    {timeStats && timeStats.taskBreakdown.length > 0 && (
                        <div className="bz-card p-4">
                            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                                By task · this month
                            </div>
                            <ul className="space-y-3">
                                {(() => {
                                    const max = Math.max(
                                        ...timeStats.taskBreakdown.map((t) => t.totalMinutes),
                                    );
                                    return timeStats.taskBreakdown.map((item) => (
                                        <li key={item.taskId}>
                                            <div className="flex items-center justify-between gap-3 text-[13px]">
                                                <span className="truncate text-neutral-300">{item.taskTitle}</span>
                                                <span className="mono shrink-0 text-neutral-400">
                                                    {formatDuration(item.totalMinutes)}
                                                </span>
                                            </div>
                                            <div className="mt-1.5">
                                                <Meter
                                                    pct={max ? (item.totalMinutes / max) * 100 : 0}
                                                    color="var(--bz-blue)"
                                                />
                                            </div>
                                        </li>
                                    ));
                                })()}
                            </ul>
                        </div>
                    )}
                </div>
            </section>

            {/* ===== Estimate vs actual ===== */}
            {estimateItems && estimateItems.length > 0 && (
                <section>
                    <SectionHeader>Estimate vs actual</SectionHeader>
                    <div className="bz-card divide-y divide-[color:var(--border)] overflow-hidden p-0">
                        {estimateItems.map((item) => {
                            const actualHours = item.actualMinutes / 60;
                            // Variance is only meaningful once time has been logged.
                            const variance =
                                item.actualMinutes > 0 && item.estimatedHours > 0
                                    ? ((actualHours - item.estimatedHours) / item.estimatedHours) * 100
                                    : null;
                            const varianceColor =
                                variance === null ? "#858585"
                                : variance > 10 ? "var(--bz-red)"
                                : variance < -10 ? "var(--bz-green)"
                                : "var(--bz-blue)";
                            return (
                                <div key={item.taskId} className="flex items-center gap-3 px-4 py-3">
                                    <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-300">
                                        {item.taskTitle}
                                    </span>
                                    <span className="mono text-[12px] text-neutral-500">
                                        est {formatHoursShort(item.estimatedHours)}
                                    </span>
                                    <span className="mono text-[12px] text-white">
                                        {formatHoursShort(actualHours)}
                                    </span>
                                    <span className="w-16 text-right">
                                        {variance !== null ? (
                                            <Chip color={varianceColor}>
                                                {variance > 0 ? "+" : ""}
                                                {variance.toFixed(0)}%
                                            </Chip>
                                        ) : (
                                            <span className="text-[11px] text-neutral-600">—</span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ===== Focus ===== */}
            <section>
                <SectionHeader>Focus</SectionHeader>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-[color:var(--border)] px-4 py-3">
                        <StatCell value={formatDuration(focusStats?.weekMinutes ?? 0)} label="week" />
                        <span className="h-4 w-px bg-[color:var(--border)]" />
                        <StatCell value={formatDuration(focusStats?.totalMinutes ?? 0)} label="all time" />
                        <span className="h-4 w-px bg-[color:var(--border)]" />
                        <StatCell value={focusStats?.totalSessions ?? 0} label="sessions" />
                        <span className="h-4 w-px bg-[color:var(--border)]" />
                        <div className="flex items-center gap-1.5">
                            <Flame className="h-4 w-4" style={{ color: "var(--bz-pink)" }} />
                            <span className="mono text-[20px] font-semibold leading-none text-white">
                                {focusStats?.streak ?? 0}
                            </span>
                            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-500">
                                day streak
                            </span>
                        </div>
                    </div>
                    <FocusHistory />
                </div>
            </section>

            {/* ===== Completion trend ===== */}
            <section>
                <SectionHeader>Completion trend</SectionHeader>
                <div className="bz-card p-4">
                    {taskTrend && taskTrend.length > 0 ? (
                        <>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={taskTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="insightsCreated" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="var(--bz-peri)" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="var(--bz-peri)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="insightsCompleted" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="var(--bz-mint)" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="var(--bz-mint)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatDay}
                                            tick={{ fontSize: 10, fill: "#737373" }}
                                            axisLine={{ stroke: "var(--border)" }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fontSize: 10, fill: "#737373" }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            labelFormatter={(label) =>
                                                typeof label === "string" ? formatDay(label) : String(label ?? "")
                                            }
                                            contentStyle={{
                                                background: "rgba(0,0,0,0.85)",
                                                border: "1px solid var(--border)",
                                                borderRadius: "0.75rem",
                                                fontSize: "12px",
                                            }}
                                            itemStyle={{ color: "#e5e5e5" }}
                                            labelStyle={{ color: "#737373" }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="created"
                                            name="Created"
                                            stroke="var(--bz-peri)"
                                            strokeWidth={1.5}
                                            fill="url(#insightsCreated)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="completed"
                                            name="Completed"
                                            stroke="var(--bz-mint)"
                                            strokeWidth={1.5}
                                            fill="url(#insightsCompleted)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-3 flex items-center gap-4 border-t border-[color:var(--border)] pt-3 text-[11px] text-neutral-400">
                                <span className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bz-peri)" }} />
                                    Created
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bz-mint)" }} />
                                    Completed
                                </span>
                            </div>
                        </>
                    ) : (
                        <EmptyRow>No task activity in this range.</EmptyRow>
                    )}
                </div>
            </section>

            {/* ===== Status distribution ===== */}
            <section>
                <SectionHeader>Where tasks stand</SectionHeader>
                <div className="bz-card p-4">
                    {statusDist && statusDist.length > 0 ? (
                        <>
                            {/* One stacked bar, then a row per status */}
                            <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
                                {statusDist.map((s) => (
                                    <div
                                        key={s.status}
                                        style={{
                                            width: `${s.percentage}%`,
                                            background: STATUS_CONFIG[s.status]?.color ?? "#555",
                                        }}
                                    />
                                ))}
                            </div>
                            <ul className="mt-4 space-y-2.5">
                                {statusDist.map((s) => {
                                    const cfg = STATUS_CONFIG[s.status];
                                    return (
                                        <li key={s.status} className="flex items-center gap-3 text-[13px]">
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-full"
                                                style={{ background: cfg?.color ?? "#555" }}
                                            />
                                            <span className="flex-1 text-neutral-300">
                                                {cfg?.label ?? s.status}
                                            </span>
                                            <span className="mono text-white">{s.count}</span>
                                            <span className="mono w-10 text-right text-[11px] text-neutral-500">
                                                {s.percentage}%
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    ) : (
                        <EmptyRow>No tasks yet.</EmptyRow>
                    )}
                </div>
            </section>

            {/* ===== Projects (collapsible) ===== */}
            <CollapsibleSection title="Projects" count={projectProg?.length ?? 0}>
                {projectProg && projectProg.length > 0 ? (
                    projectProg.map((project) => (
                        <div key={project.projectId} className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bz-mint)" }} />
                                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">
                                    {project.projectName}
                                </span>
                                {project.overdueTasks > 0 && (
                                    <Chip color="var(--bz-red)">{project.overdueTasks} overdue</Chip>
                                )}
                                {project.progressPercentage === 100 && (
                                    <Chip color="var(--bz-green)">Complete</Chip>
                                )}
                                <span className="mono text-[13px] text-neutral-400">
                                    {project.progressPercentage}%
                                </span>
                            </div>
                            <div className="mt-2.5">
                                <Meter
                                    pct={project.progressPercentage}
                                    color={project.progressPercentage === 100 ? "var(--bz-green)" : "var(--bz-peri)"}
                                />
                            </div>
                            <div className="mono mt-1.5 text-[11px] text-neutral-500">
                                {project.completedTasks} of {project.totalTasks} tasks
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyRow>No active projects.</EmptyRow>
                )}
            </CollapsibleSection>

            {/* ===== Sprint velocity (collapsible) ===== */}
            <CollapsibleSection title="Sprint velocity" count={sprintVel?.length ?? 0}>
                {sprintVel && sprintVel.length > 0 ? (
                    sprintVel.map((sprint) => (
                        <div key={sprint.sprintId} className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">
                                    {sprint.sprintName}
                                </span>
                                <span className="mono text-[12px] text-neutral-400">
                                    {sprint.tasksCompleted}/{sprint.tasksPlanned}
                                </span>
                                <span className="mono w-12 text-right text-[13px] text-neutral-300">
                                    {sprint.completionRate}%
                                </span>
                            </div>
                            <div className="mt-2.5">
                                <Meter pct={sprint.completionRate} color="var(--bz-amber)" />
                            </div>
                            <div className="mono mt-1.5 text-[11px] text-neutral-500">
                                {formatDay(sprint.startDate)} – {formatDay(sprint.endDate)}
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyRow>No sprints yet.</EmptyRow>
                )}
            </CollapsibleSection>

            {/* ===== Team (collapsible) ===== */}
            <CollapsibleSection title="Team" count={teamProd?.length ?? 0}>
                {teamProd && teamProd.length > 0 ? (
                    teamProd.map((member) => {
                        const rate = member.tasksAssigned > 0
                            ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100)
                            : 0;
                        return (
                            <div key={member.userId} className="flex items-center gap-3 px-4 py-3.5">
                                {member.userImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={member.userImage}
                                        alt=""
                                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <span
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                        style={{ background: "color-mix(in oklab, var(--bz-peri) 30%, transparent)" }}
                                    >
                                        {member.userName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[14px] font-medium text-white">
                                        {member.userName}
                                    </div>
                                    <div className="mono mt-0.5 text-[11px] text-neutral-500">
                                        {formatDuration(member.focusTime)} focus · {formatDuration(member.loggedTime)} tracked
                                    </div>
                                </div>
                                <span className="mono text-[12px] text-neutral-400">
                                    {member.tasksCompleted}/{member.tasksAssigned}
                                </span>
                                <div className="w-20">
                                    <Meter pct={rate} color="var(--bz-peri)" />
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <EmptyRow>No activity in this range.</EmptyRow>
                )}
            </CollapsibleSection>
        </div>
    );
}

// ----- collapsible focus history (mirrors Today's reflection row) ----------

function FocusHistory() {
    const { data: sessions } = useFocusSessions({ limit: 30 });
    const [open, setOpen] = useState(false);

    return (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border)]">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
            >
                <span className="flex items-center gap-2.5 text-[13px] font-medium text-neutral-300">
                    <Timer className="h-4 w-4" style={{ color: "var(--bz-pink)" }} />
                    Session history
                    {sessions && sessions.length > 0 && (
                        <span className="text-[11px] font-normal text-neutral-500">
                            · {sessions.length}
                        </span>
                    )}
                </span>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-neutral-500 transition-transform",
                        open && "rotate-180",
                    )}
                />
            </button>
            {open && (
                <div className="border-t border-[color:var(--border)]">
                    {!sessions || sessions.length === 0 ? (
                        <EmptyRow>No focus sessions yet.</EmptyRow>
                    ) : (
                        <ul className="divide-y divide-[color:var(--border)]">
                            {sessions.map((session) => {
                                const task = (session as unknown as { task?: { title: string } }).task;
                                const isPomodoro = session.type === "POMODORO";
                                const accent = isPomodoro ? "var(--bz-pink)" : "var(--bz-blue)";
                                return (
                                    <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                                        <span
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                            style={{
                                                color: accent,
                                                background: `color-mix(in oklab, ${accent} 12%, transparent)`,
                                            }}
                                        >
                                            {isPomodoro ? (
                                                <Target className="h-3.5 w-3.5" />
                                            ) : (
                                                <Timer className="h-3.5 w-3.5" />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] font-medium text-white">
                                                {isPomodoro ? "Pomodoro" : "Free focus"}
                                                {task && (
                                                    <span className="ml-2 font-normal text-neutral-500">
                                                        {task.title}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mono mt-0.5 text-[11px] text-neutral-500">
                                                {formatDay(session.startedAt)} at {formatTime(session.startedAt)}
                                            </div>
                                        </div>
                                        <span className="mono text-[13px] tabular-nums text-neutral-300">
                                            {session.duration ? formatDuration(session.duration) : "—"}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
