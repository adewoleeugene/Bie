"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    createProjectSchema,
    updateProjectSchema,
    CreateProjectInput,
    UpdateProjectInput
} from "@/lib/validators/project";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { useMembers } from "@/hooks/use-members";
import { useSquads } from "@/hooks/use-squads";
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Project, ProjectStatus } from "@prisma/client";
import { Plus } from "lucide-react";

interface ProjectDialogProps {
    project?: Project & { lead?: { id: string } | null, squad?: { id: string } | null };
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ProjectDialog({
    project,
    trigger,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
}: ProjectDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen : setInternalOpen;

    const isEditing = !!project;
    const createProject = useCreateProject();
    const updateProject = useUpdateProject();
    const { data: members } = useMembers();
    const { data: squads } = useSquads();

    const form = useForm<CreateProjectInput | UpdateProjectInput>({
        resolver: zodResolver(isEditing ? updateProjectSchema : createProjectSchema),
        defaultValues: {
            name: "",
            description: "",
            status: "ACTIVE",
            leadId: "",
            squadId: "",
        },
    });

    useEffect(() => {
        if (open) {
            if (project) {
                form.reset({
                    id: project.id,
                    name: project.name,
                    description: project.description || "",
                    status: project.status,
                    leadId: project.leadId || null,
                    squadId: project.squadId || null,
                });
            } else {
                form.reset({
                    name: "",
                    description: "",
                    status: "ACTIVE",
                    leadId: null,
                    squadId: null,
                });
            }
        }
    }, [open, project, form]);

    const onSubmit = async (data: CreateProjectInput | UpdateProjectInput) => {
        try {
            if (isEditing) {
                await updateProject.mutateAsync(data as UpdateProjectInput);
            } else {
                await createProject.mutateAsync(data as CreateProjectInput);
            }
            setOpen?.(false);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                !isControlled && (
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    </DialogTrigger>
                )
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Project" : "Create New Project"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Project name" {...field} />
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
                                        <Textarea
                                            placeholder="Project description"
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ACTIVE">Active</SelectItem>
                                                <SelectItem value="PAUSED">Paused</SelectItem>
                                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                                <SelectItem value="ARCHIVED">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="squadId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Squad</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                            defaultValue={field.value || "none"}
                                            value={field.value || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select squad" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">No Squad</SelectItem>
                                                {squads?.map((squad) => (
                                                    <SelectItem key={squad.id} value={squad.id}>
                                                        {squad.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="leadId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project Lead</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                        defaultValue={field.value || "none"}
                                        value={field.value || "none"}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select lead" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">No Lead</SelectItem>
                                            {members?.map((member) => (
                                                <SelectItem key={member.id} value={member.id}>
                                                    {member.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen?.(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
                                {createProject.isPending || updateProject.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
