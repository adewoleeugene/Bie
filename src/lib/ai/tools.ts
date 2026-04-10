/**
 * BieAI tools — server-side implementations of what the LLM can call.
 *
 * Every tool here:
 *   1. Is defined with a JSON schema the LLM uses to generate args
 *   2. Is executed on the server (never in the browser) via its `run()`
 *   3. Returns a plain object the LLM reads back as a `tool` message
 *
 * All tools authenticate through the existing server actions, so org
 * isolation + auth checks come along for free.
 */

import { createTask, getTasks, updateTask } from "@/actions/task";
import {
    startFocusSession,
    endFocusSession,
    getActiveFocusSession,
} from "@/actions/focus-sessions";
import { TaskPriority, TaskStatus } from "@prisma/client";

/** Human priority → Bie P0/P1/P2/P3. */
function coercePriority(p: unknown): TaskPriority | undefined {
    if (typeof p !== "string") return undefined;
    const up = p.toUpperCase();
    if (up === "URGENT" || up === "P0") return "P0";
    if (up === "HIGH" || up === "P1") return "P1";
    if (up === "MEDIUM" || up === "MED" || up === "P2") return "P2";
    if (up === "LOW" || up === "P3") return "P3";
    return undefined;
}

/** Scoring: URGENT/overdue rank highest. Works off P0–P3. */
function priorityScore(p: TaskPriority): number {
    if (p === "P0") return 100;
    if (p === "P1") return 60;
    if (p === "P2") return 30;
    return 10;
}

// ─── Tool schema ────────────────────────────────────────

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
    /**
     * "unsafe" tools mutate user data (create, delete, start/stop).
     * The route will refuse to execute these unless the client passed
     * `confirmDestructive: true`. Read-only tools are always safe.
     */
    unsafe?: boolean;
    run: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * JSON-schema description broadcast to the LLM. Cloudflare's tool-calling
 * format wants `{ type: "function", function: { name, description, parameters } }`.
 */
export function toolDescriptorsForCloudflare(tools: ToolDefinition[]) {
    return tools.map((t) => ({
        type: "function" as const,
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));
}

// ─── Individual tools ───────────────────────────────────

const getTodayPlanTool: ToolDefinition = {
    name: "get_today_plan",
    description:
        "Return all actionable tasks the user could work on. Includes: tasks due today or overdue, tasks currently IN_PROGRESS, tasks in TODO/BACKLOG. Always call this before planning the user's day or recommending what to work on.",
    parameters: {
        type: "object",
        properties: {},
    },
    async run() {
        const all = await getTasks(undefined);
        const now = new Date();
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(endOfToday.getDate() + 1);

        const actionable = all.filter(
            (t) => t.status !== "DONE" && t.status !== "ARCHIVED",
        );

        const trim = (t: (typeof all)[number]) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
            projectId: t.projectId,
        });

        const inProgress = actionable.filter((t) => t.status === "IN_PROGRESS");
        const todayOrOverdue = actionable.filter((t) => {
            if (t.status === "IN_PROGRESS") return false; // already listed
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < endOfToday;
        });
        const backlog = actionable.filter((t) => {
            if (t.status === "IN_PROGRESS") return false;
            if (t.dueDate && new Date(t.dueDate) < endOfToday) return false;
            return t.status === "TODO" || t.status === "BACKLOG";
        });

        return {
            inProgress: inProgress.map(trim),
            todayOrOverdue: todayOrOverdue.map(trim),
            backlog: backlog.map(trim),
            count: actionable.length,
        };
    },
};

const nextTaskTool: ToolDefinition = {
    name: "next_task",
    description:
        "Return the single best task the user should work on right now. Prioritizes: URGENT > overdue > due today > HIGH priority. Call this when the user asks 'what should I do next' or 'what's up next'.",
    parameters: {
        type: "object",
        properties: {},
    },
    async run() {
        const all = await getTasks(undefined);
        const active = all.filter(
            (t) => t.status !== "DONE" && t.status !== "ARCHIVED",
        );
        if (active.length === 0) return { task: null, reason: "No active tasks" };

        const now = Date.now();
        const score = (t: (typeof all)[number]) => {
            let s = priorityScore(t.priority);
            if (t.dueDate) {
                const diff = new Date(t.dueDate).getTime() - now;
                if (diff < 0) s += 80; // overdue
                else if (diff < 24 * 3600 * 1000) s += 50; // due today
                else if (diff < 3 * 24 * 3600 * 1000) s += 20;
            }
            return s;
        };

        const ranked = [...active].sort((a, b) => score(b) - score(a));
        const best = ranked[0];

        return {
            task: {
                id: best.id,
                title: best.title,
                priority: best.priority,
                status: best.status,
                dueDate: best.dueDate ? new Date(best.dueDate).toISOString() : null,
                projectId: best.projectId,
            },
            reason:
                best.priority === "P0"
                    ? "This is marked urgent."
                    : best.dueDate && new Date(best.dueDate).getTime() < now
                      ? "This one is overdue."
                      : best.dueDate
                        ? "This is due soon."
                        : "Highest priority item in your backlog.",
        };
    },
};

