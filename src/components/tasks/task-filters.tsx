"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Filter, X, Plus, Calendar, UserCircle, Flag, CircleDot } from "lucide-react";
import { useMembers } from "@/hooks/use-members";

export interface TaskFilters {
    statuses: string[];
    priorities: string[];
    assigneeIds: string[];
    dateRange: {
        from?: string;
        to?: string;
    };
}

const EMPTY_FILTERS: TaskFilters = {
    statuses: [],
    priorities: [],
    assigneeIds: [],
    dateRange: {},
};

const STATUS_OPTIONS = [
    { value: "BACKLOG", label: "Backlog", color: "bg-neutral-400" },
    { value: "TODO", label: "To Do", color: "bg-blue-400" },
    { value: "IN_PROGRESS", label: "In Progress", color: "bg-amber-400" },
    { value: "IN_REVIEW", label: "In Review", color: "bg-purple-400" },
    { value: "DONE", label: "Done", color: "bg-green-400" },
];

const PRIORITY_OPTIONS = [
    { value: "P0", label: "P0 — Critical", color: "bg-red-500" },
    { value: "P1", label: "P1 — High", color: "bg-orange-400" },
    { value: "P2", label: "P2 — Medium", color: "bg-yellow-400" },
    { value: "P3", label: "P3 — Low", color: "bg-blue-300" },
];

interface TaskFiltersBarProps {
    filters: TaskFilters;
    onFiltersChange: (filters: TaskFilters) => void;
}

