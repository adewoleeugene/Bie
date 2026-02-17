import { TaskPriority, TaskStatus } from "@prisma/client";

export interface ParsedTask {
    title: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: Date;
    description?: string;
    projectId?: string;
    sprintId?: string;
    assigneeIds: string[];
}

export function parseTaskInput(text: string): ParsedTask {
    // Simple regex-based NLP parser
    let title = text;
    let priority: TaskPriority = "P2"; // Default
    let dueDate: Date | undefined;

    // Parse priority: P0, P1, P2, P3 or !high, !medium, !low
    if (text.match(/\bP[0-3]\b/i)) {
        const match = text.match(/\bP([0-3])\b/i);
        if (match) {
            priority = `P${match[1]}` as TaskPriority;
            title = title.replace(match[0], "").trim();
        }
    } else if (text.includes("!high")) {
        priority = "P0";
        title = title.replace("!high", "").trim();
    } else if (text.includes("!medium")) {
        priority = "P2";
        title = title.replace("!medium", "").trim();
    } else if (text.includes("!low")) {
        priority = "P3";
        title = title.replace("!low", "").trim();
    }

    // Parse due date: today, tomorrow, next week, friday
    const today = new Date();
    if (text.match(/\btoday\b/i)) {
        dueDate = today;
        title = title.replace(/today/i, "").trim();
    } else if (text.match(/\btomorrow\b/i)) {
        const tmrw = new Date(today);
        tmrw.setDate(tmrw.getDate() + 1);
        dueDate = tmrw;
        title = title.replace(/tomorrow/i, "").trim();
    } else if (text.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)) {
        // Basic next day parsing logic could go here
        // For now, let's just set next week (+7 days)
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        dueDate = nextWeek;
    }

    // Determine status - usually TODO initially
    const status: TaskStatus = "TODO";

    // We could add more complex parsing for #project and @assignee here
    // For now, returning basic parsed struct

    return {
        title,
        priority,
        status,
        dueDate,
        assigneeIds: [],
    };
}
