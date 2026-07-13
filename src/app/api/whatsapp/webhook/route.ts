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
    const messages = Array.isArray(record.messages) ? record.messages : Array.isArray(record.message) ? record.message : [];

    return messages
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => {
            const text = item.text && typeof item.text === "object" ? item.text as Record<string, unknown> : undefined;
            const interactive = item.interactive && typeof item.interactive === "object" ? item.interactive as Record<string, unknown> : undefined;
            const listReply = interactive?.list_reply && typeof interactive.list_reply === "object" ? interactive.list_reply as Record<string, unknown> : undefined;
            const buttonReply = interactive?.button_reply && typeof interactive.button_reply === "object" ? interactive.button_reply as Record<string, unknown> : undefined;
            const reply = item.list_reply && typeof item.list_reply === "object" ? item.list_reply as Record<string, unknown> : undefined;
            return {
                id: typeof item.id === "string" ? item.id : undefined,
                from: typeof item.from === "string" ? item.from : undefined,
                chatId: typeof item.chat_id === "string" ? item.chat_id : typeof item.chatId === "string" ? item.chatId : undefined,
                body: typeof item.body === "string"
                    ? item.body
                    : typeof text?.body === "string"
                      ? text.body
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
