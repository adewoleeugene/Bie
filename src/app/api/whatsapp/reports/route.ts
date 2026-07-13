import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isInsideQuietHours } from "@/lib/whatsapp";
import { sendDailyReportToUser, sendOwnerReportForOrganization } from "@/lib/whatsapp-workflows";

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
            notificationPreferences: { some: { type: "DAILY_REPORT", whatsapp: true } },
        },
        include: {
            memberships: { include: { organization: true }, orderBy: { joinedAt: "asc" } },
            whatsappSession: true,
        },
    });

    const userReports = await Promise.allSettled(
        users
            .filter((user) => {
                if (!user.whatsappQuietHoursEnabled) return true;
                return !isInsideQuietHours({
                    timezone: user.whatsappTimezone,
                    quietStart: user.whatsappQuietStart,
                    quietEnd: user.whatsappQuietEnd,
                });
            })
            .map((user) => sendDailyReportToUser(user))
    );

    const ownerReportOrgs = await db.notificationPreference.findMany({
        where: { type: "OWNER_REPORT", whatsapp: true },
        select: { organizationId: true },
        distinct: ["organizationId"],
    });

    await Promise.allSettled(ownerReportOrgs.map((pref) => sendOwnerReportForOrganization(pref.organizationId)));

    return NextResponse.json({ ok: true, userReports: userReports.length, ownerReports: ownerReportOrgs.length });
}
