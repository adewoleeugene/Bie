"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
    Sun,
    Calendar,
    CheckCircle2,
    ArrowUp,
    ArrowDown,
    Play,
    Pause,
    StopCircle,
    Flame,
    Coffee,
    Settings2,
    SkipForward,
    Circle,
    Check,
    Sparkles,
    Star,
    ChevronDown,
    Notebook,
} from "lucide-react";
import { PomodoroTimer } from "@/components/focus/pomodoro-timer";
import { AIPlanPicker } from "@/components/daily-planner/ai-plan-picker";
import { useDailyReflection, useUpsertReflection } from "@/hooks/use-reflections";
import { useTasks, useUpdateTask, useMarkTaskInProgressForFocus } from "@/hooks/use-tasks";
import { useFocusStats } from "@/hooks/use-focus-sessions";
import { useTimeTrackingStats, useCreateTimeEntry } from "@/hooks/use-time-entries";

// ----- config -------------------------------------------------------------

// Pomodoro durations are shared with the per-task timer via these localStorage
// keys, so a change in one place applies everywhere.
const WORK_KEY = "pomodoro-work";
const BREAK_KEY = "pomodoro-short-break";
const LONG_BREAK_KEY = "pomodoro-long-break";
const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const DEFAULT_LONG_BREAK_MIN = 15;
const MAX_WORK_MIN = 120;
const MAX_BREAK_MIN = 60;
const MAX_LONG_BREAK_MIN = 60;
const POMODOROS_BEFORE_LONG = 4; // long break after every 4 focus rounds

