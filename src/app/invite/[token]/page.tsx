import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptInviteByTokenForUser } from "@/lib/workspaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InvitePage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const invitePath = `/invite/${token}`;
    const session = await auth();

    if (!session?.user?.email) {
        redirect(`/login?callbackUrl=${encodeURIComponent(invitePath)}`);
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, name: true, email: true },
    });

    if (!user) {
        redirect(`/login?callbackUrl=${encodeURIComponent(invitePath)}`);
    }

    const result = await db.$transaction((tx) =>
        acceptInviteByTokenForUser(tx, token, user)
    );

    if (result.success) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Invite unavailable</CardTitle>
                    <CardDescription>{result.error}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Button asChild>
                        <Link href="/dashboard">Go to dashboard</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/login">Use another account</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

