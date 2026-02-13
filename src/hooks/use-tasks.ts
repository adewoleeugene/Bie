"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, createTask, updateTask, deleteTask, reorderTask } from "@/actions/task";
import { CreateTaskInput, UpdateTaskInput, DeleteTaskInput, ReorderTaskInput } from "@/lib/validators/task";
import { toast } from "sonner";

export function useTasks(projectId?: string, options?: { sprintId?: string | null }) {
    return useQuery({
        queryKey: ["tasks", projectId, options?.sprintId],
        queryFn: () => getTasks(projectId, options),
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
            const previousTasks = queryClient.getQueryData(["tasks"]);

            queryClient.setQueryData(["tasks"], (old: any) => {
                if (!old) return old;
                return old.map((task: any) =>
                    task.id === input.id ? { ...task, ...input } : task
                );
            });

            return { previousTasks };
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Task updated successfully");
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

export function useReorderTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: ReorderTaskInput) => reorderTask(input),
        onMutate: async (input) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const previousTasks = queryClient.getQueryData(["tasks"]);

            queryClient.setQueryData(["tasks"], (old: any) => {
                if (!old) return old;
                return old.map((task: any) =>
                    task.id === input.id
                        ? { ...task, status: input.status, sortOrder: input.sortOrder }
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
