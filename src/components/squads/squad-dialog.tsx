"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    createSquadSchema,
    updateSquadSchema,
    CreateSquadInput,
    UpdateSquadInput
} from "@/lib/validators/squad";
import { useCreateSquad, useUpdateSquad } from "@/hooks/use-squads";
import { useMembers } from "@/hooks/use-members";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Squad } from "@prisma/client";
import { Plus, Users } from "lucide-react";

interface SquadDialogProps {
    squad?: Squad & { members: { userId: string }[] };
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function SquadDialog({ squad, trigger, open: controlledOpen, onOpenChange: setControlledOpen }: SquadDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen : setInternalOpen;

    const isEditing = !!squad;
    const createSquad = useCreateSquad();
    const updateSquad = useUpdateSquad();
    const { data: members } = useMembers();

    const form = useForm<CreateSquadInput | UpdateSquadInput>({
        resolver: zodResolver(isEditing ? updateSquadSchema : createSquadSchema),
        defaultValues: {
            name: "",
            description: "",
            memberIds: [],
        },
    });

    useEffect(() => {
        if (open) {
            if (squad) {
                form.reset({
                    id: squad.id,
                    name: squad.name,
                    description: squad.description || "",
                    memberIds: squad.members?.map(m => m.userId) || [],
                });
            } else {
                form.reset({
                    name: "",
                    description: "",
                    memberIds: [],
                });
            }
        }
    }, [open, squad, form]);

    const onSubmit = async (data: CreateSquadInput | UpdateSquadInput) => {
        try {
            if (isEditing) {
                await updateSquad.mutateAsync(data as UpdateSquadInput);
            } else {
                await createSquad.mutateAsync(data as CreateSquadInput);
            }
            setOpen?.(false);
        } catch (error) {
            // Handled by onError in mutation
            console.error(error);
        }
    };

    const toggleMember = (userId: string) => {
        const current = (form.getValues("memberIds") as string[]) || [];
        if (current.includes(userId)) {
            form.setValue("memberIds", current.filter((id) => id !== userId));
        } else {
            form.setValue("memberIds", [...current, userId]);
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
                            New Squad
                        </Button>
                    </DialogTrigger>
                )
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Squad" : "Create New Squad"}</DialogTitle>
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
                                        <Input placeholder="Squad name" {...field} />
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
                                            placeholder="What is this squad responsible for?"
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div>
                            <FormLabel>Members</FormLabel>
                            <div className="mt-2 flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                                {members?.map((member) => {
                                    const isSelected = (form.watch("memberIds") as string[])?.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => toggleMember(member.id)}
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

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen?.(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createSquad.isPending || updateSquad.isPending}>
                                {createSquad.isPending || updateSquad.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Squad"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
