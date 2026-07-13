import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isInsideQuietHours } from "@/lib/whatsapp";
import { sendMorningDigestToUser } from "@/lib/whatsapp-workflows";

function authorized(request: NextRequest) {
    const secret = process.env.WHATSAPP_CRON_SECRET;
    if (!secret) return true;
    return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const users = await db.user.findMany({
        where: {
            phone: { not: null },
            phoneVerifiedAt: { not: null },
            whatsappEnabled: true,
            notificationPreferences: { some: { type: "DAILY_DIGEST", whatsapp: true } },
        },
        include: {
            memberships: { include: { organization: true }, orderBy: { joinedAt: "asc" } },
            whatsappSession: true,
        },
    });

    const results = await Promise.allSettled(
        users
            .filter((user) => {
                if (!user.whatsappQuietHoursEnabled) return true;
                return !isInsideQuietHours({
                    timezone: user.whatsappTimezone,
                    quietStart: user.whatsappQuietStart,
                    quietEnd: user.whatsappQuietEnd,
                });
            })
            .map((user) => sendMorningDigestToUser(user))
    );

    return NextResponse.json({ ok: true, attempted: results.length });
}
