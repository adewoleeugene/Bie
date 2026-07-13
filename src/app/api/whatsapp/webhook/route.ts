import { NextRequest, NextResponse } from "next/server";
import { normalizeWhapiSender } from "@/lib/phone";
import { handleWhatsAppInbound } from "@/lib/whatsapp-workflows";

function hasValidSecret(request: NextRequest) {
    const expected = process.env.WHAPI_WEBHOOK_SECRET;
    if (!expected) return true;

    return (
        request.nextUrl.searchParams.get("secret") === expected ||
        request.headers.get("x-whapi-secret") === expected ||
        request.headers.get("x-bie-whapi-secret") === expected
    );
}

function extractMessages(payload: unknown): Array<{ id?: string; from?: string; chatId?: string; body?: string; replyId?: string; fromMe?: boolean }> {
    if (!payload || typeof payload !== "object") return [];

    const record = payload as Record<string, unknown>;
    const candidates = [
        ...toRecordArray(record.messages),
        ...toRecordArray(record.message),
        ...toRecordArray(record.data),
        ...toRecordArray(record.payload),
        ...(looksLikeMessage(record) ? [record] : []),
    ];

    return candidates
        .map((item) => {
            const text = item.text && typeof item.text === "object" ? item.text as Record<string, unknown> : undefined;
            const message = item.message && typeof item.message === "object" ? item.message as Record<string, unknown> : undefined;
            const messageText = message?.text && typeof message.text === "object" ? message.text as Record<string, unknown> : undefined;
            const interactive = item.interactive && typeof item.interactive === "object" ? item.interactive as Record<string, unknown> : undefined;
            const listReply = interactive?.list_reply && typeof interactive.list_reply === "object" ? interactive.list_reply as Record<string, unknown> : undefined;
            const buttonReply = interactive?.button_reply && typeof interactive.button_reply === "object" ? interactive.button_reply as Record<string, unknown> : undefined;
            const reply = item.list_reply && typeof item.list_reply === "object" ? item.list_reply as Record<string, unknown> : undefined;
            return {
                id: typeof item.id === "string" ? item.id : undefined,
                from: typeof item.from === "string" ? item.from : typeof item.sender === "string" ? item.sender : undefined,
                chatId: typeof item.chat_id === "string" ? item.chat_id : typeof item.chatId === "string" ? item.chatId : undefined,
                body: typeof item.body === "string"
                    ? item.body
                    : typeof item.text === "string"
                      ? item.text
                    : typeof text?.body === "string"
                      ? text.body
                      : typeof message?.body === "string"
                        ? message.body
                        : typeof messageText?.body === "string"
                          ? messageText.body
                      : typeof listReply?.title === "string"
                        ? listReply.title
                        : typeof buttonReply?.title === "string"
                          ? buttonReply.title
                          : typeof reply?.title === "string"
                            ? reply.title
                            : undefined,
                replyId: typeof listReply?.id === "string"
                    ? listReply.id
                    : typeof buttonReply?.id === "string"
                      ? buttonReply.id
                      : typeof reply?.id === "string"
                        ? reply.id
                        : undefined,
                fromMe: item.from_me === true || item.fromMe === true,
            };
        });
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return [value as Record<string, unknown>];
    }
    return [];
}

function looksLikeMessage(record: Record<string, unknown>) {
    return (
        typeof record.id === "string" ||
        typeof record.from === "string" ||
        typeof record.chat_id === "string" ||
        typeof record.chatId === "string" ||
        typeof record.body === "string" ||
        typeof record.text === "string"
    );
}

export async function POST(request: NextRequest) {
    if (!hasValidSecret(request)) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ ok: true });
    }

    const messages = extractMessages(payload);
    if (messages.length === 0) {
        console.warn("[whatsapp:webhook] no messages extracted", {
            keys: Object.keys(payload as Record<string, unknown>),
        });
    }

    await Promise.allSettled(
        messages.map(async (message) => {
            if (message.fromMe) return;

            const phone = normalizeWhapiSender(message.from || message.chatId || "");
            if (!phone) return;

            await handleWhatsAppInbound({
                phone,
                text: message.body || message.replyId || "",
                replyId: message.replyId,
                messageId: message.id,
            });
        })
    );

    return NextResponse.json({ ok: true });
}
