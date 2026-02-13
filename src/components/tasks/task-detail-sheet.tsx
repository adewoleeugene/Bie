"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useUpdateTask, useDeleteTask, useCreateTask, useReorderTask } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-members";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, Trash2, Plus, X, GripVertical, ChevronRight } from "lucide-react";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { TaskWithRelations } from "@/types/task";
import { TaskComments } from "@/components/tasks/task-comments";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const statusColors: Record<string, string> = {
    BACKLOG: "bg-neutral-400",
    TODO: "bg-blue-400",
    IN_PROGRESS: "bg-yellow-500",
    IN_REVIEW: "bg-purple-500",
    DONE: "bg-green-500",
    ARCHIVED: "bg-neutral-300",
};

const statusLabels: Record<string, string> = {
    BACKLOG: "Backlog",
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    DONE: "Done",
    ARCHIVED: "Archived",
};

const priorityLabels: Record<string, string> = {
    P0: "P0",
    P1: "P1",
    P2: "P2",
    P3: "P3",
};

const priorityColors: Record<string, string> = {
    P0: "text-red-600 bg-red-50 dark:bg-red-950",
    P1: "text-orange-600 bg-orange-50 dark:bg-orange-950",
    P2: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
    P3: "text-blue-600 bg-blue-50 dark:bg-blue-950",
};

interface TaskDetailSheetProps {
    task: TaskWithRelations | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Sortable Subtask Row Component
function SortableSubtaskRow({
    subtask,
    index,
    totalCount,
    onOpen,
    onDelete,
}: {
    subtask: TaskWithRelations["subtasks"][0];
    index: number;
    totalCount: number;
    onOpen: () => void;
    onDelete: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subtask.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors ${index < totalCount - 1 ? "border-b" : ""
                }`}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
                <GripVertical className="h-4 w-4 text-neutral-400" />
            </div>

            {/* Status Dot */}
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${statusColors[subtask.status]}`} />

            {/* Title */}
            <button
                onClick={onOpen}
                className={`flex-1 truncate text-left ${subtask.status === "DONE" || subtask.status === "ARCHIVED"
                        ? "line-through text-neutral-400"
                        : ""
                    }`}
            >
                {subtask.title}
            </button>

            {/* Status Badge */}
            <Badge variant="secondary" className="text-[10px] h-5 flex-shrink-0">
                {statusLabels[subtask.status] || subtask.status}
            </Badge>

            {/* Priority */}
            <Badge
                variant="outline"
                className={`text-[10px] h-5 flex-shrink-0 ${priorityColors[subtask.priority] || ""}`}
            >
                {priorityLabels[subtask.priority] || subtask.priority}
            </Badge>

            {/* Assignees */}
            <div className="flex -space-x-1 flex-shrink-0">
                {subtask.assignees?.slice(0, 2).map((a) => (
                    <Avatar key={a.user.id} className="h-5 w-5 border border-white">
                        <AvatarImage src={a.user.image || undefined} />
                        <AvatarFallback className="text-[8px]">
                            {a.user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                ))}
            </div>

            {/* Open indicator */}
            <button onClick={onOpen} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <ChevronRight className="h-3 w-3 text-neutral-300" />
            </button>

            {/* Delete */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all flex-shrink-0"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    );
}

export function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailSheetProps) {
    const updateTask = useUpdateTask();
    const deleteTask = useDeleteTask();
    const createTask = useCreateTask();
    const reorderTask = useReorderTask();
    const { data: members } = useMembers();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [subtaskTitle, setSubtaskTitle] = useState("");
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [selectedSubtask, setSelectedSubtask] = useState<TaskWithRelations | null>(null);

    // Local subtask order for optimistic updates
    const [localSubtasks, setLocalSubtasks] = useState<TaskWithRelations["subtasks"]>([]);

    // Sync local subtasks with task.subtasks
    useState(() => {
        if (task?.subtasks) {
            setLocalSubtasks([...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder));
        }
    });

    // Update local subtasks when task changes
    if (task?.subtasks && JSON.stringify(localSubtasks.map(s => s.id)) !== JSON.stringify(task.subtasks.map(s => s.id))) {
        setLocalSubtasks([...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder));
    }

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!task) return null;

    const handleStatusChange = (status: TaskStatus) => {
        updateTask.mutate({ id: task.id, status });
    };

    const handlePriorityChange = (priority: TaskPriority) => {
        updateTask.mutate({ id: task.id, priority });
    };

    const handleDelete = () => {
        deleteTask.mutate({ id: task.id }, {
            onSuccess: () => {
                onOpenChange(false);
            }
        });
    };

    const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsEditingTitle(false);
        if (e.target.value !== task.title) {
            updateTask.mutate({ id: task.id, title: e.target.value });
        }
    };

