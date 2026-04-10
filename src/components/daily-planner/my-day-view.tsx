"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
    Sun,
    Calendar,
    GripVertical,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Flame,
    Target,
    ArrowUp,
    ArrowDown,
    ListChecks,
    Rocket,
    Sparkles,
    Timer,
    Play,
} from "lucide-react";
import { PomodoroTimer } from "@/components/focus/pomodoro-timer";
import { AIPlanPicker } from "@/components/daily-planner/ai-plan-picker";
import { useDailyReflection, useUpsertReflection } from "@/hooks/use-reflections";

const POMODORO_MINUTES = 25;

function getDailyEstimatesKey(): string {
    const d = new Date();
    return `daily-estimates-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import {
    useFocusStats,
    useFocusSessions,
    useStartFocusSession,
    useEndFocusSession,
} from "@/hooks/use-focus-sessions";
import { useTimeTrackingStats } from "@/hooks/use-time-entries";
import { Pause, StopCircle } from "lucide-react";

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
    TODO:        { label: "To Do",    color: "var(--bz-blue)" },
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

function getDailyGoalKey(): string {
    const d = new Date();
    return `daily-goal-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ----- small UI primitives ------------------------------------------------

function StatTile({
    label,
    value,
    icon: Icon,
    accent,
}: {
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
}) {
    return (
        <div className="bz-card relative overflow-hidden p-5">
            <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.10] blur-2xl"
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
                    <div className="mono mt-2 text-3xl font-semibold leading-none text-white">
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
        </div>
    );
}

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

// ----- main view ----------------------------------------------------------

