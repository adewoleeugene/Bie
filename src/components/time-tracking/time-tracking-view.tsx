"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import {
    Clock,
    Plus,
    Trash2,
    Calendar,
    TrendingUp,
    BarChart3,
    Timer,
} from "lucide-react";
import { useTimeEntries, useTimeTrackingStats, useCreateTimeEntry, useDeleteTimeEntry } from "@/hooks/use-time-entries";
import { useTasks } from "@/hooks/use-tasks";

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function AddTimeEntryDialog() {
    const [open, setOpen] = useState(false);
    const [taskId, setTaskId] = useState("");
    const [hours, setHours] = useState("");
    const [minutes, setMinutes] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    const { data: tasks } = useTasks();
    const createEntry = useCreateTimeEntry();

    const handleSubmit = async () => {
        if (!taskId) return;

        const totalMinutes = (parseInt(hours || "0") * 60) + parseInt(minutes || "0");
        if (totalMinutes <= 0) return;

        const startedAt = new Date(date);
        const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000);

        const result = await createEntry.mutateAsync({
            taskId,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            duration: totalMinutes,
            description: description || null,
        });

        if (result.success) {
            setOpen(false);
            setTaskId("");
            setHours("");
            setMinutes("");
            setDescription("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Log Time
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Log Time Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Task</label>
                        <Select value={taskId} onValueChange={setTaskId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a task..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks?.map((task) => (
                                    <SelectItem key={task.id} value={task.id}>
                                        {task.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Duration</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    value={hours}
                                    onChange={(e) => setHours(e.target.value)}
                                />
                                <span className="text-xs text-neutral-500 mt-0.5 block">Hours</span>
                            </div>
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    max="59"
                                    value={minutes}
                                    onChange={(e) => setMinutes(e.target.value)}
                                />
                                <span className="text-xs text-neutral-500 mt-0.5 block">Minutes</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Date</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Description</label>
                        <Textarea
                            placeholder="What did you work on?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="resize-none"
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleSubmit}
                        disabled={!taskId || createEntry.isPending}
                    >
                        {createEntry.isPending ? "Logging..." : "Log Time"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function TimeTrackingView() {
    const { data: entries, isLoading } = useTimeEntries();
    const { data: stats } = useTimeTrackingStats();
    const deleteEntry = useDeleteTimeEntry();

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Clock className="h-8 w-8 text-blue-500" />
                        Time Tracking
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Track how you spend your time across tasks and projects.
                    </p>
                </div>
                <AddTimeEntryDialog />
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-blue-200 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                Today
                            </CardTitle>
                            <Timer className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatDuration(stats.todayMinutes)}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-indigo-200 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                                This Week
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatDuration(stats.weekMinutes)}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-violet-200 dark:border-violet-900/30 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-neutral-950">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-400">
                                This Month
                            </CardTitle>
                            <BarChart3 className="h-4 w-4 text-violet-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatDuration(stats.monthMinutes)}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Task Breakdown */}
            {stats && stats.taskBreakdown.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Time by Task (This Month)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.taskBreakdown.map((item) => {
                                const maxMinutes = Math.max(
                                    ...stats.taskBreakdown.map((t) => t.totalMinutes)
                                );
                                const percentage = (item.totalMinutes / maxMinutes) * 100;

                                return (
                                    <div key={item.taskId} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="truncate font-medium">
                                                {item.taskTitle}
                                            </span>
                                            <span className="font-mono tabular-nums text-neutral-500">
                                                {formatDuration(item.totalMinutes)}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Time Entries List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Recent Entries
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!entries || entries.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 mx-auto text-neutral-300 dark:text-neutral-700 mb-4" />
                            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                No time entries yet
                            </h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                Log time manually or start a focus session to track time automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {entries.map((entry) => {
                                const task = (entry as unknown as { task?: { id: string; title: string; status: string; project?: { id: string; name: string } } }).task;
                                return (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={cn(
                                                    "flex h-8 w-8 items-center justify-center rounded-lg",
                                                    entry.source === "FOCUS_SESSION"
                                                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-500"
                                                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-500"
                                                )}
                                            >
                                                {entry.source === "FOCUS_SESSION" ? (
                                                    <Timer className="h-4 w-4" />
                                                ) : (
                                                    <Clock className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">
                                                        {task?.title || "Unknown task"}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] px-1.5 py-0"
                                                    >
                                                        {entry.source === "FOCUS_SESSION" ? "Focus" : "Manual"}
                                                    </Badge>
                                                    {task?.project && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                            {task.project.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-neutral-500">
                                                        {formatDate(entry.startedAt)} • {formatTime(entry.startedAt)}
                                                    </span>
                                                    {entry.description && (
                                                        <span className="text-xs text-neutral-400 truncate max-w-[200px]">
                                                            — {entry.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-medium tabular-nums text-sm">
                                                {entry.duration ? formatDuration(entry.duration) : "—"}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-neutral-400 hover:text-red-500"
                                                onClick={() => deleteEntry.mutate(entry.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
