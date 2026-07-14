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

    // Parse due date: today, tomorrow, "by/on/before friday", "next friday"
    const today = new Date();
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const weekdayMatch = title.match(/\b(?:(next)\s+|(?:by|on|before|due)\s+)(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

    if (title.match(/\b(?:by |due )?today\b/i)) {
        dueDate = today;
        title = title.replace(/\b(?:by |due )?today\b/i, "").trim();
    } else if (title.match(/\b(?:by |due )?tomorrow\b/i)) {
        const tmrw = new Date(today);
        tmrw.setDate(tmrw.getDate() + 1);
        dueDate = tmrw;
        title = title.replace(/\b(?:by |due )?tomorrow\b/i, "").trim();
    } else if (weekdayMatch) {
        const target = weekdays.indexOf(weekdayMatch[2].toLowerCase());
        let daysAhead = (target - today.getDay() + 7) % 7;
        // "by friday" on a Friday means today; "next friday" always means a week out
        if (weekdayMatch[1] && daysAhead === 0) daysAhead = 7;
        const due = new Date(today);
        due.setDate(due.getDate() + daysAhead);
        dueDate = due;
        title = title.replace(weekdayMatch[0], "").trim();
    }

    title = title.replace(/\s{2,}/g, " ").trim();

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
