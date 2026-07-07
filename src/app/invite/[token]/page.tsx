import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InviteConfirm } from "@/components/invite/invite-confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_LABELS: Record<string, string> = {
    OWNER: "an owner",
    ADMIN: "an admin",
    MEMBER: "a member",
    GUEST: "a guest",
    EDITOR: "an editor",
    VIEWER: "a viewer",
};

function roleLabel(role: string) {
    return ROLE_LABELS[role] ?? "a member";
}

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

    // Read-only preview — nothing is joined until the user confirms.
    const invitation = await db.organizationInvitation.findUnique({
        where: { token },
        include: {
            organization: { select: { name: true } },
            project: { select: { name: true } },
            invitedBy: { select: { name: true } },
        },
    });

    let error: string | null = null;
    if (!invitation) {
        error = "This invite link is invalid.";
    } else if (invitation.email && invitation.email !== user.email?.toLowerCase().trim()) {
        error = `This invite was sent to ${invitation.email}. Sign in with that email to accept it.`;
    } else if (invitation.expiresAt <= new Date()) {
        error = "This invite link has expired.";
    }

    if (error || !invitation) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Invite unavailable</CardTitle>
                        <CardDescription>{error}</CardDescription>
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

    const effectiveRole =
        invitation.scope === "PROJECT" ? invitation.projectRole ?? "EDITOR" : invitation.role;

    return (
        <InviteConfirm
            token={token}
            workspaceName={invitation.organization.name}
            projectName={invitation.scope === "PROJECT" ? invitation.project?.name : null}
            roleLabel={roleLabel(effectiveRole)}
            inviterName={invitation.invitedBy?.name}
        />
    );
}
