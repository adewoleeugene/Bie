import { promises as fs } from "fs";
import path from "path";

/**
 * Local-disk storage adapter for attachments.
 *
 * Files live under `public/uploads/<organizationId>/<key>` so Next.js serves
 * them statically at `/uploads/<organizationId>/<key>`.
 *
 * This is dev/local only — on Vercel or any read-only filesystem this will
 * fail. Swap this file for an S3/R2 adapter (same exported surface) when
 * deploying. The rest of the app talks to this module, not to `fs`.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export interface SavedFile {
    key: string; // path relative to UPLOAD_ROOT, e.g. "org123/abc-report.pdf"
    publicUrl: string; // URL the browser can fetch, e.g. "/uploads/org123/abc-report.pdf"
    size: number;
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export async function saveFile(
    organizationId: string,
    id: string,
    filename: string,
    data: Buffer | Uint8Array,
): Promise<SavedFile> {
    const safeName = sanitizeFilename(filename);
    const key = `${organizationId}/${id}-${safeName}`;
    const fullPath = path.join(UPLOAD_ROOT, key);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);

    const stat = await fs.stat(fullPath);
    return {
        key,
        publicUrl: `/uploads/${key}`,
        size: stat.size,
    };
}

export async function deleteFile(key: string): Promise<void> {
    const fullPath = path.join(UPLOAD_ROOT, key);
    try {
        await fs.unlink(fullPath);
    } catch (err: unknown) {
        // Ignore "file not found" — the row may have been orphaned.
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
            throw err;
        }
    }
}

export function publicUrl(key: string): string {
    return `/uploads/${key}`;
}
