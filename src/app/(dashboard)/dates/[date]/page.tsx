import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPagesMentioning } from "@/actions/wiki";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { Calendar } from "lucide-react";

interface PageProps {
    params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { date } = await params;
    return { title: `Date: ${date}` };
}

export default async function DatePage({ params }: PageProps) {
    const { date } = await params;

    const session = await auth();
    if (!session?.user?.email) return notFound();

    // Validate ISO date format YYYY-MM-DD.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound();

    const parsed = parseISO(date);
    if (isNaN(parsed.getTime())) return notFound();

    const { data: pages } = await getPagesMentioning("DATE", date);

    return (
        <div className="mx-auto max-w-3xl p-8">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">
                        {format(parsed, "EEEE, MMMM d, yyyy")}
                    </h1>
                    <p className="text-sm text-neutral-500">{date}</p>
                </div>
            </div>

            <section className="mt-10">
                <h2 className="text-sm font-semibold uppercase text-neutral-500">
                    Mentioned in
                </h2>
                {pages.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-500 italic">
                        No wiki pages reference this date.
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
