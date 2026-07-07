"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// A "client-side exception" white screen right after a deploy is almost always a
// stale JS chunk: the browser is holding old HTML that points at chunk files the
// new deploy no longer serves. These are the messages browsers/Next emit for it.
const CHUNK_ERROR_RE =
    /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Ideally log to error reporting service like Sentry
        console.error(error);

        // Auto-recover from stale-chunk errors by pulling fresh HTML + chunks.
        // The timestamp guard reloads at most once per 10s so a persistent error
        // that merely looks chunk-like can't spin into an infinite reload loop.
        const isChunkError =
            CHUNK_ERROR_RE.test(error?.message ?? "") ||
            CHUNK_ERROR_RE.test(error?.name ?? "");
        if (isChunkError && typeof window !== "undefined") {
            const KEY = "bie:last-chunk-reload";
            const last = Number(window.sessionStorage.getItem(KEY) || 0);
            if (Date.now() - last > 10_000) {
                window.sessionStorage.setItem(KEY, String(Date.now()));
                window.location.reload();
            }
        }
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
                    <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        We apologize for the inconvenience. An unexpected error occurred.
                    </p>
                    <div className="flex gap-4">
                        <Button onClick={() => reset()}>Try again</Button>
                        <Button variant="outline" onClick={() => window.location.href = "/"}>
                            Return Home
                        </Button>
                    </div>
                </div>
            </body>
        </html>
    );
}
