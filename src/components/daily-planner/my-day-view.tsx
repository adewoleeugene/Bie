"use client";

import { useState, useMemo, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
    Sun,
    Calendar,
    CheckCircle2,
    ArrowUp,
    ArrowDown,
    Play,
    Sparkles,
    Star,
    ChevronDown,
    Notebook,
} from "lucide-react";
import { PomodoroTimer } from "@/components/focus/pomodoro-timer";
import { AIPlanPicker } from "@/components/daily-planner/ai-plan-picker";
import { useDailyReflection, useUpsertReflection } from "@/hooks/use-reflections";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useFocusStats } from "@/hooks/use-focus-sessions";
import { useTimeTrackingStats } from "@/hooks/use-time-entries";

// ----- config -------------------------------------------------------------

const PRIORITY_CONFIG: Record<
    string,
    { label: string; color: string; icon: typeof ArrowUp }
> = {
    P0: { label: "Critical", color: "var(--bz-red)", icon: ArrowUp },
    P1: { label: "High", color: "var(--bz-amber)", icon: ArrowUp },
    P2: { label: "Medium", color: "var(--bz-peri)", icon: ArrowDown },
    P3: { label: "Low", color: "var(--bz-mint)", icon: ArrowDown },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    BACKLOG:     { label: "Backlog",  color: "#858585" },
    TODO:        { label: "To do",    color: "var(--bz-blue)" },
    IN_PROGRESS: { label: "Doing",    color: "var(--bz-amber)" },
    IN_REVIEW:   { label: "Review",   color: "var(--bz-pink)" },
    DONE:        { label: "Done",     color: "var(--bz-green)" },
};

// ----- helpers ------------------------------------------------------------

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface TaskWithRelations {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string | Date | null;
    estimatedHours?: number | null;
    project?: { id: string; name: string } | null;
    assignees?: { user: { id: string; name: string; image?: string | null } }[];
}

