import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneNumber } from "@/lib/phone";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

function hasValidSecret(request: NextRequest) {
    const expected = process.env.WHAPI_WEBHOOK_SECRET;
    if (!expected) return false;
    return request.nextUrl.searchParams.get("secret") === expected;
}

export async function GET(request: NextRequest) {
    if (!hasValidSecret(request)) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const country = request.nextUrl.searchParams.get("country") || "SL";
    const rawTo = request.nextUrl.searchParams.get("to");
    if (!rawTo) {
        return NextResponse.json({ ok: false, error: "Missing to" }, { status: 400 });
    }

    let to: string;
    try {
        to = normalizePhoneNumber(country, rawTo);
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Invalid phone",
        }, { status: 400 });
    }

    const sent = await sendWhatsAppMessage({
        to,
        body: "Bie WhatsApp outbound test.",
    });

    return NextResponse.json({ ok: sent, to });
}