export function TaskFiltersBar({ filters, onFiltersChange }: TaskFiltersBarProps) {
    const { data: members } = useMembers();
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);

    const activeFilterCount =
        filters.statuses.length +
        filters.priorities.length +
        filters.assigneeIds.length +
        (filters.dateRange.from || filters.dateRange.to ? 1 : 0);

    const toggleArrayFilter = (key: "statuses" | "priorities" | "assigneeIds", value: string) => {
        const current = filters[key];
        const updated = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        onFiltersChange({ ...filters, [key]: updated });
    };

    const clearAll = () => onFiltersChange(EMPTY_FILTERS);

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Add Filter Button */}
            <Popover open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-1 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                    <div className="p-3 border-b">
                        <h4 className="text-sm font-semibold">Filters</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Narrow down tasks by properties</p>
                    </div>

                    {/* Status Filter */}
                    <div className="p-3 border-b">
                        <div className="flex items-center gap-2 mb-2">
                            <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">Status</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((status) => {
                                const isActive = filters.statuses.includes(status.value);
                                return (
                                    <button
                                        key={status.value}
                                        onClick={() => toggleArrayFilter("statuses", status.value)}
                                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${isActive
                                                ? "border-primary bg-primary/10 text-primary font-medium"
                                                : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                            }`}
                                    >
                                        <div className={`h-2 w-2 rounded-full ${status.color}`} />
                                        {status.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Priority Filter */}
                    <div className="p-3 border-b">
                        <div className="flex items-center gap-2 mb-2">
                            <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">Priority</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {PRIORITY_OPTIONS.map((priority) => {
                                const isActive = filters.priorities.includes(priority.value);
                                return (
                                    <button
                                        key={priority.value}
                                        onClick={() => toggleArrayFilter("priorities", priority.value)}
                                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${isActive
                                                ? "border-primary bg-primary/10 text-primary font-medium"
                                                : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                            }`}
                                    >
                                        <div className={`h-2 w-2 rounded-full ${priority.color}`} />
                                        {priority.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Assignee Filter */}
                    <div className="p-3 border-b">
                        <div className="flex items-center gap-2 mb-2">
                            <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">Assignee</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {members?.map((member: any) => {
                                const isActive = filters.assigneeIds.includes(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleArrayFilter("assigneeIds", member.id)}
                                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${isActive
                                                ? "border-primary bg-primary/10 text-primary font-medium"
                                                : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                            }`}
                                    >
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage src={member.image || undefined} />
                                            <AvatarFallback className="text-[8px]">
                                                {member.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {member.name}
                                    </button>
                                );
                            })}
                            {!members?.length && (
                                <p className="text-[11px] text-muted-foreground">No members</p>
                            )}
                        </div>
                    </div>

                    {/* Date Range Filter */}
                    <div className="p-3 border-b">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">Due Date Range</span>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                placeholder="From"
                                value={filters.dateRange.from || ""}
                                onChange={(e) =>
                                    onFiltersChange({
                                        ...filters,
                                        dateRange: { ...filters.dateRange, from: e.target.value || undefined },
                                    })
                                }
                                className="h-7 text-xs"
                            />
                            <span className="text-xs text-muted-foreground self-center">→</span>
                            <Input
                                type="date"
                                placeholder="To"
                                value={filters.dateRange.to || ""}
                                onChange={(e) =>
                                    onFiltersChange({
                                        ...filters,
                                        dateRange: { ...filters.dateRange, to: e.target.value || undefined },
                                    })
                                }
                                className="h-7 text-xs"
                            />
                        </div>
                    </div>

                    {/* Clear All */}
                    {activeFilterCount > 0 && (
                        <div className="p-2">
                            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-red-500 hover:text-red-600" onClick={clearAll}>
                                <X className="h-3 w-3 mr-1" />
                                Clear all filters
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {/* Active Filter Chips */}
            {filters.statuses.map((s) => {
                const opt = STATUS_OPTIONS.find((o) => o.value === s);
                return (
                    <Badge key={s} variant="secondary" className="gap-1 h-6 text-[11px] pl-1.5 pr-1">
                        <div className={`h-1.5 w-1.5 rounded-full ${opt?.color}`} />
                        {opt?.label}
                        <button onClick={() => toggleArrayFilter("statuses", s)} className="ml-0.5 hover:text-red-500">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                );
            })}
            {filters.priorities.map((p) => {
                const opt = PRIORITY_OPTIONS.find((o) => o.value === p);
                return (
                    <Badge key={p} variant="secondary" className="gap-1 h-6 text-[11px] pl-1.5 pr-1">
                        <div className={`h-1.5 w-1.5 rounded-full ${opt?.color}`} />
                        {opt?.label}
                        <button onClick={() => toggleArrayFilter("priorities", p)} className="ml-0.5 hover:text-red-500">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                );
            })}
            {filters.assigneeIds.map((id) => {
                const member = members?.find((m: any) => m.id === id);
                return (
                    <Badge key={id} variant="secondary" className="gap-1 h-6 text-[11px] pl-1.5 pr-1">
                        {member?.name || "Unknown"}
                        <button onClick={() => toggleArrayFilter("assigneeIds", id)} className="ml-0.5 hover:text-red-500">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                );
            })}
            {(filters.dateRange.from || filters.dateRange.to) && (
                <Badge variant="secondary" className="gap-1 h-6 text-[11px] pl-1.5 pr-1">
                    <Calendar className="h-3 w-3" />
                    {filters.dateRange.from || "..."} → {filters.dateRange.to || "..."}
                    <button
                        onClick={() => onFiltersChange({ ...filters, dateRange: {} })}
                        className="ml-0.5 hover:text-red-500"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            )}

            {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground px-2" onClick={clearAll}>
                    Clear all
                </Button>
            )}
        </div>
    );
}

/** Utility: apply filters to a task array client-side */
export function applyTaskFilters(tasks: any[], filters: TaskFilters): any[] {
    return tasks.filter((task) => {
        // Status filter
        if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
            return false;
        }

        // Priority filter
        if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
            return false;
        }

        // Assignee filter
        if (filters.assigneeIds.length > 0) {
            const taskAssigneeIds = task.assignees?.map((a: any) => a.userId || a.user?.id || a.id) || [];
            const hasMatch = filters.assigneeIds.some((id) => taskAssigneeIds.includes(id));
            if (!hasMatch) return false;
        }

        // Date range filter (due date)
        if (filters.dateRange.from || filters.dateRange.to) {
            if (!task.dueDate) return false;
            const dueDate = new Date(task.dueDate);
            if (filters.dateRange.from && dueDate < new Date(filters.dateRange.from)) return false;
            if (filters.dateRange.to && dueDate > new Date(filters.dateRange.to + "T23:59:59")) return false;
        }

        return true;
    });
}
