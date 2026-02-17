"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
    data: any;
    filename?: string;
}

export function ExportButton({ data, filename = "analytics-export" }: ExportButtonProps) {
    const handleExport = () => {
        try {
            if (!data) {
                toast.error("No data to export");
                return;
            }

            // Convert object to JSON string
            const jsonString = JSON.stringify(data, null, 2);

            // Create detailed CSV structure based on data type if possible, 
            // but for generic export, JSON is safest or flattened CSV.
            // Let's do JSON for now as it handles nested structures better.
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filename}-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Export successful!");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export data");
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
        </Button>
    );
}