const createTaskTool: ToolDefinition = {
    unsafe: true,
    name: "create_task",
    description:
        "Create a new task. Use for 'add a task', 'remind me to', etc. Only pass projectId if the user explicitly named a project.",
    parameters: {
        type: "object",
        properties: {
            title: { type: "string", description: "Short task title" },
            description: { type: "string" },
            projectId: { type: "string" },
            priority: {
                type: "string",
                enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                description:
                    "Human priority label. Mapped to Bie's P0/P1/P2/P3 internally.",
            },
            dueDate: {
                type: "string",
                description: "ISO date string, e.g. 2026-04-10",
            },
        },
        required: ["title"],
    },
    async run(args) {
        const title = String(args.title || "").trim();
        if (!title) throw new Error("title is required");

        const result = await createTask({
            title,
            description:
                typeof args.description === "string" ? args.description : undefined,
            projectId:
                typeof args.projectId === "string" ? args.projectId : undefined,
            priority: coercePriority(args.priority) ?? "P2",
            dueDate:
                typeof args.dueDate === "string" ? args.dueDate : undefined,
            status: "TODO" as TaskStatus,
            assigneeIds: [],
            labels: [],
        });

        if (!result.success) {
            throw new Error(result.error || "Failed to create task");
        }
        return {
            id: result.data.id,
            title: result.data.title,
            projectId: result.data.projectId,
        };
    },
};

const completeTaskTool: ToolDefinition = {
    unsafe: true,
    name: "complete_task",
    description:
        "Mark a task as DONE. Use when the user says 'I finished X' or 'mark X done'.",
    parameters: {
        type: "object",
        properties: {
            taskId: { type: "string" },
        },
        required: ["taskId"],
    },
    async run(args) {
        const taskId = String(args.taskId || "");
        if (!taskId) throw new Error("taskId is required");

        const result = await updateTask({ id: taskId, status: "DONE" as TaskStatus });
        if (!result.success) throw new Error(result.error || "Failed to update");
        return { ok: true, taskId };
    },
};

const startFocusSessionTool: ToolDefinition = {
    unsafe: true,
    name: "start_focus_session",
    description:
        "Start a focus session on a specific task. REQUIRES a valid taskId — call next_task first to get one. NEVER call this without a real taskId. If there are no tasks, tell the user to create one first.",
    parameters: {
        type: "object",
        properties: {
            taskId: { type: "string", description: "The task ID to focus on. Must be a real task ID from next_task or get_today_plan." },
            mode: {
                type: "string",
                enum: ["POMODORO", "FREE"],
                description: "POMODORO = fixed interval; FREE = open-ended",
            },
        },
        required: ["taskId"],
    },
    async run(args) {
        const taskId = String(args.taskId || "").trim();
        if (!taskId) throw new Error("taskId is required — call next_task first to get a valid task ID");

        // Verify the task actually exists before starting a session on it.
        const allTasks = await getTasks(undefined);
        const task = allTasks.find((t) => t.id === taskId);
        if (!task) throw new Error(`Task "${taskId}" not found. Call next_task to get a valid task ID.`);

        const mode = args.mode === "FREE" ? "FREE" : "POMODORO";

        const result = await startFocusSession({
            taskId,
            type: mode as "POMODORO" | "FREE",
        });
        if (!result.success) {
            throw new Error(result.error || "Failed to start session");
        }
        return {
            sessionId: result.data.id,
            taskId,
            mode,
            startedAt: new Date(result.data.startedAt).toISOString(),
        };
    },
};

const endFocusSessionTool: ToolDefinition = {
    unsafe: true,
    name: "end_focus_session",
    description:
        "End the currently running focus session. Use when the user says they're done, taking a break, or stopping.",
    parameters: {
        type: "object",
        properties: {},
    },
    async run() {
        const active = await getActiveFocusSession();
        if (!active) return { ended: false, reason: "No active session" };
        const result = await endFocusSession({ sessionId: active.id });
        if (!result.success) throw new Error(result.error || "Failed to end");
        return { ended: true, sessionId: active.id };
    },
};

const getActiveSessionTool: ToolDefinition = {
    name: "get_active_session",
    description:
        "Check whether the user has a focus session currently running. Returns the active session or null.",
    parameters: { type: "object", properties: {} },
    async run() {
        const active = await getActiveFocusSession();
        if (!active) return { active: null };
        return {
            active: {
                id: active.id,
                taskId: active.taskId,
                type: active.type,
                startedAt: new Date(active.startedAt).toISOString(),
            },
        };
    },
};

// ─── Registry ───────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
    getTodayPlanTool,
    nextTaskTool,
    createTaskTool,
    completeTaskTool,
    startFocusSessionTool,
    endFocusSessionTool,
    getActiveSessionTool,
];

export function findTool(name: string): ToolDefinition | undefined {
    return ALL_TOOLS.find((t) => t.name === name);
}