function getDailyPlanKey(): string {
    const d = new Date();
    return `daily-plan-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function StatCell({ value, label }: { value: string | number; label: string }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="mono text-[20px] font-semibold leading-none text-white">{value}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-500">
                {label}
            </span>
        </div>
    );
}

// ----- main view ----------------------------------------------------------

export function MyDayView() {
    const { data: allTasks, isLoading } = useTasks();
    const { data: focusStats } = useFocusStats();
    const { data: timeStats } = useTimeTrackingStats();
    const updateTask = useUpdateTask();

    const [showCompleted, setShowCompleted] = useState(false);

    // Per-task pomodoro launcher (uses existing PomodoroTimer)
    const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
    const startFocusForTask = (taskId: string) => setPomodoroTaskId(taskId);

    // Optional AI helper: pinned tasks sort to the top — never a gate.
    const [pinnedTaskIds, setPinnedTaskIds] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return new Set();
        try {
            const stored = localStorage.getItem(getDailyPlanKey());
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });

    const pinTasks = (ids: string[]) => {
        setPinnedTaskIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.add(id);
            localStorage.setItem(getDailyPlanKey(), JSON.stringify([...next]));
            return next;
        });
    };

    // Captured once on mount — stable across renders so the memos below don't churn.
    const today = useMemo(() => new Date(), []);
    const todayStart = useMemo(
        () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        [today],
    );
    const todayRest = today.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    const todayWeekday = today.toLocaleDateString("en-US", { weekday: "long" });

    // Today's tasks — shown directly: due today/overdue, or actively in flight.
    const myDayTasks = useMemo(() => {
        if (!allTasks) return [];
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const prioRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const statusRank: Record<string, number> = {
            IN_PROGRESS: 0, TODO: 1, IN_REVIEW: 2, BACKLOG: 3, DONE: 4,
        };

        return (allTasks as TaskWithRelations[])
            .filter((task) => {
                if (task.status === "ARCHIVED") return false;
                if (task.status === "DONE" && !showCompleted) return false;
                if (task.dueDate && new Date(task.dueDate) < todayEnd) return true;
                return task.status === "IN_PROGRESS" || task.status === "TODO";
            })
            .sort((a, b) => {
                // Pinned first, then overdue, then priority, then status.
                const aPin = pinnedTaskIds.has(a.id) ? 0 : 1;
                const bPin = pinnedTaskIds.has(b.id) ? 0 : 1;
                if (aPin !== bPin) return aPin - bPin;
                const aOver = a.dueDate && new Date(a.dueDate) < todayStart ? 0 : 1;
                const bOver = b.dueDate && new Date(b.dueDate) < todayStart ? 0 : 1;
                if (aOver !== bOver) return aOver - bOver;
                const p = (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2);
                if (p !== 0) return p;
                return (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
            });
    }, [allTasks, showCompleted, pinnedTaskIds, todayStart]);

    const activeTasks = myDayTasks.filter((t) => t.status !== "DONE");
    const doneTasks = myDayTasks.filter((t) => t.status === "DONE");
    const overdueCount = activeTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < todayStart,
    ).length;

    const handleToggleDone = async (task: TaskWithRelations) => {
        const newStatus = task.status === "DONE" ? "TODO" : "DONE";
        await updateTask.mutateAsync({ id: task.id, status: newStatus });
    };

    const renderTaskRow = (task: TaskWithRelations) => {
        const isDone = task.status === "DONE";
        const isOverdue =
            !!task.dueDate && new Date(task.dueDate) < todayStart && !isDone;
        const prio = PRIORITY_CONFIG[task.priority];
        const status = STATUS_CONFIG[task.status];
        const isPinned = pinnedTaskIds.has(task.id);
        const edge = isOverdue ? "var(--bz-red)" : status?.color ?? "transparent";

        return (
            <li
                key={task.id}
                className={cn(
                    "group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.025]",
                    isDone && "opacity-50",
                )}
            >
                <span
                    aria-hidden
                    className="absolute left-0 top-0 h-full w-[3px]"
                    style={{ background: edge }}
                />
                <Checkbox
                    checked={isDone}
                    onCheckedChange={() => handleToggleDone(task)}
                    className="h-[18px] w-[18px]"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {isPinned && !isDone && (
                            <Star
                                className="h-3 w-3 shrink-0"
                                style={{ color: "var(--bz-amber)", fill: "var(--bz-amber)" }}
                            />
                        )}
                        <span
                            className={cn(
                                "truncate text-[14px] font-medium text-white",
                                isDone && "line-through text-neutral-500",
                            )}
                        >
                            {task.title}
                        </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
                        {task.project && (
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: "var(--bz-mint)" }}
                                />
                                {task.project.name}
                            </span>
                        )}
                        {task.dueDate && (
                            <span
                                className="mono"
                                style={isOverdue ? { color: "var(--bz-red)" } : undefined}
                            >
                                {new Date(task.dueDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                })}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isOverdue && <Chip color="var(--bz-red)">Overdue</Chip>}
                    {prio && <Chip color={prio.color}>{task.priority}</Chip>}
                    {status && <Chip color={status.color}>{status.label}</Chip>}
                    {!isDone && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                startFocusForTask(task.id);
                            }}
                            aria-label="Start focus session"
                            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] font-medium text-neutral-300 opacity-0 transition-all hover:bg-white/[0.06] hover:text-white group-hover:opacity-100"
                        >
                            <Play className="h-3 w-3" />
                            Start
                        </button>
                    )}
                </div>
            </li>
        );
    };

    if (isLoading) {
        return (
            <div className="p-10">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 rounded-xl bg-white/[0.04]" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-10">
            {/* ===== Header ===== */}
            <header className="flex items-end justify-between gap-6">
                <div>
                    <div className="mono mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                        <Calendar className="mr-1.5 -mt-0.5 inline h-3 w-3" />
                        {todayRest}
                    </div>
                    <h1 className="flex items-center gap-3 text-[34px] font-semibold leading-none tracking-tight text-white">
                        {todayWeekday}
                        <Sun className="h-7 w-7" style={{ color: "var(--bz-amber)" }} />
                    </h1>
                    <p className="mt-3 text-[13px] text-neutral-400">
                        {activeTasks.length} {activeTasks.length === 1 ? "task" : "tasks"} today
                        {overdueCount > 0 && (
                            <>
                                {" · "}
                                <span style={{ color: "var(--bz-red)" }}>{overdueCount} overdue</span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <AIPlanPicker existingCommittedIds={pinnedTaskIds} onCommit={pinTasks} />
                    <button
                        type="button"
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="rounded-lg border border-[color:var(--border)] px-3.5 py-2 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        {showCompleted ? "Hide done" : "Show done"}
                    </button>
                </div>
            </header>

            {/* ===== Compact stat strip ===== */}
            <div className="flex items-center gap-5 rounded-xl border border-[color:var(--border)] px-4 py-3">
                <StatCell value={activeTasks.length} label="tasks" />
                <span className="h-4 w-px bg-[color:var(--border)]" />
                <StatCell
                    value={focusStats ? formatDuration(focusStats.todayMinutes) : "0m"}
                    label="focus"
                />
                <span className="h-4 w-px bg-[color:var(--border)]" />
                <StatCell
                    value={timeStats ? formatDuration(timeStats.todayMinutes) : "0m"}
                    label="tracked"
                />
            </div>

            {/* ===== Task list ===== */}
            <section>
                {activeTasks.length === 0 && doneTasks.length === 0 ? (
                    <div className="bz-card flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div
                            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{
                                background: "color-mix(in oklab, var(--bz-amber) 10%, transparent)",
                                border: "1px solid color-mix(in oklab, var(--bz-amber) 30%, transparent)",
                            }}
                        >
                            <CheckCircle2 className="h-6 w-6" style={{ color: "var(--bz-green)" }} />
                        </div>
                        <h3 className="text-[15px] font-semibold text-white">Nothing due today.</h3>
                        <p className="mt-1 max-w-xs text-[13px] text-neutral-500">
                            You&apos;re all clear. New tasks with a due date will show up here.
                        </p>
                    </div>
                ) : activeTasks.length === 0 ? (
                    <div className="bz-card flex flex-col items-center justify-center px-6 py-10 text-center">
                        <CheckCircle2 className="mb-3 h-8 w-8" style={{ color: "var(--bz-green)" }} />
                        <h3 className="text-[15px] font-semibold text-white">All done.</h3>
                        <p className="mt-1 text-[13px] text-neutral-500">
                            {doneTasks.length} {doneTasks.length === 1 ? "task" : "tasks"} completed today.
                        </p>
                    </div>
                ) : (
                    <ul className="bz-card divide-y divide-[color:var(--border)] overflow-hidden p-0">
                        {activeTasks.map((task) => renderTaskRow(task))}
                    </ul>
                )}

                {showCompleted && doneTasks.length > 0 && (
                    <div className="mt-5">
                        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            Completed
                        </h2>
                        <ul className="bz-card divide-y divide-[color:var(--border)] overflow-hidden p-0">
                            {doneTasks.map((task) => renderTaskRow(task))}
                        </ul>
                    </div>
                )}
            </section>

            {/* ===== Reflection (collapsed) ===== */}
            <ReflectionRow />

            {pomodoroTaskId && (
                <PomodoroTimer
                    isOpen={!!pomodoroTaskId}
                    onClose={() => setPomodoroTaskId(null)}
                    preSelectedTaskId={pomodoroTaskId}
                    preSelectedMode="pomodoro"
                />
            )}
        </div>
    );
}

// ============================================================================
// Collapsible end-of-day reflection
// ============================================================================

function ReflectionRow() {
    const { data: reflection } = useDailyReflection();
    const [open, setOpen] = useState(false);

    return (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border)]">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
            >
                <span className="flex items-center gap-2.5 text-[13px] font-medium text-neutral-300">
                    <Notebook className="h-4 w-4" style={{ color: "var(--bz-amber)" }} />
                    Reflect on today
                    {reflection && (
                        <span className="text-[11px] font-normal text-neutral-500">· saved</span>
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
                <div className="border-t border-[color:var(--border)] p-5">
                    <DailyReflectionSection />
                </div>
            )}
        </div>
    );
}

function DailyReflectionSection() {
    const { data: reflection, isLoading } = useDailyReflection();
    const upsert = useUpsertReflection();
    const [editing, setEditing] = useState(!reflection);
    const [mood, setMood] = useState<number | null>(null);
    const [content, setContent] = useState("");
    const [highlights, setHighlights] = useState("");
    const [improvements, setImprovements] = useState("");

    useEffect(() => {
        if (reflection) {
            setMood(reflection.mood ?? null);
            setContent(reflection.content ?? "");
            setHighlights(reflection.highlights ?? "");
            setImprovements(reflection.improvements ?? "");
            setEditing(false);
        } else {
            setEditing(true);
        }
    }, [reflection]);

    const MOODS = [
        { value: 1, emoji: "😩" },
        { value: 2, emoji: "😕" },
        { value: 3, emoji: "😐" },
        { value: 4, emoji: "🙂" },
        { value: 5, emoji: "😊" },
    ];

    const save = async () => {
        await upsert.mutateAsync({
            mood,
            content: content.trim(),
            highlights: highlights.trim() || null,
            improvements: improvements.trim() || null,
        });
        setEditing(false);
    };

    if (isLoading) return null;

    if (editing) {
        return (
            <div className="space-y-4">
                <div>
                    <label className="mb-2 block text-[11px] text-neutral-500">
                        How was your day?
                    </label>
                    <div className="flex gap-2">
                        {MOODS.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => setMood(m.value)}
                                className={`rounded-lg px-2.5 py-1.5 text-xl transition-all ${
                                    mood === m.value
                                        ? "bg-white/[0.1] scale-110"
                                        : "hover:bg-white/[0.05]"
                                }`}
                            >
                                {m.emoji}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-[11px] text-neutral-500">
                        What went well?
                    </label>
                    <Input
                        value={highlights}
                        onChange={(e) => setHighlights(e.target.value)}
                        placeholder="Highlights of the day..."
                        className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[11px] text-neutral-500">
                        What to improve tomorrow?
                    </label>
                    <Input
                        value={improvements}
                        onChange={(e) => setImprovements(e.target.value)}
                        placeholder="Things to do differently..."
                        className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[11px] text-neutral-500">
                        Notes (optional)
                    </label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={3}
                        placeholder="Free-form thoughts..."
                        className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-[var(--bz-amber)]"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={save}
                        disabled={upsert.isPending}
                        className="rounded-lg px-4 py-2 text-[12px] font-medium text-black transition-all"
                        style={{ background: "var(--bz-amber)" }}
                    >
                        {upsert.isPending ? "Saving..." : "Save reflection"}
                    </button>
                    {reflection && (
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="rounded-lg px-3 py-2 text-[12px] text-neutral-400 hover:text-white"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2 text-sm">
            <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium text-white">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--bz-amber)" }} />
                    Today&apos;s reflection
                </span>
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-[11px] text-neutral-400 hover:text-white"
                >
                    Edit
                </button>
            </div>
            {reflection?.mood && (
                <div className="text-xl">
                    {MOODS.find((m) => m.value === reflection.mood)?.emoji}
                </div>
            )}
            {reflection?.highlights && (
                <p className="text-white/70">
                    <strong className="text-white/40">Went well:</strong> {reflection.highlights}
                </p>
            )}
            {reflection?.improvements && (
                <p className="text-white/70">
                    <strong className="text-white/40">Improve:</strong> {reflection.improvements}
                </p>
            )}
            {reflection?.content && (
                <p className="text-xs text-white/50">{reflection.content}</p>
            )}
        </div>
    );
}
