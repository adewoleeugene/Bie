"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveFocusSession, useEndFocusSession } from "@/hooks/use-focus-sessions";
import { useUpdateTask } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { SessionReflectionModal } from "@/components/focus/session-reflection-modal";

// ─── Constants ──────────────────────────────────────────

const WORK_SEC = 25 * 60;
const SHORT_BREAK_SEC = 5 * 60;
const LONG_BREAK_SEC = 15 * 60;
const POMODOROS_BEFORE_LONG = 4;

type Phase = "work" | "short_break" | "long_break";

const BREAK_SUGGESTIONS = [
    "Stand up and stretch your arms above your head",
    "Get a glass of water",
    "Look out a window for 20 seconds",
    "Take 5 deep breaths",
    "Walk around the room",
    "Roll your shoulders and neck",
    "Close your eyes and rest them",
    "Do 10 squats",
];

function randomBreakSuggestion() {
    return BREAK_SUGGESTIONS[Math.floor(Math.random() * BREAK_SUGGESTIONS.length)];
}

// ─── SVG Timer Ring ─────────────────────────────────────

const RING_SIZE = 280;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function TimerRing({
    progress,
    phase,
}: {
    progress: number; // 0–1
    phase: Phase;
}) {
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    const color =
        phase === "work"
            ? "stroke-orange-500"
            : phase === "short_break"
              ? "stroke-blue-400"
              : "stroke-emerald-400";

    return (
        <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="rotate-[-90deg]"
        >
            <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={RING_STROKE}
                className="text-white/[0.06]"
            />
            <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
                className={`transition-all duration-1000 ease-linear ${color}`}
            />
        </svg>
    );
}

// ─── Pomodoro Dots ──────────────────────────────────────

