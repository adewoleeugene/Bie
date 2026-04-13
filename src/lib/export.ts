import { TaskWithRelations } from "@/types/task";
import { format } from "date-fns";
import { DatabasePropertyType } from "@prisma/client";

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

    downloadCSV(csvContent, filename);
}

interface DbExportProperty {
    id: string;
    name: string;
    type: DatabasePropertyType;
}

interface DbExportValue {
    propertyId: string;
    value: unknown;
}

interface DbExportRow {
    id: string;
    values: DbExportValue[];
}

export function exportDatabaseToCSV(
    properties: DbExportProperty[],
    rows: DbExportRow[],
    filename = "database-export.csv",
) {
    const headers = properties.map((p) => p.name);

    const csvRows = rows.map((row) => {
        return properties.map((prop) => {
            const val = row.values.find((v) => v.propertyId === prop.id);
            const raw = val?.value;
            return `"${formatCellValue(raw, prop.type).replace(/"/g, '""')}"`;
        });
    });

    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    downloadCSV(csvContent, filename);
}

function formatCellValue(value: unknown, type: DatabasePropertyType): string {
    if (value == null || value === "") return "";

    switch (type) {
        case "CHECKBOX":
            return value ? "Yes" : "No";
        case "MULTI_SELECT":
            return Array.isArray(value) ? value.join("; ") : String(value);
        case "PERSON":
            if (Array.isArray(value)) {
                return value.map((p: any) => p.name || p.email || p).join("; ");
            }
            return String(value);
        case "DATE":
            try {
                return format(new Date(value as string), "yyyy-MM-dd");
            } catch {
                return String(value);
            }
        default:
            return String(value);
    }
}

function downloadCSV(csvContent: string, filename: string) {
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
