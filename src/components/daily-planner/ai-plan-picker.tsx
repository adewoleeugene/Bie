"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SuggestedTask {
    id: string;
    title: string;
    status: string;
    priority: string;
}

interface AIPlanPickerProps {
    /** Called with the set of task IDs the user committed. */
    onCommit: (taskIds: string[]) => void;
    /** IDs already committed (shown as pre-checked). */
    existingCommittedIds?: Set<string>;
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
    P0: { label: "Urgent", color: "var(--bz-red)" },
    P1: { label: "High", color: "var(--bz-amber)" },
    P2: { label: "Med", color: "var(--bz-blue)" },
    P3: { label: "Low", color: "#858585" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    IN_PROGRESS: { label: "In progress", color: "var(--bz-amber)" },
    TODO: { label: "To do", color: "var(--bz-blue)" },
    BACKLOG: { label: "Backlog", color: "#858585" },
    IN_REVIEW: { label: "Review", color: "var(--bz-pink)" },
};

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <span
            className="inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{
                color,
                background: `color-mix(in oklab, ${color} 12%, transparent)`,
                border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
            }}
        >
            {children}
        </span>
    );
}

/**
 * AI Plan Picker — asks BieAI for task suggestions and shows them in a
 * modal as a selectable list. The user commits whichever they want to
 * today's plan (they sort to the top; the picker never gates the list).
 */
export function AIPlanPicker({ onCommit, existingCommittedIds }: AIPlanPickerProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const fetchSuggestions = async () => {
        setLoading(true);
        setSuggestions([]);
        setSelected(new Set());

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enableTools: true,
                    messages: [
                        {
                            role: "user",
                            content: `It's ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Call get_today_plan, then pick exactly 2–4 tasks I should focus on this ${timeOfDay}. Rules: always include any IN_PROGRESS tasks (I should finish what I started), then fill with the most urgent remaining. Reply with ONLY a short bullet list — task name + one-sentence reason. No preamble, no summary after.`,
                        },
                    ],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "AI error");

            // Extract tasks from the trace — pick a tight list, not everything.
            // Priority: all IN_PROGRESS (finish what you started), then
            // overdue/due-today, then highest-priority backlog. Cap at 4 total.
            const MAX_SUGGESTIONS = 4;
            const allTasks: SuggestedTask[] = [];
            const seen = new Set<string>();
            if (Array.isArray(data.trace)) {
                for (const t of data.trace) {
                    if (t.name === "get_today_plan" && t.result) {
                        for (const bucket of ["inProgress", "todayOrOverdue", "backlog"]) {
                            const arr = (t.result as Record<string, unknown>)[bucket];
                            if (!Array.isArray(arr)) continue;
                            for (const item of arr) {
                                const id = String((item as Record<string, unknown>).id || "");
                                if (!id || seen.has(id)) continue;
                                seen.add(id);
                                allTasks.push({
                                    id,
                                    title: String((item as Record<string, unknown>).title || "Untitled"),
                                    status: String((item as Record<string, unknown>).status || ""),
                                    priority: String((item as Record<string, unknown>).priority || ""),
                                });
                            }
                        }
                    }
                }
            }

            const prioRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
            const inProgress = allTasks
                .filter((t) => t.status === "IN_PROGRESS")
                .sort((a, b) => (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2));
            const rest = allTasks.filter((t) => t.status !== "IN_PROGRESS");
            rest.sort((a, b) => (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2));
            const remaining = MAX_SUGGESTIONS - inProgress.length;
            const tasks = [...inProgress, ...rest.slice(0, Math.max(0, remaining))];

            setSuggestions(tasks);
            setSelected(new Set(tasks.map((t) => t.id)));
        } catch (err) {
            const msg = err instanceof Error ? err.message : "AI error";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const openAndFetch = () => {
        setOpen(true);
        fetchSuggestions();
    };

    const toggleTask = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(suggestions.map((t) => t.id)));
    const selectNone = () => setSelected(new Set());

    const commitSelected = () => {
        const ids = [...selected];
        if (ids.length === 0) {
            toast.error("Select at least one task");
            return;
        }
        onCommit(ids);
        setOpen(false);
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openAndFetch}
                className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
            >
                <Sparkles className="h-3.5 w-3.5" />
                AI: Plan my {timeOfDay}
            </Button>

            <Dialog
                open={open}
                onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) {
                        setSuggestions([]);
                        setSelected(new Set());
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" style={{ color: "var(--bz-blue)" }} />
                            AI suggestions for your {timeOfDay}
                        </DialogTitle>
                        <DialogDescription>
                            Picked from what you&apos;ve started and what&apos;s due today. Uncheck any you don&apos;t want, then add them to today.
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Thinking…
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="py-12 text-center text-sm text-neutral-500">
                            No suggestions right now — you&apos;re all clear.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] text-neutral-500">
                                    {selected.size} of {suggestions.length} selected
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="rounded px-2 py-1 text-[11px] font-medium text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                                    >
                                        Select all
                                    </button>
                                    <button
                                        type="button"
                                        onClick={selectNone}
                                        className="rounded px-2 py-1 text-[11px] font-medium text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <ul className="space-y-1.5">
                                {suggestions.map((task) => {
                                    const checked = selected.has(task.id);
                                    const alreadyCommitted = existingCommittedIds?.has(task.id);
                                    const pri = PRIORITY_LABELS[task.priority];
                                    const st = STATUS_LABELS[task.status];
                                    return (
                                        <li
                                            key={task.id}
                                            onClick={() => toggleTask(task.id)}
                                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                                checked
                                                    ? "border-white/[0.12] bg-white/[0.05]"
                                                    : "border-transparent hover:bg-white/[0.03]"
                                            }`}
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleTask(task.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="h-[18px] w-[18px] shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[13px] font-medium text-white">
                                                    {task.title}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                    {st && <Pill color={st.color}>{st.label}</Pill>}
                                                    {pri && <Pill color={pri.color}>{pri.label}</Pill>}
                                                    {alreadyCommitted && (
                                                        <Pill color="var(--bz-green)">Already added</Pill>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={fetchSuggestions}
                            disabled={loading}
                            className="text-[12px] text-neutral-400"
                        >
                            Re-generate
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={commitSelected}
                            disabled={loading || selected.size === 0}
                            className="text-[12px] font-medium text-black"
                            style={{ background: "var(--bz-blue)" }}
                        >
                            Add {selected.size} to today
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
