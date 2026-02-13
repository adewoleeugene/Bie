"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { WikiNamespace } from "@prisma/client";

export type SearchResult = {
    type: "page" | "task";
    id: string;
    title: string;
    subtitle?: string;
    url: string;
    meta?: any;
};

export async function globalSearch(query: string): Promise<{
    success: boolean;
    results?: SearchResult[];
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    select: { organizationId: true },
                },
            },
        });

        if (!user || user.memberships.length === 0) {
            return { success: false, error: "No organization found" };
        }

        const organizationId = user.memberships[0].organizationId;

        if (!query || query.length < 2) {
            return { success: true, results: [] };
        }

        // Parallel search
        const [wikiPages, tasks] = await Promise.all([
            db.wikiPage.findMany({
                where: {
                    organizationId,
                    title: {
                        contains: query,
                        mode: "insensitive",
                    },
                },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    namespace: true,
                    projectId: true,
                    updatedAt: true,
                },
            }),
            db.task.findMany({
                where: {
                    organizationId,
                    title: {
                        contains: query,
                        mode: "insensitive",
                    },
                },
                take: 5,
                include: {
                    project: {
                        select: { name: true },
                    },
                    sprint: {
                        select: { name: true },
                    },
                },
            }),
        ]);

        const results: SearchResult[] = [];

        // Process Wiki Pages
        wikiPages.forEach((page) => {
            let url = "/wiki";
            let subtitle = "Company Wiki";

            if (page.namespace === WikiNamespace.PROJECT && page.projectId) {
                url = `/projects/${page.projectId}/wiki/${page.id}`;
                subtitle = "Project Wiki";
            } else {
                url = `/wiki/${page.id}`;
            }

            results.push({
                type: "page",
                id: page.id,
                title: page.title,
                subtitle,
                url,
            });
        });

        // Process Tasks
        tasks.forEach((task) => {
            // Assuming tasks are opened in a side sheet or specific page. 
            // Current implementation uses side sheet on board/list views.
            // To link directly to a task, we might need a specific route or query param?
            // For now, let's link to the project board with task query param if feasible, 
            // or just /projects/[id]?taskId=[id] if we implement that handling.
            // Or simply /projects/[id] and let user find it? 
            // Better: we likely need a task detail page or a way to open sheet via URL.
            // Let's assume /projects/[id]?task=[taskId] handles opening the sheet.

            const url = task.projectId
                ? `/projects/${task.projectId}?task=${task.id}`
                : `/tasks/${task.id}`; // Fallback if we have global task list?

            let subtitle = task.project?.name || "No Project";
            if (task.sprint) {
                subtitle += ` • ${task.sprint.name}`;
            }
            subtitle += ` • ${task.status}`;

            results.push({
                type: "task",
                id: task.id,
                title: task.title,
                subtitle,
                url,
            });
        });

        return { success: true, results };
    } catch (error) {
        console.error("Search error:", error);
        return { success: false, error: "Failed to perform search" };
    }
}
