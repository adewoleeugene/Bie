"use client";

import { useState } from "react";
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
import { Plus } from "lucide-react";
import { useCreateTimeEntry } from "@/hooks/use-time-entries";
import { useTasks } from "@/hooks/use-tasks";

/**
 * Manual time entry — extracted from the retired Hours page. Focus sessions
 * log time automatically; this covers work done away from a session
 * (meetings, calls, offline). Pass `taskId` to scope it to one task and hide
 * the picker, or omit it for a free "log time for any task" entry.
 */
export function LogTimeDialog({
    taskId: presetTaskId,
    trigger,
}: {
    taskId?: string;
    trigger?: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [taskId, setTaskId] = useState(presetTaskId ?? "");
    const [hours, setHours] = useState("");
    const [minutes, setMinutes] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    const { data: tasks } = useTasks();
    const createEntry = useCreateTimeEntry();

    const handleSubmit = async () => {
        if (!taskId) return;
        const totalMinutes = parseInt(hours || "0") * 60 + parseInt(minutes || "0");
        if (totalMinutes <= 0) return;

        const startedAt = new Date(date);
        const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000);

        const result = await createEntry.mutateAsync({
            taskId,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            duration: totalMinutes,
            description: description || null,
        });

        if (result.success) {
            setOpen(false);
            if (!presetTaskId) setTaskId("");
            setHours("");
            setMinutes("");
            setDescription("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Log time
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Log time entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    {!presetTaskId && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium">Task</label>
                            <Select value={taskId} onValueChange={setTaskId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a task..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {tasks?.map((task) => (
                                        <SelectItem key={task.id} value={task.id}>
                                            {task.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-sm font-medium">Duration</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    value={hours}
                                    onChange={(e) => setHours(e.target.value)}
                                />
                                <span className="mt-0.5 block text-xs text-neutral-500">Hours</span>
                            </div>
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    max="59"
                                    value={minutes}
                                    onChange={(e) => setMinutes(e.target.value)}
                                />
                                <span className="mt-0.5 block text-xs text-neutral-500">Minutes</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium">Date</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium">Description</label>
                        <Textarea
                            placeholder="What did you work on?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="resize-none"
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleSubmit}
                        disabled={!taskId || createEntry.isPending}
                    >
                        {createEntry.isPending ? "Logging..." : "Log time"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
