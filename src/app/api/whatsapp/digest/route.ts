import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDigestDue } from "@/lib/whatsapp";
import { sendMorningDigestToUser } from "@/lib/whatsapp-workflows";

function authorized(request: NextRequest) {
    const secret = process.env.WHATSAPP_CRON_SECRET;
    // Fail closed: an unset secret would leave this public endpoint open.
    if (!secret) return false;
    return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Called on a schedule (hourly, from the always-on OpenWA box's crontab). Each
// run sends the digest only to users whose local time has reached their chosen
// digest time and who have not been sent one today — so a single hourly job
// delivers each person's digest at their own local work-start time.
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

    const now = new Date();
    // Scheduled digest fires at the user's explicitly-chosen time, so it is not
    // gated by quiet hours (the user picked this hour deliberately).
    const due = users.filter((user) =>
        isDigestDue({
            timezone: user.whatsappTimezone,
            digestTime: user.whatsappDigestTime,
            lastSentAt: user.whatsappSession?.lastDigestSentAt ?? null,
            now,
        })
    );

    const results = await Promise.allSettled(due.map((user) => sendMorningDigestToUser(user)));

    return NextResponse.json({ ok: true, eligible: users.length, sent: results.length });
}
