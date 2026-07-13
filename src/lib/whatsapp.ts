import { toWhapiRecipient } from "@/lib/phone";

const WHAPI_BASE_URL = process.env.WHAPI_BASE_URL || "https://gate.whapi.cloud";

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

export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<boolean> {
    if (!process.env.WHAPI_TOKEN) {
        console.error("Failed to send WhatsApp message: WHAPI_TOKEN is not configured");
        return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.WHAPI_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: toWhapiRecipient(params.to),
                body: params.body,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            console.error("Failed to send WhatsApp message:", response.status, await response.text());
            return false;
        }

        console.info("Sent WhatsApp message", { to: toWhapiRecipient(params.to) });
        return true;
    } catch (error) {
        console.error("Failed to send WhatsApp message:", error);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

export async function sendWhatsAppListMessage(params: SendWhatsAppParams & {
    buttonText: string;
    sections: WhatsAppListSection[];
}): Promise<boolean> {
    if (!process.env.WHAPI_TOKEN) {
        return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(`${WHAPI_BASE_URL}/messages/list`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.WHAPI_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: toWhapiRecipient(params.to),
                body: params.body,
                button: params.buttonText,
                sections: params.sections,
            }),
            signal: controller.signal,
        });

        if (response.ok) return true;

        console.error("Failed to send WhatsApp list message:", response.status, await response.text());
        return sendWhatsAppMessage({ to: params.to, body: formatListFallback(params) });
    } catch (error) {
        console.error("Failed to send WhatsApp list message:", error);
        return sendWhatsAppMessage({ to: params.to, body: formatListFallback(params) });
    } finally {
        clearTimeout(timeout);
    }
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
