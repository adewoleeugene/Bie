import { z } from "zod";

/**
 * Environment variable validation using Zod.
 * Fails fast at startup if required variables are missing.
 */

const serverSchema = z.object({
    // Database
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),

    // Auth — NextAuth v5 uses AUTH_SECRET; NEXTAUTH_SECRET accepted for legacy support
    AUTH_SECRET: z.string().min(1).optional(),
    NEXTAUTH_SECRET: z.string().min(1).optional(),
    AUTH_URL: z.string().url().optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    AUTH_TRUST_HOST: z.string().optional(),

    // Google OAuth (optional — credentials auth works without these)
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // SMTP for email notifications (optional — skips email if not set)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z.enum(["true", "false"]).optional(),
    EMAIL_FROM: z.string().optional(),

    // AI / Cloudflare (optional — AI features degrade gracefully)
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),

    // Cloudflare R2 storage (optional locally; required for production uploads)
    R2_BUCKET_NAME: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_ENDPOINT: z.string().url().optional(),
    R2_PUBLIC_BASE_URL: z.string().url().optional(),

    // Google Gemini (optional)
    GEMINI_API_KEY: z.string().optional(),

    // Node environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const clientSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function validateEnv() {
    const serverResult = serverSchema.safeParse(process.env);
    if (!serverResult.success) {
        const formatted = serverResult.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");
        console.error(`\n❌ Invalid environment variables:\n${formatted}\n`);
        throw new Error("Invalid environment variables. See above for details.");
    }

    const clientResult = clientSchema.safeParse(process.env);
    if (!clientResult.success) {
        const formatted = clientResult.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");
        console.error(`\n❌ Invalid client environment variables:\n${formatted}\n`);
        throw new Error("Invalid client environment variables. See above for details.");
    }

    return {
        server: serverResult.data,
        client: clientResult.data,
    };
}

export const env = validateEnv();
