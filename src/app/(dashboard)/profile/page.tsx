import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserProfileView } from "@/components/users/user-profile";

export const metadata: Metadata = {
    title: "Your Profile",
};

/**
 * The signed-in user's own profile at a stable, canonical `/profile` URL —
 * renders in place (no redirect to `/users/[id]`) so the address bar stays
 * `/profile`. Others' profiles still live at `/users/[id]`.
 */
export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user?.email) redirect("/login");

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) redirect("/login");

    return <UserProfileView userId={user.id} />;
}
