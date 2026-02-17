import { TaskWithRelations } from "@/types/task";
import { format } from "date-fns";

export function exportTasksToCSV(tasks: TaskWithRelations[], filename = "tasks-export.csv") {
    const headers = ["Title", "Status", "Priority", "Assignees", "Due Date", "Created At"];

    const rows = tasks.map(task => {
        const assignees = task.assignees.map(a => a.user.name).join("; ");
        const dueDate = task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "";
        const createdAt = format(new Date(task.createdAt), "yyyy-MM-dd HH:mm");

        return [
            `"${task.title.replace(/"/g, '""')}"`,
            task.status,
            task.priority,
            `"${assignees.replace(/"/g, '""')}"`,
            dueDate,
            createdAt
        ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
