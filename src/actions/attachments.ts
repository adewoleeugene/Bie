"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { AttachmentParent } from "@prisma/client";
import { saveFile, deleteFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME = new Set<string>([
    // images
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
    // docs
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "text/markdown",
    // archives
    "application/zip",
]);

async function getUserOrganization() {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) {
        throw new Error("No organization found");
    }

    return {
        userId: user.id,
        organizationId: user.memberships[0].organizationId,
    };
}

export async function uploadAttachment(formData: FormData) {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const file = formData.get("file");
        const parentTypeRaw = formData.get("parentType");
        const parentId = formData.get("parentId");

        if (!(file instanceof File)) {
            return { success: false, error: "No file provided" };
        }
        if (typeof parentTypeRaw !== "string" || typeof parentId !== "string") {
            return { success: false, error: "Missing parent reference" };
        }
        if (!(parentTypeRaw in AttachmentParent)) {
            return { success: false, error: "Invalid parent type" };
        }
        const parentType = parentTypeRaw as AttachmentParent;

        if (file.size > MAX_BYTES) {
            return { success: false, error: "File exceeds 25 MB limit" };
        }
        if (!ALLOWED_MIME.has(file.type)) {
            return { success: false, error: `Unsupported file type: ${file.type}` };
        }

        // Create the row first (ready=false) so we have a stable id for the filename.
        const pending = await db.attachment.create({
            data: {
                organizationId,
                uploaderId: userId,
                parentType,
                parentId,
                key: "", // filled in after save
                filename: file.name,
                mimeType: file.type,
                size: file.size,
                ready: false,
            },
        });

        try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const saved = await saveFile(organizationId, pending.id, file.name, buffer);

            const finalized = await db.attachment.update({
                where: { id: pending.id },
                data: { key: saved.key, ready: true },
            });

            revalidatePath("/");
            return { success: true, data: finalized };
        } catch (err) {
            // Roll back the pending row if the disk write failed.
            await db.attachment.delete({ where: { id: pending.id } }).catch(() => {});
            throw err;
        }
    } catch (error) {
        console.error("Upload attachment error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
}

/**
 * Lightweight upload for the wiki editor's media blocks (image/video/audio/
 * file). Saves the file and returns a public URL string — the shape
 * BlockNote's `uploadFile` expects. Throws on error so the editor surfaces it.
 */
export async function uploadEditorFile(formData: FormData): Promise<string> {
    const { organizationId } = await getUserOrganization();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    if (file.size > MAX_BYTES) throw new Error("File exceeds 25 MB limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const saved = await saveFile(organizationId, id, file.name, buffer);
    return saved.publicUrl;
}

export async function listAttachments(parentType: AttachmentParent, parentId: string) {
    try {
        const { organizationId } = await getUserOrganization();

        return db.attachment.findMany({
            where: {
                organizationId,
                parentType,
                parentId,
                ready: true,
            },
            include: {
                uploader: { select: { id: true, name: true, image: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    } catch (error) {
        console.error("List attachments error:", error);
        return [];
    }
}

export async function deleteAttachment(attachmentId: string) {
    try {
        const { userId, organizationId } = await getUserOrganization();

        const attachment = await db.attachment.findUnique({
            where: { id: attachmentId },
        });

        if (!attachment || attachment.organizationId !== organizationId) {
            return { success: false, error: "Not found" };
        }
        if (attachment.uploaderId !== userId) {
            // Future: allow project leads / admins to delete others' files.
            return { success: false, error: "You can only delete your own uploads" };
        }

        await deleteFile(attachment.key);
        await db.attachment.delete({ where: { id: attachmentId } });

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Delete attachment error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Delete failed",
        };
    }
}
