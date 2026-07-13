"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Sparkles,
    Compass,
    ClipboardList,
    Bell,
    Loader2,
    Send,
    Play,
    X,
    CheckCircle2,
    Rocket,
    User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

/**
 * BieAI Focus Strip — the Blitzit-style copilot baked into the focus screen.
 *
 * Features:
 *  - 3 one-tap actions ("What's next", "Plan my afternoon", "Summarize my day")
 *  - 1 destructive one-tap action ("Start next focus") with confirm flow
 *  - Inline conversational thread (follow-up messages)
 *  - SSE streaming of the final reply (text appears live as it's typed)
 *  - Tool-trace chips render as the model runs each tool
 *  - Tiny inline markdown renderer (bold, italic, bullets) — no extra deps
 *
 * The route runs the tool-loop server-side and emits four event types over SSE:
 *   tool_start, tool_result, tool_blocked, text_chunk, done
 *
 * Destructive tools (create_task, complete_task, start_focus_session,
 * end_focus_session) require `confirmDestructive: true` in the request, which
 * we only set after the user explicitly clicks "confirm" on a pending action.
 */

interface PlanTask {
    id: string;
    title: string;
    status: string;
    priority: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    /** Streaming-in-progress flag — disables the input while the strip waits. */
    pending?: boolean;
    /** Tool calls observed during this assistant turn. */
    trace?: ToolEvent[];
    /** True if any destructive tool was blocked → render the confirm row. */
    blockedAt?: { prompt: string; toolNames: string[] } | null;
    /** Tasks extracted from tool results — rendered as actionable focus buttons. */
    planTasks?: PlanTask[];
}

interface ToolEvent {
    name: string;
    status: "running" | "ok" | "error" | "blocked";
    error?: string;
    result?: unknown;
}

interface FocusAIStripProps {
    onStartFocus?: (taskId: string) => void;
}

