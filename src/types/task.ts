import { Prisma } from "@prisma/client";

// Task with all relations
export type TaskWithRelations = Prisma.TaskGetPayload<{
    include: {
        assignees: {
            include: {
                user: true;
            };
        };
        project: true;
        sprint: true;
        parentTask: true;
        subtasks: {
            include: {
                assignees: {
                    include: {
                        user: true;
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