function readDurationSetting(key: string, fallback: number): number {
    if (typeof window === "undefined") return fallback;
    const stored = parseInt(localStorage.getItem(key) || "", 10);
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
}

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
    completedAt?: string | Date | null;
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

    const createTimeEntry = useCreateTimeEntry();
    const markInProgress = useMarkTaskInProgressForFocus();

    const [showCompleted, setShowCompleted] = useState(false);

    // Per-task pomodoro launcher (uses existing PomodoroTimer)
    const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
    const startFocusForTask = (taskId: string) => setPomodoroTaskId(taskId);

    // ----- multi-select → holistic focus block --------------------------
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (taskId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    // The running block: a client-side timer worked as a sequential queue.
    // Time from `lastMark` → `blockElapsed` is the current task's segment;
    // it's logged to that task's Hours whenever we leave it (done/skip/end).
    // Deliberately no server focus session — that would trigger the global
    // Pomodoro popup and can orphan an open session.
    const [blockActive, setBlockActive] = useState(false);
    const [blockQueue, setBlockQueue] = useState<string[]>([]); // queue[0] = current
    const [blockRunning, setBlockRunning] = useState(false);
    const [blockElapsed, setBlockElapsed] = useState(0); // focused seconds (work only)
    const [lastMark, setLastMark] = useState(0); // blockElapsed when current task began
    // User-editable Pomodoro durations (persisted, shared with the per-task timer).
    const [workMin, setWorkMin] = useState(() => readDurationSetting(WORK_KEY, DEFAULT_WORK_MIN));
    const [breakMin, setBreakMin] = useState(() => readDurationSetting(BREAK_KEY, DEFAULT_BREAK_MIN));
    const [longBreakMin, setLongBreakMin] = useState(() => readDurationSetting(LONG_BREAK_KEY, DEFAULT_LONG_BREAK_MIN));
    const workSecRef = useRef(workMin * 60);
    const breakSecRef = useRef(breakMin * 60);
    const longBreakSecRef = useRef(longBreakMin * 60);
    useEffect(() => { workSecRef.current = workMin * 60; }, [workMin]);
    useEffect(() => { breakSecRef.current = breakMin * 60; }, [breakMin]);
    useEffect(() => { longBreakSecRef.current = longBreakMin * 60; }, [longBreakMin]);
    // Count of completed focus rounds — every 4th break is a long one.
    const pomodoroCountRef = useRef(0);
    const [breakKind, setBreakKind] = useState<"short" | "long">("short");

    const setDuration = (
        key: string,
        minutes: number,
        setter: (n: number) => void,
        max: number,
    ) => {
        const clamped = Math.max(1, Math.min(max, Math.round(minutes) || 1));
        setter(clamped);
        try {
            localStorage.setItem(key, String(clamped));
        } catch {
            /* ignore */
        }
    };

    const [showPomoSettings, setShowPomoSettings] = useState(false);

    // Pomodoro rhythm — runs across the whole block; tasks switch underneath it.
    const [blockMode, setBlockMode] = useState<"pomodoro" | "free">("pomodoro");
    const [phase, setPhase] = useState<"work" | "break">("work");
    const [phaseRemaining, setPhaseRemaining] = useState(workMin * 60);
    const phaseRef = useRef<"work" | "break">("work");
    const remainingRef = useRef(workMin * 60);
    const modeRef = useRef<"pomodoro" | "free">("pomodoro");
    const blockTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!blockRunning) return;
        blockTickRef.current = setInterval(() => {
            if (modeRef.current === "free") {
                setBlockElapsed((s) => s + 1);
                return;
            }
            // Pomodoro: count down the phase; focus seconds accrue in "work".
            const next = remainingRef.current - 1;
            if (next <= 0) {
                if (phaseRef.current === "work") {
                    pomodoroCountRef.current += 1;
                    const isLong = pomodoroCountRef.current % POMODOROS_BEFORE_LONG === 0;
                    phaseRef.current = "break";
                    remainingRef.current = isLong ? longBreakSecRef.current : breakSecRef.current;
                    setBreakKind(isLong ? "long" : "short");
                    setPhase("break");
                } else {
                    phaseRef.current = "work";
                    remainingRef.current = workSecRef.current;
                    setPhase("work");
                }
                setPhaseRemaining(remainingRef.current);
            } else {
                remainingRef.current = next;
                if (phaseRef.current === "work") setBlockElapsed((s) => s + 1);
                setPhaseRemaining(next);
            }
        }, 1000);
        return () => {
            if (blockTickRef.current) clearInterval(blockTickRef.current);
        };
    }, [blockRunning]);

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
                if (task.status === "DONE") {
                    if (!showCompleted) return false;
                    // Show anything completed today, plus done tasks that were
                    // on today's list by due date.
                    const done = task.completedAt ? new Date(task.completedAt) : null;
                    const doneToday = !!done && done >= todayStart;
                    const dueByToday = !!task.dueDate && new Date(task.dueDate) < todayEnd;
                    return doneToday || dueByToday;
                }
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

    const tasksById = useMemo(() => {
        const map = new Map<string, TaskWithRelations>();
        for (const t of (allTasks as TaskWithRelations[] | undefined) ?? []) map.set(t.id, t);
        return map;
    }, [allTasks]);

    const blockTasks = blockQueue
        .map((id) => tasksById.get(id))
        .filter((t): t is TaskWithRelations => Boolean(t));
    const currentTask = blockTasks[0] ?? null;
    const upcomingTasks = blockTasks.slice(1);

    // Log the current task's segment (lastMark → blockElapsed) to Hours.
    const logSegment = async (taskId: string) => {
        const seconds = Math.max(0, blockElapsed - lastMark);
        const minutes = Math.round(seconds / 60);
        if (minutes < 1) return; // don't log sub-minute noise
        const endedAt = new Date();
        const startedAt = new Date(endedAt.getTime() - seconds * 1000);
        await createTimeEntry.mutateAsync({
            taskId,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            duration: minutes,
            description: "Holistic focus",
        });
    };

    const startHolisticFocus = (mode: "pomodoro" | "free") => {
        if (blockActive || selectedIds.size === 0) return;
        const queue = [...selectedIds];
        modeRef.current = mode;
        phaseRef.current = "work";
        remainingRef.current = workMin * 60;
        pomodoroCountRef.current = 0;
        setBreakKind("short");
        setBlockMode(mode);
        setPhase("work");
        setPhaseRemaining(workMin * 60);
        setBlockActive(true);
        setBlockQueue(queue);
        setBlockElapsed(0);
        setLastMark(0);
        setBlockRunning(true);
        setSelectedIds(new Set());
        // Focusing on the first task moves it to In Progress on the board.
        if (queue[0]) markInProgress.mutate(queue[0]);
    };

    // Finish the current task: log its time, mark it done, advance the queue.
    const completeCurrent = async () => {
        if (!currentTask) return;
        await logSegment(currentTask.id);
        await updateTask.mutateAsync({ id: currentTask.id, status: "DONE" });
        setLastMark(blockElapsed);
        const rest = blockQueue.slice(1);
        if (rest.length === 0) {
            resetBlock();
        } else {
            setBlockQueue(rest);
            if (rest[0]) markInProgress.mutate(rest[0]);
        }
    };

    // Defer the current task: log its time, leave it not-done. If others
    // remain, send it to the back; if it's the last, that ends the block.
    const skipCurrent = async () => {
        if (!currentTask) return;
        await logSegment(currentTask.id);
        if (blockQueue.length < 2) {
            resetBlock();
            return;
        }
        setLastMark(blockElapsed);
        setBlockQueue((q) => [...q.slice(1), q[0]]);
        // The next task in line becomes active → move it to In Progress.
        if (blockQueue[1]) markInProgress.mutate(blockQueue[1]);
    };

    const resetBlock = () => {
        setBlockActive(false);
        setBlockQueue([]);
        setBlockRunning(false);
        setBlockElapsed(0);
        setLastMark(0);
        phaseRef.current = "work";
        remainingRef.current = workMin * 60;
        pomodoroCountRef.current = 0;
        setBreakKind("short");
        setPhase("work");
        setPhaseRemaining(workMin * 60);
    };

    // Skip the current break → jump straight back to a fresh focus round.
    const skipBreak = () => {
        if (phaseRef.current !== "break") return;
        phaseRef.current = "work";
        remainingRef.current = workMin * 60;
        setPhase("work");
        setPhaseRemaining(workMin * 60);
    };

    // End early: the still-open segment goes to whatever task is current.
    const endHolisticFocus = async () => {
        if (currentTask) await logSegment(currentTask.id);
        resetBlock();
    };

    const renderTaskRow = (task: TaskWithRelations) => {
        const isDone = task.status === "DONE";
        const isOverdue =
            !!task.dueDate && new Date(task.dueDate) < todayStart && !isDone;
        const prio = PRIORITY_CONFIG[task.priority];
        const status = STATUS_CONFIG[task.status];
        const isPinned = pinnedTaskIds.has(task.id);
        const isSelected = selectedIds.has(task.id);
        const canSelect = !isDone && !blockActive;
        const edge = isOverdue ? "var(--bz-red)" : status?.color ?? "transparent";

        return (
            <li
                key={task.id}
                className={cn(
                    "group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025]",
                    isDone && "opacity-50",
                    isSelected && "bg-white/[0.04]",
                )}
            >
                <span
                    aria-hidden
                    className="absolute left-0 top-0 h-full w-[3px]"
                    style={{ background: isSelected ? "var(--bz-pink)" : edge }}
                />
                {canSelect && (
                    <button
                        type="button"
                        onClick={() => toggleSelect(task.id)}
                        aria-label={isSelected ? "Deselect task" : "Select for focus"}
                        aria-pressed={isSelected}
                        className={cn(
                            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-all",
                            isSelected
                                ? "border-transparent text-black"
                                : "border-neutral-600 text-transparent opacity-0 hover:border-neutral-400 group-hover:opacity-100",
                            selectedIds.size > 0 && !isSelected && "opacity-100",
                        )}
                        style={isSelected ? { background: "var(--bz-pink)" } : undefined}
                    >
                        {isSelected ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
                    </button>
                )}
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
                    {!isDone ? (
                        <>
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
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleDone(task);
                                }}
                                aria-label="Mark done"
                                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:text-white"
                                style={{ borderColor: "var(--border)" }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor =
                                        "color-mix(in oklab, var(--bz-green) 55%, transparent)";
                                    e.currentTarget.style.background =
                                        "color-mix(in oklab, var(--bz-green) 12%, transparent)";
                                    e.currentTarget.style.color = "var(--bz-green)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "var(--border)";
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.color = "";
                                }}
                            >
                                <Check className="h-3 w-3" />
                                Done
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleDone(task);
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:text-white"
                        >
                            Undo
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
            {blockActive && currentTask && (
                <FocusBar
                    current={currentTask}
                    upcoming={upcomingTasks}
                    mode={blockMode}
                    phase={phase}
                    breakKind={breakKind}
                    phaseRemaining={phaseRemaining}
                    segmentSec={Math.max(0, blockElapsed - lastMark)}
                    totalSec={blockElapsed}
                    running={blockRunning}
                    busy={createTimeEntry.isPending || updateTask.isPending}
                    onDone={completeCurrent}
                    onSkip={skipCurrent}
                    onSkipBreak={skipBreak}
                    onPause={() => setBlockRunning(false)}
                    onResume={() => setBlockRunning(true)}
                    onEnd={endHolisticFocus}
                />
            )}
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

            {/* ===== Multi-select → holistic focus ===== */}
            {selectedIds.size > 0 && !blockActive && (
                <div className="sticky bottom-6 z-40">
                    {blockMode === "pomodoro" && showPomoSettings && (
                        <div className="mx-auto mb-2 flex max-w-xl items-center gap-5 rounded-2xl border border-[color:var(--border)] bg-black/80 px-5 py-3 text-[12px] text-neutral-300 backdrop-blur">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                                Timing
                            </span>
                            <label className="flex items-center gap-2">
                                Focus
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_WORK_MIN}
                                    value={workMin}
                                    onChange={(e) =>
                                        setDuration(WORK_KEY, parseInt(e.target.value) || DEFAULT_WORK_MIN, setWorkMin, MAX_WORK_MIN)
                                    }
                                    className="mono w-14 rounded-md border border-[color:var(--border)] bg-white/[0.04] px-2 py-1 text-center text-white outline-none focus:ring-1 focus:ring-[var(--bz-pink)]"
                                />
                                min
                            </label>
                            <label className="flex items-center gap-2">
                                Break
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_BREAK_MIN}
                                    value={breakMin}
                                    onChange={(e) =>
                                        setDuration(BREAK_KEY, parseInt(e.target.value) || DEFAULT_BREAK_MIN, setBreakMin, MAX_BREAK_MIN)
                                    }
                                    className="mono w-14 rounded-md border border-[color:var(--border)] bg-white/[0.04] px-2 py-1 text-center text-white outline-none focus:ring-1 focus:ring-[var(--bz-pink)]"
                                />
                                min
                            </label>
                            <label className="flex items-center gap-2">
                                Long break
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_LONG_BREAK_MIN}
                                    value={longBreakMin}
                                    onChange={(e) =>
                                        setDuration(LONG_BREAK_KEY, parseInt(e.target.value) || DEFAULT_LONG_BREAK_MIN, setLongBreakMin, MAX_LONG_BREAK_MIN)
                                    }
                                    className="mono w-14 rounded-md border border-[color:var(--border)] bg-white/[0.04] px-2 py-1 text-center text-white outline-none focus:ring-1 focus:ring-[var(--bz-pink)]"
                                />
                                min
                            </label>
                            <span className="text-[11px] text-neutral-500">every {POMODOROS_BEFORE_LONG}</span>
                        </div>
                    )}
                    <div
                        className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-black/80 px-5 py-3 backdrop-blur"
                        style={{ boxShadow: "0 16px 40px -16px rgba(0,0,0,0.8)" }}
                    >
                        <div className="flex items-center gap-2 text-[13px]">
                            <span className="mono font-semibold text-white">{selectedIds.size}</span>
                            <span className="text-neutral-400">
                                {selectedIds.size === 1 ? "task selected" : "tasks selected"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Pomodoro / Free toggle */}
                            <div className="flex items-center rounded-lg border border-[color:var(--border)] p-0.5">
                                {(["pomodoro", "free"] as const).map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setBlockMode(m)}
                                        className={cn(
                                            "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                                            blockMode === m
                                                ? "bg-white/[0.1] text-white"
                                                : "text-neutral-500 hover:text-neutral-300",
                                        )}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                            {blockMode === "pomodoro" && (
                                <button
                                    type="button"
                                    onClick={() => setShowPomoSettings((s) => !s)}
                                    aria-label="Pomodoro timing"
                                    aria-pressed={showPomoSettings}
                                    className={cn(
                                        "rounded-lg border border-[color:var(--border)] p-1.5 transition-colors hover:bg-white/[0.06] hover:text-white",
                                        showPomoSettings ? "text-white bg-white/[0.06]" : "text-neutral-400",
                                    )}
                                >
                                    <Settings2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setSelectedIds(new Set())}
                                className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-400 hover:text-white"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => startHolisticFocus(blockMode)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-black transition-all"
                                style={{ background: "var(--bz-pink)" }}
                            >
                                <Play className="h-3.5 w-3.5" />
                                Start focus
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
// Sticky holistic-focus bar
// ============================================================================

function fmtClock(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return h > 0 ? `${h}:${mm}` : mm;
}

interface FocusBarProps {
    current: TaskWithRelations;
    upcoming: TaskWithRelations[];
    mode: "pomodoro" | "free";
    phase: "work" | "break";
    breakKind: "short" | "long";
    phaseRemaining: number;
    segmentSec: number;
    totalSec: number;
    running: boolean;
    busy: boolean;
    onDone: () => void;
    onSkip?: () => void;
    onSkipBreak: () => void;
    onPause: () => void;
    onResume: () => void;
    onEnd: () => void;
}

function FocusBar({
    current,
    upcoming,
    mode,
    phase,
    breakKind,
    phaseRemaining,
    segmentSec,
    totalSec,
    running,
    busy,
    onDone,
    onSkip,
    onSkipBreak,
    onPause,
    onResume,
    onEnd,
}: FocusBarProps) {
    const remaining = upcoming.length + 1;
    const onBreak = mode === "pomodoro" && phase === "break";
    const bigTimer = mode === "pomodoro" ? fmtClock(phaseRemaining) : fmtClock(segmentSec);
    const timerLabel =
        mode !== "pomodoro" ? "Elapsed" : onBreak ? (breakKind === "long" ? "Long break" : "Break") : "Focus";
    const accent = onBreak ? "var(--bz-mint)" : "var(--bz-pink)";

    return (
        <div
            className="sticky top-4 z-40 rounded-2xl border bg-black/80 p-4 backdrop-blur"
            style={{
                borderColor: "color-mix(in oklab, var(--bz-pink) 40%, var(--border))",
                boxShadow: "0 16px 40px -18px rgba(255,0,128,0.5)",
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    <Flame className="h-3.5 w-3.5" style={{ color: "var(--bz-pink)" }} />
                    Holistic focus · {remaining} {remaining === 1 ? "task left" : "tasks left"}
                    {!running && " · paused"}
                </div>
                <div className="flex items-center gap-3">
                    <span className="mono text-[11px] text-neutral-500">total {fmtClock(totalSec)}</span>
                    <button
                        type="button"
                        onClick={running ? onPause : onResume}
                        aria-label={running ? "Pause" : "Resume"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-[12px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                    >
                        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={onEnd}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-[12px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                    >
                        <StopCircle className="h-3.5 w-3.5" />
                        End
                    </button>
                </div>
            </div>

            {/* Current task */}
            <div className="mt-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-semibold text-white">{current.title}</div>
                    {current.project && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bz-mint)" }} />
                            {current.project.name}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end">
                    <span
                        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: mode === "pomodoro" ? accent : "var(--muted-foreground, #737373)" }}
                    >
                        {onBreak ? <Coffee className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                        {timerLabel}
                    </span>
                    <span
                        className="mono text-[26px] font-semibold leading-none tabular-nums"
                        style={{ color: onBreak ? "var(--bz-mint)" : "#fff" }}
                    >
                        {bigTimer}
                    </span>
                    {mode === "pomodoro" && !onBreak && (
                        <span className="mono mt-1 text-[10px] text-neutral-500">
                            {fmtClock(segmentSec)} on this task
                        </span>
                    )}
                    {onBreak && (
                        <button
                            type="button"
                            onClick={onSkipBreak}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                            <SkipForward className="h-3 w-3" />
                            Skip break
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onDone}
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-black transition-all disabled:opacity-50"
                    style={{ background: "var(--bz-pink)" }}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    {upcoming.length > 0 ? "Done · next" : "Done · finish"}
                </button>
                {onSkip && (
                    <button
                        type="button"
                        onClick={onSkip}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-2 text-[13px] font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                    >
                        {upcoming.length > 0 ? "Skip" : "Skip · finish"}
                    </button>
                )}
            </div>

            {upcoming.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-[color:var(--border)] pt-3">
                    {upcoming.map((task, i) => (
                        <li
                            key={task.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] text-neutral-400"
                        >
                            <span className="mono text-neutral-600">{i + 1}</span>
                            <span className="max-w-[180px] truncate">{task.title}</span>
                        </li>
                    ))}
                </ul>
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
