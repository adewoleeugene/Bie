import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
        ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
          }
        : undefined,
});

const FROM_ADDRESS = process.env.EMAIL_FROM || "Bie <noreply@christex.org>";

interface SendEmailParams {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

/**
 * Send an email notification. Fire-and-forget — errors are logged but not thrown.
 * Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars to be configured.
 * If SMTP is not configured, emails are silently skipped.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!process.env.SMTP_HOST) {
        // SMTP not configured — skip silently
        return false;
    }

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
        });
        return true;
    } catch (error) {
        console.error("Failed to send email:", error);
        return false;
    }
}

/**
 * Build a simple HTML email body for a notification.
 */
export function buildNotificationEmail(params: {
    title: string;
    body?: string;
    linkUrl?: string;
    appUrl?: string;
}): { subject: string; text: string; html: string } {
    const appUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://christbase.christex.org";
    const fullLink = params.linkUrl ? `${appUrl}${params.linkUrl}` : appUrl;

    const text = [
        params.title,
        params.body || "",
        "",
        params.linkUrl ? `View: ${fullLink}` : "",
        "",
        "— Bie",
    ]
        .filter(Boolean)
        .join("\n");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0099ff; padding-bottom: 12px; margin-bottom: 20px;">
    <strong style="font-size: 14px; color: #666;">Bie</strong>
  </div>
  <h2 style="font-size: 18px; margin: 0 0 8px;">${escapeHtml(params.title)}</h2>
  ${params.body ? `<p style="color: #555; margin: 0 0 16px;">${escapeHtml(params.body)}</p>` : ""}
  ${params.linkUrl ? `<a href="${escapeHtml(fullLink)}" style="display: inline-block; background: #0099ff; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View in Bie</a>` : ""}
  <p style="color: #999; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
    You received this because of your notification preferences in Bie.
  </p>
</body>
</html>`.trim();

    return { subject: params.title, text, html };
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
