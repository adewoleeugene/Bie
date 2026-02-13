import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProjectCalendar } from "@/components/tasks/project-calendar";

export default async function CalendarPage({
    params,
}: {
    params: { projectId: string };
}) {
    const session = await auth();
    if (!session?.user?.email) redirect("/login");

    // Fetch tasks
    const tasks = await db.task.findMany({
        where: {
            projectId: params.projectId,
            status: { not: "ARCHIVED" },
            dueDate: { not: null },
        },
        include: {
            assignees: { include: { user: true } },
            project: true,
            sprint: true,
            subtasks: {
                include: {
                    assignees: { include: { user: true } }
                }
            },
        },
        orderBy: { dueDate: "asc" }
    });

    // Transform dates to strings to avoid serialization issues if passed to client component directly? (Next.js handles Date objects in server components props usually fine in recent versions, but safe to verify. ACTUALLY client components props need to be serializable. Date objects are serializable to ISO string by Next.js automatically? No, they trigger warnings often. It's safer to map them or use a transform.)
    // However, Prisma returns Date objects. Next.js App Router serializes them.
    // Let's assume it works. If not, I'll map to strings.

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b bg-white dark:bg-neutral-950 px-6 py-3">
                <h1 className="text-xl font-semibold">Calendar</h1>
            </div>
            <div className="flex-1 overflow-auto p-6">
                <ProjectCalendar tasks={tasks as any} />
            </div>
        </div>
    );
}
