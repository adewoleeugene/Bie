import { Client, Pool } from "pg";
import { MessageRefType, ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";

// Cross-instance pub/sub for chat using Postgres LISTEN/NOTIFY.
// Channel: "chat_messages". Payload: JSON { conversationId, type, ... }.

type Listener = (payload: ChatEventPayload) => void;

export type ChatRealtimeMessage = {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
    updatedAt?: string;
    deletedAt?: string | null;
    sender: { id: string; name: string | null; image: string | null };
    references?: {
        id: string;
        targetType: MessageRefType;
        targetId: string;
        user?: { id: string; name: string; image: string | null } | null;
        task?: {
            id: string;
            title: string;
            status: TaskStatus;
            priority: TaskPriority;
            projectId: string | null;
            projectName: string | null;
            statusColumnName: string | null;
            statusColumnColor: string | null;
            assignees: { id: string; name: string; image: string | null }[];
            url: string;
        } | null;
        project?: {
            id: string;
            name: string;
            status: ProjectStatus;
            url: string;
        } | null;
    }[];
};

export type ChatEventPayload =
    | { conversationId: string; type: "message.created"; message: ChatRealtimeMessage }
    | { conversationId: string; type: "message.updated"; message: ChatRealtimeMessage }
    | { conversationId: string; type: "message.deleted"; messageId: string; deletedAt: string }
    | { conversationId: string; type: "typing"; userId: string; name: string; isTyping: boolean }
    | { conversationId: string; type: "presence"; userId: string; name: string; status: "online" | "offline" }
    | { conversationId: string; type: "read"; userId: string; readAt: string }
    | { conversationId: string; type: "membership"; action: "added" | "removed"; userId: string };

const CHANNEL = "chat_messages";

// Postgres LISTEN/NOTIFY does NOT work over a transaction-pooled connection —
// Neon's `-pooler` endpoint (PgBouncer in transaction mode) silently drops
// async notifications, so realtime chat never fires. Always use a direct,
// unpooled connection for the pub/sub channel. Prefer an explicit unpooled env
// var; otherwise derive the direct host from DATABASE_URL (Neon's pooled host is
// the direct host with a `-pooler` suffix).
function realtimeConnectionString(): string | undefined {
    const explicit =
        process.env.DATABASE_URL_UNPOOLED ??
        process.env.POSTGRES_URL_NON_POOLING ??
        process.env.DIRECT_URL;
    if (explicit) return explicit;

    return process.env.DATABASE_URL?.replace("-pooler", "");
}

const globalForChat = globalThis as unknown as {
    chatListeners?: Map<string, Set<Listener>>;
    chatListenClient?: Client | null;
    chatListenReady?: Promise<void> | null;
};

const listeners: Map<string, Set<Listener>> =
    globalForChat.chatListeners ?? new Map();
globalForChat.chatListeners = listeners;

async function ensureListenClient(): Promise<void> {
    if (globalForChat.chatListenReady) return globalForChat.chatListenReady;

    globalForChat.chatListenReady = (async () => {
        const client = new Client({ connectionString: realtimeConnectionString() });
        globalForChat.chatListenClient = client;

        client.on("notification", (msg) => {
            if (msg.channel !== CHANNEL || !msg.payload) return;
            try {
                const payload = JSON.parse(msg.payload) as ChatEventPayload;
                const set = listeners.get(payload.conversationId);
                set?.forEach((fn) => {
                    try {
                        fn(payload);
                    } catch (e) {
                        console.error("chat listener error", e);
                    }
                });
            } catch (e) {
                console.error("chat notify parse error", e);
            }
        });

        client.on("error", (err) => {
            console.error("chat LISTEN client error", err);
            globalForChat.chatListenClient = null;
            globalForChat.chatListenReady = null;
        });

        await client.connect();
        await client.query(`LISTEN ${CHANNEL}`);
    })();

    return globalForChat.chatListenReady;
}

export async function subscribe(
    conversationId: string,
    fn: Listener
): Promise<() => void> {
    await ensureListenClient();
    if (!listeners.has(conversationId)) listeners.set(conversationId, new Set());
    listeners.get(conversationId)!.add(fn);
    return () => {
        const set = listeners.get(conversationId);
        set?.delete(fn);
        if (set && set.size === 0) listeners.delete(conversationId);
    };
}

// Publish via NOTIFY using a shared pg pool.
export async function publishChatEvent(payload: ChatEventPayload): Promise<void> {
    const g = globalThis as unknown as { __chatPubPool?: Pool };
    const pool: Pool =
        g.__chatPubPool ?? new Pool({ connectionString: realtimeConnectionString() });
    g.__chatPubPool = pool;
    await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(payload)]);
}
