"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, Send, ChevronDown, Mic, Square, Plus, X } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

import { parseTaskInput, ParsedTask } from "@/lib/ai/nlp";
import { useCreateTask, useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    link?: { href: string; label: string };
}

type PendingTask = { parsed: ParsedTask; rawText: string } | null;

export function AssistantChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hi! I'm BieAI. Ask me anything, or say 'create task ...'. You can also tap the mic to speak.",
            timestamp: new Date(),
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [pendingTask, setPendingTask] = useState<PendingTask>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [showQuickTask, setShowQuickTask] = useState(false);
    const [quickTitle, setQuickTitle] = useState("");
    const [quickDescription, setQuickDescription] = useState("");
    const [quickProject, setQuickProject] = useState<string>("none");
    const [quickPriority, setQuickPriority] = useState<"P0" | "P1" | "P2" | "P3">("P2");
    const [quickDueDate, setQuickDueDate] = useState<string>("");
    const [lastTask, setLastTask] = useState<{
        id: string;
        title: string;
        description?: string;
        projectId: string | null;
    } | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const pathname = usePathname();

    const createTask = useCreateTask();
    const { data: projects = [] } = useProjects();
    // Load all tasks (no project filter) so the AI can resolve task names from anywhere
    const { data: allTasks = [] } = useTasks(undefined);

    // Detect current project from URL like /projects/<id>/...
    const currentProjectId = (() => {
        const m = pathname?.match(/\/projects\/([^/]+)/);
        return m ? m[1] : null;
    })();
    const currentProject = currentProjectId
        ? projects.find((p) => p.id === currentProjectId)
        : null;

    // Pre-fill quick-task project when opened
    useEffect(() => {
        if (showQuickTask) {
            setQuickProject(currentProjectId || "none");
        }
    }, [showQuickTask, currentProjectId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    function pushAssistant(content: string, link?: Message["link"]) {
        setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, role: "assistant", content, timestamp: new Date(), link },
        ]);
    }

    function pushUser(content: string) {
        const msg: Message = {
            id: `${Date.now()}-${Math.random()}`,
            role: "user",
            content,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, msg]);
        return msg;
    }

    async function actuallyCreateTask(
        parsed: ParsedTask,
        projectId: string | null,
        extra?: { description?: string; dueDate?: Date }
    ) {
        try {
            let title = parsed.title.trim();
            let description: string | undefined = extra?.description?.trim() || undefined;
            if (title.length > 255) {
                description = [title, description].filter(Boolean).join("\n\n");
                title = title.slice(0, 252).trimEnd() + "...";
            }
            const dueDate = extra?.dueDate || parsed.dueDate;
            const result = await createTask.mutateAsync({
                title,
                description,
                status: parsed.status,
                priority: parsed.priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                projectId: projectId || undefined,
                assigneeIds: [],
                labels: [],
            });

            if (result.success && result.data) {
                const task = result.data as any;
                const href = task.projectId ? `/projects/${task.projectId}/board` : "/my-day";
                const label = task.projectId
                    ? `Open in ${projects.find((p) => p.id === task.projectId)?.name || "project"}`
                    : "Open in My Day";
                setLastTask({
                    id: task.id,
                    title: task.title,
                    description: task.description ?? description,
                    projectId: task.projectId ?? null,
                });
                pushAssistant(`Created "${task.title}". You can say "break into subtasks" to expand it.`, { href, label });
            } else {
                throw new Error((result as any).error || "Failed");
            }
        } catch (e: any) {
            pushAssistant(`Sorry, I couldn't create the task: ${e.message}`);
        }
    }

    async function breakdownLastTask() {
        if (!lastTask) {
            pushAssistant("I don't have a task in context. Create one first or open one in the app.");
            return;
        }
        pushAssistant(`Breaking "${lastTask.title}" into subtasks...`);
        try {
            const prompt = [
                `Parent task: ${lastTask.title}`,
                lastTask.description ? `Details: ${lastTask.description}` : "",
                "",
                "Return ONLY a JSON array of 3-7 short, concrete subtask titles (each <80 chars). No commentary, no numbering, no markdown. Example: [\"Set up database schema\",\"Build API endpoint\"]",
            ]
                .filter(Boolean)
                .join("\n");

            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: prompt }],
                    systemInstruction:
                        "You output ONLY a valid JSON array of short subtask title strings. No other text.",
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "AI error");

            const raw: string = data.message || "";
            const match = raw.match(/\[[\s\S]*\]/);
            if (!match) throw new Error("Couldn't parse subtask list");
            let titles: string[] = [];
            try {
                titles = JSON.parse(match[0]);
            } catch {
                throw new Error("Couldn't parse subtask list");
            }
            titles = titles
                .filter((t) => typeof t === "string" && t.trim())
                .map((t) => t.trim().slice(0, 255));

            if (titles.length === 0) throw new Error("No subtasks generated");

            const created: string[] = [];
            for (const t of titles) {
                const r = await createTask.mutateAsync({
                    title: t,
                    status: "TODO" as any,
                    priority: "P2" as any,
                    projectId: lastTask.projectId || undefined,
                    parentTaskId: lastTask.id,
                    assigneeIds: [],
                    labels: [],
                });
                if (r.success) created.push(t);
            }

            const href = lastTask.projectId ? `/projects/${lastTask.projectId}/board` : "/my-day";
            pushAssistant(
                `Created ${created.length} subtask${created.length === 1 ? "" : "s"} under "${lastTask.title}":\n` +
                    created.map((t) => `• ${t}`).join("\n"),
                { href, label: lastTask.projectId ? "Open project board" : "Open My Day" }
            );
        } catch (e: any) {
            pushAssistant(`Couldn't break down the task: ${e.message}`);
        }
    }

    async function handleTaskIntent(taskText: string) {
        if (!taskText) {
            pushAssistant("What's the task? e.g. 'Review designs tomorrow P1'");
            return;
        }
        const parsed = parseTaskInput(taskText);

        if (projects.length === 0) {
            await actuallyCreateTask(parsed, null);
            return;
        }

        // If on a project page, use that project automatically.
        if (currentProject) {
            await actuallyCreateTask(parsed, currentProject.id);
            return;
        }

        setPendingTask({ parsed, rawText: taskText });
        const list = projects.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
        pushAssistant(
            `Got it: "${parsed.title}". Which project should this go in? Reply with a number, the project name, or "none".\n\n${list}`
        );
    }

    function resolveProjectChoice(answer: string): string | null | "unresolved" {
        const a = answer.trim().toLowerCase();
        if (!a) return "unresolved";
        if (a === "none" || a === "no" || a === "skip" || a === "no project") return null;
        const num = parseInt(a, 10);
        if (!isNaN(num) && num >= 1 && num <= projects.length) {
            return projects[num - 1].id;
        }
        const byName = projects.find((p) => p.name.toLowerCase() === a);
        if (byName) return byName.id;
        const partial = projects.find((p) => p.name.toLowerCase().includes(a));
        if (partial) return partial.id;
        return "unresolved";
    }

    function extractJsonAction(raw: any): any | null {
        if (raw == null) return null;
        if (typeof raw === "object") return raw;
        const str = String(raw);
        const trimmed = str.trim();
        // strip ``` fences
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : trimmed;
        const match = candidate.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }

    async function handleAgentMessage(raw: any) {
        const action = extractJsonAction(raw);
        if (!action || typeof action !== "object") {
            pushAssistant(typeof raw === "string" ? raw : JSON.stringify(raw) || "(no response)");
            return;
        }
        switch (action.action) {
            case "reply":
                pushAssistant(String(action.message ?? ""));
                return;
            case "create_task": {
                const title = String(action.title || "").trim();
                if (!title) {
                    pushAssistant("I tried to create a task but didn't have a title.");
                    return;
                }
                const parsed: ParsedTask = {
                    title,
                    priority: (["P0", "P1", "P2", "P3"].includes(action.priority) ? action.priority : "P2") as any,
                    status: "TODO" as any,
                    assigneeIds: [],
                };
                const rawProj = action.projectId === "null" ? null : action.projectId;
                const projectId =
                    rawProj && projects.some((p) => p.id === rawProj)
                        ? rawProj
                        : currentProject?.id || null;
                const rawDue = action.dueDate === "null" ? null : action.dueDate;
                const dueDate = rawDue ? new Date(rawDue) : undefined;
                await actuallyCreateTask(parsed, projectId, {
                    description: action.description || undefined,
                    dueDate,
                });
                return;
            }
            case "create_task_with_subtasks": {
                const title = String(action.title || "").trim();
                if (!title) {
                    pushAssistant("I tried to create the task but didn't have a title.");
                    return;
                }
                // Guard: if the proposed title closely matches an EXISTING task, attach subtasks to it instead of creating a duplicate.
                const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
                const tNorm = norm(title);
                const existing = (allTasks as any[]).find((t) => {
                    if (t.parentTaskId) return false;
                    const eNorm = norm(t.title || "");
                    if (!eNorm) return false;
                    return (
                        eNorm === tNorm ||
                        eNorm.includes(tNorm) ||
                        tNorm.includes(eNorm)
                    );
                });
                if (existing) {
                    const titles: string[] = Array.isArray(action.subtaskTitles) ? action.subtaskTitles : [];
                    const created: string[] = [];
                    for (const t of titles) {
                        const subTitle = String(t).trim().slice(0, 255);
                        if (!subTitle) continue;
                        const r = await createTask.mutateAsync({
                            title: subTitle,
                            status: "TODO" as any,
                            priority: "P2" as any,
                            projectId: existing.projectId || undefined,
                            parentTaskId: existing.id,
                            assigneeIds: [],
                            labels: [],
                        });
                        if (r.success) created.push(subTitle);
                    }
                    setLastTask({
                        id: existing.id,
                        title: existing.title,
                        description: existing.description,
                        projectId: existing.projectId ?? null,
                    });
                    const href = existing.projectId ? `/projects/${existing.projectId}/board` : "/my-day";
                    pushAssistant(
                        `Found existing task "${existing.title}" — added ${created.length} subtask${created.length === 1 ? "" : "s"}:\n` +
                            created.map((t) => `• ${t}`).join("\n"),
                        { href, label: existing.projectId ? "Open project board" : "Open My Day" }
                    );
                    return;
                }
                const rawProj = action.projectId === "null" ? null : action.projectId;
                const projectId =
                    rawProj && projects.some((p) => p.id === rawProj)
                        ? rawProj
                        : currentProject?.id || null;
                const priority = (["P0", "P1", "P2", "P3"].includes(action.priority)
                    ? action.priority
                    : "P2") as any;

                const parentRes = await createTask.mutateAsync({
                    title: title.slice(0, 255),
                    description: action.description || undefined,
                    status: "TODO" as any,
                    priority,
                    projectId: projectId || undefined,
                    assigneeIds: [],
                    labels: [],
                });
                if (!parentRes.success || !parentRes.data) {
                    pushAssistant(`Couldn't create the parent task: ${(parentRes as any).error || "error"}`);
                    return;
                }
                const parent = parentRes.data as any;
                setLastTask({
                    id: parent.id,
                    title: parent.title,
                    description: parent.description ?? action.description,
                    projectId: parent.projectId ?? null,
                });

                const titles: string[] = Array.isArray(action.subtaskTitles) ? action.subtaskTitles : [];
                const created: string[] = [];
                for (const t of titles) {
                    const subTitle = String(t).trim().slice(0, 255);
                    if (!subTitle) continue;
                    const r = await createTask.mutateAsync({
                        title: subTitle,
                        status: "TODO" as any,
                        priority: "P2" as any,
                        projectId: parent.projectId || undefined,
                        parentTaskId: parent.id,
                        assigneeIds: [],
                        labels: [],
                    });
                    if (r.success) created.push(subTitle);
                }
                const href = parent.projectId ? `/projects/${parent.projectId}/board` : "/my-day";
                pushAssistant(
                    `Created "${parent.title}" with ${created.length} subtask${created.length === 1 ? "" : "s"}:\n` +
                        created.map((t) => `• ${t}`).join("\n"),
                    { href, label: parent.projectId ? "Open project board" : "Open My Day" }
                );
                return;
            }
            case "create_subtasks": {
                const claimed = action.parentTaskId ? String(action.parentTaskId) : "";
                // Accept the id only if it's a real task in this workspace; otherwise fall back to last task.
                const realTask = (allTasks as any[]).find((t) => t.id === claimed);
                const parent = realTask
                    ? { id: realTask.id, projectId: realTask.projectId ?? null }
                    : lastTask
                    ? { id: lastTask.id, projectId: lastTask.projectId }
                    : null;
                const titles: string[] = Array.isArray(action.titles) ? action.titles : [];
                if (!parent || titles.length === 0) {
                    pushAssistant("I couldn't find that task. Try referring to it by name from the current project.");
                    return;
                }
                const parentId = parent.id;
                const parentProject = parent.projectId || currentProject?.id || null;
                const created: string[] = [];
                for (const t of titles) {
                    const title = String(t).trim().slice(0, 255);
                    if (!title) continue;
                    const r = await createTask.mutateAsync({
                        title,
                        status: "TODO" as any,
                        priority: "P2" as any,
                        projectId: parentProject || undefined,
                        parentTaskId: parentId,
                        assigneeIds: [],
                        labels: [],
                    });
                    if (r.success) created.push(title);
                }
                const href = parentProject ? `/projects/${parentProject}/board` : "/my-day";
                pushAssistant(
                    `Created ${created.length} subtask${created.length === 1 ? "" : "s"}:\n` +
                        created.map((t) => `• ${t}`).join("\n"),
                    { href, label: parentProject ? "Open project board" : "Open My Day" }
                );
                return;
            }
            default:
                pushAssistant(raw);
        }
    }

    async function handleTextSubmit(text: string) {
        const trimmed = text.trim();
        if (!trimmed) return;
        pushUser(trimmed);
        setIsTyping(true);

        try {
            // Pending task -> awaiting project choice
            if (pendingTask) {
                const choice = resolveProjectChoice(trimmed);
                if (choice === "unresolved") {
                    pushAssistant("I didn't catch that. Reply with the project number, exact name, or 'none'.");
                    return;
                }
                const { parsed } = pendingTask;
                setPendingTask(null);
                await actuallyCreateTask(parsed, choice);
                return;
            }

            // Pending task -> awaiting project choice (still handled here since it's a stateful UI flow)
            // (handled above)

            // Regular chat — let the LLM decide intent and emit an action
            const history = [...messages, { role: "user", content: trimmed, id: "x" }]
                .filter((m) => m.id !== "welcome")
                .map((m: any) => ({ role: m.role, content: m.content }));

            const projectList = projects.length
                ? projects.map((p) => `- ${p.name} (id: ${p.id})`).join("\n")
                : "(no projects exist yet)";

            const lastTaskBlock = lastTask
                ? `Last task in context: "${lastTask.title}" (id: ${lastTask.id}, project: ${lastTask.projectId || "none"})`
                : "Last task in context: none";

            // Cap to keep prompt small. Filter to top-level tasks (no parent) for cleaner matching.
            const taskList = (allTasks as any[])
                .filter((t) => !t.parentTaskId)
                .slice(0, 100)
                .map((t) => `- [${t.id}] ${t.title}${t.projectId ? ` (project: ${t.projectId})` : ""}`)
                .join("\n");

            const systemInstruction = [
                "You are BieAI, the in-app assistant for Bie (a project management app by Christex Foundation).",
                "",
                "You have ACTIONS available. To run an action, your ENTIRE reply must be a single JSON object on one line, no prose, no markdown:",
                '  {"action":"create_task","title":"...","description":"...","priority":"P0|P1|P2|P3","dueDate":"YYYY-MM-DD","projectId":"<id or null>"}',
                '  {"action":"create_subtasks","parentTaskId":"<id>","titles":["...","..."]}',
                '  {"action":"create_task_with_subtasks","title":"...","description":"...","priority":"P0|P1|P2|P3","projectId":"<id or null>","subtaskTitles":["...","..."]}',
                '  {"action":"reply","message":"plain text reply"}',
                "",
                "Rules:",
                "- If the user wants to create a task, emit create_task. Use null for projectId if unclear. Omit unknown fields.",
                "- To break down an EXISTING task: find its id in 'Existing tasks' below by matching the user's words to a task title, then emit create_subtasks with that id. If no clear match and no last task in context, fall back to create_task_with_subtasks.",
                "- If the user pastes a fresh task description (not matching any existing task) and asks to break it down, emit create_task_with_subtasks — invent a short title, use their text as description, and generate 3-7 concrete subtask titles.",
                "- For anything else, emit reply.",
                "- NEVER invent project names, task ids, assignees, or records you weren't given. You only see the project names below — no tasks, no users.",
                "- Don't claim to have created anything; the action JSON is what actually does it.",
                "- Reply messages should be short, plain, grounded.",
                "",
                "App navigation: Dashboard (/), Today (/my-day) — includes focus sessions and time tracking, Sprints (/sprintboard), Insights (/analytics) — includes focus and time stats, Wiki (/wiki), Squads (/squads), Chat (/chat). Each project has Board, Backlog, Calendar, Timeline, Table, Sprints, Wiki, Automation.",
                "",
                "Real projects in this workspace:",
                projectList,
                "",
                "Existing tasks (id, title):",
                taskList || "(none)",
                "",
                `Current page: ${pathname || "unknown"}${currentProject ? ` (project: ${currentProject.name}, id: ${currentProject.id})` : ""}`,
                lastTaskBlock,
            ].join("\n");

            const response = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: history, systemInstruction }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed");
            }
            const data = await response.json();
            await handleAgentMessage(data.message || "");
        } catch (err: any) {
            pushAssistant(`Error: ${err.message}`);
        } finally {
            setIsTyping(false);
        }
    }

    async function submitQuickTask(e?: React.FormEvent) {
        e?.preventDefault();
        const title = quickTitle.trim();
        if (!title) return;
        // Run NL parser on the title so users can still embed "tomorrow P1" etc.
        const nlp = parseTaskInput(title);
        const parsed: ParsedTask = {
            title: nlp.title || title,
            // Explicit pickers win over inline tokens
            priority: quickPriority || nlp.priority,
            status: "TODO" as any,
            assigneeIds: [],
        };
        const projectId = quickProject === "none" ? null : quickProject;
        const dueDate = quickDueDate ? new Date(quickDueDate) : nlp.dueDate;
        const description = quickDescription.trim() || undefined;

        setShowQuickTask(false);
        setQuickTitle("");
        setQuickDescription("");
        setQuickDueDate("");
        pushUser(`+ Task: ${parsed.title}`);
        setIsTyping(true);
        try {
            await actuallyCreateTask(parsed, projectId, { description, dueDate });
        } finally {
            setIsTyping(false);
        }
    }

    // Paste/drop a multi-line blob into the title → first line = title, rest = description
    function handleTitlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        const text = e.clipboardData.getData("text");
        if (text && text.includes("\n")) {
            e.preventDefault();
            const [first, ...rest] = text.split("\n");
            setQuickTitle((quickTitle + first).slice(0, 255));
            const body = rest.join("\n").trim();
            if (body) setQuickDescription((d) => (d ? d + "\n" + body : body));
        }
    }
    function handleFormDrop(e: React.DragEvent) {
        e.preventDefault();
        const text = e.dataTransfer.getData("text");
        if (!text) return;
        const [first, ...rest] = text.split("\n");
        if (!quickTitle) setQuickTitle(first.slice(0, 255));
        else setQuickDescription((d) => (d ? d + "\n" + text : text));
        const body = rest.join("\n").trim();
        if (body && !quickDescription) setQuickDescription(body);
    }

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const text = input;
        setInput("");
        await handleTextSubmit(text);
    };

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            chunksRef.current = [];
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            mr.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
                await transcribeAndSend(blob);
            };
            recorderRef.current = mr;
            mr.start();
            setIsRecording(true);
        } catch (e: any) {
            pushAssistant(`Mic error: ${e.message}`);
        }
    }

    function stopRecording() {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setIsRecording(false);
    }

    async function transcribeAndSend(blob: Blob) {
        setIsTyping(true);
        try {
            const fd = new FormData();
            fd.append("audio", blob, "audio.webm");
            const res = await fetch("/api/ai/chat", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transcription failed");
            const transcript = (data.transcript || "").trim();
            if (!transcript) {
                pushAssistant("I couldn't hear anything — try again?");
                return;
            }
            await handleTextSubmit(transcript);
        } catch (e: any) {
            pushAssistant(`Audio error: ${e.message}`);
        } finally {
            setIsTyping(false);
        }
    }

    // Hide the floating assistant on the chat page — its bottom-right button
    // overlaps the message composer's send button.
    if (pathname?.startsWith("/chat")) {
        return null;
    }

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg p-0 hover:scale-105 transition-transform z-50 bg-primary/90 hover:bg-primary"
            >
                <Bot className="h-7 w-7" />
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-6 right-6 w-[350px] md:w-[400px] h-[500px] shadow-2xl z-50 flex flex-col border-primary/20 animate-in slide-in-from-bottom-10 fade-in duration-200">
            <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-primary/5 dark:bg-primary/10 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/20 rounded-lg">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold">BieAI Assistant</CardTitle>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Online
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full items-start gap-2",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "assistant" && (
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1 shrink-0">
                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-muted text-muted-foreground rounded-tl-sm"
                                )}
                            >
                                {msg.content}
                                {msg.link && (
                                    <div className="mt-2">
                                        <Link
                                            href={msg.link.href}
                                            className="text-xs underline text-primary"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            {msg.link.label} →
                                        </Link>
                                    </div>
                                )}
                            </div>
                            {msg.role === "user" && (
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-1 shrink-0">
                                    <User className="h-3.5 w-3.5 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex w-full items-start gap-2 justify-start">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1 shrink-0">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>

            <CardFooter className="p-3 border-t bg-background flex-col gap-2">
                {showQuickTask && (
                    <form
                        onSubmit={submitQuickTask}
                        onDrop={handleFormDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="w-full space-y-2 rounded-lg border bg-muted/40 p-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">New task</span>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setShowQuickTask(false)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <Input
                            autoFocus
                            value={quickTitle}
                            onChange={(e) => setQuickTitle(e.target.value)}
                            onPaste={handleTitlePaste}
                            placeholder="Task title (paste multi-line to fill description)"
                            className="h-8 text-sm"
                            maxLength={255}
                        />
                        <Textarea
                            value={quickDescription}
                            onChange={(e) => setQuickDescription(e.target.value)}
                            placeholder="Description (optional) — drop or paste here too"
                            className="text-sm min-h-[60px] resize-none"
                            rows={3}
                        />
                        <div className="flex gap-2">
                            <Select value={quickProject} onValueChange={setQuickProject}>
                                <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue placeholder="Project" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No project (Today)</SelectItem>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={quickPriority} onValueChange={(v) => setQuickPriority(v as any)}>
                                <SelectTrigger className="h-8 text-xs w-16">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="P0">P0</SelectItem>
                                    <SelectItem value="P1">P1</SelectItem>
                                    <SelectItem value="P2">P2</SelectItem>
                                    <SelectItem value="P3">P3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={quickDueDate}
                                onChange={(e) => setQuickDueDate(e.target.value)}
                                className="h-8 text-xs flex-1"
                            />
                            <Button type="submit" size="sm" className="h-8" disabled={!quickTitle.trim()}>
                                Add task
                            </Button>
                        </div>
                    </form>
                )}
                <form
                    onSubmit={handleSend}
                    className={cn(
                        "flex w-full flex-col gap-1.5 rounded-2xl border bg-background px-3 py-2 transition-all",
                        "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
                        isRecording && "border-red-500/50 ring-2 ring-red-500/20"
                    )}
                >
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isRecording ? "Listening..." : "Ask BieAI anything..."}
                        rows={1}
                        className="w-full min-h-[24px] max-h-32 border-0 bg-transparent p-0 text-sm shadow-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={isTyping || isRecording}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                                onClick={() => setShowQuickTask((v) => !v)}
                                disabled={isTyping || isRecording}
                                title="Quick add task"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className={cn(
                                    "h-7 w-7 rounded-full text-muted-foreground hover:text-foreground",
                                    isRecording && "text-red-500 hover:text-red-500"
                                )}
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={isTyping}
                                title={isRecording ? "Stop recording" : "Record audio"}
                            >
                                {isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
                            </Button>
                        </div>
                        <Button
                            type="submit"
                            size="icon"
                            className="h-7 w-7 rounded-full shrink-0"
                            disabled={!input.trim() || isTyping || isRecording}
                        >
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </form>
            </CardFooter>
        </Card>
    );
}
