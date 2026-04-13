import { NextResponse } from "next/server";
import {
    ALL_TOOLS,
    findTool,
    toolDescriptorsForCloudflare,
} from "@/lib/ai/tools";

const CF_BASE = "https://api.cloudflare.com/client/v4/accounts";

function getCfConfig() {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!apiToken || !accountId) return null;
    return { apiToken, accountId };
}

interface CfMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    name?: string;
    tool_calls?: CfToolCall[];
}

interface CfToolCall {
    id?: string;
    name: string;
    arguments: Record<string, unknown> | string;
}

async function runCfModel(
    model: string,
    body: Record<string, unknown>,
    cfg: { apiToken: string; accountId: string },
) {
    const res = await fetch(`${CF_BASE}/${cfg.accountId}/ai/run/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${cfg.apiToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        // Cloudflare content filtering returns a 400 with a specific message.
        // Surface a user-friendly message instead of a raw API error.
        const rawMsg =
            data?.errors?.[0]?.message ||
            (typeof data?.error === "object" && data.error?.message) ||
            "";
        if (
            res.status === 400 &&
            typeof rawMsg === "string" &&
            rawMsg.toLowerCase().includes("content filtering")
        ) {
            throw new Error(
                "The AI response was blocked by Cloudflare's content filter. Try rephrasing your message.",
            );
        }
        throw new Error(rawMsg || `Cloudflare AI request failed (${res.status})`);
    }
    return data.result;
}

/**
 * Parse tool_calls out of a Cloudflare model response.
 *
 * The API has moved around: sometimes `result.tool_calls` is populated,
 * sometimes the model embeds the call inside `result.response` as JSON text.
 * We accept either shape defensively.
 */
function extractToolCalls(result: unknown): CfToolCall[] {
    if (!result || typeof result !== "object") return [];
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.tool_calls) && r.tool_calls.length > 0) {
        return (r.tool_calls as unknown[]).map((tc) => {
            const t = tc as Record<string, unknown>;
            // Cloudflare sometimes wraps as { function: { name, arguments } }
            if (t.function && typeof t.function === "object") {
                const f = t.function as Record<string, unknown>;
                return {
                    id: typeof t.id === "string" ? t.id : undefined,
                    name: String(f.name || ""),
                    arguments:
                        typeof f.arguments === "string"
                            ? safeJson(f.arguments)
                            : (f.arguments as Record<string, unknown>) || {},
                };
            }
            return {
                id: typeof t.id === "string" ? t.id : undefined,
                name: String(t.name || ""),
                arguments:
                    typeof t.arguments === "string"
                        ? safeJson(t.arguments)
                        : (t.arguments as Record<string, unknown>) || {},
            };
        });
    }
    return [];
}

function safeJson(s: string): Record<string, unknown> {
    try {
        const v = JSON.parse(s);
        return v && typeof v === "object" ? v : {};
    } catch {
        return {};
    }
}

interface ToolTrace {
    name: string;
    args: unknown;
    result?: unknown;
    error?: string;
}

/** Emitter used by the streaming path. Non-streaming path passes a no-op. */
type Emit = (event: { type: string; data?: unknown }) => void;

async function runToolLoop({
    model,
    cfg,
    system,
    initialMessages,
    allowUnsafe,
    emit,
    maxIterations = 4,
}: {
    model: string;
    cfg: { apiToken: string; accountId: string };
    system: string;
    initialMessages: CfMessage[];
    allowUnsafe: boolean;
    emit?: Emit;
    maxIterations?: number;
}): Promise<{ message: string; trace: ToolTrace[]; blocked?: string[] }> {
    const tools = toolDescriptorsForCloudflare(ALL_TOOLS);
    const messages: CfMessage[] = [
        { role: "system", content: system },
        ...initialMessages,
    ];
    const trace: ToolTrace[] = [];
    const blocked: string[] = [];
    const calledOnce = new Set<string>(); // dedup: "toolName:argsJSON"

    for (let i = 0; i < maxIterations; i++) {
        const result = await runCfModel(model, { messages, tools }, cfg);
        const toolCalls = extractToolCalls(result);

        if (toolCalls.length === 0) {
            const r = (result as { response?: unknown })?.response;
            const text =
                typeof r === "string" ? r : r != null ? JSON.stringify(r) : "";
            return { message: text, trace, blocked: blocked.length ? blocked : undefined };
        }

        // Echo tool_calls in Cloudflare's expected format:
        // { id, type: "function", function: { name, arguments } }
        messages.push({
            role: "assistant",
            content: "",
            tool_calls: toolCalls.map((tc, idx) => ({
                id: tc.id || `call_${i}_${idx}`,
                type: "function" as const,
                function: {
                    name: tc.name,
                    arguments:
                        typeof tc.arguments === "string"
                            ? tc.arguments
                            : JSON.stringify(tc.arguments),
                },
            })) as any,
        });

        for (const call of toolCalls) {
            const tool = findTool(call.name);
            const args =
                typeof call.arguments === "string"
                    ? safeJson(call.arguments)
                    : call.arguments;
            const entry: ToolTrace = { name: call.name, args };

            if (!tool) {
                entry.error = `Unknown tool: ${call.name}`;
                trace.push(entry);
                emit?.({ type: "tool_result", data: entry });
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    name: call.name,
                    content: JSON.stringify({ error: entry.error }),
                });
                continue;
            }

            // Destructive-action gate: refuse to execute without confirmation.
            if (tool.unsafe && !allowUnsafe) {
                blocked.push(call.name);
                entry.error = `Blocked: ${call.name} is a destructive action and requires user confirmation.`;
                trace.push(entry);
                emit?.({ type: "tool_blocked", data: entry });
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    name: call.name,
                    content: JSON.stringify({
                        error:
                            "This action is destructive and was not executed. Describe what you WOULD do so the user can confirm.",
                    }),
                });
                continue;
            }

            // Dedup: block the same tool+args from being called twice.
            const callKey = `${call.name}:${JSON.stringify(args)}`;
            if (calledOnce.has(callKey)) {
                const dupMsg = `You already called ${call.name} with the same arguments and got a result. Do NOT call it again — reply to the user based on what you already know.`;
                entry.error = "Duplicate call blocked";
                trace.push(entry);
                emit?.({ type: "tool_result", data: entry });
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    name: call.name,
                    content: JSON.stringify({ error: dupMsg }),
                });
                continue;
            }
            calledOnce.add(callKey);

            emit?.({ type: "tool_start", data: { name: call.name, args } });
            try {
                const toolResult = await tool.run(args);
                entry.result = toolResult;
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    name: call.name,
                    content: JSON.stringify(toolResult),
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                entry.error = msg;
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    name: call.name,
                    content: JSON.stringify({ error: msg }),
                });
            }
            trace.push(entry);
            emit?.({ type: "tool_result", data: entry });
        }

        // If every call this round was a duplicate, break out and force a
        // text-only completion so the model stops looping.
        const allDuped = toolCalls.every((c) => {
            const a = typeof c.arguments === "string" ? safeJson(c.arguments) : c.arguments;
            const key = `${c.name}:${JSON.stringify(a)}`;
            // The key was added before this check, so "has" is always true.
            // Instead check if the trace entry for it was "Duplicate call blocked".
            return trace.some(
                (t) =>
                    t.name === c.name &&
                    t.error === "Duplicate call blocked",
            );
        });
        if (allDuped) {
            // Final text-only call — no tools, so the model must reply.
            messages.push({
                role: "user",
                content: "Based on the tool results above, reply to the user now. Do not call any more tools.",
            });
            const finalResult = await runCfModel(model, { messages }, cfg);
            const r = (finalResult as { response?: unknown })?.response;
            const text =
                typeof r === "string" ? r : r != null ? JSON.stringify(r) : "";
            return { message: text, trace, blocked: blocked.length ? blocked : undefined };
        }
    }

    return {
        message:
            "I got stuck in a loop while trying to help — try rephrasing the request.",
        trace,
        blocked: blocked.length ? blocked : undefined,
    };
}

const DEFAULT_AGENT_SYSTEM = [
    "You are BieAI, a Blitzit-style focus copilot built into the Bie project management app.",
    "Your job is to help the user act fast. Prefer doing over explaining.",
    "",
    "Rules:",
    "- When the user asks what to work on, call get_today_plan or next_task. Never guess.",
    "- When they agree to work on something, call start_focus_session for them.",
    "- When they say they finished something, call complete_task.",
    "- Keep replies short and action-oriented. When planning, give concrete time slots and next actions — never just list task names back.",
    "- If you don't have enough info, ask ONE sharp question. Don't monologue.",
    "- Never claim you did something unless a tool actually succeeded.",
    "- If a tool fails, say so plainly and suggest a fix.",
    "- If a tool returns empty results (e.g. no tasks, no sessions), do NOT call it again. Report the result to the user in plain language.",
    "- Never call the same tool more than once in a single conversation turn.",
].join("\n");

export async function POST(req: Request) {
    try {
        const cfg = getCfConfig();
        if (!cfg) {
            return NextResponse.json(
                {
                    error: "Cloudflare Workers AI not configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)",
                },
                { status: 500 },
            );
        }

        const contentType = req.headers.get("content-type") || "";
        const chatModel =
            process.env.CLOUDFLARE_AI_MODEL ||
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        const sttModel =
            process.env.CLOUDFLARE_STT_MODEL || "@cf/openai/whisper";

        // Audio path: multipart/form-data with "audio" file (unchanged).
        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();
            const audio = form.get("audio");
            if (!(audio instanceof Blob)) {
                return NextResponse.json(
                    { error: "Missing 'audio' file" },
                    { status: 400 },
                );
            }
            const buf = new Uint8Array(await audio.arrayBuffer());
            const result = await runCfModel(
                sttModel,
                { audio: Array.from(buf) },
                cfg,
            );
            const transcript: string = (result as { text?: string })?.text ?? "";
            return NextResponse.json({ transcript });
        }

        // JSON path
        const body = await req.json();
        const {
            messages,
            systemInstruction,
            enableTools,
        }: {
            messages: { role: string; content: string }[];
            systemInstruction?: string;
            enableTools?: boolean;
        } = body;

        if (enableTools) {
            const system = systemInstruction || DEFAULT_AGENT_SYSTEM;
            const allowUnsafe = !!body.confirmDestructive;
            const stream = !!body.stream;
            const mapped = messages.map((m) => ({
                role: m.role as CfMessage["role"],
                content: m.content,
            }));

            if (!stream) {
                // JSON path.
                const { message, trace, blocked } = await runToolLoop({
                    model: chatModel,
                    cfg,
                    system,
                    initialMessages: mapped,
                    allowUnsafe,
                });
                return NextResponse.json({ message, trace, blocked });
            }

            // Streaming path — SSE. Tool loop runs buffered (can't stream a
            // structured response), but the final text answer is sent
            // incrementally as character chunks at a readable pace so the
            // UI feels like it's typing.
            const encoder = new TextEncoder();
            const sseStream = new ReadableStream<Uint8Array>({
                async start(controller) {
                    const send = (event: { type: string; data?: unknown }) => {
                        const line = `data: ${JSON.stringify(event)}\n\n`;
                        controller.enqueue(encoder.encode(line));
                    };
                    try {
                        const { message, trace, blocked } = await runToolLoop({
                            model: chatModel,
                            cfg,
                            system,
                            initialMessages: mapped,
                            allowUnsafe,
                            emit: send,
                        });
                        // Stream the final text in small chunks.
                        const text = message || "";
                        const chunkSize = 4;
                        for (let i = 0; i < text.length; i += chunkSize) {
                            send({
                                type: "text_chunk",
                                data: text.slice(i, i + chunkSize),
                            });
                            // small yield so the event loop flushes chunks
                            await new Promise((r) => setTimeout(r, 12));
                        }
                        send({ type: "done", data: { trace, blocked } });
                    } catch (err) {
                        const msg =
                            err instanceof Error ? err.message : String(err);
                        send({ type: "error", data: { message: msg } });
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(sseStream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                },
            });
        }

        // Legacy single-shot path (unchanged — existing callers rely on this).
        const system =
            systemInstruction ||
            "You are BieAI, a helpful project management assistant for Bie. You help the user manage tasks, projects, and navigate the system. Keep responses concise and friendly.";

        const cfMessages = [
            { role: "system", content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        const result = await runCfModel(chatModel, { messages: cfMessages }, cfg);
        const r = (result as { response?: unknown })?.response;
        const text =
            typeof r === "string" ? r : r != null ? JSON.stringify(r) : "";
        return NextResponse.json({ message: text });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("AI chat error:", error);
        return NextResponse.json(
            { error: msg || "Failed to generate AI response" },
            { status: 500 },
        );
    }
}
