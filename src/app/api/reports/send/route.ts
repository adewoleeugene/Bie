import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, buildNotificationEmail } from "@/lib/email";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

/**
 * Scheduled report endpoint. Call via cron:
 *   GET /api/reports/send?type=weekly
 *   GET /api/reports/send?type=monthly
 *
 * Secured via CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
    const secret = req.headers.get("authorization");
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = req.nextUrl.searchParams.get("type") || "weekly";
    const now = new Date();

    let start: Date;
    let end: Date;
    let periodLabel: string;

    if (type === "monthly") {
        start = startOfMonth(now);
        end = endOfMonth(now);
        periodLabel = format(now, "MMMM yyyy");
    } else {
        start = startOfWeek(now);
        end = endOfWeek(now);
        periodLabel = `Week of ${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }

    try {
        // Get all organizations
        const orgs = await db.organization.findMany({
            include: {
                members: {
                    include: {
                        user: { select: { id: true, email: true, name: true } },
                    },
                },
            },
        });

        let sent = 0;

        for (const org of orgs) {
            // Gather metrics for this org
            const [totalTasks, completedTasks, newTasks, overdueTasks] = await Promise.all([
                db.task.count({ where: { organizationId: org.id, status: { not: "ARCHIVED" } } }),
                db.task.count({
                    where: { organizationId: org.id, status: "DONE", updatedAt: { gte: start, lte: end } },
                }),
                db.task.count({
                    where: { organizationId: org.id, createdAt: { gte: start, lte: end } },
                }),
                db.task.count({
                    where: { organizationId: org.id, status: { notIn: ["DONE", "ARCHIVED"] }, dueDate: { lt: now } },
                }),
            ]);

            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Check email preferences — only send to users who have opted in
            for (const member of org.members) {
                const pref = await db.notificationPreference.findFirst({
                    where: { userId: member.user.id, organizationId: org.id, type: "DUE_SOON", email: true },
                });

                // Only send if user has any email preference enabled (using DUE_SOON as proxy for report opt-in)
                if (!pref || !member.user.email) continue;

                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://christbase.christex.org";

                const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0099ff; padding-bottom: 12px; margin-bottom: 20px;">
    <strong style="font-size: 14px; color: #666;">Bie — ${type === "monthly" ? "Monthly" : "Weekly"} Report</strong>
  </div>
  <h2 style="font-size: 18px; margin: 0 0 16px;">${periodLabel}</h2>
  <p>Hi ${member.user.name || "there"},</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px 0; color: #666;">Tasks completed</td>
      <td style="padding: 8px 0; text-align: right; font-weight: bold;">${completedTasks}</td>
    </tr>
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px 0; color: #666;">New tasks created</td>
      <td style="padding: 8px 0; text-align: right; font-weight: bold;">${newTasks}</td>
    </tr>
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px 0; color: #666;">Completion rate</td>
      <td style="padding: 8px 0; text-align: right; font-weight: bold;">${completionRate}%</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: ${overdueTasks > 0 ? "#ef4444" : "#666"};">Overdue tasks</td>
      <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${overdueTasks > 0 ? "#ef4444" : "inherit"};">${overdueTasks}</td>
    </tr>
  </table>
  <a href="${appUrl}/analytics" style="display: inline-block; background: #0099ff; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Full Analytics</a>
  <p style="color: #999; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
    Manage your email preferences in Bie settings.
  </p>
</body>
</html>`;

                await sendEmail({
                    to: member.user.email,
                    subject: `Bie ${type === "monthly" ? "Monthly" : "Weekly"} Report — ${periodLabel}`,
                    text: `${periodLabel}: ${completedTasks} tasks completed, ${newTasks} new, ${overdueTasks} overdue. Completion rate: ${completionRate}%.`,
                    html,
                });
                sent++;
            }
        }

        return NextResponse.json({ success: true, sent });
    } catch (error) {
        console.error("Scheduled report error:", error);
        return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
    }
}
