"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Play,
    Pause,
    Square,
    Timer,
    Coffee,
    Flame,
    SkipForward,
    Target,
    Zap,
} from "lucide-react";
import { useStartFocusSession, useEndFocusSession, useActiveFocusSession } from "@/hooks/use-focus-sessions";
import { useTasks } from "@/hooks/use-tasks";

const POMODORO_WORK = 25 * 60; // 25 minutes in seconds
const POMODORO_SHORT_BREAK = 5 * 60; // 5 minutes
const POMODORO_LONG_BREAK = 15 * 60; // 15 minutes
const POMODOROS_BEFORE_LONG_BREAK = 4;

type TimerPhase = "work" | "short_break" | "long_break";

interface PomodoroTimerProps {
    /** When provided, opens as a controlled dialog for a specific task */
    preSelectedTaskId?: string | null;
    preSelectedMode?: "pomodoro" | "free";
    isOpen?: boolean;
    onClose?: () => void;
}

export function PomodoroTimer({
    preSelectedTaskId,
    preSelectedMode,
    isOpen: externalIsOpen,
    onClose,
}: PomodoroTimerProps = {}) {
    const isControlled = externalIsOpen !== undefined;
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = isControlled ? externalIsOpen : internalIsOpen;
    const setIsOpen = isControlled
        ? (open: boolean) => { if (!open && onClose) onClose(); }
        : setInternalIsOpen;

    const [mode, setMode] = useState<"pomodoro" | "free">(preSelectedMode || "pomodoro");
    const [selectedTaskId, setSelectedTaskId] = useState<string>(preSelectedTaskId || "");
    const [notes, setNotes] = useState("");

    // Timer state
    const [isRunning, setIsRunning] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(POMODORO_WORK);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [phase, setPhase] = useState<TimerPhase>("work");
    const [pomodoroCount, setPomodoroCount] = useState(0);
    const [sessionActive, setSessionActive] = useState(false);

    // Refs for interval
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Hooks
    const { data: tasks } = useTasks();
    const startSession = useStartFocusSession();
    const endSession = useEndFocusSession();
    const { data: activeSession } = useActiveFocusSession();

    // Sync pre-selected values when they change (controlled mode)
    useEffect(() => {
        if (preSelectedTaskId) {
            setSelectedTaskId(preSelectedTaskId);
        }
    }, [preSelectedTaskId]);

    useEffect(() => {
        if (preSelectedMode) {
            setMode(preSelectedMode);
        }
    }, [preSelectedMode]);

    // Create audio context for notification sound
    const playNotificationSound = useCallback(() => {
        try {
            const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 800;
            oscillator.type = "sine";
            gainNode.gain.value = 0.3;

            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch {
            // Audio not available
        }
    }, []);

    // Request browser notification permission
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const sendNotification = useCallback((title: string, body: string) => {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, icon: "/favicon.ico" });
        }
        playNotificationSound();
    }, [playNotificationSound]);

    // Timer logic
    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                if (mode === "pomodoro") {
                    setTimeRemaining((prev) => {
                        if (prev <= 1) {
                            // Phase completed
                            if (phase === "work") {
                                const newCount = pomodoroCount + 1;
                                setPomodoroCount(newCount);

                                if (newCount % POMODOROS_BEFORE_LONG_BREAK === 0) {
                                    setPhase("long_break");
                                    setTimeRemaining(POMODORO_LONG_BREAK);
                                    sendNotification(
                                        "Long break time! ☕",
                                        `Great work! ${newCount} pomodoros completed. Take a 15-minute break.`
                                    );
                                } else {
                                    setPhase("short_break");
                                    setTimeRemaining(POMODORO_SHORT_BREAK);
                                    sendNotification(
                                        "Short break! 🎉",
                                        `Pomodoro #${newCount} done! Take a 5-minute break.`
                                    );
                                }
                                setIsRunning(false);
                            } else {
                                // Break is over
                                setPhase("work");
                                setTimeRemaining(POMODORO_WORK);
                                sendNotification(
                                    "Break's over! 🔥",
                                    "Time to get back to work!"
                                );
                                setIsRunning(false);
                            }
                            return 0;
                        }
                        return prev - 1;
                    });
                }
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, mode, phase, pomodoroCount, sendNotification]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const handleStart = async () => {
        if (!sessionActive) {
            // Start a new focus session
            const result = await startSession.mutateAsync({
                taskId: selectedTaskId || null,
                type: mode === "pomodoro" ? "POMODORO" : "FREE",
                notes: notes || null,
            });

            if (result.success) {
                setSessionActive(true);
                setIsRunning(true);
                setElapsedSeconds(0);
                if (mode === "pomodoro") {
                    setTimeRemaining(POMODORO_WORK);
                    setPhase("work");
                    setPomodoroCount(0);
                }
            }
        } else {
            setIsRunning(true);
        }
    };

    const handlePause = () => {
        setIsRunning(false);
    };

    const handleStop = async () => {
        setIsRunning(false);

        if (activeSession) {
            await endSession.mutateAsync({
                sessionId: activeSession.id,
                notes: notes || null,
                pomodoroCount,
                completed: true,
            });
        }

        // Reset
        setSessionActive(false);
        setElapsedSeconds(0);
        setTimeRemaining(POMODORO_WORK);
        setPhase("work");
        setPomodoroCount(0);
        setNotes("");

        // Close if controlled
        if (onClose) onClose();
    };

    const handleSkipBreak = () => {
        setPhase("work");
        setTimeRemaining(POMODORO_WORK);
        setIsRunning(false);
    };

    const getPhaseColor = () => {
        switch (phase) {
            case "work":
                return "text-orange-500";
            case "short_break":
                return "text-green-500";
            case "long_break":
                return "text-blue-500";
        }
    };

    const getPhaseLabel = () => {
        switch (phase) {
            case "work":
                return "Focus";
            case "short_break":
                return "Short Break";
            case "long_break":
                return "Long Break";
        }
    };

    const getPhaseIcon = () => {
        switch (phase) {
            case "work":
                return <Flame className="h-4 w-4" />;
            case "short_break":
                return <Coffee className="h-4 w-4" />;
            case "long_break":
                return <Coffee className="h-4 w-4" />;
        }
    };

    // Get name of the currently selected task
    const selectedTask = tasks?.find((t: any) => t.id === selectedTaskId);

    // Calculate progress for the ring
    const totalTime =
        phase === "work"
            ? POMODORO_WORK
            : phase === "short_break"
                ? POMODORO_SHORT_BREAK
                : POMODORO_LONG_BREAK;
    const progress = mode === "pomodoro" ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;
    const circumference = 2 * Math.PI * 90;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const dialogContent = (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    Focus Session
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
                {/* Linked Task Display */}
                {selectedTask && (
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 p-3">
                        <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-orange-500 shrink-0" />
                            <span className="font-medium text-sm truncate">{selectedTask.title}</span>
                        </div>
                        {(selectedTask as any).project && (
                            <span className="text-xs text-neutral-500 ml-6">
                                {(selectedTask as any).project.name}
                            </span>
                        )}
                    </div>
                )}

                {/* Mode Selector */}
                {!sessionActive && (
                    <div className="flex gap-2">
                        <Button
                            variant={mode === "pomodoro" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setMode("pomodoro")}
                        >
                            <Target className="mr-2 h-4 w-4" />
                            Pomodoro
                        </Button>
                        <Button
                            variant={mode === "free" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setMode("free")}
                        >
                            <Timer className="mr-2 h-4 w-4" />
                            Free Focus
                        </Button>
                    </div>
                )}

                {/* Timer Display */}
                <div className="flex flex-col items-center py-4">
                    {mode === "pomodoro" ? (
                        <div className="relative">
                            {/* Progress Ring */}
                            <svg
                                className="transform -rotate-90"
                                width="200"
                                height="200"
                            >
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="90"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    className="text-neutral-200 dark:text-neutral-800"
                                />
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="90"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    className={cn(
                                        "transition-all duration-1000",
                                        phase === "work" && "text-orange-500",
                                        phase === "short_break" && "text-green-500",
                                        phase === "long_break" && "text-blue-500"
                                    )}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className={cn("flex items-center gap-1 text-xs font-medium mb-1", getPhaseColor())}>
                                    {getPhaseIcon()}
                                    {getPhaseLabel()}
                                </div>
                                <span className="text-4xl font-mono font-bold tabular-nums">
                                    {formatTime(timeRemaining)}
                                </span>
                                {pomodoroCount > 0 && (
                                    <div className="flex gap-1 mt-2">
                                        {Array.from({ length: pomodoroCount }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="h-2 w-2 rounded-full bg-orange-500"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-medium text-neutral-500 mb-2">
                                Elapsed Time
                            </span>
                            <span className="text-5xl font-mono font-bold tabular-nums">
                                {formatTime(elapsedSeconds)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Pomodoro Count */}
                {mode === "pomodoro" && pomodoroCount > 0 && (
                    <div className="text-center">
                        <Badge
                            variant="secondary"
                            className="gap-1"
                        >
                            <Flame className="h-3 w-3 text-orange-500" />
                            {pomodoroCount} {pomodoroCount === 1 ? "Pomodoro" : "Pomodoros"} completed
                        </Badge>
                    </div>
                )}

                {/* Task Selector (only if not pre-selected) */}
                {!sessionActive && !preSelectedTaskId && (
                    <div className="space-y-3">
                        <Select
                            value={selectedTaskId}
                            onValueChange={setSelectedTaskId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Link to a task (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No task</SelectItem>
                                {tasks?.map((task: any) => (
                                    <SelectItem key={task.id} value={task.id}>
                                        {task.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Textarea
                            placeholder="Session notes (optional)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="resize-none"
                        />
                    </div>
                )}

                {/* Notes (if pre-selected task, show notes only) */}
                {!sessionActive && preSelectedTaskId && (
                    <Textarea
                        placeholder="Session notes (optional)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="resize-none"
                    />
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-3">
                    {!sessionActive ? (
                        <Button
                            size="lg"
                            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={handleStart}
                            disabled={startSession.isPending}
                        >
                            <Play className="h-5 w-5" />
                            Start {mode === "pomodoro" ? "Pomodoro" : "Focus"}
                        </Button>
                    ) : (
                        <>
                            {isRunning ? (
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handlePause}
                                >
                                    <Pause className="h-5 w-5" />
                                    Pause
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="gap-2 bg-green-500 hover:bg-green-600 text-white"
                                    onClick={handleStart}
                                >
                                    <Play className="h-5 w-5" />
                                    Resume
                                </Button>
                            )}

                            {mode === "pomodoro" && phase !== "work" && (
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handleSkipBreak}
                                >
                                    <SkipForward className="h-5 w-5" />
                                    Skip Break
                                </Button>
                            )}

                            <Button
                                size="lg"
                                variant="destructive"
                                className="gap-2"
                                onClick={handleStop}
                                disabled={endSession.isPending}
                            >
                                <Square className="h-5 w-5" />
                                End Session
                            </Button>
                        </>
                    )}
                </div>

                {/* Session Info */}
                {sessionActive && (
                    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-neutral-500">Total elapsed</span>
                            <span className="font-mono tabular-nums font-medium">
                                {formatTime(elapsedSeconds)}
                            </span>
                        </div>
                        {mode === "pomodoro" && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-neutral-500">Pomodoros</span>
                                <span className="font-medium">{pomodoroCount}</span>
                            </div>
                        )}
                        <Textarea
                            placeholder="Add notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="resize-none mt-2"
                        />
                    </div>
                )}
            </div>
        </DialogContent>
    );

    // If controlled externally (from Focus page), render without trigger
    if (isControlled) {
        return (
            <>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    {dialogContent}
                </Dialog>
                <audio ref={audioRef} preload="none" />
            </>
        );
    }

    // Standalone mode (top nav trigger)
    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "relative gap-2",
                            sessionActive && "text-orange-500"
                        )}
                    >
                        <Timer className="h-4 w-4" />
                        {sessionActive && (
                            <>
                                <span className="text-xs font-mono tabular-nums">
                                    {mode === "pomodoro" ? formatTime(timeRemaining) : formatTime(elapsedSeconds)}
                                </span>
                                {isRunning && (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                                    </span>
                                )}
                            </>
                        )}
                        {!sessionActive && <span className="text-xs hidden sm:inline">Focus</span>}
                    </Button>
                </DialogTrigger>
                {dialogContent}
            </Dialog>

            {/* Hidden audio element */}
            <audio ref={audioRef} preload="none" />
        </>
    );
}
