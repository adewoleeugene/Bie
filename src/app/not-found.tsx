"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="flex h-screen flex-col items-center justify-center space-y-4 p-8 text-center bg-background">
            <div className="rounded-full bg-muted p-4">
                <FileQuestion className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Page Not Found</h2>
            <p className="text-muted-foreground max-w-sm">
                Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
            </p>
            <div className="flex gap-4">
                <Link href="/">
                    <Button>Return Home</Button>
                </Link>
                <Button variant="outline" onClick={() => router.back()}>
                    Go Back
                </Button>
            </div>
        </div>
    );
}
