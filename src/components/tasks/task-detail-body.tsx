"use client";

import { useState, useEffect } from "react";
import { useUpdateTask, useDeleteTask, useCreateTask, useReorderTask } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-members";
import { useSquads } from "@/hooks/use-squads";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "@/components/wiki/block-editor-lazy";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, X, GripVertical, ChevronRight, Hash, Check, Users, Tag } from "lucide-react";
import { TaskStatus, TaskPriority, AttachmentParent } from "@prisma/client";
import { TaskWithRelations } from "@/types/task";
import { TaskComments } from "@/components/tasks/task-comments";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
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

// Sortable Subtask Row
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
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: subtask.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors ${
                index < totalCount - 1 ? "border-b" : ""
            }`}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
                <GripVertical className="h-4 w-4 text-neutral-400" />
            </div>

            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${statusColors[subtask.status]}`} />

            <button
                onClick={onOpen}
                className={`flex-1 truncate text-left ${
                    subtask.status === "DONE" || subtask.status === "ARCHIVED"
                        ? "line-through text-neutral-400"
                        : ""
                }`}
            >
                {subtask.title}
            </button>

            <Badge variant="secondary" className="text-[10px] h-5 flex-shrink-0">
                {statusLabels[subtask.status] || subtask.status}
            </Badge>

            <Badge
                variant="outline"
                className={`text-[10px] h-5 flex-shrink-0 ${priorityColors[subtask.priority] || ""}`}
            >
                {priorityLabels[subtask.priority] || subtask.priority}
            </Badge>

            <div className="flex -space-x-1 flex-shrink-0">
                {subtask.assignees?.slice(0, 2).map((a: any) => (
                    <Avatar key={a.user.id} className="h-5 w-5 border border-white">
                        <AvatarImage src={a.user.image || undefined} />
                        <AvatarFallback className="text-[8px]">
                            {a.user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                ))}
            </div>

            <button
                onClick={onOpen}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
                <ChevronRight className="h-3 w-3 text-neutral-300" />
            </button>

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

interface TaskDetailBodyProps {
    task: TaskWithRelations;
    onOpenSubtask: (subtask: TaskWithRelations) => void;
}

export function TaskDetailBody({ task, onOpenSubtask }: TaskDetailBodyProps) {
    const updateTask = useUpdateTask();
    const deleteTask = useDeleteTask();
    const createTask = useCreateTask();
    const reorderTask = useReorderTask();
    const { data: members } = useMembers();
    const { data: squads } = useSquads();

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [subtaskTitle, setSubtaskTitle] = useState("");
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [assigneeOpen, setAssigneeOpen] = useState(false);
    const [description, setDescription] = useState(task.description);
    const debouncedDescription = useDebounce(description, 1000);
    const [isDescriptionDirty, setIsDescriptionDirty] = useState(false);
    const [localSubtasks, setLocalSubtasks] = useState<TaskWithRelations["subtasks"]>(
        [...(task.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    );

    // Sync description when task changes
    useEffect(() => {
        setDescription(task.description);
        setIsDescriptionDirty(false);
    }, [task.id, task.description]);

    // Auto-save description
    useEffect(() => {
        if (isDescriptionDirty) {
            updateTask.mutate({ id: task.id, description: debouncedDescription });
        }
    }, [debouncedDescription, isDescriptionDirty, task.id, updateTask]);

    // Keep local subtasks in sync
    if (
        task.subtasks &&
        JSON.stringify(localSubtasks.map((s: any) => s.id)) !==
            JSON.stringify(task.subtasks.map((s: any) => s.id))
    ) {
        setLocalSubtasks([...task.subtasks].sort((a: any, b: any) => a.sortOrder - b.sortOrder));
    }

    const TEMPLATES = {
        BUG: [
            { type: "heading", content: [{ type: "text", text: "Steps to Reproduce", styles: { bold: true } }] },
            { type: "bulletListItem", content: [{ type: "text", text: "1. ", styles: {} }] },
            { type: "heading", content: [{ type: "text", text: "Expected Behavior", styles: { bold: true } }] },
            { type: "paragraph", content: [{ type: "text", text: "Description of what was expected...", styles: {} }] },
        ],
        FEATURE: [
            { type: "heading", content: [{ type: "text", text: "Problem Statement", styles: { bold: true } }] },
            { type: "paragraph", content: [{ type: "text", text: "Why are we building this?", styles: {} }] },
            { type: "heading", content: [{ type: "text", text: "Requirements", styles: { bold: true } }] },
            { type: "checkListItem", content: [{ type: "text", text: "Frontend implementation", styles: {} }] },
            { type: "checkListItem", content: [{ type: "text", text: "API endpoint development", styles: {} }] },
        ],
        MEETING: [
            { type: "heading", content: [{ type: "text", text: "Agenda", styles: { bold: true } }] },
            { type: "bulletListItem", content: [{ type: "text", text: "Topic A", styles: {} }] },
            { type: "heading", content: [{ type: "text", text: "Action Items", styles: { bold: true } }] },
            { type: "checkListItem", content: [{ type: "text", text: "Follow up with @team", styles: {} }] },
        ],
    };

    const applyTemplate = (templateKey: keyof typeof TEMPLATES) => {
        setDescription(TEMPLATES[templateKey]);
        setIsDescriptionDirty(true);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const currentAssigneeIds = task.assignees.map((a: any) => a.user.id);
    const selectedMembers =
        members?.filter((m: any) => currentAssigneeIds.includes(m.id)) ?? [];

    const toggleAssignee = (userId: string) => {
        const newAssignees = currentAssigneeIds.includes(userId)
            ? currentAssigneeIds.filter((id: string) => id !== userId)
            : [...currentAssigneeIds, userId];
        updateTask.mutate({ id: task.id, assigneeIds: newAssignees });
    };

    // Assigning a squad is a shortcut that adds all of its members as assignees.
    const assignSquad = (squad: any) => {
        const memberIds = (squad.members || [])
            .map((m: any) => m.userId || m.user?.id)
            .filter(Boolean);
        const newAssignees = Array.from(new Set([...currentAssigneeIds, ...memberIds]));
        updateTask.mutate({ id: task.id, assigneeIds: newAssignees });
    };

    const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsEditingTitle(false);
        if (e.target.value !== task.title) {
            updateTask.mutate({ id: task.id, title: e.target.value });
        }
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

        const oldIndex = localSubtasks.findIndex((s: any) => s.id === active.id);
        const newIndex = localSubtasks.findIndex((s: any) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(localSubtasks, oldIndex, newIndex);
        setLocalSubtasks(reordered);

        const movedSubtask = localSubtasks[oldIndex];
        reorderTask.mutate({
            id: movedSubtask.id,
            status: movedSubtask.status,
            sortOrder: newIndex + 1,
        });
    };

    const subtaskCount = localSubtasks.length;
    const subtaskDoneCount = localSubtasks.filter(
        (s: any) => s.status === "DONE" || s.status === "ARCHIVED",
    ).length;
    const subtaskProgress = subtaskCount > 0 ? Math.round((subtaskDoneCount / subtaskCount) * 100) : 0;

    const propertyRow = "grid grid-cols-[132px_1fr] items-center py-1 px-1 rounded-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors";
    const propertyLabel = "text-sm text-neutral-500 flex items-center gap-2";
    const inlineControl = "h-7 border-0 p-0 shadow-none focus:ring-0 focus-visible:ring-0 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors rounded px-2 w-fit bg-transparent";

    return (
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
            {/* Title */}
            <div className="mb-6">
                {isEditingTitle ? (
                    <Input
                        defaultValue={task.title}
                        onBlur={handleTitleBlur}
                        autoFocus
                        className="text-4xl font-bold h-auto p-0 border-0 focus-visible:ring-0 shadow-none"
                    />
                ) : (
                    <h1
                        className="text-4xl font-bold cursor-text hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-md transition-colors leading-[1.2]"
                        onClick={() => setIsEditingTitle(true)}
                    >
                        {task.title}
                    </h1>
                )}
            </div>

            {/* Properties */}
            <div className="space-y-px mb-8">
                {/* Status */}
                <div className={propertyRow}>
                    <label className={propertyLabel}>
                        <div className="h-2 w-2 rounded-full bg-neutral-400" />
                        Status
                    </label>
                    <Select value={task.status} onValueChange={(v) => updateTask.mutate({ id: task.id, status: v as TaskStatus })}>
                        <SelectTrigger className={`${inlineControl} gap-1.5`}>
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

                {/* Assignees — compact searchable dropdown */}
                <div className={propertyRow}>
                    <label className={propertyLabel}>
                        <Users className="h-4 w-4 text-neutral-400" />
                        Assignees
                    </label>
                    <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="flex min-h-7 w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                {selectedMembers.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-1">
                                        {selectedMembers.map((member: any) => (
                                            <span
                                                key={member.id}
                                                className="flex items-center gap-1 rounded-full bg-neutral-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-neutral-800"
                                            >
                                                <Avatar className="h-4 w-4">
                                                    <AvatarImage src={member.image || undefined} />
                                                    <AvatarFallback className="text-[9px]">
                                                        {member.name?.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {member.name}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm text-neutral-400">Empty</span>
                                )}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search people or squads..." />
                                <CommandList>
                                    <CommandEmpty>No match found.</CommandEmpty>
                                    {squads && squads.length > 0 && (
                                        <CommandGroup heading="Squads">
                                            {squads.map((squad: any) => {
                                                const memberIds = (squad.members || [])
                                                    .map((m: any) => m.userId || m.user?.id)
                                                    .filter(Boolean);
                                                const allSelected =
                                                    memberIds.length > 0 &&
                                                    memberIds.every((id: string) => currentAssigneeIds.includes(id));
                                                return (
                                                    <CommandItem
                                                        key={squad.id}
                                                        value={`squad ${squad.name}`}
                                                        onSelect={() => assignSquad(squad)}
                                                        className="gap-2"
                                                    >
                                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/60 dark:bg-muted/40">
                                                            <Users className="h-3 w-3" />
                                                        </span>
                                                        <span className="flex-1 truncate">{squad.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {memberIds.length}
                                                        </span>
                                                        {allSelected && <Check className="h-4 w-4 text-primary" />}
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    )}
                                    <CommandGroup heading={squads && squads.length > 0 ? "People" : undefined}>
                                        {members?.map((member: any) => {
                                            const isSelected = currentAssigneeIds.includes(member.id);
                                            return (
                                                <CommandItem
                                                    key={member.id}
                                                    value={member.name ?? member.id}
                                                    onSelect={() => toggleAssignee(member.id)}
                                                    className="gap-2"
                                                >
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={member.image || undefined} />
                                                        <AvatarFallback className="text-[10px]">
                                                            {member.name?.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="flex-1 truncate">{member.name}</span>
                                                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Start Date */}
                <div className={propertyRow}>
                    <label className={propertyLabel}>
                        <Clock className="h-4 w-4 text-neutral-400" />
                        Start Date
                    </label>
                    <Input
                        type="datetime-local"
                        defaultValue={task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : ""}
                        onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : null;
                            updateTask.mutate({ id: task.id, startDate: date?.toISOString() || null });
                        }}
                        className={inlineControl}
                    />
                </div>

                {/* Due Date */}
                <div className={propertyRow}>
                    <label className={propertyLabel}>
                        <Clock className="h-4 w-4 text-neutral-400" />
                        Due Date
                    </label>
                    <Input
                        type="datetime-local"
                        defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : ""}
                        onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : null;
                            updateTask.mutate({ id: task.id, dueDate: date?.toISOString() || null });
                        }}
                        className={inlineControl}
                    />
                </div>

                {/* Priority */}
                <div className={propertyRow}>
                    <label className={propertyLabel}>
                        <Hash className="h-4 w-4 text-neutral-400" />
                        Priority
                    </label>
                    <Select value={task.priority} onValueChange={(v) => updateTask.mutate({ id: task.id, priority: v as TaskPriority })}>
                        <SelectTrigger className={`${inlineControl} gap-1.5`}>
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

                {/* Labels */}
                {Array.isArray(task.labels) && task.labels.length > 0 && (
                    <div className={propertyRow}>
                        <label className={propertyLabel}>
                            <Tag className="h-4 w-4 text-neutral-400" />
                            Labels
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {task.labels.map((label: string) => (
                                <Badge
                                    key={label}
                                    variant="outline"
                                    className="h-5 rounded-full border-[color:var(--border)] px-2 text-[11px] font-normal text-neutral-400"
                                >
                                    {label}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="mb-8">
                {!description || (Array.isArray(description) && description.length === 0) ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                            Start from a template
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                className="rounded-lg border border-neutral-100 dark:border-neutral-900 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                onClick={() => applyTemplate("BUG")}
                            >
                                <div className="text-sm font-medium">🐛 Bug Report</div>
                                <div className="text-[11px] text-neutral-400">Steps, expected, actual</div>
                            </button>
                            <button
                                className="rounded-lg border border-neutral-100 dark:border-neutral-900 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                onClick={() => applyTemplate("FEATURE")}
                            >
                                <div className="text-sm font-medium">🚀 Feature Req</div>
                                <div className="text-[11px] text-neutral-400">Context, specs, roadmap</div>
                            </button>
                            <button
                                className="rounded-lg border border-neutral-100 dark:border-neutral-900 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                onClick={() => applyTemplate("MEETING")}
                            >
                                <div className="text-sm font-medium">📅 Meeting Notes</div>
                                <div className="text-[11px] text-neutral-400">Agenda, action items</div>
                            </button>
                            <button
                                className="rounded-lg border border-neutral-100 dark:border-neutral-900 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                onClick={() => {
                                    setDescription([{ type: "paragraph", content: [] }]);
                                    setIsDescriptionDirty(true);
                                }}
                            >
                                <div className="text-sm font-medium">📝 Blank Page</div>
                                <div className="text-[11px] text-neutral-400">Start from scratch</div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <BlockEditor
                        key={task.id}
                        initialContent={
                            typeof description === "string"
                                ? [{ type: "paragraph", content: [{ type: "text", text: description, styles: {} }] }]
                                : description
                        }
                        onChange={(content) => {
                            setDescription(content);
                            setIsDescriptionDirty(true);
                        }}
                    />
                )}
            </div>

            {/* Subtasks */}
            <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                            Sub-tasks
                        </label>
                        {subtaskCount > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {subtaskDoneCount}/{subtaskCount}
                                </span>
                                <div className="h-1.5 w-20 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                            subtaskProgress === 100 ? "bg-green-500" : "bg-primary"
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

                {subtaskCount > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <div className="rounded-lg border overflow-hidden">
                            <SortableContext
                                items={localSubtasks.map((s: any) => s.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {localSubtasks.map((subtask: any, index: number) => (
                                    <SortableSubtaskRow
                                        key={subtask.id}
                                        subtask={subtask}
                                        index={index}
                                        totalCount={subtaskCount}
                                        onOpen={() => onOpenSubtask(subtask as unknown as TaskWithRelations)}
                                        onDelete={() => handleDeleteSubtask(subtask.id)}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    </DndContext>
                )}

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
                                    if (e.key === "Enter" && subtaskTitle.trim()) handleAddSubtask();
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

                {subtaskCount === 0 && !isAddingSubtask && (
                    <button
                        onClick={() => setIsAddingSubtask(true)}
                        className="w-full rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-3 text-center text-xs text-neutral-400 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                        <Plus className="h-4 w-4 mx-auto mb-1" />
                        Add a sub-task
                    </button>
                )}
            </div>

            {/* Attachments */}
            <div className="border-t pt-6 mb-2">
                <AttachmentPanel parentType={AttachmentParent.TASK} parentId={task.id} />
            </div>

            {/* Comments */}
            <div className="border-t pt-6">
                <TaskComments taskId={task.id} />
            </div>
        </div>
    );
}
