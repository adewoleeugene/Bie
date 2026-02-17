"use client";

import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { format } from "date-fns";
import { ArrowUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskWithRelations } from "@/types/task";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { exportTasksToCSV } from "@/lib/export";

interface TaskTableProps {
    tasks: TaskWithRelations[];
    actionColumn?: (task: TaskWithRelations) => React.ReactNode;
}

type SortField = "title" | "priority" | "dueDate" | "status";
type SortOrder = "asc" | "desc";

const statusColors: Record<TaskStatus, string> = {
    BACKLOG: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
    TODO: "bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    IN_PROGRESS: "bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    IN_REVIEW: "bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    DONE: "bg-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    ARCHIVED: "bg-neutral-300 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-500",
};

const priorityColors: Record<TaskPriority, string> = {
    P0: "bg-red-500 text-white hover:bg-red-600",
    P1: "bg-orange-500 text-white hover:bg-orange-600",
    P2: "bg-yellow-500 text-white hover:bg-yellow-600",
    P3: "bg-blue-500 text-white hover:bg-blue-600",
};

export function TaskTable({ tasks, actionColumn }: TaskTableProps) {
    const [sortField, setSortField] = useState<SortField>("dueDate");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
    const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
    const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);

    const filteredAndSortedTasks = useMemo(() => {
        let filtered = [...tasks];

        // Apply filters
        if (statusFilter !== "ALL") {
            filtered = filtered.filter((task) => task.status === statusFilter);
        }
        if (priorityFilter !== "ALL") {
            filtered = filtered.filter((task) => task.priority === priorityFilter);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue: any = a[sortField];
            let bValue: any = b[sortField];

            if (sortField === "dueDate") {
                aValue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                bValue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            } else if (sortField === "priority") {
                const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
                aValue = priorityOrder[a.priority];
                bValue = priorityOrder[b.priority];
            } else if (sortField === "title") {
                aValue = a.title.toLowerCase();
                bValue = b.title.toLowerCase();
            }

            if (sortOrder === "asc") {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return filtered;
    }, [tasks, sortField, sortOrder, statusFilter, priorityFilter]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-center justify-between">
                <div className="flex gap-4">
                    <Select
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value as TaskStatus | "ALL")}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="BACKLOG">Backlog</SelectItem>
                            <SelectItem value="TODO">To Do</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="IN_REVIEW">In Review</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={priorityFilter}
                        onValueChange={(value) => setPriorityFilter(value as TaskPriority | "ALL")}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Filter by priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Priorities</SelectItem>
                            <SelectItem value="P0">P0 - Critical</SelectItem>
                            <SelectItem value="P1">P1 - High</SelectItem>
                            <SelectItem value="P2">P2 - Medium</SelectItem>
                            <SelectItem value="P3">P3 - Low</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportTasksToCSV(filteredAndSortedTasks)}
                    className="ml-auto"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSort("title")}
                                    className="h-8 px-2"
                                >
                                    Task
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSort("status")}
                                    className="h-8 px-2"
                                >
                                    Status
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSort("priority")}
                                    className="h-8 px-2"
                                >
                                    Priority
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>Assignees</TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSort("dueDate")}
                                    className="h-8 px-2"
                                >
                                    Due Date
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            {actionColumn && <TableHead className="w-[100px]">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedTasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={actionColumn ? 6 : 5} className="h-24 text-center">
                                    No tasks found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedTasks.map((task) => (
                                <TableRow
                                    key={task.id}
                                    className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                    onClick={() => setSelectedTask(task)}
                                >
                                    <TableCell className="font-medium">
                                        <div>
                                            <div>{task.title}</div>
                                            {task.description && typeof task.description === 'string' && (
                                                <div className="text-xs text-neutral-500 line-clamp-1">
                                                    {task.description}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`hover:bg-opacity-80 border-0 ${statusColors[task.status]}`}>
                                            {task.status.replace("_", " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`border-0 ${priorityColors[task.priority]}`}>
                                            {task.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex -space-x-2">
                                            {task.assignees.slice(0, 3).map((assignee) => (
                                                <Avatar
                                                    key={assignee.user.id}
                                                    className="h-8 w-8 border-2 border-white dark:border-neutral-900"
                                                >
                                                    <AvatarImage src={assignee.user.image || undefined} />
                                                    <AvatarFallback className="text-xs">
                                                        {assignee.user.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                            {task.assignees.length > 3 && (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-xs dark:border-neutral-900 dark:bg-neutral-700">
                                                    +{task.assignees.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {task.dueDate
                                            ? format(new Date(task.dueDate), "MMM d, yyyy")
                                            : "-"}
                                    </TableCell>
                                    {actionColumn && (
                                        <TableCell onClick={(e: any) => e.stopPropagation()}>
                                            {actionColumn(task)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <TaskDetailSheet
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />
        </div>
    );
}
