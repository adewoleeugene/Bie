"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Sparkles,
    Loader2,
    CheckSquare,
    Square,
} from "lucide-react";
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

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
    P0: { label: "Urgent", cls: "bg-red-500/20 text-red-400" },
    P1: { label: "High", cls: "bg-orange-500/20 text-orange-400" },
    P2: { label: "Med", cls: "bg-blue-500/20 text-blue-400" },
    P3: { label: "Low", cls: "bg-neutral-500/20 text-neutral-400" },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    IN_PROGRESS: { label: "In progress", cls: "bg-blue-500/20 text-blue-400" },
    TODO: { label: "To do", cls: "bg-neutral-500/20 text-neutral-400" },
    BACKLOG: { label: "Backlog", cls: "bg-neutral-500/20 text-neutral-500" },
    IN_REVIEW: { label: "Review", cls: "bg-purple-500/20 text-purple-400" },
};

/**
 * AI Plan Picker — asks BieAI for task suggestions, shows them as a
 * selectable list, and lets the user commit whichever they want to
 * today's plan.
 *
 * Two modes:
 *  1. "Auto" — accept all AI suggestions in one click.
 *  2. "Pick" — toggle individual tasks, then commit.
 */
export function AIPlanPicker({ onCommit, existingCommittedIds }: AIPlanPickerProps) {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [aiMessage, setAiMessage] = useState<string | null>(null);

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const fetchSuggestions = async () => {
        setLoading(true);
        setSuggestions([]);
        setSelected(new Set());
        setAiMessage(null);

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
                        // Walk buckets in priority order.
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

            // Build the tight list: all in-progress + fill to MAX from the rest.
            const prioRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
            const inProgress = allTasks
                .filter((t) => t.status === "IN_PROGRESS")
                .sort((a, b) => (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2));
            const rest = allTasks.filter((t) => t.status !== "IN_PROGRESS");
            rest.sort((a, b) => (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2));
            const remaining = MAX_SUGGESTIONS - inProgress.length;
            const tasks = [...inProgress, ...rest.slice(0, Math.max(0, remaining))];

            setSuggestions(tasks);
            // Pre-select all by default (user can deselect).
            setSelected(new Set(tasks.map((t) => t.id)));
            setAiMessage(typeof data.message === "string" ? data.message : null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "AI error";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
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
        setSuggestions([]);
        setSelected(new Set());
        setAiMessage(null);
    };

    // Nothing shown yet — just the button.
    if (suggestions.length === 0 && !loading) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchSuggestions}
                disabled={loading}
                className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
            >
                <Sparkles className="h-3.5 w-3.5" />
                AI: Plan my {timeOfDay}
            </Button>
        );
    }

    return (
        <div
            className="rounded-xl border p-4 space-y-3"
            style={{
                borderColor: "color-mix(in oklab, var(--bz-blue) 35%, var(--border))",
                background:
                    "linear-gradient(180deg, color-mix(in oklab, var(--bz-blue) 6%, var(--card)), var(--card))",
            }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: "var(--bz-blue)" }} />
                    <span className="text-[13px] font-medium text-white">
                        AI suggestions for your {timeOfDay}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="rounded px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                    >
                        <CheckSquare className="mr-1 inline h-3 w-3" />
                        All
                    </button>
                    <button
                        type="button"
                        onClick={selectNone}
                        className="rounded px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                    >
                        <Square className="mr-1 inline h-3 w-3" />
                        None
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                </div>
            ) : (
                <>
                    {/* AI's reasoning */}
                    {aiMessage && (
                        <p className="text-[12px] leading-relaxed text-neutral-500">
                            {aiMessage}
                        </p>
                    )}

                    {/* Selectable task list */}
                    <ul className="space-y-1">
                        {suggestions.map((task) => {
                            const checked = selected.has(task.id);
                            const alreadyCommitted = existingCommittedIds?.has(task.id);
                            const pri = PRIORITY_LABELS[task.priority];
                            const st = STATUS_LABELS[task.status];
                            return (
                                <li
                                    key={task.id}
                                    onClick={() => toggleTask(task.id)}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                        checked
                                            ? "bg-white/[0.06]"
                                            : "hover:bg-white/[0.03]"
                                    }`}
                                >
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => toggleTask(task.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-[18px] w-[18px]"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <span className="truncate text-[13px] font-medium text-white">
                                            {task.title}
                                        </span>
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            {st && (
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] ${st.cls}`}>
                                                    {st.label}
                                                </span>
                                            )}
                                            {pri && (
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] ${pri.cls}`}>
                                                    {pri.label}
                                                </span>
                                            )}
                                            {alreadyCommitted && (
                                                <span className="rounded px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400">
                                                    Already planned
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                        <Button
                            type="button"
                            size="sm"
                            onClick={commitSelected}
                            disabled={selected.size === 0}
                            className="text-[12px] font-medium text-black"
                            style={{
                                background: "var(--bz-blue)",
                                boxShadow: "0 8px 24px -8px rgba(0,153,255,0.55)",
                            }}
                        >
                            Commit {selected.size} {selected.size === 1 ? "task" : "tasks"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={fetchSuggestions}
                            className="text-[12px] text-neutral-400"
                        >
                            Re-generate
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSuggestions([]);
                                setAiMessage(null);
                            }}
                            className="text-[12px] text-neutral-400"
                        >
                            Cancel
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
