"use client";

import { useState } from "react";
import { MilestoneStatus } from "@prisma/client";
import { useMilestones, useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/hooks/use-milestones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Flag, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { toast } from "sonner";

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; icon: typeof Flag }> = {
    PENDING: { label: "Pending", color: "bg-neutral-500/10 text-neutral-400", icon: Clock },
    IN_PROGRESS: { label: "In Progress", color: "bg-blue-500/10 text-blue-400", icon: Flag },
    COMPLETED: { label: "Completed", color: "bg-green-500/10 text-green-400", icon: CheckCircle2 },
    MISSED: { label: "Missed", color: "bg-red-500/10 text-red-400", icon: AlertTriangle },
};

interface MilestoneListProps {
    projectId: string;
}

export function MilestoneList({ projectId }: MilestoneListProps) {
    const { data: milestones = [], isLoading } = useMilestones(projectId);
    const createMilestone = useCreateMilestone(projectId);
    const updateMilestone = useUpdateMilestone(projectId);
    const deleteMilestone = useDeleteMilestone(projectId);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [description, setDescription] = useState("");

    const handleCreate = async () => {
        if (!title.trim() || !dueDate) return;
        const result = await createMilestone.mutateAsync({
            title: title.trim(),
            description: description.trim() || undefined,
            dueDate,
            projectId,
        });
        if (result.success) {
            toast.success("Milestone created");
            setTitle("");
            setDueDate("");
            setDescription("");
            setDialogOpen(false);
        } else {
            toast.error(result.error || "Failed to create milestone");
        }
    };

    const handleStatusChange = async (milestoneId: string, status: MilestoneStatus) => {
        const result = await updateMilestone.mutateAsync({ milestoneId, data: { status } });
        if (result.success) {
            toast.success("Status updated");
        }
    };

    const handleDelete = async (milestoneId: string) => {
        const result = await deleteMilestone.mutateAsync(milestoneId);
        if (result.success) {
            toast.success("Milestone deleted");
        }
    };

    if (isLoading) return <div className="text-sm text-muted-foreground">Loading milestones...</div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Milestones</h3>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>New Milestone</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <Input
                                placeholder="Milestone title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} disabled={!title.trim() || !dueDate || createMilestone.isPending}>
                                {createMilestone.isPending ? "Creating..." : "Create Milestone"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {milestones.length === 0 ? (
                <p className="text-xs text-muted-foreground">No milestones yet.</p>
            ) : (
                <div className="space-y-2">
                    {milestones.map((milestone) => {
                        const config = STATUS_CONFIG[milestone.status];
                        const Icon = config.icon;
                        const overdue = milestone.status !== "COMPLETED" && isPast(new Date(milestone.dueDate));

                        return (
                            <div
                                key={milestone.id}
                                className="flex items-center justify-between rounded-lg border px-3 py-2"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Icon className={`h-4 w-4 shrink-0 ${overdue ? "text-red-400" : "text-muted-foreground"}`} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{milestone.title}</p>
                                        <p className={`text-xs ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                                            Due {format(new Date(milestone.dueDate), "MMM d, yyyy")}
                                            {overdue && milestone.status !== "MISSED" && " (overdue)"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                                        {config.label}
                                    </Badge>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {(["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED"] as MilestoneStatus[]).map((status) => (
                                                <DropdownMenuItem
                                                    key={status}
                                                    disabled={milestone.status === status}
                                                    onClick={() => handleStatusChange(milestone.id, status)}
                                                >
                                                    {STATUS_CONFIG[status].label}
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => handleDelete(milestone.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
