"use client";

import { useState } from "react";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
    isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskWithRelations } from "@/types/task";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { TaskStatus } from "@prisma/client";

interface ProjectCalendarProps {
    tasks: TaskWithRelations[];
}

const statusColors: Record<TaskStatus, string> = {
    BACKLOG: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    TODO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    IN_REVIEW: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    DONE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    ARCHIVED: "bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-600",
};

export function ProjectCalendar({ tasks }: ProjectCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const today = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd,
    });

    const getDayTasks = (day: Date) => {
        return tasks.filter((task) => {
            if (!task.dueDate) return false;
            return isSameDay(new Date(task.dueDate), day);
        });
    };

    return (
        <div className="flex h-full flex-col bg-white dark:bg-neutral-950 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold">
                        {format(currentDate, "MMMM yyyy")}
                    </h2>
                    <div className="flex items-center rounded-md border bg-muted/50">
                        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={today} className="h-8 px-3 text-xs font-medium">
                            Today
                        </Button>
                        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-7 border-b bg-muted/20 text-center text-xs font-semibold text-muted-foreground">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="py-2">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid flex-1 grid-cols-7 grid-rows-5 auto-rows-fr">
                    {days.map((day, dayIdx) => {
                        const dayTasks = getDayTasks(day);
                        const isCurrentMonth = isSameMonth(day, currentDate);

                        return (
                            <div
                                key={day.toString()}
                                className={`min-h-[120px] border-b border-r p-2 transition-colors ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground" : ""
                                    } ${isToday(day) ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span
                                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(day)
                                                ? "bg-primary text-primary-foreground font-bold"
                                                : "text-muted-foreground"
                                            }`}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    {/* Optional add task button visible on hover could go here */}
                                </div>

                                <div className="space-y-1">
                                    {dayTasks.map((task) => (
                                        <button
                                            key={task.id}
                                            onClick={() => setSelectedTask(task)}
                                            className={`w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-medium transition-all hover:opacity-80 ${statusColors[task.status]
                                                }`}
                                        >
                                            <span className="mr-1 opacity-75">{task.priority}</span>
                                            {task.title}
                                        </button>
                                    ))}
                                    {dayTasks.length > 5 && (
                                        <div className="text-[10px] text-muted-foreground pl-1">
                                            + {dayTasks.length - 5} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedTask && (
                <TaskDetailSheet
                    task={selectedTask}
                    open={!!selectedTask}
                    onOpenChange={(open) => !open && setSelectedTask(null)}
                />
            )}
        </div>
    );
}
