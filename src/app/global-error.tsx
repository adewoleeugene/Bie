"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
