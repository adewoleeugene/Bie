import { promises as fs } from "fs";
import path from "path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * Storage adapter for attachments.
 *
 * Uses Cloudflare R2 when configured, with local-disk storage as a development
 * fallback. The rest of the app talks to this module, not to a specific storage
 * provider.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const R2_REQUIRED_KEYS = [
    "R2_BUCKET_NAME",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
] as const;

export interface SavedFile {
    key: string; // path relative to UPLOAD_ROOT, e.g. "org123/abc-report.pdf"
    publicUrl: string; // URL the browser can fetch, e.g. "/uploads/org123/abc-report.pdf"
    size: number;
}

interface R2Config {
    bucket: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl?: string;
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function encodedKey(key: string): string {
    return key.split("/").map(encodeURIComponent).join("/");
}

function getR2Config(): R2Config | null {
    const missing = R2_REQUIRED_KEYS.filter((key) => !env.server[key]);
    const hasAnyR2Config = R2_REQUIRED_KEYS.some((key) => Boolean(env.server[key]))
        || Boolean(env.server.R2_ENDPOINT)
        || Boolean(env.server.R2_PUBLIC_BASE_URL);

    if (missing.length > 0) {
        if (hasAnyR2Config) {
            throw new Error(`Incomplete R2 configuration. Missing: ${missing.join(", ")}`);
        }

        if (env.server.NODE_ENV === "production") {
            throw new Error("R2 storage is not configured for production uploads");
        }

        return null;
    }

    const endpoint = env.server.R2_ENDPOINT
        || (env.server.CLOUDFLARE_ACCOUNT_ID
            ? `https://${env.server.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : null);

    if (!endpoint) {
        throw new Error("R2_ENDPOINT or CLOUDFLARE_ACCOUNT_ID is required for R2 storage");
    }

    return {
        bucket: env.server.R2_BUCKET_NAME!,
        endpoint,
        accessKeyId: env.server.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.server.R2_SECRET_ACCESS_KEY!,
        publicBaseUrl: env.server.R2_PUBLIC_BASE_URL?.replace(/\/+$/, ""),
    };
}

function r2Client(config: R2Config) {
    return new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
}

export async function saveFile(
    organizationId: string,
    id: string,
    filename: string,
    data: Buffer | Uint8Array,
    mimeType?: string,
): Promise<SavedFile> {
    const safeName = sanitizeFilename(filename);
    const key = `${organizationId}/${id}-${safeName}`;
    const r2 = getR2Config();

    if (r2) {
        await r2Client(r2).send(new PutObjectCommand({
            Bucket: r2.bucket,
            Key: key,
            Body: data,
            ContentType: mimeType || "application/octet-stream",
            ContentDisposition: `inline; filename="${safeName.replace(/"/g, "_")}"`,
        }));

        return {
            key,
            publicUrl: publicUrl(key),
            size: data.byteLength,
        };
    }

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
    const r2 = getR2Config();
    if (r2) {
        await r2Client(r2).send(new DeleteObjectCommand({
            Bucket: r2.bucket,
            Key: key,
        }));
        return;
    }

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
    const r2 = getR2Config();
    if (r2?.publicBaseUrl) {
        return `${r2.publicBaseUrl}/${encodedKey(key)}`;
    }

    return `/uploads/${encodedKey(key)}`;
}
