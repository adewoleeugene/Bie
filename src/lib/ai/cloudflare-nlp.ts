import { TaskPriority } from "@prisma/client";
import { parseTaskInput, ParsedTask } from "@/lib/ai/nlp";

// Natural-language task parsing via Cloudflare Workers AI, with the regex
// parseTaskInput as a guaranteed fallback. Enabled only when both env vars are
// set; any failure (unconfigured, timeout, bad JSON) falls back to regex, so
// task creation never regresses.

const CF_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const CF_TIMEOUT_MS = 6000; // bounded so it stays well under the webhook/function budget

function cloudflareConfig() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) return null;
    return { accountId, apiToken };
}

export function isTaskAIEnabled(): boolean {
    return cloudflareConfig() !== null;
}

function todayContext(timezone: string, now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("weekday")}, ${get("year")}-${get("month")}-${get("day")}`;
}

function coerce(raw: string): ParsedTask | null {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
        return null;
    }

    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    if (!title) return null;

    const priority: TaskPriority =
        parsed.priority === "P0" || parsed.priority === "P1" || parsed.priority === "P3"
            ? parsed.priority
            : "P2";

    let dueDate: Date | undefined;
    if (typeof parsed.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
        const date = new Date(`${parsed.dueDate}T00:00:00`);
        if (!Number.isNaN(date.getTime())) dueDate = date;
    }

    return { title, priority, status: "TODO", dueDate, assigneeIds: [] };
}

export async function parseTaskInputAI(text: string, timezone: string): Promise<ParsedTask | null> {
    const config = cloudflareConfig();
    if (!config) return null;

    const system = [
        `You extract ONE task from a short message sent to a task bot. Today is ${todayContext(timezone)} (timezone ${timezone}).`,
        "Reply with ONLY a compact JSON object and nothing else (no prose, no code fences), with these keys:",
        `"title": a concise imperative task title. Keep any @mentions (words starting with @) exactly as written. Do NOT include date or priority words in the title.`,
        `"priority": one of "P0","P1","P2","P3". P0=urgent/asap/critical, P1=high/important, P2=normal (default), P3=low/whenever.`,
        `"dueDate": "YYYY-MM-DD" if the message implies a due date (today, tomorrow, a weekday, next week, an explicit date), otherwise null.`,
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CF_TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${CF_MODEL}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config.apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: text },
                    ],
                    max_tokens: 200,
                    temperature: 0.1,
                }),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            console.error("Cloudflare AI task parse failed:", response.status, await response.text().catch(() => ""));
            return null;
        }

        const data = (await response.json()) as { result?: { response?: string } };
        const raw = data?.result?.response;
        return raw ? coerce(raw) : null;
    } catch (error) {
        console.error("Cloudflare AI task parse error:", error);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

// AI first, regex fallback — always returns a usable ParsedTask.
export async function parseTaskSmart(text: string, timezone: string): Promise<ParsedTask> {
    const ai = await parseTaskInputAI(text, timezone);
    return ai ?? parseTaskInput(text);
}
