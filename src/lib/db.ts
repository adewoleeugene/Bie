import { PrismaClient } from "@prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    pool: Pool | undefined;
};

// Neon suspends idle serverless compute, which silently kills pooled
// connections. A bare Pool then hands out dead sockets ("Connection
// terminated unexpectedly") and, with no connect timeout, requests hang.
// These options make the pool fail fast and recover; the 'error' handler is
// required so an idle-client error does not crash the process.
function createPool() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        keepAlive: true,
        allowExitOnIdle: true,
    });
    pool.on("error", (err) => {
        console.error("[pg] idle client error:", err.message);
    });
    return pool;
}

const pool = globalForPrisma.pool ?? createPool();
const adapter = new PrismaPg(pool);

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = db;
    globalForPrisma.pool = pool;
}