    const handleDescriptionBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (e.target.value !== (task.description as string)) {
            updateTask.mutate({ id: task.id, description: e.target.value });
        }
    };

    const currentAssigneeIds = task.assignees.map(a => a.user.id);

    const toggleAssignee = (userId: string) => {
        const newAssignees = currentAssigneeIds.includes(userId)
            ? currentAssigneeIds.filter(id => id !== userId)
            : [...currentAssigneeIds, userId];

        updateTask.mutate({ id: task.id, assigneeIds: newAssignees });
    };

    const handleAddSubtask = async () => {
        if (!subtaskTitle.trim()) return;
        await createTask.mutateAsync({
            title: subtaskTitle.trim(),
            parentTaskId: task.id,
            projectId: task.projectId || undefined,
            sprintId: task.sprintId || undefined,
            status: "TODO",
            priority: "P2",
            assigneeIds: [],
            labels: [],
        });
        setSubtaskTitle("");
    };

    const handleDeleteSubtask = (subtaskId: string) => {
        deleteTask.mutate({ id: subtaskId });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = localSubtasks.findIndex((s) => s.id === active.id);
        const newIndex = localSubtasks.findIndex((s) => s.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Optimistic update
        const reordered = arrayMove(localSubtasks, oldIndex, newIndex);
        setLocalSubtasks(reordered);

        // Update sortOrder on server
        const movedSubtask = localSubtasks[oldIndex];
        reorderTask.mutate({
            id: movedSubtask.id,
            status: movedSubtask.status,
            sortOrder: newIndex + 1,
        });
    };

    const subtaskCount = localSubtasks.length;
    const subtaskDoneCount = localSubtasks.filter(s => s.status === "DONE" || s.status === "ARCHIVED").length;
    const subtaskProgress = subtaskCount > 0 ? Math.round((subtaskDoneCount / subtaskCount) * 100) : 0;

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="sm:max-w-[600px] w-full overflow-y-auto">
                    <SheetHeader className="mb-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 mr-4">
                                {isEditingTitle ? (
                                    <Input
                                        defaultValue={task.title}
                                        onBlur={handleTitleBlur}
                                        autoFocus
                                        className="font-semibold text-lg"
                                    />
                                ) : (
                                    <SheetTitle
                                        className="text-xl cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-1 -ml-1 transition-colors"
                                        onClick={() => setIsEditingTitle(true)}
                                    >
                                        {task.title}
                                    </SheetTitle>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the task
                                                &quot;{task.title}&quot; and remove it from our servers.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDelete}
                                                className="bg-red-600 hover:bg-red-700 text-white"
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Badge variant="outline">{task.status}</Badge>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Created {format(new Date(task.createdAt), "MMM d, yyyy")}
                            </span>
                            {task.project && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                                    📁 {task.project.name}
                                </span>
                            )}
                            {task.sprint && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-full">
                                    🏃 {task.sprint.name}
                                </span>
                            )}
                        </div>
                    </SheetHeader>

                    <div className="space-y-8">
                        {/* Status & Priority & Due Date Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-500 uppercase">Status</label>
                                <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BACKLOG">Backlog</SelectItem>
                                        <SelectItem value="TODO">To Do</SelectItem>
                                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                        <SelectItem value="IN_REVIEW">In Review</SelectItem>
                                        <SelectItem value="DONE">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-500 uppercase">Priority</label>
                                <Select value={task.priority} onValueChange={(v) => handlePriorityChange(v as TaskPriority)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="P0">P0 - Critical</SelectItem>
                                        <SelectItem value="P1">P1 - High</SelectItem>
                                        <SelectItem value="P2">P2 - Medium</SelectItem>
                                        <SelectItem value="P3">P3 - Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-500 uppercase">Due Date</label>
                                <Input
                                    type="datetime-local"
                                    defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ""}
                                    onChange={(e) => {
                                        const date = e.target.value ? new Date(e.target.value) : null;
                                        updateTask.mutate({ id: task.id, dueDate: date?.toISOString() || null });
                                    }}
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-500 uppercase">Description</label>
                            <Textarea
                                defaultValue={(task.description as string) || ""}
                                onBlur={handleDescriptionBlur}
                                className="min-h-[100px] resize-none"
                                placeholder="Add a more detailed description..."
                            />
                        </div>

                        {/* Assignees */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-neutral-500 uppercase">Assignees</label>
                            <div className="flex flex-wrap gap-2">
                                {members?.map(member => {
                                    const isAssigned = currentAssigneeIds.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            onClick={() => toggleAssignee(member.id)}
                                            className={`flex items-center gap-2 rounded-full border px-2 py-1 text-xs transition-colors ${isAssigned
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                                                }`}
                                        >
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={member.image || undefined} />
                                                <AvatarFallback className="text-[9px]">{member.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            {member.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Subtasks with Drag & Drop */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-semibold text-neutral-500 uppercase">
                                        Sub-tasks
                                    </label>
                                    {subtaskCount > 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {subtaskDoneCount}/{subtaskCount}
                                            </span>
                                            <div className="h-1.5 w-20 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${subtaskProgress === 100 ? "bg-green-500" : "bg-primary"
                                                        }`}
                                                    style={{ width: `${subtaskProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {!isAddingSubtask && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsAddingSubtask(true)}
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add
                                    </Button>
                                )}
                            </div>

                            {/* Subtask Table with Drag & Drop */}
                            {subtaskCount > 0 && (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="rounded-lg border overflow-hidden">
                                        <SortableContext
                                            items={localSubtasks.map(s => s.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {localSubtasks.map((subtask, index) => (
                                                <SortableSubtaskRow
                                                    key={subtask.id}
                                                    subtask={subtask}
                                                    index={index}
                                                    totalCount={subtaskCount}
                                                    onOpen={() => setSelectedSubtask(subtask as unknown as TaskWithRelations)}
                                                    onDelete={() => handleDeleteSubtask(subtask.id)}
                                                />
                                            ))}
                                        </SortableContext>
                                    </div>
                                </DndContext>
                            )}

                            {/* Add Subtask Input */}
                            {isAddingSubtask && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 flex-1 rounded-md border px-2">
                                        <Input
                                            value={subtaskTitle}
                                            onChange={(e) => setSubtaskTitle(e.target.value)}
                                            placeholder="What needs to be done?"
                                            className="h-8 text-sm border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && subtaskTitle.trim()) {
                                                    handleAddSubtask();
                                                }
                                                if (e.key === "Escape") {
                                                    setIsAddingSubtask(false);
                                                    setSubtaskTitle("");
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        className="h-8"
                                        onClick={handleAddSubtask}
                                        disabled={!subtaskTitle.trim() || createTask.isPending}
                                    >
                                        {createTask.isPending ? "..." : "Add"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => {
                                            setIsAddingSubtask(false);
                                            setSubtaskTitle("");
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Empty State */}
                            {subtaskCount === 0 && !isAddingSubtask && (
                                <button
                                    onClick={() => setIsAddingSubtask(true)}
                                    className="w-full rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-4 text-center text-xs text-neutral-400 hover:border-primary/50 hover:text-primary transition-colors"
                                >
                                    <Plus className="h-4 w-4 mx-auto mb-1" />
                                    Add a sub-task
                                </button>
                            )}
                        </div>

                        <div className="border-t pt-6">
                            <TaskComments taskId={task.id} />
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Nested Subtask Detail Sheet */}
            {selectedSubtask && (
                <TaskDetailSheet
                    task={selectedSubtask}
                    open={!!selectedSubtask}
                    onOpenChange={(open) => !open && setSelectedSubtask(null)}
                />
            )}
        </>
    );
}
