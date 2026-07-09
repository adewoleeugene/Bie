import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * One-shot migrator for the chat-channels + project-access work.
 *
 * Why not `prisma db push`: db push syncs schema STRUCTURE only. It would drop
 * `isGroup` WITHOUT running the `type` backfill (existing GROUP chats silently
 * become DMs) and would skip the `#general` seeding and project-lead backfill.
 * These migration files run structure + data backfills in the correct order.
 *
 * Safe to re-run: each step is guarded by a check for the object it creates, so
 * already-applied steps are skipped. Runs one file per transaction and STOPS on
 * the first error (nothing past a failure is applied).
 *
 * Usage:  npx tsx scripts/apply-chat-migrations.ts
 * Requires DATABASE_URL in the environment (.env is loaded automatically).
 */

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

// Ordered. `guard` returns true when the migration is ALREADY applied (skip it).
const STEPS: { dir: string; label: string; guard: string }[] = [
    {
        dir: "20260708150000_add_chat_channels",
        label: "chat channels + #general backfill",
        guard: `SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Conversation' AND column_name = 'type'`,
    },
    {
        dir: "20260708153000_add_message_references",
        label: "message references",
        guard: `SELECT to_regclass('"MessageReference"') IS NOT NULL AS applied`,
    },
    {
        dir: "20260708154500_add_message_edit_delete",
        label: "message edit/delete (deletedAt)",
        guard: `SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Message' AND column_name = 'deletedAt'`,
    },
    {
        // Data-only backfill; its SQL is idempotent, so no guard (always run).
        dir: "20260709100000_backfill_project_access",
        label: "project access backfill (leads → members)",
        guard: "",
    },
];

async function isApplied(client: Client, guard: string): Promise<boolean> {
    if (!guard) return false;
    const res = await client.query(guard);
    if (res.rowCount === 0) return false;
    // For the `... IS NOT NULL AS applied` form, respect the boolean.
    const first = res.rows[0] as Record<string, unknown>;
    if ("applied" in first) return first.applied === true;
    return true;
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("✗ DATABASE_URL is not set. Aborting.");
        process.exit(1);
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log("Connected to database.\n");

    try {
        for (const step of STEPS) {
            if (await isApplied(client, step.guard)) {
                console.log(`↷ skip  ${step.label} (already applied)`);
                continue;
            }

            const sql = readFileSync(join(MIGRATIONS_DIR, step.dir, "migration.sql"), "utf8");
            process.stdout.write(`→ apply ${step.label} ... `);

            try {
                await client.query("BEGIN");
                await client.query(sql); // multi-statement; no bind params in these files
                await client.query("COMMIT");
                console.log("done");
            } catch (err) {
                await client.query("ROLLBACK");
                console.log("FAILED");
                console.error(`\n✗ ${step.dir} failed — rolled back. Nothing further applied.\n`, err);
                process.exit(1);
            }
        }

        console.log("\n✓ All migrations applied. Re-run Part A + Part B to verify.");
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