function PomodoroDots({
    completed,
    total,
}: {
    completed: number;
    total: number;
}) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                        i < completed
                            ? "bg-orange-500"
                            : "bg-white/[0.1]"
                    }`}
                />
            ))}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────

interface DeepFocusViewProps {
    sessionId: string;
    taskId: string | null;
    taskTitle: string;
    taskPriority?: string;
    projectName?: string;
    sessionType: "POMODORO" | "FREE";
    startedAt: Date;
    pomodoroCount: number;
}

export function DeepFocusView({
    sessionId,
    taskId,
    taskTitle,
    taskPriority,
    projectName,
    sessionType,
    startedAt,
    pomodoroCount: initialPomodoroCount,
}: DeepFocusViewProps) {
    const router = useRouter();
    const endSession = useEndFocusSession();
    const updateTask = useUpdateTask();

    const [isRunning, setIsRunning] = useState(true);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [phase, setPhase] = useState<Phase>("work");
    const [timeRemaining, setTimeRemaining] = useState(WORK_SEC);
    const [pomodoroCount, setPomodoroCount] = useState(initialPomodoroCount);
    const [breakSuggestion] = useState(randomBreakSuggestion);
    const [exiting, setExiting] = useState(false);
    const [showReflection, setShowReflection] = useState(false);
    const [sessionDurationMin, setSessionDurationMin] = useState(0);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Calculate initial state from startedAt
    useEffect(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
        setElapsedSec(elapsed);

        if (sessionType === "POMODORO") {
            // Reconstruct phase from elapsed time
            const cycleLen =
                POMODOROS_BEFORE_LONG * WORK_SEC +
                (POMODOROS_BEFORE_LONG - 1) * SHORT_BREAK_SEC +
                LONG_BREAK_SEC;
            let rem = elapsed % cycleLen;
            let p: Phase = "work";
            let left = WORK_SEC;
            for (let i = 0; i < POMODOROS_BEFORE_LONG; i++) {
                if (rem < WORK_SEC) {
                    p = "work";
                    left = WORK_SEC - rem;
                    break;
                }
                rem -= WORK_SEC;
                const brk = i === POMODOROS_BEFORE_LONG - 1 ? LONG_BREAK_SEC : SHORT_BREAK_SEC;
                if (rem < brk) {
                    p = i === POMODOROS_BEFORE_LONG - 1 ? "long_break" : "short_break";
                    left = brk - rem;
                    break;
                }
                rem -= brk;
            }
            setPhase(p);
            setTimeRemaining(left);
        }
    }, [startedAt, sessionType]);

    // Timer tick
    useEffect(() => {
        if (!isRunning) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setElapsedSec((s) => s + 1);
            if (sessionType === "POMODORO") {
                setTimeRemaining((t) => {
                    if (t <= 1) {
                        // Phase transition
                        setPhase((currentPhase) => {
                            if (currentPhase === "work") {
                                setPomodoroCount((c) => {
                                    const next = c + 1;
                                    if (next % POMODOROS_BEFORE_LONG === 0) {
                                        setTimeRemaining(LONG_BREAK_SEC);
                                        return next;
                                    }
                                    setTimeRemaining(SHORT_BREAK_SEC);
                                    return next;
                                });
                                // Play sound
                                playBeep();
                                return pomodoroCount > 0 && (pomodoroCount + 1) % POMODOROS_BEFORE_LONG === 0
                                    ? "long_break"
                                    : "short_break";
                            }
                            // Break → work
                            setTimeRemaining(WORK_SEC);
                            playBeep();
                            return "work";
                        });
                        return 0;
                    }
                    return t - 1;
                });
            }
        }, 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, sessionType, pomodoroCount]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                e.preventDefault();
                setIsRunning((r) => !r);
            } else if (e.code === "Enter") {
                e.preventDefault();
                handleComplete();
            } else if (e.code === "Escape") {
                e.preventDefault();
                handleExit();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Request fullscreen on mount
    useEffect(() => {
        try {
            document.documentElement.requestFullscreen?.();
        } catch {
            // Fullscreen may be blocked — that's OK
        }
        return () => {
            try {
                if (document.fullscreenElement) document.exitFullscreen?.();
            } catch {}
        };
    }, []);

    const finishAndReflect = useCallback((durationMin: number) => {
        setSessionDurationMin(durationMin);
        try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
        setIsRunning(false);
        setShowReflection(true);
    }, []);

    const handleComplete = useCallback(async () => {
        if (!taskId) return;
        await updateTask.mutateAsync({ id: taskId, status: "DONE" });
        toast.success(`"${taskTitle}" marked done`);
        await endSession.mutateAsync({
            sessionId,
            pomodoroCount,
            completed: true,
            durationMinutes: Math.round(elapsedSec / 60),
        });
        finishAndReflect(Math.round(elapsedSec / 60));
    }, [taskId, taskTitle, sessionId, pomodoroCount, elapsedSec, endSession, updateTask, finishAndReflect]);

    const handleExit = useCallback(async () => {
        setExiting(true);
        await endSession.mutateAsync({
            sessionId,
            pomodoroCount,
            completed: false,
            durationMinutes: Math.round(elapsedSec / 60),
        });
        finishAndReflect(Math.round(elapsedSec / 60));
    }, [sessionId, pomodoroCount, elapsedSec, endSession, finishAndReflect]);

    // Format time
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeDisplay = sessionType === "FREE"
        ? `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`
        : `${minutes}:${String(seconds).padStart(2, "0")}`;

    const totalPhaseSec =
        phase === "work"
            ? WORK_SEC
            : phase === "short_break"
              ? SHORT_BREAK_SEC
              : LONG_BREAK_SEC;
    const progress =
        sessionType === "POMODORO"
            ? (totalPhaseSec - timeRemaining) / totalPhaseSec
            : 0; // free mode: no ring progress

    const isBreak = phase !== "work" && sessionType === "POMODORO";

    const bgColor = isBreak
        ? "from-slate-950 via-blue-950/40 to-slate-950"
        : "from-neutral-950 via-neutral-950 to-neutral-950";

    const priorityLabel: Record<string, string> = {
        P0: "Urgent",
        P1: "High",
        P2: "Medium",
        P3: "Low",
    };

    if (showReflection) {
        return (
            <SessionReflectionModal
                taskTitle={taskTitle}
                sessionMinutes={sessionDurationMin}
                onDone={() => router.push("/my-day")}
            />
        );
    }

    return (
        <div
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b ${bgColor} text-white select-none`}
        >
            {/* Phase label */}
            <div className="mb-8 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    {isBreak
                        ? phase === "long_break"
                            ? "Long break"
                            : "Short break"
                        : sessionType === "FREE"
                          ? "Free focus"
                          : "Focus"}
                </div>
            </div>

            {/* Timer ring + time */}
            <div className="relative mb-8">
                {sessionType === "POMODORO" && (
                    <TimerRing progress={progress} phase={phase} />
                )}
                <div
                    className={`absolute inset-0 flex flex-col items-center justify-center ${
                        sessionType === "FREE" ? "relative" : ""
                    }`}
                >
                    <div
                        className={`font-mono font-bold leading-none tracking-tight ${
                            sessionType === "FREE" ? "text-[80px]" : "text-[64px]"
                        }`}
                    >
                        {timeDisplay}
                    </div>
                    {!isRunning && (
                        <div className="mt-2 text-xs uppercase tracking-wider text-white/40 animate-pulse">
                            Paused
                        </div>
                    )}
                </div>
            </div>

            {/* Pomodoro dots */}
            {sessionType === "POMODORO" && (
                <div className="mb-8">
                    <PomodoroDots completed={pomodoroCount} total={POMODOROS_BEFORE_LONG} />
                </div>
            )}

            {/* Task info or break suggestion */}
            {isBreak ? (
                <div className="mb-12 text-center">
                    <p className="text-sm text-blue-300/70">{breakSuggestion}</p>
                </div>
            ) : (
                <div className="mb-12 text-center max-w-md">
                    <h2 className="text-xl font-semibold leading-tight">
                        {taskTitle || "Untitled task"}
                    </h2>
                    <div className="mt-2 flex items-center justify-center gap-3 text-xs text-white/40">
                        {taskPriority && priorityLabel[taskPriority] && (
                            <span>{priorityLabel[taskPriority]}</span>
                        )}
                        {projectName && (
                            <>
                                <span>·</span>
                                <span>{projectName}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Keyboard hints */}
            <div className="flex items-center gap-6 text-[11px] text-white/20">
                <button
                    type="button"
                    onClick={() => setIsRunning((r) => !r)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.05] hover:text-white/40"
                >
                    <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                        Space
                    </kbd>
                    {isRunning ? "Pause" : "Resume"}
                </button>
                {taskId && !isBreak && (
                    <button
                        type="button"
                        onClick={handleComplete}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.05] hover:text-white/40"
                    >
                        <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                            Enter
                        </kbd>
                        Done
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleExit}
                    disabled={exiting}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.05] hover:text-white/40"
                >
                    <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                        Esc
                    </kbd>
                    {exiting ? "Exiting…" : "Exit"}
                </button>
            </div>
        </div>
    );
}

function playBeep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    } catch {
        // Audio not available — silent
    }
}
