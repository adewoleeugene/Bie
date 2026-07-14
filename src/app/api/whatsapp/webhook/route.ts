import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeWhatsAppSender } from "@/lib/phone";
import { handleWhatsAppInbound } from "@/lib/whatsapp-workflows";

interface OpenWAEnvelope {
    event?: string;
    sessionId?: string;
    idempotencyKey?: string;
    data?: {
        id?: string;
        from?: string;
        senderPhone?: string;
        body?: string;
        type?: string;
        isGroup?: boolean;
        status?: string;
        reason?: string;
    };
}

// OpenWA signs each delivery as `X-OpenWA-Signature: sha256=<hex>` computed
// over the raw request body. Fails closed when the secret is not configured.
function hasValidSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.OPENWA_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(signatureBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    if (!hasValidSignature(rawBody, request.headers.get("x-openwa-signature"))) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    let envelope: OpenWAEnvelope;
    try {
        envelope = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ ok: true });
    }

    if (envelope.event === "session.status") {
        const status = envelope.data?.status;
        if (status === "disconnected" || status === "failed") {
            console.error("[whatsapp:webhook] OpenWA session issue", {
                sessionId: envelope.sessionId,
                status,
                reason: envelope.data?.reason,
            });
        } else {
            console.info("[whatsapp:webhook] OpenWA session status", {
                sessionId: envelope.sessionId,
                status,
            });
        }
        return NextResponse.json({ ok: true });
    }

    if (envelope.event !== "message.received") {
        return NextResponse.json({ ok: true });
    }

    const message = envelope.data;
    if (!message || message.isGroup) {
        return NextResponse.json({ ok: true });
    }

    // `senderPhone` carries the real phone when `from` is a WhatsApp @lid address.
    const phone = normalizeWhatsAppSender(message.senderPhone || message.from || "");
    if (!phone) {
        console.warn("[whatsapp:webhook] message missing sender phone", {
            id: message.id,
            from: message.from,
        });
        return NextResponse.json({ ok: true });
    }

    console.info("[whatsapp:webhook] inbound message", {
        id: message.id,
        idempotencyKey: envelope.idempotencyKey,
        hasBody: Boolean(message.body),
    });

    await handleWhatsAppInbound({
        phone,
        text: message.body || "",
        messageId: message.id,
    });

    return NextResponse.json({ ok: true });
}