export function MyDayView() {
    const { data: allTasks, isLoading } = useTasks();
    const { data: focusStats } = useFocusStats();
    const { data: timeStats } = useTimeTrackingStats();
    const updateTask = useUpdateTask();

    const [showCompleted, setShowCompleted] = useState(false);
    // ----- per-task pomodoro launcher (uses existing PomodoroTimer) -----
    const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
    const startFocusForTask = (taskId: string) => setPomodoroTaskId(taskId);

    // ----- "Start focus block" — free stopwatch with pause/resume/end -----
    const startSession = useStartFocusSession();
    const endSession = useEndFocusSession();
    const [blockSessionId, setBlockSessionId] = useState<string | null>(null);
    const [blockRunning, setBlockRunning] = useState(false);
    const [blockElapsed, setBlockElapsed] = useState(0); // active focused seconds
    const blockTickRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (blockRunning) {
            blockTickRef.current = setInterval(() => {
                setBlockElapsed((s) => s + 1);
            }, 1000);
        }
        return () => {
            if (blockTickRef.current) clearInterval(blockTickRef.current);
        };
    }, [blockRunning]);

    const startFocusBlock = async () => {
        if (blockSessionId) return;
        const result = await startSession.mutateAsync({
            taskId: null,
            type: "FREE",
            notes: "Daily focus block",
        });
        if (result.success && result.data) {
            setBlockSessionId(result.data.id);
            setBlockElapsed(0);
            setBlockRunning(true);
        }
    };

    const pauseFocusBlock = () => setBlockRunning(false);
    const resumeFocusBlock = () => setBlockRunning(true);

    const endFocusBlock = async () => {
        if (!blockSessionId) return;
        const minutes = Math.max(0, Math.round(blockElapsed / 60));
        await endSession.mutateAsync({
            sessionId: blockSessionId,
            durationMinutes: minutes,
            completed: true,
        });
        setBlockSessionId(null);
        setBlockRunning(false);
        setBlockElapsed(0);
    };

    const [committedTaskIds, setCommittedTaskIds] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return new Set();
        try {
            const stored = localStorage.getItem(getDailyPlanKey());
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });
    const [dailyGoalHours, setDailyGoalHours] = useState<number>(() => {
        if (typeof window === "undefined") return 0;
        return parseFloat(localStorage.getItem(getDailyGoalKey()) || "0");
    });
    const [taskEstimates, setTaskEstimates] = useState<Record<string, number>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const stored = localStorage.getItem(getDailyEstimatesKey());
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    const setEstimate = (taskId: string, minutes: number) => {
        setTaskEstimates((prev) => {
            const next = { ...prev, [taskId]: minutes };
            if (!minutes) delete next[taskId];
            localStorage.setItem(getDailyEstimatesKey(), JSON.stringify(next));
            return next;
        });
    };

    const committedEstimateMinutes = useMemo(() => {
        let total = 0;
        committedTaskIds.forEach((id) => {
            const fromInput = taskEstimates[id];
            if (fromInput && fromInput > 0) {
                total += fromInput;
                return;
            }
            const task = (allTasks as TaskWithRelations[] | undefined)?.find((t) => t.id === id);
            if (task?.estimatedHours) total += task.estimatedHours * 60;
        });
        return total;
    }, [committedTaskIds, taskEstimates, allTasks]);

    const totalPomodoros = Math.ceil(committedEstimateMinutes / POMODORO_MINUTES) || 0;

    const hasPlan = committedTaskIds.size > 0;

    const toggleCommitTask = (taskId: string) => {
        setCommittedTaskIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            localStorage.setItem(getDailyPlanKey(), JSON.stringify([...next]));
            return next;
        });
    };

    const updateGoal = (hours: number) => {
        setDailyGoalHours(hours);
        localStorage.setItem(getDailyGoalKey(), String(hours));
    };

    const today = new Date();
    const todayWeekday = today.toLocaleDateString("en-US", { weekday: "long" });
    const todayRest = today.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const myDayTasks = useMemo(() => {
        if (!allTasks) return [];
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        return (allTasks as TaskWithRelations[])
            .filter((task) => {
                if (task.status === "ARCHIVED") return false;
                if (task.status === "DONE" && !showCompleted) return false;
                if (task.dueDate) {
                    const due = new Date(task.dueDate);
                    if (due < todayEnd) return true;
                }
                if (task.status === "IN_PROGRESS" || task.status === "TODO") return true;
                return false;
            })
            .sort((a, b) => {
                const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
                const statusOrder: Record<string, number> = {
                    IN_PROGRESS: 0,
                    TODO: 1,
                    IN_REVIEW: 2,
                    BACKLOG: 3,
                    DONE: 4,
                };
                const aDue = a.dueDate ? new Date(a.dueDate) : null;
                const bDue = b.dueDate ? new Date(b.dueDate) : null;
                const aOverdue = aDue && aDue < todayStart;
                const bOverdue = bDue && bDue < todayStart;
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                const aPrio = priorityOrder[a.priority] ?? 2;
                const bPrio = priorityOrder[b.priority] ?? 2;
                if (aPrio !== bPrio) return aPrio - bPrio;
                const aStatus = statusOrder[a.status] ?? 3;
                const bStatus = statusOrder[b.status] ?? 3;
                return aStatus - bStatus;
            });
    }, [allTasks, showCompleted, today]);

    const visibleTasks = myDayTasks;

    // groupedTasks removed — planning mode no longer exists here.

    const overdueTasks = myDayTasks.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    });

    const planDoneCount =
        (allTasks as TaskWithRelations[] | undefined)?.filter(
            (t) => committedTaskIds.has(t.id) && t.status === "DONE",
        ).length ?? 0;
    const planPct =
        committedTaskIds.size > 0 ? (planDoneCount / committedTaskIds.size) * 100 : 0;

    const handleToggleDone = async (task: TaskWithRelations) => {
        const newStatus = task.status === "DONE" ? "TODO" : "DONE";
        await updateTask.mutateAsync({ id: task.id, status: newStatus });
    };

    const renderTaskRow = (task: TaskWithRelations) => {
        const isDone = task.status === "DONE";
        const isOverdue =
            task.dueDate &&
            new Date(task.dueDate) <
                new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const prio = PRIORITY_CONFIG[task.priority];
        const status = STATUS_CONFIG[task.status];
        const isCommitted = committedTaskIds.has(task.id);
        const dimmed = hasPlan && !isCommitted;
        const mins =
            taskEstimates[task.id] ?? (task.estimatedHours ? task.estimatedHours * 60 : 0);
        const poms = Math.ceil((mins || 0) / POMODORO_MINUTES);

        return (
            <li
                key={task.id}
                className={cn(
                    "group relative flex items-center gap-4 px-4 py-3.5 transition-colors",
                    "hover:bg-white/[0.025]",
                    isDone && "opacity-50",
                    dimmed && "opacity-35",
                )}
            >
                <span
                    aria-hidden
                    className="absolute left-0 top-0 h-full w-[3px]"
                    style={{
                        background: status?.color ?? "transparent",
                        opacity: isCommitted ? 1 : 0.5,
                    }}
                />
                <div className="cursor-grab text-neutral-700 opacity-0 group-hover:opacity-100">
                    <GripVertical className="h-4 w-4" />
                </div>
                <Checkbox
                    checked={isDone}
                    onCheckedChange={() => handleToggleDone(task)}
                    className="h-[18px] w-[18px]"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                "truncate text-[14px] font-medium text-white",
                                isDone && "line-through text-neutral-500",
                            )}
                        >
                            {task.title}
                        </span>
                        {isOverdue && !isDone && <Chip color="var(--bz-red)">Overdue</Chip>}
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
                    {prio && <Chip color={prio.color}>{task.priority}</Chip>}
                    {status && <Chip color={status.color}>{status.label}</Chip>}
                    {isCommitted && mins > 0 && (
                        <span className="mono inline-flex items-center gap-1 text-[11px] text-neutral-500">
                            <Timer className="h-3 w-3" />
                            {poms}
                        </span>
                    )}
                    {task.estimatedHours && !(isCommitted && mins > 0) && (
                        <span className="mono inline-flex items-center gap-1 text-[11px] text-neutral-500">
                            <Clock className="h-3 w-3" />
                            {task.estimatedHours}h
                        </span>
                    )}
                    {isCommitted && !isDone && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                startFocusForTask(task.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
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
        <div className="mx-auto max-w-6xl space-y-10 p-10">
            {blockSessionId && (
                <FocusBar
                    elapsedSec={blockElapsed}
                    running={blockRunning}
                    onPause={pauseFocusBlock}
                    onResume={resumeFocusBlock}
                    onEnd={endFocusBlock}
                />
            )}
            {/* ===== Header ===== */}
            <header className="flex items-end justify-between gap-6">
                <div>
                    <div className="mono mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                        <Calendar className="mr-1.5 -mt-0.5 inline h-3 w-3" />
                        {todayRest}
                    </div>
                    <h1 className="flex items-baseline gap-3 text-[44px] font-semibold leading-none tracking-tight text-white">
                        {todayWeekday}.
                        <span
                            className="text-[44px] leading-none"
                            style={{ color: "var(--bz-amber)" }}
                        >
                            <Sun className="inline h-9 w-9 -translate-y-1" />
                        </span>
                    </h1>
                    <p className="mt-3 max-w-md text-sm text-neutral-500">
                        Your tasks for today.{" "}
                        <span className="text-neutral-400">Plan in <a href="/focus" className="underline hover:text-white">Focus</a>.</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="rounded-lg border border-[color:var(--border)] px-3.5 py-2 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        {showCompleted ? "Hide done" : "Show done"}
                    </button>
                </div>
            </header>

            {/* ===== Stat tiles ===== */}
            <div className="grid gap-4 md:grid-cols-4">
                <StatTile
                    label="Tasks today"
                    value={myDayTasks.filter((t) => t.status !== "DONE").length}
                    icon={Target}
                    accent="var(--bz-blue)"
                />
                <StatTile
                    label="Completed"
                    value={(allTasks ?? []).filter((t) => t.status === "DONE").length}
                    icon={CheckCircle2}
                    accent="var(--bz-green)"
                />
                <StatTile
                    label="Focus"
                    value={focusStats ? formatDuration(focusStats.todayMinutes) : "0m"}
                    icon={Flame}
                    accent="var(--bz-pink)"
                />
                <StatTile
                    label="Tracked"
                    value={timeStats ? formatDuration(timeStats.todayMinutes) : "0m"}
                    icon={Clock}
                    accent="var(--bz-mint)"
                />
            </div>

            {/* ===== AI Plan Picker ===== */}
            <AIPlanPicker
                existingCommittedIds={committedTaskIds}
                onCommit={(ids) => {
                    setCommittedTaskIds((prev) => {
                        const next = new Set(prev);
                        for (const id of ids) next.add(id);
                        localStorage.setItem(getDailyPlanKey(), JSON.stringify([...next]));
                        return next;
                    });
                }}
            />

            {/* ===== Plan progress / planning controls ===== */}
            {hasPlan && (
                <div className="bz-card p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--bz-blue)" }} />
                            <span className="text-[13px] font-medium text-white">Today&apos;s plan</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="mono text-[11px] text-neutral-500">
                                {planDoneCount} / {committedTaskIds.size}
                                {totalPomodoros > 0 && ` · ${totalPomodoros}🍅`}
                            </span>
                            <button
                                type="button"
                                onClick={startFocusBlock}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-black transition-all"
                                style={{
                                    background: "var(--bz-pink)",
                                    boxShadow: "0 8px 24px -8px rgba(255,0,128,0.55)",
                                }}
                            >
                                <Play className="h-3 w-3" />
                                Start focus block
                            </button>
                        </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${planPct}%`,
                                background:
                                    "linear-gradient(90deg, var(--bz-blue), var(--bz-mint))",
                                boxShadow: "0 0 16px rgba(0,153,255,0.45)",
                            }}
                        />
                    </div>
                    {dailyGoalHours > 0 && timeStats && (
                        <div className="mono mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                            <span>
                                {formatDuration(timeStats.todayMinutes)} / {dailyGoalHours}h goal
                            </span>
                            <span>
                                {Math.min(
                                    100,
                                    Math.round((timeStats.todayMinutes / (dailyGoalHours * 60)) * 100),
                                )}
                                %
                            </span>
                        </div>
                    )}
                </div>
            )}


            {/* ===== Overdue alert ===== */}
            {overdueTasks.length > 0 && (
                <div
                    className="flex items-center gap-3 rounded-xl border px-4 py-3"
                    style={{
                        borderColor: "color-mix(in oklab, var(--bz-red) 40%, transparent)",
                        background: "color-mix(in oklab, var(--bz-red) 8%, transparent)",
                    }}
                >
                    <AlertTriangle className="h-4 w-4" style={{ color: "var(--bz-red)" }} />
                    <span className="text-[13px] font-medium" style={{ color: "var(--bz-red)" }}>
                        {overdueTasks.length} overdue {overdueTasks.length === 1 ? "task" : "tasks"}
                    </span>
                </div>
            )}

            {/* ===== Task list — only committed tasks ===== */}
            <section>
                {(() => {
                    const prioRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
                    const statusRank: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, IN_REVIEW: 2, BACKLOG: 3, DONE: 4 };
                    const sortFn = (a: TaskWithRelations, b: TaskWithRelations) => {
                        const sp = (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
                        if (sp !== 0) return sp;
                        return (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2);
                    };

                    const allCommitted = ((allTasks as TaskWithRelations[] | undefined) ?? [])
                        .filter((t) => committedTaskIds.has(t.id));
                    const activeTasks = allCommitted
                        .filter((t) => t.status !== "DONE")
                        .sort(sortFn);
                    const doneTasks = allCommitted
                        .filter((t) => t.status === "DONE")
                        .sort(sortFn);

                    return (
                        <>
                            <div className="mb-4">
                                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                    Today&apos;s tasks
                                </h2>
                                <div className="mono mt-1 text-[28px] font-semibold leading-none text-white">
                                    {String(activeTasks.length).padStart(2, "0")}
                                </div>
                            </div>

                            {activeTasks.length === 0 && doneTasks.length === 0 ? (
                                <div className="bz-card flex flex-col items-center justify-center px-6 py-16 text-center">
                                    <div
                                        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                                        style={{
                                            background: "color-mix(in oklab, var(--bz-amber) 10%, transparent)",
                                            border: "1px solid color-mix(in oklab, var(--bz-amber) 30%, transparent)",
                                        }}
                                    >
                                        <Sun className="h-6 w-6" style={{ color: "var(--bz-amber)" }} />
                                    </div>
                                    <h3 className="text-[15px] font-semibold text-white">No plan yet.</h3>
                                    <p className="mt-1 max-w-xs text-[13px] text-neutral-500">
                                        Use the <strong>AI: Plan my day</strong> button above to pick your tasks,
                                        or head to <a href="/focus" className="underline hover:text-white">Focus</a> to plan from there.
                                    </p>
                                </div>
                            ) : activeTasks.length === 0 ? (
                                <div className="bz-card flex flex-col items-center justify-center px-6 py-10 text-center">
                                    <CheckCircle2 className="mb-3 h-8 w-8" style={{ color: "var(--bz-green)" }} />
                                    <h3 className="text-[15px] font-semibold text-white">All done!</h3>
                                    <p className="mt-1 text-[13px] text-neutral-500">
                                        {doneTasks.length} {doneTasks.length === 1 ? "task" : "tasks"} completed today.
                                    </p>
                                </div>
                            ) : (
                                <ul className="bz-card divide-y divide-[color:var(--border)] overflow-hidden p-0">
                                    {activeTasks.map((task) => renderTaskRow(task))}
                                </ul>
                            )}

                            {/* Done tasks — separate section, only when toggled */}
                            {showCompleted && doneTasks.length > 0 && (
                                <div className="mt-6">
                                    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                        Completed
                                    </h2>
                                    <ul className="bz-card divide-y divide-[color:var(--border)] overflow-hidden p-0">
                                        {doneTasks.map((task) => renderTaskRow(task))}
                                    </ul>
                                </div>
                            )}
                        </>
                    );
                })()}
            </section>

            {pomodoroTaskId && (
                <PomodoroTimer
                    isOpen={!!pomodoroTaskId}
                    onClose={() => setPomodoroTaskId(null)}
                    preSelectedTaskId={pomodoroTaskId}
                    preSelectedMode="pomodoro"
                />
            )}

            <EndOfDaySummary
                allTasks={(allTasks as TaskWithRelations[] | undefined) ?? []}
                committedTaskIds={committedTaskIds}
                committedEstimateMinutes={committedEstimateMinutes}
                dailyGoalHours={dailyGoalHours}
            />
        </div>
    );
}

// ============================================================================
// Sticky focus-block bar + End-of-day summary
// ============================================================================

interface FocusBarProps {
    elapsedSec: number;
    running: boolean;
    onPause: () => void;
    onResume: () => void;
    onEnd: () => void;
}

function FocusBar({ elapsedSec, running, onPause, onResume, onEnd }: FocusBarProps) {
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    return (
        <div
            className="sticky top-0 z-40 mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-[color:var(--border)] bg-black/70 px-6 py-3 backdrop-blur"
            style={{
                boxShadow: "0 12px 28px -16px rgba(255,0,128,0.45)",
            }}
        >
            <div className="flex items-center gap-3">
                <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                        background: "color-mix(in oklab, var(--bz-pink) 18%, transparent)",
                        border: "1px solid color-mix(in oklab, var(--bz-pink) 40%, transparent)",
                        color: "var(--bz-pink)",
                    }}
                >
                    <Flame className="h-4 w-4" />
                </span>
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                        Focus block {running ? "· running" : "· paused"}
                    </div>
                    <div className="mono text-[20px] font-semibold leading-none text-white">
                        {time}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {running ? (
                    <button
                        type="button"
                        onClick={onPause}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-[12px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                    >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onResume}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-[12px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                    >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                    </button>
                )}
                <button
                    type="button"
                    onClick={onEnd}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-black"
                    style={{
                        background: "var(--bz-pink)",
                        boxShadow: "0 8px 24px -8px rgba(255,0,128,0.55)",
                    }}
                >
                    <StopCircle className="h-3.5 w-3.5" />
                    End
                </button>
            </div>
        </div>
    );
}

interface EndOfDaySummaryProps {
    allTasks: TaskWithRelations[];
    committedTaskIds: Set<string>;
    committedEstimateMinutes: number;
    dailyGoalHours: number;
}

function EndOfDaySummary({
    allTasks,
    committedTaskIds,
    committedEstimateMinutes,
    dailyGoalHours,
}: EndOfDaySummaryProps) {
    const { data: sessions } = useFocusSessions({ limit: 200 });
    const { data: stats } = useFocusStats();

    const todayStart = useMemo(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }, []);

    const todaySessions = useMemo(
        () =>
            (sessions ?? []).filter(
                (s) => new Date(s.startedAt) >= todayStart && s.completed,
            ),
        [sessions, todayStart],
    );

    // Per-project rollup
    const perProject = useMemo(() => {
        const map = new Map<string, { name: string; minutes: number }>();
        for (const s of todaySessions) {
            const sessionTask = (s as unknown as {
                task?: { project?: { id: string; name: string } | null } | null;
            }).task;
            const project = sessionTask?.project ?? null;
            const key = project?.id ?? "__none__";
            const name = project?.name ?? "No project";
            const cur = map.get(key) ?? { name, minutes: 0 };
            cur.minutes += s.duration ?? 0;
            map.set(key, cur);
        }
        return [...map.values()].sort((a, b) => b.minutes - a.minutes);
    }, [todaySessions]);

    const actualMinutes = todaySessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const todayPomodoros = stats?.todayPomodoros ?? 0;
    // Rough break estimate: 5 min per pomodoro, with a 15-min long break every 4
    const breakMinutes =
        todayPomodoros * 5 + Math.floor(todayPomodoros / 4) * 10; // long-break adds 10 extra over short
    const committedCount = committedTaskIds.size;
    const completedCommitted = allTasks.filter(
        (t) => committedTaskIds.has(t.id) && t.status === "DONE",
    ).length;
    const goalMinutes = dailyGoalHours * 60;
    const goalPct = goalMinutes
        ? Math.min(100, Math.round((actualMinutes / goalMinutes) * 100))
        : null;

    const fmt = (mins: number) => {
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m ? `${h}h ${m}m` : `${h}h`;
    };

    return (
        <section className="bz-card p-6">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        End of day
                    </div>
                    <h3 className="mt-1 text-[18px] font-semibold text-white">
                        Today&apos;s scoreboard
                    </h3>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <Flame className="h-3.5 w-3.5" style={{ color: "var(--bz-pink)" }} />
                    <span className="mono">{stats?.streak ?? 0}-day streak</span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-[color:var(--border)] bg-black/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Committed vs actual
                    </div>
                    <div className="mono mt-2 text-[22px] font-semibold text-white">
                        {fmt(actualMinutes)}{" "}
                        <span className="text-[14px] text-neutral-500">
                            / {fmt(committedEstimateMinutes)}
                        </span>
                    </div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-black/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Pomodoros
                    </div>
                    <div className="mono mt-2 text-[22px] font-semibold text-white">
                        {todayPomodoros}
                    </div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-black/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Breaks (est.)
                    </div>
                    <div className="mono mt-2 text-[22px] font-semibold text-white">
                        {fmt(breakMinutes)}
                    </div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-black/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Tasks done
                    </div>
                    <div className="mono mt-2 text-[22px] font-semibold text-white">
                        {completedCommitted}{" "}
                        <span className="text-[14px] text-neutral-500">/ {committedCount}</span>
                    </div>
                </div>
            </div>

            {goalPct !== null && (
                <div className="mt-5">
                    <div className="mono mb-1.5 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>
                            Focus vs goal · {fmt(actualMinutes)} / {dailyGoalHours}h
                        </span>
                        <span>{goalPct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${goalPct}%`,
                                background:
                                    "linear-gradient(90deg, var(--bz-blue), var(--bz-mint))",
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="mt-6">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    By project
                </div>
                {perProject.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-[12px] text-neutral-500">
                        No focus time logged yet today.
                    </div>
                ) : (
                    <ul className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-black/20">
                        {perProject.map((p) => {
                            const pct = actualMinutes
                                ? Math.round((p.minutes / actualMinutes) * 100)
                                : 0;
                            return (
                                <li
                                    key={p.name}
                                    className="flex items-center gap-4 px-4 py-3"
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: "var(--bz-mint)" }}
                                    />
                                    <span className="flex-1 truncate text-[13px] text-white">
                                        {p.name}
                                    </span>
                                    <span className="mono text-[11px] text-neutral-500">
                                        {pct}%
                                    </span>
                                    <span className="mono w-16 text-right text-[12px] text-white">
                                        {fmt(p.minutes)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Daily Reflection */}
            <DailyReflectionSection />
        </section>
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
        { value: 1, emoji: "\uD83D\uDE29" },
        { value: 2, emoji: "\uD83D\uDE15" },
        { value: 3, emoji: "\uD83D\uDE10" },
        { value: 4, emoji: "\uD83D\uDE42" },
        { value: 5, emoji: "\uD83D\uDE0A" },
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

    return (
        <div
            className="mt-6 rounded-xl border p-5"
            style={{
                borderColor: "color-mix(in oklab, var(--bz-amber) 30%, var(--border))",
                background: "color-mix(in oklab, var(--bz-amber) 4%, var(--card))",
            }}
        >
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[13px] font-medium text-white">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--bz-amber)" }} />
                    Daily reflection
                </h3>
                {!editing && reflection && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-[11px] text-neutral-400 hover:text-white"
                    >
                        Edit
                    </button>
                )}
            </div>

            {editing ? (
                <div className="space-y-4">
                    {/* Mood */}
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
                            style={{
                                background: "var(--bz-amber)",
                                boxShadow: "0 8px 24px -8px rgba(255,191,0,0.4)",
                            }}
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
            ) : reflection ? (
                <div className="space-y-2 text-sm">
                    {reflection.mood && (
                        <div className="text-xl">
                            {MOODS.find((m) => m.value === reflection.mood)?.emoji}
                        </div>
                    )}
                    {reflection.highlights && (
                        <p className="text-white/70">
                            <strong className="text-white/40">Went well:</strong>{" "}
                            {reflection.highlights}
                        </p>
                    )}
                    {reflection.improvements && (
                        <p className="text-white/70">
                            <strong className="text-white/40">Improve:</strong>{" "}
                            {reflection.improvements}
                        </p>
                    )}
                    {reflection.content && (
                        <p className="text-white/50 text-xs">{reflection.content}</p>
                    )}
                </div>
            ) : (
                <p className="text-[12px] text-neutral-500">
                    No reflection yet. Take a moment to review your day.
                </p>
            )}
        </div>
    );
}

