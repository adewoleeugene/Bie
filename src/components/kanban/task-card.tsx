"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, MoreHorizontal, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useDeleteTask } from "@/hooks/use-tasks";
import { TaskWithRelations } from "@/types/task";

interface TaskCardProps {
    task: TaskWithRelations;
    isDragging?: boolean;
    onClick?: () => void;
    depth?: number;
    hasSubtasks?: boolean;
    isExpanded?: boolean;
    showSubtasks?: boolean;
    onToggleExpand?: () => void;
    visibleProperties?: {
        assignees: boolean;
        priority: boolean;
        dueDate: boolean;
        subtaskProgress: boolean;
    };
}

const priorityColors = {
    P0: "bg-red-500",
    P1: "bg-orange-500",
    P2: "bg-yellow-500",
    P3: "bg-blue-500",
};

export function TaskCard({
    task,
    isDragging,
    onClick,
    depth = 0,
    hasSubtasks,
    isExpanded,
    showSubtasks,
    onToggleExpand,
    visibleProperties = {
        assignees: true,
        priority: true,
        dueDate: true,
        subtaskProgress: true,
    }
}: TaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({
        id: task.id,
        data: {
            type: "Task",
            task,
        }
    });

    const deleteTask = useDeleteTask();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteTask.mutate({ id: task.id });
        setShowDeleteDialog(false);
    };

    // Subtask progress
    const subtaskCount = task.subtasks?.length || 0;
    const subtaskDoneCount = task.subtasks?.filter((s: any) => s.status === "DONE" || s.status === "ARCHIVED").length || 0;
    const subtaskProgress = subtaskCount > 0 ? Math.round((subtaskDoneCount / subtaskCount) * 100) : 0;

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleExpand?.();
    };

    const indentationStyle = {
        marginLeft: `${depth * 24}px`,
        width: "auto",
        flex: "1 1 0%",
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={{ ...style, ...indentationStyle }}
                className={cn(
                    "opacity-50 ring-2 ring-primary ring-offset-2",
                    isDragging && "rotate-3 shadow-lg"
                )}
            >
                <Card className="cursor-grabbing">
                    <CardContent className="p-3">
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
                                {visibleProperties.priority && (
                                    <Badge
                                        variant="outline"
                                        className={cn("h-5 w-5 rounded-full p-0", priorityColors[task.priority as keyof typeof priorityColors])}
                                    />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <>
            <div
                ref={setNodeRef}
                style={{ ...style, ...indentationStyle }}
                {...attributes}
                {...listeners}
            >
                <Card
                    onClick={onClick}
                    className={cn(
                        "group relative cursor-grab hover:ring-2 hover:ring-primary/50 active:cursor-grabbing transition-all",
                        depth > 0 && "border-l-2 border-l-primary/30 bg-neutral-50/50 dark:bg-neutral-900/50"
                    )}
                >
                    <CardContent className="p-3">
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                {/* Chevron for parents with subtasks */}
                                {hasSubtasks && showSubtasks && (
                                    <button
                                        onClick={handleChevronClick}
                                        className="flex-shrink-0 mt-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </button>
                                )}

                                {/* Spacer for parents without subtasks when subtasks are shown */}
                                {!hasSubtasks && showSubtasks && (
                                    <div className="w-4 flex-shrink-0" />
                                )}

                                <div className="flex-1 min-w-0 pr-6">
                                    <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
                                </div>

                                {visibleProperties.priority && (
                                    <Badge
                                        variant="outline"
                                        className={cn("h-5 w-5 rounded-full p-0 flex-shrink-0", priorityColors[task.priority as keyof typeof priorityColors])}
                                    />
                                )}
                            </div>

                            {task.description && typeof task.description === 'string' && (
                                <p className="line-clamp-2 text-xs text-neutral-500 ml-6">
                                    {task.description}
                                </p>
                            )}

                            {/* Subtask Progress Bar (only for parents with subtasks) */}
                            {subtaskCount > 0 && visibleProperties.subtaskProgress && (
                                <div className="space-y-1 ml-6">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>{subtaskDoneCount}/{subtaskCount} sub-tasks</span>
                                        <span>{subtaskProgress}%</span>
                                    </div>
                                    <div className="h-1 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-300",
                                                subtaskProgress === 100 ? "bg-green-500" : "bg-primary"
                                            )}
                                            style={{ width: `${subtaskProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className={cn("flex items-center justify-between ml-6")}>
                                <div className="flex -space-x-2">
                                    {visibleProperties.assignees && task.assignees.slice(0, 3).map((assignee: any) => (
                                        <Avatar key={assignee.user.id} className="h-6 w-6 border-2 border-white dark:border-neutral-800">
                                            <AvatarImage src={assignee.user.image || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {assignee.user.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {task.assignees.length > 3 && visibleProperties.assignees && (
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-700 text-xs">
                                            +{task.assignees.length - 3}
                                        </div>
                                    )}
                                </div>

                                {task.dueDate && visibleProperties.dueDate && (
                                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(task.dueDate), "MMM d")}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions Menu */}
                        <div
                            className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={onClick}>
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDeleteDialog(true);
                                        }}
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the task.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
