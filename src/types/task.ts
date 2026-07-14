import { Prisma } from "@prisma/client";

// Task list shape — relations are trimmed to what boards/lists render.
// Must stay in sync with the `include` in getTasks (src/actions/task.ts).
export type TaskWithRelations = Prisma.TaskGetPayload<{
    include: {
        assignees: {
            select: {
                userId: true;
                user: { select: { id: true; name: true; email: true; image: true } };
            };
        };
        project: { select: { id: true; name: true } };
        sprint: { select: { id: true; name: true; status: true } };
        statusColumn: true;
        parentTask: { select: { id: true; title: true } };
        subtasks: {
            select: {
                id: true;
                title: true;
                status: true;
                priority: true;
                sortOrder: true;
                statusColumn: true;
                assignees: {
                    select: {
                        userId: true;
                        user: { select: { id: true; name: true; email: true; image: true } };
                    };
                };
            };
        };
    };
}> & {
    depth?: number;
};

// Simplified task type for components
export interface TaskDisplay {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    sortOrder: number;
    assignees: Array<{
        user: {
            id: string;
            name: string;
            image: string | null;
        };
    }>;
    project?: {
        id: string;
        name: string;
    } | null;
}
