"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    createSprintSchema,
    updateSprintSchema,
    CreateSprintInput,
    UpdateSprintInput
} from "@/lib/validators/sprint";
import { useCreateSprint, useUpdateSprint } from "@/hooks/use-sprints";
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
import { Sprint } from "@prisma/client";
import { Plus } from "lucide-react";

interface SprintDialogProps {
    projectId: string; // Required for creating new sprints
    sprint?: Sprint;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type SprintFormValues = {
    id?: string;
    name: string;
    goal?: string;
    status: "PLANNING" | "ACTIVE" | "COMPLETED";
    projectId: string;
    startDate: string;
    endDate: string;
};

export function SprintDialog({
    projectId,
    sprint,
    trigger,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
}: SprintDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen : setInternalOpen;

    const isEditing = !!sprint;
    const createSprint = useCreateSprint();
    const updateSprint = useUpdateSprint();

    const form = useForm<SprintFormValues>({
        resolver: zodResolver(isEditing ? updateSprintSchema : createSprintSchema) as any,
        defaultValues: {
            name: "",
            goal: "",
            status: "PLANNING",
            projectId: projectId,
            startDate: undefined, // Type assertion might be needed if strict
            endDate: undefined,
        },
    });

    useEffect(() => {
        if (open) {
            if (sprint) {
                form.reset({
                    id: sprint.id,
                    name: sprint.name,
                    goal: sprint.goal || "",
                    status: sprint.status,
                    projectId: sprint.projectId,
                    startDate: new Date(sprint.startDate).toISOString(), // Ensure ISO string for validation
                    endDate: new Date(sprint.endDate).toISOString(),
                });
            } else {
                form.reset({
                    name: "",
                    goal: "",
                    status: "PLANNING",
                    projectId: projectId,
                    startDate: undefined,
                    endDate: undefined,
                });
            }
        }
    }, [open, sprint, form, projectId]);

    const onSubmit = async (data: SprintFormValues) => {
        try {
            // Ensure dates are properly formatted ISO strings if coming from datetime-local input
            const payload = {
                ...data,
                startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
                endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
            };

            if (isEditing && payload.id) {
                await updateSprint.mutateAsync(payload as UpdateSprintInput);
            } else {
                await createSprint.mutateAsync(payload as CreateSprintInput);
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
                            New Sprint
                        </Button>
                    </DialogTrigger>
                )
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Sprint" : "Create New Sprint"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sprint Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Sprint 24" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="goal"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sprint Goal</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="What is the main goal of this sprint?"
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
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="datetime-local"
                                                {...field}
                                                value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ""}
                                                onChange={(e) => field.onChange(new Date(e.target.value).toISOString())}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Date</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="datetime-local"
                                                {...field}
                                                value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ""}
                                                onChange={(e) => field.onChange(new Date(e.target.value).toISOString())}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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
                                            <SelectItem value="PLANNING">Planning</SelectItem>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                            <SelectItem value="COMPLETED">Completed</SelectItem>
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
                            <Button type="submit" disabled={createSprint.isPending || updateSprint.isPending}>
                                {createSprint.isPending || updateSprint.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Sprint"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
