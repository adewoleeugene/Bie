"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTaskSchema, CreateTaskInput } from "@/lib/validators/task";
import { useCreateTask } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-members";
import { useProjects } from "@/hooks/use-projects";
import { useSprints } from "@/hooks/use-sprints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BlockEditor } from "@/components/wiki/block-editor";
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
import { TaskStatus, TaskPriority } from "@prisma/client";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

interface TaskFormProps {
    projectId?: string;
    sprintId?: string;
}

export function TaskForm({ projectId: initialProjectId, sprintId: initialSprintId }: TaskFormProps) {
    const [open, setOpen] = useState(false);
    const createTask = useCreateTask();
    const { data: members } = useMembers();
    const { data: projects } = useProjects();

    const form = useForm<CreateTaskInput>({
        resolver: zodResolver(createTaskSchema) as any,
        defaultValues: {
            title: "",
            description: undefined,
            status: "BACKLOG",
            priority: "P2",
            assigneeIds: [],
            labels: [],
            projectId: initialProjectId || undefined,
            sprintId: initialSprintId || undefined,
            dueDate: undefined,
            estimatedHours: undefined,
        },
    });

    const watchedProjectId = form.watch("projectId");
    const { data: allSprints } = useSprints();
    // If a project is selected, show its sprints first, but always show all
    const sprints = watchedProjectId
        ? allSprints?.filter((s: any) => s.projectId === watchedProjectId)
        : allSprints;
    const hasNoProjectSprints = watchedProjectId && (!sprints || sprints.length === 0);

    useEffect(() => {
        if (open) {
            form.reset({
                title: "",
                description: undefined,
                status: "BACKLOG",
                priority: "P2",
                assigneeIds: [],
                labels: [],
                projectId: initialProjectId || undefined,
                sprintId: initialSprintId || undefined,
                dueDate: undefined,
                estimatedHours: undefined,
            });
        }
    }, [open, initialProjectId, initialSprintId, form]);

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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter task title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <div className="min-h-[150px] border rounded-md p-1">
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

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="projectId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                            defaultValue={field.value || "none"}
                                            value={field.value || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Project" />
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sprintId"
                                render={({ field }) => {
                                    // Show project-specific sprints, or all if project has none
                                    const displaySprints = hasNoProjectSprints ? allSprints : sprints;
                                    return (
                                        <FormItem>
                                            <FormLabel>Sprint</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value || undefined}
                                                value={field.value || undefined}
                                                disabled={!allSprints?.length}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Sprint" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {displaySprints?.map((sprint: any) => (
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
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="BACKLOG">Backlog</SelectItem>
                                                <SelectItem value="TODO">To Do</SelectItem>
                                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                                                <SelectItem value="DONE">Done</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Priority" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="P0">P0 - Critical</SelectItem>
                                                <SelectItem value="P1">P1 - High</SelectItem>
                                                <SelectItem value="P2">P2 - Medium</SelectItem>
                                                <SelectItem value="P3">P3 - Low</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div>
                            <FormLabel>Assignees</FormLabel>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {members?.map((member) => {
                                    const isSelected = form.watch("assigneeIds")?.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => toggleAssignee(member.id)}
                                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${isSelected
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
                                                }`}
                                        >
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={member.image || undefined} />
                                                <AvatarFallback className="text-[10px]">
                                                    {member.name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {member.name}
                                        </button>
                                    );
                                })}
                                {!members?.length && (
                                    <p className="text-sm text-neutral-500">No members found.</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type="datetime-local"
                                                    {...field}
                                                    value={field.value || ""}
                                                    className="pl-8"
                                                />
                                                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Due Date</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type="datetime-local"
                                                    {...field}
                                                    value={field.value || ""}
                                                    className="pl-8"
                                                />
                                                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="estimatedHours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Est. Hours</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="e.g. 4.5"
                                                {...field}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    field.onChange(isNaN(val) ? undefined : val);
                                                }}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createTask.isPending}>
                                {createTask.isPending ? "Creating..." : "Create Task"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
