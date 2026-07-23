"use server";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/whatsapp";

const CODE_TTL_MINUTES = 10;

async function currentUser() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            phone: true,
            phoneCountry: true,
            phoneVerifiedAt: true,
            whatsappEnabled: true,
            whatsappQuietHoursEnabled: true,
            whatsappQuietStart: true,
            whatsappQuietEnd: true,
            whatsappTimezone: true,
            whatsappDigestTime: true,
        },
    });

    if (!user) throw new Error("Unauthorized");
    return user;
}

function hashCode(code: string) {
    return crypto.createHash("sha256").update(`${code}:${process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "bie"}`).digest("hex");
}

export async function getWhatsAppSettings() {
    try {
        const user = await currentUser();
        return {
            success: true,
            data: user,
        };
    } catch (error) {
        console.error("Get WhatsApp settings error:", error);
        return { success: false, error: "Could not load WhatsApp settings" };
    }
}

export async function requestWhatsAppVerification(input: { country: string; phone: string }) {
    try {
        const user = await currentUser();
        const phone = normalizePhoneNumber(input.country, input.phone);

        const existing = await db.user.findFirst({
            where: {
                phone,
                phoneVerifiedAt: { not: null },
                id: { not: user.id },
            },
            select: { id: true },
        });

        if (existing) {
            return { success: false, error: "This WhatsApp number is already connected to another Bie account." };
        }

        if (!isWhatsAppConfigured()) {
            return { success: false, error: "WhatsApp sending is not configured yet." };
        }

        const code = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

        await db.phoneVerification.deleteMany({
            where: { userId: user.id },
        });

        await db.phoneVerification.create({
            data: {
                userId: user.id,
                phone,
                country: input.country,
                codeHash: hashCode(code),
                expiresAt,
            },
        });

        const sent = await sendWhatsAppMessage({
            to: phone,
            body: `Your Bie WhatsApp verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
        });

        if (!sent) {
            return { success: false, error: "Could not send the WhatsApp verification code." };
        }

        return { success: true };
    } catch (error) {
        console.error("Request WhatsApp verification error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Could not send code" };
    }
}

export async function verifyWhatsAppCode(input: { code: string }) {
    try {
        const user = await currentUser();
        const code = input.code.replace(/\D/g, "");
        if (code.length !== 6) {
            return { success: false, error: "Enter the 6-digit code." };
        }

        const verification = await db.phoneVerification.findFirst({
            where: {
                userId: user.id,
                codeHash: hashCode(code),
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });

        if (!verification) {
            return { success: false, error: "The code is invalid or expired." };
        }

        const existing = await db.user.findFirst({
            where: {
                phone: verification.phone,
                phoneVerifiedAt: { not: null },
                id: { not: user.id },
            },
            select: { id: true },
        });

        if (existing) {
            return { success: false, error: "This WhatsApp number is already connected to another Bie account." };
        }

        await db.$transaction([
            db.user.update({
                where: { id: user.id },
                data: {
                    phone: verification.phone,
                    phoneCountry: verification.country,
                    phoneVerifiedAt: new Date(),
                    whatsappEnabled: true,
                },
            }),
            db.phoneVerification.deleteMany({ where: { userId: user.id } }),
        ]);

        return { success: true };
    } catch (error) {
        console.error("Verify WhatsApp code error:", error);
        return { success: false, error: "Could not verify WhatsApp number" };
    }
}

export async function updateWhatsAppSettings(input: {
    enabled?: boolean;
    quietHoursEnabled?: boolean;
    quietStart?: string;
    quietEnd?: string;
    timezone?: string;
    digestTime?: string;
}) {
    try {
        const user = await currentUser();
        if (input.enabled && !user.phoneVerifiedAt) {
            return { success: false, error: "Verify a WhatsApp number first." };
        }

        await db.user.update({
            where: { id: user.id },
            data: {
                whatsappEnabled: input.enabled,
                whatsappQuietHoursEnabled: input.quietHoursEnabled,
                whatsappQuietStart: input.quietStart,
                whatsappQuietEnd: input.quietEnd,
                whatsappTimezone: input.timezone,
                whatsappDigestTime: input.digestTime,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Update WhatsApp settings error:", error);
        return { success: false, error: "Could not update WhatsApp settings" };
    }
}

export async function disconnectWhatsAppNumber() {
    try {
        const user = await currentUser();

        await db.$transaction([
            db.user.update({
                where: { id: user.id },
                data: {
                    phone: null,
                    phoneCountry: null,
                    phoneVerifiedAt: null,
                    whatsappEnabled: false,
                },
            }),
            db.phoneVerification.deleteMany({ where: { userId: user.id } }),
        ]);

        return { success: true };
    } catch (error) {
        console.error("Disconnect WhatsApp error:", error);
        return { success: false, error: "Could not disconnect WhatsApp" };
    }
}
