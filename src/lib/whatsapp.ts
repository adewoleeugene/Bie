import { toWhatsAppChatId } from "@/lib/phone";

interface SendWhatsAppParams {
    to: string;
    body: string;
}

export interface WhatsAppListSection {
    title?: string;
    rows: Array<{
        id: string;
        title: string;
        description?: string;
    }>;
}

function getOpenWAConfig() {
    const baseUrl = process.env.OPENWA_BASE_URL?.replace(/\/+$/, "");
    const apiKey = process.env.OPENWA_API_KEY;
    const sessionId = process.env.OPENWA_SESSION_ID;

    if (!baseUrl || !apiKey || !sessionId) return null;
    return { baseUrl, apiKey, sessionId };
}

export function isWhatsAppConfigured(): boolean {
    return getOpenWAConfig() !== null;
}

export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<boolean> {
    const config = getOpenWAConfig();
    if (!config) {
        console.error("Failed to send WhatsApp message: OpenWA is not configured (OPENWA_BASE_URL, OPENWA_API_KEY, OPENWA_SESSION_ID)");
        return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const chatId = toWhatsAppChatId(params.to);

    try {
        const response = await fetch(`${config.baseUrl}/sessions/${config.sessionId}/messages/send-text`, {
            method: "POST",
            headers: {
                "X-API-Key": config.apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chatId,
                text: params.body,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            console.error("Failed to send WhatsApp message:", response.status, await response.text());
            return false;
        }

        const result = await response.json().catch(() => null) as { messageId?: string } | null;
        console.info("Sent WhatsApp message", { to: chatId, messageId: result?.messageId });
        return true;
    } catch (error) {
        console.error("Failed to send WhatsApp message:", error);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

// OpenWA has no interactive list-message endpoint, and unofficial gateways are
// unreliable for interactive UI anyway. Lists always go out as numbered text;
// the router accepts the matching text replies.
export async function sendWhatsAppListMessage(params: SendWhatsAppParams & {
    buttonText: string;
    sections: WhatsAppListSection[];
}): Promise<boolean> {
    return sendWhatsAppMessage({ to: params.to, body: formatListFallback(params) });
}

function formatListFallback(params: {
    body: string;
    sections: WhatsAppListSection[];
}) {
    const lines = [params.body];
    for (const section of params.sections) {
        if (section.title) lines.push("", section.title);
        section.rows.forEach((row, index) => {
            lines.push(`${index + 1}. ${row.title}${row.description ? ` - ${row.description}` : ""}`);
        });
    }
    return lines.join("\n");
}

export function buildNotificationWhatsApp(params: {
    title: string;
    body?: string;
    linkUrl?: string;
    appUrl?: string;
}): string {
    const appUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://christbase.christex.org";
    const fullLink = params.linkUrl ? `${appUrl}${params.linkUrl}` : undefined;

    return [
        `*${params.title}*`,
        params.body,
        fullLink ? `Open in Bie: ${fullLink}` : undefined,
        "",
        "Reply STOP to turn off WhatsApp notifications.",
    ]
        .filter(Boolean)
        .join("\n");
}

export function isInsideQuietHours(params: {
    now?: Date;
    timezone: string;
    quietStart: string;
    quietEnd: string;
}): boolean {
    const now = params.now || new Date();
    const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: params.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(now);

    const toMinutes = (value: string) => {
        const [hours, minutes] = value.split(":").map(Number);
        return hours * 60 + minutes;
    };

    const current = toMinutes(localTime);
    const start = toMinutes(params.quietStart);
    const end = toMinutes(params.quietEnd);

    if (start === end) return false;
    if (start < end) return current >= start && current < end;
    return current >= start || current < end;
}
