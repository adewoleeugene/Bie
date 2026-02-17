"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createAutomationRule } from "@/actions/automation";
import { useRouter } from "next/navigation";
import { TriggerType, ActionType } from "@/actions/automation";

interface CreateRuleDialogProps {
    projectId: string;
}

const STATUS_OPTIONS = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED"];
const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"];

export function CreateRuleDialog({ projectId }: CreateRuleDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const [name, setName] = useState("");
    const [triggerType, setTriggerType] = useState<TriggerType>("STATUS_CHANGE");
    const [triggerValue, setTriggerValue] = useState("DONE");
    const [actionType, setActionType] = useState<ActionType>("ADD_COMMENT");
    const [actionValue, setActionValue] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !actionValue) {
            toast.error("Please fill in all fields");
            return;
        }

        setLoading(true);
        try {
            const result = await createAutomationRule({
                name,
                projectId,
                triggerType,
                triggerValue,
                actionType,
                actionValue,
            });

            if (result.success) {
                toast.success("Rule created successfully");
                setOpen(false);
                setName("");
                setActionValue("");
                router.refresh();
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Rule
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Automation Rule</DialogTitle>
                        <DialogDescription>
                            Define a trigger and an action to automate your workflow.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Rule Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Congratulate on Done"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>When...</Label>
                                <Select
                                    value={triggerType}
                                    onValueChange={(val) => setTriggerType(val as TriggerType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="STATUS_CHANGE">Status Changes to</SelectItem>
                                        <SelectItem value="PRIORITY_CHANGE">Priority Changes to</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Value</Label>
                                <Select
                                    value={triggerValue}
                                    onValueChange={setTriggerValue}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {triggerType === "STATUS_CHANGE" ? (
                                            STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)
                                        ) : (
                                            PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Then...</Label>
                                <Select
                                    value={actionType}
                                    onValueChange={(val) => setActionType(val as ActionType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADD_COMMENT">Add Comment</SelectItem>
                                        <SelectItem value="ARCHIVE_TASK">Archive Task</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                {actionType === "ADD_COMMENT" && (
                                    <>
                                        <Label>Message</Label>
                                        <Input
                                            value={actionValue}
                                            onChange={(e) => setActionValue(e.target.value)}
                                            placeholder="Great job team!"
                                        />
                                    </>
                                )}
                                {actionType === "ARCHIVE_TASK" && (
                                    <div className="flex items-center h-full text-sm text-muted-foreground pt-6">
                                        Task will be archived.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Rule"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
