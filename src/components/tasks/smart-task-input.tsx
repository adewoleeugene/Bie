"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CornerDownLeft, Sparkles, Loader2 } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreateTask } from "@/hooks/use-tasks";
import { parseTaskInput } from "@/lib/ai/nlp";
// Note: hook import might need adjustment depending on where useCreateTask is located. 
// Assuming it's in hooks/use-tasks based on previous context.
import { TaskStatus, TaskPriority } from "@prisma/client";

interface SmartTaskInputProps {
    projectId?: string;
    sprintId?: string;
    onSuccess?: () => void;
}

export function SmartTaskInput({ projectId, sprintId, onSuccess }: SmartTaskInputProps) {
    const [input, setInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Custom hook for creating tasks
    // Actually, I should check if useCreateTask exists or import creating action directly.
    // Let's assume useCreateTask exists from use-tasks.ts 
    const createTask = useCreateTask();

    const parseTask = (text: string) => {
        const parsed = parseTaskInput(text);
        return {
            ...parsed,
            projectId: projectId || null,
            sprintId: sprintId || null,
        };
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;

        setIsProcessing(true);

        try {
            const parsed = parseTask(input);

            const result = await createTask.mutateAsync({
                title: parsed.title,
                status: parsed.status,
                priority: parsed.priority,
                projectId: parsed.projectId || undefined,
                sprintId: parsed.sprintId || undefined,
                dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : undefined,
                description: undefined, // Or null
                assigneeIds: [],
                labels: []
            });

            if (result.success) {
                toast.success("Task created!", {
                    description: `Created "${parsed.title}" with priority ${parsed.priority}`
                });
                setInput("");
                onSuccess?.();
            } else {
                toast.error("Failed to create task");
            }
        } catch (error) {
            console.error("Error creating task:", error);
            toast.error("An error occurred");
        } finally {
            setIsProcessing(false);
            // Refocus input for rapid entry
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="relative group w-full max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                <Sparkles className="h-4 w-4" />
            </div>
            <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add task quickly... e.g., 'Review designs tomorrow P1 #marketing'"
                className="pl-10 pr-12 h-12 shadow-sm border-neutral-200 dark:border-neutral-800 focus-visible:ring-primary/20 transition-all font-medium"
                disabled={isProcessing}
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md text-muted-foreground"
                                onClick={() => handleSubmit()}
                                disabled={!input.trim() || isProcessing}
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CornerDownLeft className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="end">
                            <p>Press Enter to add task</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Parsing Preview - Optional: Show parsed details as badges below input while typing */}
            {input.length > 5 && (
                <div className="absolute top-14 left-0 right-0 flex gap-2 overflow-x-auto py-1 px-1 opacity-0 group-focus-within:opacity-100 transition-opacity">
                    {/* This could show extracted Date, Priority, etc badges */}
                </div>
            )}
        </div>
    );
}
