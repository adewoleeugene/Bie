"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function updateUserAvatar(formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    const file = formData.get("avatar") as File | null;
    if (!file || file.size === 0) {
        return { success: false, error: "No file provided" };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return { success: false, error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." };
    }

    if (file.size > MAX_AVATAR_SIZE) {
        return { success: false, error: "File too large. Maximum 5MB." };
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) {
        return { success: false, error: "User not found" };
    }

    const organizationId = user.memberships[0].organizationId;
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveFile(organizationId, `avatar-${user.id}`, file.name, buffer);

    await db.user.update({
        where: { id: user.id },
        data: { image: saved.publicUrl },
    });

    revalidatePath("/settings");
    return { success: true, url: saved.publicUrl };
}

export async function updateUserProfile(data: { name: string }) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    const name = data.name.trim();
    if (!name) {
        return { success: false, error: "Name cannot be empty" };
    }

    await db.user.update({
        where: { email: session.user.email },
        data: { name },
    });

    revalidatePath("/settings");
    return { success: true };
}
