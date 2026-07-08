"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTask,
    bulkReorderTasks,
    addTasksToSprint,
    getTaskStatusColumns,
    createTaskStatusColumn,
    deleteTaskStatusColumn,
} from "@/actions/task";
import {
    CreateTaskInput,
    UpdateTaskInput,
    DeleteTaskInput,
    ReorderTaskInput,
    BulkReorderTasksInput,
    CreateTaskStatusColumnInput,
    DeleteTaskStatusColumnInput,
} from "@/lib/validators/task";
import { TaskWithRelations } from "@/types/task";
import { toast } from "sonner";

export function useTasks(projectId?: string | null, options?: { sprintId?: string | null }) {
    return useQuery({
        queryKey: ["tasks", projectId, options?.sprintId],
        queryFn: () => getTasks(projectId, options),
    });
}

export function useTaskStatusColumns(projectId?: string | null) {
    return useQuery({
        queryKey: ["task-status-columns", projectId],
        queryFn: () => getTaskStatusColumns(projectId),
    });
}

export function useCreateTaskStatusColumn() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateTaskStatusColumnInput) => createTaskStatusColumn(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["task-status-columns"] });
                toast.success("Column created successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to create column");
        },
    });
}

export function useDeleteTaskStatusColumn() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: DeleteTaskStatusColumnInput) => deleteTaskStatusColumn(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["task-status-columns"] });
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Column deleted successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to delete column");
        },
    });
}

export function useCreateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateTaskInput) => createTask(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Task created successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to create task");
        },
    });
}

export function useUpdateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateTaskInput) => updateTask(input),
        onMutate: async (input) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(["tasks"]);

            queryClient.setQueryData<TaskWithRelations[]>(["tasks"], (old) => {
                if (!old) return old;
                return old.map((task) => {
                    if (task.id !== input.id) return task;

                    return {
                        ...task,
                        ...(input.title !== undefined ? { title: input.title } : {}),
                        ...(input.description !== undefined ? { description: input.description } : {}),
                        ...(input.status !== undefined ? { status: input.status } : {}),
                        ...(input.statusColumnId !== undefined ? { statusColumnId: input.statusColumnId } : {}),
                        ...(input.priority !== undefined ? { priority: input.priority } : {}),
                        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
                        ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
                        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
                        ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
                        ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
                        ...(input.labels !== undefined ? { labels: input.labels } : {}),
                    };
                });
            });

            return { previousTasks };
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                // Silent success — inline edits (assignee toggle, status, dates)
                // fire this hook constantly; toasting on every one is noisy.
            } else {
                toast.error(result.error);
            }
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            if (context?.previousTasks) {
                queryClient.setQueryData(["tasks"], context.previousTasks);
            }
            toast.error("Failed to update task");
        },
    });
}

export function useDeleteTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: DeleteTaskInput) => deleteTask(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Task deleted successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to delete task");
        },
    });
}

export function useAddTasksToSprint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { sprintId: string; taskIds: string[] }) => addTasksToSprint(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success(`Added ${result.data?.count ?? 0} task(s) to sprint`);
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to add tasks to sprint");
        },
    });
}

export function useReorderTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: ReorderTaskInput) => reorderTask(input),
        onMutate: async (input) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(["tasks"]);

            queryClient.setQueryData<TaskWithRelations[]>(["tasks"], (old) => {
                if (!old) return old;
                return old.map((task) =>
                    task.id === input.id
                        ? { ...task, status: input.status, statusColumnId: input.statusColumnId ?? task.statusColumnId, sortOrder: input.sortOrder }
                        : task
                );
            });

            return { previousTasks };
        },
        onSuccess: (result) => {
            if (!result.success) {
                toast.error(result.error);
            }
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            if (context?.previousTasks) {
                queryClient.setQueryData(["tasks"], context.previousTasks);
            }
            toast.error("Failed to reorder task");
        },
    });
}

export function useBulkReorderTasks() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: BulkReorderTasksInput) => bulkReorderTasks(input),
        onMutate: async (input) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(["tasks"]);

            // Input is array of { id, status, sortOrder }
            queryClient.setQueryData<TaskWithRelations[]>(["tasks"], (old) => {
                if (!old) return old;
                return old.map((task) => {
                    const update = input.tasks.find(t => t.id === task.id);
                    if (update) {
                        return { ...task, ...update };
                    }
                    return task;
                });
            });

            return { previousTasks };
        },
        onSuccess: (result) => {
            if (!result.success) {
                toast.error(result.error);
            }
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            if (context?.previousTasks) {
                queryClient.setQueryData(["tasks"], context.previousTasks);
            }
            toast.error("Failed to reorder tasks");
        },
    });
}
