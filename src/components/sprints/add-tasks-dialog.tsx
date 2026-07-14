"use client";

import { useMemo, useState } from "react";
import { useTasks, useAddTasksToSprint } from "@/hooks/use-tasks";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddTasksDialogProps {
    projectId: string;
    sprintId: string;
    sprintName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddTasksDialog({
    projectId,
    sprintId,
    sprintName,
    open,
    onOpenChange,
}: AddTasksDialogProps) {
    const { data: tasks, isLoading } = useTasks(projectId);
    const addTasks = useAddTasksToSprint();
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Tasks eligible to pull in: in this project, not already in this sprint,
    // and not archived.
    const candidates = useMemo(
        () =>
            (tasks || []).filter(
                (t: any) => t.sprintId !== sprintId && t.status !== "ARCHIVED"
            ),
        [tasks, sprintId]
    );

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allSelected = candidates.length > 0 && selected.size === candidates.length;
    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(candidates.map((t: { id: string }) => t.id)));
    };

    const close = (o: boolean) => {
        if (!o) setSelected(new Set());
        onOpenChange(o);
    };

    const handleAdd = async () => {
        if (selected.size === 0) return;
        const result = await addTasks.mutateAsync({
            sprintId,
            taskIds: Array.from(selected),
        });
        if (result.success) {
            setSelected(new Set());
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Add tasks to {sprintName || "sprint"}</DialogTitle>
                    <DialogDescription>
                        Select existing tasks to move into this sprint.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                        Loading tasks…
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                        No other tasks available to add.
                    </div>
                ) : (
                    <>
                        <label className="flex cursor-pointer items-center gap-3 px-3 pb-1">
                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                            <span className="text-xs font-medium text-muted-foreground">
                                {allSelected ? "Deselect all" : `Select all (${candidates.length})`}
                            </span>
                        </label>
                        <ScrollArea className="max-h-[360px] pr-3">
                        <div className="space-y-1">
                            {candidates.map((t: any) => (
                                <label
                                    key={t.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-secondary/50"
                                >
                                    <Checkbox
                                        checked={selected.has(t.id)}
                                        onCheckedChange={() => toggle(t.id)}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{t.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.status.replace("_", " ")}
                                            {t.sprint ? ` · ${t.sprint.name}` : " · Backlog"}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        </ScrollArea>
                    </>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => close(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAdd}
                        disabled={selected.size === 0 || addTasks.isPending}
                    >
                        {addTasks.isPending
                            ? "Adding…"
                            : selected.size > 0
                                ? `Add ${selected.size} task${selected.size === 1 ? "" : "s"}`
                                : "Add tasks"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
