import type { Metadata } from "next";
import { db } from "@/lib/db";
import { UserProfileView } from "@/components/users/user-profile";

interface PageProps {
    params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { userId } = await params;
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });
    return { title: user?.name ?? "User Profile" };
}

export default async function UserProfilePage({ params }: PageProps) {
    const { userId } = await params;
    return <UserProfileView userId={userId} />;
}
