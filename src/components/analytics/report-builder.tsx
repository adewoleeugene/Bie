"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Plus, X, Download, GripVertical } from "lucide-react";
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ReportWidget {
    id: string;
    label: string;
    description: string;
}

const AVAILABLE_WIDGETS: ReportWidget[] = [
    { id: "overview", label: "Overview Metrics", description: "Total tasks, completion rate, active sprints" },
    { id: "completion-trend", label: "Task Completion Trend", description: "Daily/weekly completion line chart" },
    { id: "status-distribution", label: "Status Distribution", description: "Pie chart of task statuses" },
    { id: "priority-breakdown", label: "Priority Breakdown", description: "Tasks by priority level" },
    { id: "sprint-velocity", label: "Sprint Velocity", description: "Tasks completed per sprint" },
    { id: "sprint-burndown", label: "Sprint Burndown", description: "Remaining work over sprint duration" },
    { id: "sprint-health", label: "Sprint Health", description: "On track / at risk / behind indicators" },
    { id: "team-productivity", label: "Team Productivity", description: "Tasks completed per team member" },
    { id: "project-progress", label: "Project Progress", description: "Completion percentage per project" },
    { id: "peak-hours", label: "Peak Productivity Hours", description: "When most work gets done" },
    { id: "forecast", label: "Completion Forecast", description: "Predicted completion dates" },
    { id: "bottlenecks", label: "Bottleneck Detection", description: "Stale reviews, overloaded members" },
    { id: "resource-allocation", label: "Resource Allocation", description: "Team workload distribution" },
];

function SortableWidget({ widget, onRemove }: { widget: ReportWidget; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: widget.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 rounded-lg border px-3 py-2 bg-background"
        >
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{widget.label}</p>
                <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
            </div>
            <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

interface ReportBuilderProps {
    onGenerate?: (widgetIds: string[]) => void;
}

export function ReportBuilder({ onGenerate }: ReportBuilderProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedWidgets, setSelectedWidgets] = useState<ReportWidget[]>([
        AVAILABLE_WIDGETS[0], // overview
        AVAILABLE_WIDGETS[1], // completion-trend
        AVAILABLE_WIDGETS[2], // status-distribution
        AVAILABLE_WIDGETS[4], // sprint-velocity
        AVAILABLE_WIDGETS[7], // team-productivity
    ]);
    const [addOpen, setAddOpen] = useState(false);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const selectedIds = new Set(selectedWidgets.map((w) => w.id));
    const availableToAdd = AVAILABLE_WIDGETS.filter((w) => !selectedIds.has(w.id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = selectedWidgets.findIndex((w) => w.id === active.id);
        const newIndex = selectedWidgets.findIndex((w) => w.id === over.id);
        setSelectedWidgets(arrayMove(selectedWidgets, oldIndex, newIndex));
    };

    const handleRemove = (widgetId: string) => {
        setSelectedWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    };

    const handleAdd = (widget: ReportWidget) => {
        setSelectedWidgets((prev) => [...prev, widget]);
    };

    const handleExport = () => {
        const ids = selectedWidgets.map((w) => w.id);
        if (onGenerate) {
            onGenerate(ids);
        }
        // Store the report config in localStorage for the analytics page to pick up
        localStorage.setItem("custom-report-config", JSON.stringify(ids));
        setDialogOpen(false);
    };

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <FileText className="mr-1.5 h-4 w-4" />
                    Custom Report
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Custom Report Builder</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 max-h-[400px] overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Drag to reorder. {selectedWidgets.length} widget{selectedWidgets.length !== 1 ? "s" : ""} selected.
                        </p>
                        <Dialog open={addOpen} onOpenChange={setAddOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={availableToAdd.length === 0}>
                                    <Plus className="mr-1 h-3 w-3" /> Add Widget
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Widget</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {availableToAdd.map((widget) => (
                                        <button
                                            key={widget.id}
                                            onClick={() => {
                                                handleAdd(widget);
                                                setAddOpen(false);
                                            }}
                                            className="w-full text-left rounded-lg border px-3 py-2 hover:bg-muted transition-colors"
                                        >
                                            <p className="text-sm font-medium">{widget.label}</p>
                                            <p className="text-xs text-muted-foreground">{widget.description}</p>
                                        </button>
                                    ))}
                                    {availableToAdd.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">All widgets added.</p>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={selectedWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {selectedWidgets.map((widget) => (
                                    <SortableWidget
                                        key={widget.id}
                                        widget={widget}
                                        onRemove={() => handleRemove(widget.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {selectedWidgets.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No widgets selected. Click "Add Widget" to get started.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={handleExport} disabled={selectedWidgets.length === 0}>
                        <Download className="mr-1.5 h-4 w-4" />
                        Generate Report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
