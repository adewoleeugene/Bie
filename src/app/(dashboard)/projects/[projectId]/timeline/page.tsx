"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskForm } from "@/components/tasks/task-form";
import { useState, useMemo, useRef } from "react";
import { TaskFiltersBar, applyTaskFilters, TaskFilters } from "@/components/tasks/task-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import {
    addDays,
    differenceInDays,
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isToday,
    isSameMonth,
    startOfMonth,
    endOfMonth,
    addWeeks,
    subWeeks,
} from "date-fns";

const STATUS_COLORS: Record<string, string> = {
    BACKLOG: "bg-neutral-300 dark:bg-neutral-600",
    TODO: "bg-blue-400",
    IN_PROGRESS: "bg-amber-400",
    IN_REVIEW: "bg-purple-400",
    DONE: "bg-green-400",
    ARCHIVED: "bg-neutral-200",
};

const PRIORITY_INDICATORS: Record<string, string> = {
    P0: "border-l-red-500",
    P1: "border-l-orange-400",
    P2: "border-l-yellow-400",
    P3: "border-l-blue-300",
};

export default function TimelinePage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const { data: tasks, isLoading } = useTasks(projectId);
    const [taskFilters, setTaskFilters] = useState<TaskFilters>({
        statuses: [],
        priorities: [],
        assigneeIds: [],
        dateRange: {},
    });

    const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [weeksToShow, setWeeksToShow] = useState(4);
    const scrollRef = useRef<HTMLDivElement>(null);

    const viewEnd = useMemo(() => addDays(viewStart, weeksToShow * 7 - 1), [viewStart, weeksToShow]);

    const days = useMemo(() => eachDayOfInterval({ start: viewStart, end: viewEnd }), [viewStart, viewEnd]);

    const DAY_WIDTH = 40;

    const filteredTasks = applyTaskFilters(tasks || [], taskFilters);

    // Only show tasks that have at least a start date or due date
    const timelineTasks = useMemo(() => {
        return filteredTasks
            .filter((t: any) => t.startDate || t.dueDate)
            .map((task: any) => {
                const start = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : new Date());
                const end = task.dueDate ? new Date(task.dueDate) : addDays(start, 1);

                // Calculate position and width
                const dayOffset = differenceInDays(start, viewStart);
                const duration = Math.max(1, differenceInDays(end, start) + 1);

                return {
                    ...task,
                    _start: start,
                    _end: end,
                    _offset: dayOffset,
                    _duration: duration,
                };
            })
            .sort((a: any, b: any) => a._start.getTime() - b._start.getTime());
    }, [filteredTasks, viewStart]);

    const tasksWithoutDates = filteredTasks.filter((t: any) => !t.startDate && !t.dueDate);

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b bg-white p-6 dark:bg-neutral-950">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Timeline</h1>

                        {/* Navigation */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewStart(subWeeks(viewStart, 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                            >
                                Today
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewStart(addWeeks(viewStart, 1))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* Zoom */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setWeeksToShow(Math.min(12, weeksToShow + 1))}
                                disabled={weeksToShow >= 12}
                            >
                                <ZoomOut className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs text-muted-foreground w-16 text-center">
                                {weeksToShow}w
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setWeeksToShow(Math.max(2, weeksToShow - 1))}
                                disabled={weeksToShow <= 2}
                            >
                                <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <span className="text-sm text-muted-foreground">
                            {format(viewStart, "MMM d")} — {format(viewEnd, "MMM d, yyyy")}
                        </span>
                    </div>
                    <TaskForm projectId={projectId} />
                </div>

                <TaskFiltersBar filters={taskFilters} onFiltersChange={setTaskFilters} />
            </div>

            {/* Timeline Grid */}
            <div className="flex-1 overflow-auto" ref={scrollRef}>
                <div style={{ minWidth: days.length * DAY_WIDTH + 280 }}>
                    {/* Day Headers */}
                    <div className="flex sticky top-0 z-10 bg-white dark:bg-neutral-950 border-b">
                        {/* Task name column */}
                        <div className="w-[280px] min-w-[280px] border-r px-4 py-2 bg-neutral-50 dark:bg-neutral-900">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</span>
                        </div>
                        {/* Day columns */}
                        <div className="flex">
                            {days.map((day, i) => {
                                const today = isToday(day);
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                const isFirstOfMonth = day.getDate() === 1;

                                return (
                                    <div
                                        key={i}
                                        className={`flex flex-col items-center justify-center border-r ${today
                                                ? "bg-primary/10 font-bold"
                                                : isWeekend
                                                    ? "bg-neutral-50/50 dark:bg-neutral-900/50"
                                                    : ""
                                            } ${isFirstOfMonth ? "border-l-2 border-l-neutral-300 dark:border-l-neutral-600" : ""}`}
                                        style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                                    >
                                        {(i === 0 || day.getDate() <= 7 && day.getDay() === 1) && (
                                            <span className="text-[9px] text-muted-foreground font-medium">
                                                {format(day, "MMM")}
                                            </span>
                                        )}
                                        <span className={`text-[10px] ${today ? "text-primary" : "text-muted-foreground"}`}>
                                            {format(day, "d")}
                                        </span>
                                        <span className={`text-[8px] ${today ? "text-primary" : "text-muted-foreground/60"}`}>
                                            {format(day, "EEE")}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Task Rows */}
                    {timelineTasks.length === 0 && (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                            No tasks with dates found. Add start/due dates to see them on the timeline.
                        </div>
                    )}

                    {timelineTasks.map((task: any, rowIndex: number) => (
                        <div key={task.id} className="flex group hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                            {/* Task Name */}
                            <div className="w-[280px] min-w-[280px] border-r px-4 py-2 flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[task.status] || "bg-neutral-300"}`} />
                                <span className="text-xs truncate flex-1" title={task.title}>
                                    {task.title}
                                </span>
                                <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                    {task.priority}
                                </Badge>
                            </div>

                            {/* Timeline Bar */}
                            <div className="flex relative" style={{ height: 36 }}>
                                {/* Background grid */}
                                {days.map((day, i) => {
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                    const today = isToday(day);
                                    return (
                                        <div
                                            key={i}
                                            className={`border-r ${today
                                                    ? "bg-primary/5"
                                                    : isWeekend
                                                        ? "bg-neutral-50/30 dark:bg-neutral-900/30"
                                                        : ""
                                                }`}
                                            style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                                        />
                                    );
                                })}

                                {/* The actual bar */}
                                {task._offset + task._duration > 0 && task._offset < days.length && (
                                    <div
                                        className={`absolute top-1 h-[28px] rounded-md border-l-[3px] ${PRIORITY_INDICATORS[task.priority] || "border-l-neutral-300"
                                            } ${STATUS_COLORS[task.status] || "bg-neutral-200"} opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-sm`}
                                        style={{
                                            left: Math.max(0, task._offset * DAY_WIDTH),
                                            width: Math.min(
                                                task._duration * DAY_WIDTH - 2,
                                                (days.length - Math.max(0, task._offset)) * DAY_WIDTH - 2
                                            ),
                                        }}
                                        title={`${task.title} (${format(task._start, "MMM d")} → ${format(task._end, "MMM d")})`}
                                    >
                                        <span className="text-[10px] font-medium text-white px-2 truncate block leading-[28px] drop-shadow-sm">
                                            {task.title}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Tasks Without Dates Section */}
                    {tasksWithoutDates.length > 0 && (
                        <div className="border-t-2 border-dashed border-neutral-200 dark:border-neutral-700 mt-4">
                            <div className="px-4 py-2 bg-neutral-50/50 dark:bg-neutral-900/50">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Without dates ({tasksWithoutDates.length})
                                </span>
                            </div>
                            {tasksWithoutDates.map((task: any) => (
                                <div key={task.id} className="flex group hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                                    <div className="w-[280px] min-w-[280px] border-r px-4 py-2 flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[task.status] || "bg-neutral-300"}`} />
                                        <span className="text-xs truncate flex-1 text-muted-foreground" title={task.title}>
                                            {task.title}
                                        </span>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                            {task.priority}
                                        </Badge>
                                    </div>
                                    <div className="flex-1 flex items-center px-4">
                                        <span className="text-[10px] text-muted-foreground italic">
                                            Add start & due dates to display on timeline
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Today Indicator Line */}
                    {(() => {
                        const todayOffset = differenceInDays(new Date(), viewStart);
                        if (todayOffset >= 0 && todayOffset < days.length) {
                            return (
                                <div
                                    className="absolute top-0 bottom-0 w-[2px] bg-red-500/60 z-20 pointer-events-none"
                                    style={{
                                        left: 280 + todayOffset * DAY_WIDTH + DAY_WIDTH / 2,
                                    }}
                                />
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>
        </div>
    );
}