export function FocusAIStrip({ onStartFocus }: FocusAIStripProps) {
    const qc = useQueryClient();
    const [thread, setThread] = useState<ChatMessage[]>([]);
    const [followUp, setFollowUp] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Focus queue — committed plan the user is working through sequentially.
    const [focusQueue, setFocusQueue] = useState<PlanTask[]>([]);
    const [activeQueueIdx, setActiveQueueIdx] = useState(0);

    const commitPlan = (tasks: PlanTask[]) => {
        setFocusQueue(tasks);
        setActiveQueueIdx(0);
    };

    const startQueueTask = (idx: number) => {
        setActiveQueueIdx(idx);
        const task = focusQueue[idx];
        if (task && onStartFocus) onStartFocus(task.id);
    };

    const markQueueDone = (idx: number) => {
        // Move to next task in queue.
        const next = idx + 1;
        setActiveQueueIdx(next);
        if (next < focusQueue.length && onStartFocus) {
            onStartFocus(focusQueue[next].id);
        }
    };

    const clearQueue = () => {
        setFocusQueue([]);
        setActiveQueueIdx(0);
    };

    // Auto-scroll the thread when new content arrives.
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [thread]);

    /**
     * Send a prompt through the streaming /api/ai/chat route.
     *
     * Reads the SSE stream and updates the assistant message in place as
     * tool_start / tool_result / text_chunk events arrive.
     */
    const stream = async (
        userPrompt: string,
        opts: { confirmDestructive?: boolean; visible?: boolean } = {},
    ) => {
        if (busy) return;
        setBusy(true);

        // Append the user message (skipped for "silent" confirms that re-run
        // an existing prompt — for those we just continue the assistant turn).
        const visible = opts.visible !== false;
        if (visible) {
            setThread((prev) => [
                ...prev,
                { role: "user", content: userPrompt },
                { role: "assistant", content: "", pending: true, trace: [] },
            ]);
        } else {
            // Mark the last assistant turn as pending again, clear its
            // text/trace so the streaming overwrites the blocked attempt.
            setThread((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                    next[lastIdx] = {
                        ...next[lastIdx],
                        content: "",
                        trace: [],
                        pending: true,
                        blockedAt: null,
                    };
                }
                return next;
            });
        }

        // Build message history from the thread for the model. Use the
        // *current* thread state (sans the pending placeholder we just added).
        const history = thread
            .filter((m) => !m.pending)
            .map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: userPrompt });

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enableTools: true,
                    stream: true,
                    confirmDestructive: !!opts.confirmDestructive,
                    messages: history,
                }),
            });
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `AI error (${res.status})`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            const localTrace: ToolEvent[] = [];
            const blockedNames: string[] = [];
            const localPlanTasks: PlanTask[] = [];

            // Update the last assistant message in the thread.
            const patchLast = (patch: Partial<ChatMessage>) => {
                setThread((prev) => {
                    const next = [...prev];
                    const idx = next.length - 1;
                    if (idx < 0 || next[idx].role !== "assistant") return prev;
                    next[idx] = { ...next[idx], ...patch };
                    return next;
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // SSE: split on double newline; each "data: …" is one event.
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith("data:")) continue;
                    const json = line.slice(5).trim();
                    if (!json) continue;
                    let event:
                        | { type: string; data?: Record<string, unknown> }
                        | undefined;
                    try {
                        event = JSON.parse(json);
                    } catch {
                        continue;
                    }
                    if (!event) continue;

                    if (event.type === "tool_start") {
                        const name = String(
                            (event.data as { name?: string })?.name || "",
                        );
                        if (!name) continue;
                        localTrace.push({ name, status: "running" });
                        patchLast({ trace: [...localTrace] });
                    } else if (event.type === "tool_result") {
                        const data = event.data as {
                            name?: string;
                            error?: string;
                            result?: unknown;
                        };
                        const name = String(data?.name || "");
                        // Find the matching running entry; mark it ok/error.
                        const idx = localTrace.findIndex(
                            (t) => t.name === name && t.status === "running",
                        );
                        if (idx >= 0) {
                            localTrace[idx] = {
                                name,
                                status: data?.error ? "error" : "ok",
                                error: data?.error,
                                result: data?.result,
                            };
                        } else {
                            localTrace.push({
                                name,
                                status: data?.error ? "error" : "ok",
                                error: data?.error,
                                result: data?.result,
                            });
                        }

                        // Extract actionable tasks from tool results.
                        if (!data?.error && data?.result) {
                            extractPlanTasks(name, data.result, localPlanTasks);
                        }

                        patchLast({
                            trace: [...localTrace],
                            planTasks: localPlanTasks.length > 0 ? [...localPlanTasks] : undefined,
                        });
                    } else if (event.type === "tool_blocked") {
                        const name = String(
                            (event.data as { name?: string })?.name || "",
                        );
                        if (name) {
                            blockedNames.push(name);
                            localTrace.push({ name, status: "blocked" });
                            patchLast({ trace: [...localTrace] });
                        }
                    } else if (event.type === "text_chunk") {
                        const chunk = String(event.data ?? "");
                        // Append the chunk to the assistant message in place.
                        setThread((prev) => {
                            const next = [...prev];
                            const idx = next.length - 1;
                            if (idx < 0 || next[idx].role !== "assistant") {
                                return prev;
                            }
                            next[idx] = {
                                ...next[idx],
                                content: (next[idx].content || "") + chunk,
                            };
                            return next;
                        });
                    } else if (event.type === "done") {
                        // Finalize. If anything was blocked, attach a confirm
                        // row so the user can re-run with confirmation.
                        patchLast({
                            pending: false,
                            blockedAt:
                                blockedNames.length > 0
                                    ? {
                                          prompt: userPrompt,
                                          toolNames: blockedNames,
                                      }
                                    : null,
                        });
                        // Refresh queries that any executed tool may have touched.
                        const touchedSession = localTrace.some(
                            (t) =>
                                (t.name === "start_focus_session" ||
                                    t.name === "end_focus_session") &&
                                t.status === "ok",
                        );
                        if (touchedSession) {
                            qc.invalidateQueries({
                                queryKey: ["active-focus-session"],
                            });
                            qc.invalidateQueries({ queryKey: ["focus-sessions"] });
                        }
                        if (
                            localTrace.some(
                                (t) =>
                                    (t.name === "complete_task" ||
                                        t.name === "create_task") &&
                                    t.status === "ok",
                            )
                        ) {
                            qc.invalidateQueries({ queryKey: ["tasks"] });
                        }
                    } else if (event.type === "error") {
                        const msg = String(
                            (event.data as { message?: string })?.message ||
                                "AI error",
                        );
                        toast.error(msg);
                        patchLast({
                            content: `Error: ${msg}`,
                            pending: false,
                        });
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "AI error";
            toast.error(msg);
            setThread((prev) => {
                const next = [...prev];
                const idx = next.length - 1;
                if (idx >= 0 && next[idx].role === "assistant") {
                    next[idx] = {
                        ...next[idx],
                        content: `Error: ${msg}`,
                        pending: false,
                    };
                }
                return next;
            });
        } finally {
            setBusy(false);
        }
    };

    const submitFollowUp = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        const text = followUp.trim();
        if (!text) return;
        setFollowUp("");
        void stream(text);
    };

    // ─── One-tap actions ────────────────────────────────────

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const planLabel = `Plan my ${timeOfDay}`;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const endTime = hour < 12 ? "12:00 PM" : hour < 17 ? "5:00 PM" : "9:00 PM";
    const planPrompt = `It's ${timeNow}. I have until roughly ${endTime}. Call get_today_plan, then build me a concrete ${timeOfDay} plan.

Rules for the plan:
- Pick 2–4 tasks max, don't overwhelm me
- For each task, give me: a time slot (e.g. "1:50–2:30 PM"), the task name, and ONE sentence on what to do first
- Prioritize: (1) tasks already IN_PROGRESS — I should finish what I started, (2) overdue or due today, (3) highest priority from backlog
- Include a short break between tasks if the plan spans >2 hours
- If I have no tasks at all, suggest I create some and give 2–3 ideas based on common project work
- Do NOT just list task names and statuses — give me an actual schedule I can follow right now`;

    const SAFE_ACTIONS = [
        {
            key: "next",
            icon: Compass,
            label: "What's next?",
            prompt:
                "Look at my current plan and pick the single best task I should focus on right now. Tell me what it is and why, in one sentence. Do NOT start a session — just recommend.",
        },
        {
            key: "plan",
            icon: ClipboardList,
            label: planLabel,
            prompt: planPrompt,
        },
        {
            key: "summary",
            icon: Bell,
            label: "Summarize my day",
            prompt:
                "Based on my completed tasks and any active focus session, give me a 2–3 sentence summary of what I've done so far today.",
        },
    ];

    const DESTRUCTIVE_ACTION = {
        key: "start-next",
        icon: Play,
        label: "Start next task",
        prompt:
            "First call next_task to find the best task. If next_task returns no task (task is null), do NOT call start_focus_session — instead tell me I have no tasks and suggest I create one. Only if next_task returns a real task with a valid id, then call start_focus_session with that exact taskId. Reply in one sentence with the task name.",
    };

    return (
        <Card className="border-[color:var(--border)] bg-[color:var(--card)]">
            <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[color:var(--bz-pink)]" />
                    <span className="text-sm font-medium text-white">BieAI — Focus copilot</span>
                    {thread.length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 px-2 text-xs text-neutral-500"
                            onClick={() => setThread([])}
                        >
                            <X className="mr-1 h-3 w-3" /> Clear
                        </Button>
                    )}
                </div>

                {/* Active focus queue — replaces buttons + thread when committed */}
                {focusQueue.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium uppercase text-neutral-500">
                                Focus queue — {focusQueue.length} tasks
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-neutral-500"
                                onClick={clearQueue}
                            >
                                <X className="mr-1 h-3 w-3" /> Clear
                            </Button>
                        </div>
                        {focusQueue.map((task, idx) => {
                            const isDone = idx < activeQueueIdx;
                            const isCurrent = idx === activeQueueIdx;
                            const pri = PRIORITY_LABELS[task.priority];
                            const st = STATUS_LABELS[task.status];
                            return (
                                <div
                                    key={task.id}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                                        isDone
                                            ? "border-[#00c281]/30 bg-[#00c281]/10 opacity-60"
                                            : isCurrent
                                              ? "border-[#ef82ef]/40 bg-[#ef82ef]/10"
                                              : "border-[color:var(--border)] bg-white/[0.02]"
                                    }`}
                                >
                                    <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[color:var(--border)] text-xs font-bold">
                                        {isDone ? (
                                            <span className="text-[#00c281]">✓</span>
                                        ) : (
                                            <span className={isCurrent ? "text-[color:var(--bz-pink)]" : "text-neutral-400"}>
                                                {idx + 1}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className={`truncate text-sm font-medium ${isDone ? "line-through" : ""}`}>
                                            {task.title}
                                        </div>
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
                                        </div>
                                    </div>
                                    {!isDone && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() =>
                                                isCurrent
                                                    ? markQueueDone(idx)
                                                    : startQueueTask(idx)
                                            }
                                            className={`h-7 shrink-0 px-3 text-xs text-black hover:opacity-90 ${
                                                isCurrent ? "bg-[#00c281]" : "bg-[color:var(--bz-pink)]"
                                            }`}
                                        >
                                            {isCurrent ? (
                                                <>
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    Done
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="mr-1 h-3 w-3" />
                                                    Focus
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                        {activeQueueIdx >= focusQueue.length && (
                            <div className="rounded-lg border border-[#00c281]/30 bg-[#00c281]/10 p-3 text-center text-sm text-[#00c281]">
                                All done! Great focus session.
                            </div>
                        )}
                    </div>
                )}

                {/* Action buttons — hidden when focus queue is active */}
                {focusQueue.length === 0 && (<>
                <div className="flex flex-wrap gap-2">
                    {SAFE_ACTIONS.map(({ key, icon: Icon, label, prompt }) => (
                        <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => stream(prompt)}
                            className="h-8 border-[color:var(--border)] bg-transparent text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                        >
                            <Icon className="mr-1.5 h-3.5 w-3.5" />
                            {label}
                        </Button>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => stream(DESTRUCTIVE_ACTION.prompt)}
                        className="h-8 bg-[color:var(--bz-pink)] text-black hover:opacity-90"
                    >
                        {busy ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <DESTRUCTIVE_ACTION.icon className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {DESTRUCTIVE_ACTION.label}
                    </Button>
                </div>

                {/* Thread */}
                {thread.length > 0 && (
                    <div
                        ref={scrollRef}
                        className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-black/20 p-3"
                    >
                        {thread.map((msg, i) => (
                            <ThreadMessage
                                key={i}
                                msg={msg}
                                onStartFocus={onStartFocus}
                                onCommitPlan={commitPlan}
                                onConfirm={() => {
                                    if (!msg.blockedAt) return;
                                    void stream(msg.blockedAt.prompt, {
                                        confirmDestructive: true,
                                        visible: false,
                                    });
                                }}
                                onCancel={() => {
                                    setThread((prev) => {
                                        const next = [...prev];
                                        next[i] = { ...next[i], blockedAt: null };
                                        return next;
                                    });
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Follow-up input */}
                {thread.length > 0 && (
                    <form
                        onSubmit={submitFollowUp}
                        className="flex items-center gap-2"
                    >
                        <Input
                            value={followUp}
                            onChange={(e) => setFollowUp(e.target.value)}
                            placeholder="Ask a follow-up…"
                            disabled={busy}
                            className="h-8 border-[color:var(--border)] bg-white/[0.04] text-white placeholder:text-white/20"
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={busy || !followUp.trim()}
                            className="h-8"
                        >
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                )}
                </>)}
            </CardContent>
        </Card>
    );
}

// ─── Helpers ────────────────────────────────────────────

function ThreadMessage({
    msg,
    onConfirm,
    onCancel,
    onStartFocus,
    onCommitPlan,
}: {
    msg: ChatMessage;
    onConfirm: () => void;
    onCancel: () => void;
    onStartFocus?: (taskId: string) => void;
    onCommitPlan?: (tasks: PlanTask[]) => void;
}) {
    if (msg.role === "user") {
        return (
            <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/[0.06]">
                    <UserIcon className="h-3 w-3 text-neutral-500" />
                </div>
                <p className="text-sm text-neutral-300">
                    {msg.content}
                </p>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#ef82ef]/15">
                <Sparkles className="h-3 w-3 text-[color:var(--bz-pink)]" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
                {/* Tool trace chips */}
                {msg.trace && msg.trace.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {msg.trace.map((t, i) => (
                            <span
                                key={i}
                                className={`rounded px-1.5 py-0.5 text-[10px] ${
                                    t.status === "ok"
                                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                        : t.status === "error"
                                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                          : t.status === "blocked"
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
                                }`}
                                title={t.error || ""}
                            >
                                {t.name}
                                {t.status === "ok"
                                    ? " ✓"
                                    : t.status === "error"
                                      ? " ✗"
                                      : t.status === "blocked"
                                        ? " ⏸"
                                        : "…"}
                            </span>
                        ))}
                    </div>
                )}

                {/* Streaming text */}
                {msg.content ? (
                    <MarkdownLite text={msg.content} />
                ) : msg.pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                ) : null}

                {/* Actionable task cards from AI plan */}
                {msg.planTasks && msg.planTasks.length > 0 && !msg.pending && (
                    <PlanTaskCards
                        tasks={msg.planTasks}
                        onStartFocus={onStartFocus}
                        onCommitPlan={onCommitPlan}
                    />
                )}

                {/* Confirm row for blocked destructive actions */}
                {msg.blockedAt && !msg.pending && (
                    <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
                        <div className="flex-1 text-xs text-amber-800 dark:text-amber-200">
                            <strong>Confirm:</strong> The assistant wants to run{" "}
                            <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900">
                                {msg.blockedAt.toolNames.join(", ")}
                            </code>{" "}
                            — these actions modify your data. Approve?
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            className="h-6 bg-amber-600 px-2 text-xs text-white hover:bg-amber-700"
                            onClick={onConfirm}
                        >
                            Run
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Tiny inline markdown renderer.
 *
 * Handles only what BieAI replies actually use:
 *  - `- foo` and `* foo` → bullet list
 *  - `**foo**` → bold
 *  - `*foo*` and `_foo_` → italic
 *  - `\`foo\`` → inline code
 *
 * No HTML escaping risk because we render via React's text node escaping —
 * the markdown is converted to React elements, never `dangerouslySetInnerHTML`.
 */
function MarkdownLite({ text }: { text: string }) {
    const lines = text.split("\n");
    const out: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = () => {
        if (listBuffer.length === 0) return;
        out.push(
            <ul key={`ul-${out.length}`} className="ml-4 list-disc space-y-0.5 text-sm">
                {listBuffer.map((item, i) => (
                    <li key={i}>{renderInline(item)}</li>
                ))}
            </ul>,
        );
        listBuffer = [];
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet) {
            listBuffer.push(bullet[1]);
            continue;
        }
        flushList();
        if (line.length === 0) {
            out.push(<div key={`sp-${out.length}`} className="h-1" />);
        } else {
            out.push(
                <p key={`p-${out.length}`} className="text-sm">
                    {renderInline(line)}
                </p>,
            );
        }
    }
    flushList();

    return <div className="space-y-1 text-neutral-800 dark:text-neutral-200">{out}</div>;
}

/** Inline span parser: bold / italic / code. */
function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    // Match the four token types in priority order (bold > italic > code).
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        if (m.index > lastIdx) {
            parts.push(text.slice(lastIdx, m.index));
        }
        const tok = m[0];
        if (tok.startsWith("**")) {
            parts.push(
                <strong key={`b-${m.index}`}>{tok.slice(2, -2)}</strong>,
            );
        } else if (tok.startsWith("`")) {
            parts.push(
                <code
                    key={`c-${m.index}`}
                    className="rounded bg-neutral-100 px-1 py-0.5 text-[12px] dark:bg-neutral-900"
                >
                    {tok.slice(1, -1)}
                </code>,
            );
        } else if (tok.startsWith("*") || tok.startsWith("_")) {
            parts.push(<em key={`i-${m.index}`}>{tok.slice(1, -1)}</em>);
        }
        lastIdx = m.index + tok.length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts.length > 0 ? parts : text;
}

// ─── Plan task extraction + cards ───────────────────────

// Chip palette mirrors Today: 12% fill, 35% border, full-strength text.
const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
    P0: { label: "Urgent", cls: "border border-[#ff3d54]/35 bg-[#ff3d54]/12 text-[#ff3d54]" },
    P1: { label: "High", cls: "border border-[#db9c1f]/35 bg-[#db9c1f]/12 text-[#db9c1f]" },
    P2: { label: "Med", cls: "border border-[#6f98e8]/35 bg-[#6f98e8]/12 text-[#6f98e8]" },
    P3: { label: "Low", cls: "border border-[#858585]/35 bg-[#858585]/12 text-[#a3a3a3]" },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    IN_PROGRESS: { label: "In progress", cls: "border border-[#db9c1f]/35 bg-[#db9c1f]/12 text-[#db9c1f]" },
    TODO: { label: "To do", cls: "border border-[#0099ff]/35 bg-[#0099ff]/12 text-[#0099ff]" },
    BACKLOG: { label: "Backlog", cls: "border border-[#858585]/35 bg-[#858585]/12 text-[#a3a3a3]" },
    IN_REVIEW: { label: "Review", cls: "border border-[#ef82ef]/35 bg-[#ef82ef]/12 text-[#ef82ef]" },
};

/** Extract task objects from a tool result into the plan tasks array. */
const MAX_PLAN_TASKS = 4;

function extractPlanTasks(
    toolName: string,
    result: unknown,
    out: PlanTask[],
) {
    if (!result || typeof result !== "object") return;
    const r = result as Record<string, unknown>;

    if (toolName === "get_today_plan") {
        // Collect all, then pick a tight list: IN_PROGRESS first, then
        // highest-priority from the rest. Cap at MAX_PLAN_TASKS.
        const all: PlanTask[] = [];
        const seen = new Set(out.map((t) => t.id));
        for (const key of ["inProgress", "todayOrOverdue", "backlog"] as const) {
            const arr = r[key];
            if (!Array.isArray(arr)) continue;
            for (const item of arr) {
                if (!item || typeof item !== "object") continue;
                const t = item as Record<string, unknown>;
                const id = String(t.id || "");
                if (!id || seen.has(id)) continue;
                seen.add(id);
                all.push({
                    id,
                    title: String(t.title || "Untitled"),
                    status: String(t.status || ""),
                    priority: String(t.priority || ""),
                });
            }
        }
        const prioRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const inProg = all
            .filter((t) => t.status === "IN_PROGRESS")
            .sort((a, b) => (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2));
        const rest = all
            .filter((t) => t.status !== "IN_PROGRESS")
            .sort((a, b) => (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2));
        const remaining = MAX_PLAN_TASKS - inProg.length;
        const picks = [...inProg, ...rest.slice(0, Math.max(0, remaining))];
        out.push(...picks);
    } else if (toolName === "next_task") {
        // Result shape: { task: { id, title, ... } | null }
        const task = r.task;
        if (!task || typeof task !== "object") return;
        const t = task as Record<string, unknown>;
        const id = String(t.id || "");
        if (!id || out.some((p) => p.id === id)) return;
        out.push({
            id,
            title: String(t.title || "Untitled"),
            status: String(t.status || ""),
            priority: String(t.priority || ""),
        });
    }
}

function PlanTaskCards({
    tasks,
    onStartFocus,
    onCommitPlan,
}: {
    tasks: PlanTask[];
    onStartFocus?: (taskId: string) => void;
    onCommitPlan?: (tasks: PlanTask[]) => void;
}) {
    return (
        <div className="mt-2 space-y-1.5">
            {tasks.map((task) => {
                const pri = PRIORITY_LABELS[task.priority];
                const st = STATUS_LABELS[task.status];
                return (
                    <div
                        key={task.id}
                        className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-3 py-2"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                                {task.title}
                            </div>
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
                            </div>
                        </div>
                        {onStartFocus && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onStartFocus(task.id)}
                                className="h-7 shrink-0 bg-[color:var(--bz-pink)] px-3 text-xs text-black hover:opacity-90"
                            >
                                <Play className="mr-1 h-3 w-3" />
                                Focus
                            </Button>
                        )}
                    </div>
                );
            })}
            {/* Commit all tasks as a focus queue */}
            {onCommitPlan && tasks.length > 1 && (
                <Button
                    type="button"
                    size="sm"
                    onClick={() => onCommitPlan(tasks)}
                    className="mt-2 w-full bg-[color:var(--bz-pink)] text-black hover:opacity-90"
                >
                    <Rocket className="mr-1.5 h-3.5 w-3.5" />
                    Plan my {tasks.length} tasks — start focus queue
                </Button>
            )}
        </div>
    );
}
