"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, declineInvite } from "@/actions/invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function InviteConfirm({
    token,
    workspaceName,
    projectName,
    roleLabel,
    inviterName,
}: {
    token: string;
    workspaceName: string;
    projectName?: string | null;
    roleLabel: string;
    inviterName?: string | null;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [action, setAction] = useState<"accept" | "decline" | null>(null);

    const target = projectName ?? workspaceName;

    const handleAccept = () => {
        setAction("accept");
        startTransition(async () => {
            const result = await acceptInvite(token);
            if (result.success) {
                toast.success(`You've joined ${target}`);
                router.push("/dashboard");
                router.refresh();
            } else {
                toast.error(result.error || "Couldn't accept this invite");
                setAction(null);
            }
        });
    };

    const handleDecline = () => {
        setAction("decline");
        startTransition(async () => {
            await declineInvite(token);
            toast.success("Invite declined");
            router.push("/dashboard");
        });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Join {target}</CardTitle>
                    <CardDescription>
                        {inviterName ? `${inviterName} invited you` : "You've been invited"}
                        {projectName
                            ? ` to the ${projectName} project in ${workspaceName}`
                            : ` to the ${workspaceName} workspace`}
                        {" "}as {roleLabel}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Accept to gain access, or decline if you weren&apos;t expecting this.
                    </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={handleAccept} disabled={isPending}>
                        {action === "accept" ? "Joining..." : "Accept invite"}
                    </Button>
                    <Button variant="outline" onClick={handleDecline} disabled={isPending}>
                        {action === "decline" ? "Declining..." : "Decline"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
