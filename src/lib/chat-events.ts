import { Client, Pool } from "pg";

// Cross-instance pub/sub for chat using Postgres LISTEN/NOTIFY.
// Channel: "chat_messages". Payload: JSON { conversationId, message }.

type Listener = (payload: ChatEventPayload) => void;

export interface ChatEventPayload {
    conversationId: string;
    message: {
        id: string;
        body: string;
        senderId: string;
        createdAt: string;
        sender: { id: string; name: string | null; image: string | null };
    };
}

const CHANNEL = "chat_messages";

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
        const client = new Client({ connectionString: process.env.DATABASE_URL });
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
        g.__chatPubPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
    g.__chatPubPool = pool;
    await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(payload)]);
}
