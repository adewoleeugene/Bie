"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function ProjectError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <Card className="max-w-md w-full">
                <CardContent className="flex flex-col items-center text-center pt-6 space-y-4">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                    <h2 className="text-xl font-semibold">Project error</h2>
                    <p className="text-sm text-muted-foreground">
                        Failed to load project data. It may have been deleted or you may not have access.
                    </p>
                    <Button onClick={() => reset()}>Try again</Button>
                </CardContent>
            </Card>
        </div>
    );
}
