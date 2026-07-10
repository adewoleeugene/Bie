"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Resolver, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTaskSchema, CreateTaskInput } from "@/lib/validators/task";
import { useCreateTask, useTaskStatusColumns } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-members";
import { useSquads } from "@/hooks/use-squads";
import { useProjects } from "@/hooks/use-projects";
import { useSprints } from "@/hooks/use-sprints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "@/components/wiki/block-editor";
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
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
import { TaskStatus } from "@prisma/client";
import {
    Plus,
    Calendar as CalendarIcon,
    CircleDashed,
    Flag,
    FolderKanban,
    Rocket,
    Users,
    Clock,
    Check,
    X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

interface TaskFormProps {
    projectId?: string;
    sprintId?: string;
    defaultStatus?: TaskStatus;
    defaultStatusColumnId?: string;
    trigger?: ReactNode;
}

// Notion-style property row: icon + muted label on the left, control on the right.
function PropertyRow({
    icon: Icon,
    label,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start gap-2 py-0.5">
            <div className="flex w-32 shrink-0 items-center gap-2 pt-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
            </div>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

// Borderless select trigger so properties read like inline text until hovered.
const ghostTrigger =
    "w-full justify-between border-0 bg-transparent px-2 font-normal shadow-none hover:bg-muted/60 dark:bg-transparent dark:hover:bg-muted/40 focus-visible:ring-0";

export function TaskForm({
    projectId: initialProjectId,
    sprintId: initialSprintId,
    defaultStatus = "BACKLOG",
    defaultStatusColumnId,
    trigger,
}: TaskFormProps) {
    const [open, setOpen] = useState(false);
    const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
    const createTask = useCreateTask();
    const { data: members } = useMembers();
    const { data: squads } = useSquads();
    const { data: projects } = useProjects();
    const { data: statusColumnsResult } = useTaskStatusColumns(initialProjectId ?? null);

    const form = useForm<CreateTaskInput>({
        resolver: zodResolver(createTaskSchema) as Resolver<CreateTaskInput>,
        defaultValues: {
            title: "",
            description: undefined,
            status: defaultStatus,
            statusColumnId: defaultStatusColumnId,
            priority: "P2",
            assigneeIds: [],
            labels: [],
            projectId: initialProjectId || undefined,
            sprintId: initialSprintId || undefined,
            dueDate: undefined,
            estimatedHours: undefined,
        },
    });
    const selectedStatusColumnId = useWatch({
        control: form.control,
        name: "statusColumnId",
    });
    const selectedAssigneeIds = useWatch({
        control: form.control,
        name: "assigneeIds",
    });
    const watchedProjectId = useWatch({
        control: form.control,
        name: "projectId",
    });

    const { data: allSprints } = useSprints();
    // If a project is selected, show its sprints first, but always show all
    const sprints = watchedProjectId
        ? allSprints?.filter((sprint) => sprint.projectId === watchedProjectId)
        : allSprints;
    const hasNoProjectSprints = watchedProjectId && (!sprints || sprints.length === 0);

    const selectedMembers =
        members?.filter((member) => selectedAssigneeIds?.includes(member.id)) ?? [];

    useEffect(() => {
        if (open) {
            form.reset({
                title: "",
                description: undefined,
                status: defaultStatus,
                statusColumnId: defaultStatusColumnId,
                priority: "P2",
                assigneeIds: [],
                labels: [],
                projectId: initialProjectId || undefined,
                sprintId: initialSprintId || undefined,
                dueDate: undefined,
                estimatedHours: undefined,
            });
        }
    }, [open, initialProjectId, initialSprintId, defaultStatus, defaultStatusColumnId, form]);

    const onSubmit = async (data: CreateTaskInput) => {
        try {
            const payload = {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
                startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
            };

            const result = await createTask.mutateAsync(payload);
            if (result.success) {
                setOpen(false);
                form.reset();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleAssignee = (userId: string) => {
        const current = form.getValues("assigneeIds") || [];
        if (current.includes(userId)) {
            form.setValue("assigneeIds", current.filter((id) => id !== userId));
        } else {
            form.setValue("assigneeIds", [...current, userId]);
        }
    };

    // Assigning a squad is a shortcut that adds all of its members as assignees.
    const assignSquad = (squad: { members?: { userId?: string; user?: { id?: string } }[] }) => {
        const memberIds = (squad.members || [])
            .map((m) => m.userId || m.user?.id)
            .filter((id): id is string => Boolean(id));
        const current = form.getValues("assigneeIds") || [];
        form.setValue("assigneeIds", Array.from(new Set([...current, ...memberIds])));
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {trigger ?? (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Task
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent
                side="right"
                className="w-full gap-0 p-0 sm:max-w-[560px]"
            >
                <SheetTitle className="sr-only">Create New Task</SheetTitle>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex h-full flex-col"
                    >
                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto px-6 pt-12 pb-6">
                            {/* Title — large, borderless, the focal point */}
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <Input
                                                autoFocus
                                                placeholder="Untitled task"
                                                className="h-auto border-0 bg-transparent px-0 !text-2xl font-semibold shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 dark:bg-transparent"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Properties */}
                            <div className="mt-4 space-y-1 border-b pb-4">
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <PropertyRow icon={CircleDashed} label="Status">
                                            <Select
                                                onValueChange={(value) => {
                                                    const statusColumn = statusColumnsResult?.success
                                                        ? statusColumnsResult.data.find((column) => column.id === value)
                                                        : undefined;

                                                    if (statusColumn) {
                                                        form.setValue("statusColumnId", statusColumn.id);
                                                        field.onChange(statusColumn.status || "TODO");
                                                    } else {
                                                        form.setValue("statusColumnId", undefined);
                                                        field.onChange(value);
                                                    }
                                                }}
                                                value={selectedStatusColumnId || field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={ghostTrigger}>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {statusColumnsResult?.success && statusColumnsResult.data.length > 0 ? (
                                                        statusColumnsResult.data.map((column) => (
                                                            <SelectItem key={column.id} value={column.id}>
                                                                {column.name}
                                                            </SelectItem>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <SelectItem value="BACKLOG">Backlog</SelectItem>
                                                            <SelectItem value="TODO">To Do</SelectItem>
                                                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                                            <SelectItem value="IN_REVIEW">In Review</SelectItem>
                                                            <SelectItem value="DONE">Done</SelectItem>
                                                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </PropertyRow>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <PropertyRow icon={Flag} label="Priority">
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={ghostTrigger}>
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="P0">P0 - Critical</SelectItem>
                                                    <SelectItem value="P1">P1 - High</SelectItem>
                                                    <SelectItem value="P2">P2 - Medium</SelectItem>
                                                    <SelectItem value="P3">P3 - Low</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </PropertyRow>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="projectId"
                                    render={({ field }) => (
                                        <PropertyRow icon={FolderKanban} label="Project">
                                            <Select
                                                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                                defaultValue={field.value || "none"}
                                                value={field.value || "none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={ghostTrigger}>
                                                        <SelectValue placeholder="Select project" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">No Project (General Task)</SelectItem>
                                                    {projects?.map((project) => (
                                                        <SelectItem key={project.id} value={project.id}>
                                                            {project.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </PropertyRow>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="sprintId"
                                    render={({ field }) => {
                                        // Show project-specific sprints, or all if project has none
                                        const displaySprints = hasNoProjectSprints ? allSprints : sprints;
                                        return (
                                            <PropertyRow icon={Rocket} label="Sprint">
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value || undefined}
                                                    value={field.value || undefined}
                                                    disabled={!allSprints?.length}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className={ghostTrigger}>
                                                            <SelectValue placeholder="Select sprint" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {displaySprints?.map((sprint) => (
                                                            <SelectItem key={sprint.id} value={sprint.id}>
                                                                <div className="flex flex-col">
                                                                    <span>{sprint.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {sprint.project?.name ? `${sprint.project.name} · ` : ""}
                                                                        {format(new Date(sprint.startDate), "MMM d, yyyy")} - {format(new Date(sprint.endDate), "MMM d, yyyy")}
                                                                    </span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </PropertyRow>
                                        );
                                    }}
                                />

                                <PropertyRow icon={Users} label="Assignees">
                                    <Popover
                                        open={assigneePopoverOpen}
                                        onOpenChange={setAssigneePopoverOpen}
                                    >
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex min-h-8 w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/60 dark:hover:bg-muted/40"
                                            >
                                                {selectedMembers.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {selectedMembers.map((member) => (
                                                            <span
                                                                key={member.id}
                                                                className="flex items-center gap-1 rounded-full bg-muted/60 py-0.5 pl-0.5 pr-2 text-xs dark:bg-muted/40"
                                                            >
                                                                <Avatar className="h-4 w-4">
                                                                    <AvatarImage src={member.image || undefined} />
                                                                    <AvatarFallback className="text-[9px]">
                                                                        {member.name?.substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                {member.name}
                                                                <X
                                                                    className="h-3 w-3 text-muted-foreground hover:text-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleAssignee(member.id);
                                                                    }}
                                                                />
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">Empty</span>
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
                                                                    memberIds.every((id: string) => selectedAssigneeIds?.includes(id));
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
                                                                        {allSelected && <Check className="h-4 w-4" />}
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    )}
                                                    <CommandGroup heading={squads && squads.length > 0 ? "People" : undefined}>
                                                        {members?.map((member) => {
                                                            const isSelected = selectedAssigneeIds?.includes(member.id);
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
                                                                    {isSelected && <Check className="h-4 w-4" />}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </PropertyRow>

                                <FormField
                                    control={form.control}
                                    name="startDate"
                                    render={({ field }) => (
                                        <PropertyRow icon={CalendarIcon} label="Start date">
                                            <Input
                                                type="datetime-local"
                                                {...field}
                                                value={field.value || ""}
                                                className={`h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60 dark:bg-transparent dark:hover:bg-muted/40 focus-visible:ring-0 ${field.value ? "" : "text-muted-foreground"}`}
                                            />
                                        </PropertyRow>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="dueDate"
                                    render={({ field }) => (
                                        <PropertyRow icon={CalendarIcon} label="Due date">
                                            <Input
                                                type="datetime-local"
                                                {...field}
                                                value={field.value || ""}
                                                className={`h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60 dark:bg-transparent dark:hover:bg-muted/40 focus-visible:ring-0 ${field.value ? "" : "text-muted-foreground"}`}
                                            />
                                        </PropertyRow>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="estimatedHours"
                                    render={({ field }) => (
                                        <PropertyRow icon={Clock} label="Est. hours">
                                            <Input
                                                type="number"
                                                placeholder="e.g. 4.5"
                                                {...field}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    field.onChange(isNaN(val) ? undefined : val);
                                                }}
                                                value={field.value || ""}
                                                className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted/60 dark:bg-transparent dark:hover:bg-muted/40 focus-visible:ring-0"
                                            />
                                        </PropertyRow>
                                    )}
                                />
                            </div>

                            {/* Description — clean block editor, no boxed border */}
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem className="mt-4 space-y-0">
                                        <FormControl>
                                            <div className="min-h-[180px]">
                                                <BlockEditor
                                                    initialContent={field.value}
                                                    onChange={field.onChange}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Sticky footer */}
                        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createTask.isPending}>
                                {createTask.isPending ? "Creating..." : "Create Task"}
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
