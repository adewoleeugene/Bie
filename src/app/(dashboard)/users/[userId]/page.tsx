import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPagesMentioning } from "@/actions/wiki";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface PageProps {
    params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: PageProps) {
    const { userId } = await params;

    const session = await auth();
    if (!session?.user?.email) return notFound();

    const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, createdAt: true },
    });
    if (!user) return notFound();

    const { data: pages } = await getPagesMentioning("USER", userId);

    return (
        <div className="mx-auto max-w-3xl p-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-lg">
                        {(user.name || user.email || "?").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-2xl font-semibold">{user.name || "Unnamed"}</h1>
                    <p className="text-sm text-neutral-500">{user.email}</p>
                </div>
            </div>

            <section className="mt-10">
                <h2 className="text-sm font-semibold uppercase text-neutral-500">
                    Mentioned in
                </h2>
                {pages.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-500 italic">
                        Not mentioned in any wiki pages yet.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-1">
                        {pages.map((p) => (
                            <li key={p.id}>
                                <Link
                                    href={`/wiki/${p.id}`}
                                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                >
                                    <span className="truncate font-medium">{p.title}</span>
                                    <span className="ml-2 shrink-0 text-xs text-neutral-500">
                                        {formatDistanceToNow(new Date(p.updatedAt), {
                                            addSuffix: true,
                                        })}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
