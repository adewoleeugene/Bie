"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acceptInviteByTokenForUser } from "@/lib/workspaces";

async function currentUser() {
    const session = await auth();
    if (!session?.user?.email) return null;

    return db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, name: true, email: true },
    });
}

export async function acceptInvite(token: string) {
    const user = await currentUser();
    if (!user) {
        return { success: false, error: "You need to sign in to accept this invite." };
    }

    return db.$transaction((tx) => acceptInviteByTokenForUser(tx, token, user));
}

export async function declineInvite(token: string) {
    const user = await currentUser();
    if (!user) {
        return { success: false, error: "You need to sign in to respond to this invite." };
    }

    const invitation = await db.organizationInvitation.findUnique({
        where: { token },
        select: { id: true, email: true },
    });

    // Only personal email invites are consumed on decline; shareable links stay open
    // for everyone else and simply aren't joined.
    if (invitation?.email && invitation.email === user.email?.toLowerCase().trim()) {
        await db.organizationInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
        });
    }

    return { success: true };
}
