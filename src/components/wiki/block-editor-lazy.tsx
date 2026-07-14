"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Client-only BlockEditor. BlockNote reads `window.matchMedia` during render
 * (usePrefersColorScheme in @blocknote/react), so rendering it on the server
 * throws "window is not defined" and aborts the page's SSR (React #419).
 * Import the editor from here — never from ./block-editor directly.
 */
export const BlockEditor = dynamic(
    () => import("./block-editor").then((m) => m.BlockEditor),
    {
        ssr: false,
        loading: () => (
            <div className="space-y-3 py-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
            </div>
        ),
    }
);
