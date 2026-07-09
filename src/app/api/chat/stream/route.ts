import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribe } from "@/lib/chat-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response("Unauthorized", { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
        return new Response("Missing conversationId", { status: 400 });
    }

    // Verify the user is a member of this conversation
    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) return new Response("Unauthorized", { status: 401 });

    const membership = await db.conversationMember.findUnique({
        where: {
            conversationId_userId: { conversationId, userId: user.id },
        },
        select: { userId: true },
    });
    if (!membership) return new Response("Forbidden", { status: 403 });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;
            const safeEnqueue = (chunk: Uint8Array) => {
                if (closed) return;
                try {
                    controller.enqueue(chunk);
                } catch {
                    /* controller already closed */
                }
            };

            // Initial comment so the connection opens immediately
            safeEnqueue(encoder.encode(": connected\n\n"));

            const unsubscribe = await subscribe(conversationId, (payload) => {
                safeEnqueue(
                    encoder.encode(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`)
                );
            });

            // Heartbeat to keep proxies from killing the connection
            const ping = setInterval(() => {
                safeEnqueue(encoder.encode(": ping\n\n"));
            }, 25000);

            const cleanup = () => {
                if (closed) return;
                closed = true;
                clearInterval(ping);
                unsubscribe();
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            };

            req.signal.addEventListener("abort", cleanup);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
