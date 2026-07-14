"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTasks,
    getTask,
    createTask,
    updateTask,
    markTaskInProgressForFocus,
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
        // Server-action fetches can be rejected at the edge under load (503)
        // before reaching the app. Keep retrying in the background so a board
        // opened during a throttle window fills in instead of staying blank.
        retry: 5,
        refetchInterval: (query) => (query.state.status === "error" ? 15_000 : false),
    });
}

export function useTask(taskId: string) {
    return useQuery({
        queryKey: ["task", taskId],
        queryFn: () => getTask(taskId),
        enabled: !!taskId,
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

export function useMarkTaskInProgressForFocus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (taskId: string) => markTaskInProgressForFocus(taskId),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }
        },
    });
}

export function useUpdateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateTaskInput) => updateTask(input),
        onMutate: async (input) => {
            // Optimistic update across every task list (keys are
            // ["tasks", projectId, sprintId], so prefix-match them all).
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const previousTasks = queryClient.getQueriesData<TaskWithRelations[]>({ queryKey: ["tasks"] });

            // Assignee toggles must reflect immediately too — build the new
            // assignee objects from the cached members list so the picker and
            // avatar chips update without waiting for the refetch.
            const members = queryClient.getQueryData<
                { id: string; name: string; email: string; image: string | null }[]
            >(["members"]);
            const optimisticAssignees =
                input.assigneeIds !== undefined
                    ? input.assigneeIds.map((userId) => {
                          const member = members?.find((m) => m.id === userId);
                          return {
                              userId,
                              user: {
                                  id: userId,
                                  name: member?.name ?? "",
                                  email: member?.email ?? "",
                                  image: member?.image ?? null,
                              },
                          };
                      })
                    : undefined;

            queryClient.setQueriesData<TaskWithRelations[]>({ queryKey: ["tasks"] }, (old) => {
                if (!old) return old;
                return old.map((task) => {
                    if (task.id !== input.id) return task;

                    return {
                        ...task,
                        ...(optimisticAssignees !== undefined ? { assignees: optimisticAssignees } : {}),
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
        onSuccess: (result, input) => {
            if (result.success) {
                // Refetching every open task list on every inline edit is what
                // floods the backend. Only membership changes (project/sprint
                // moves, which alter which filtered lists contain the task)
                // need a refetch — scalar edits and assignee toggles are
                // already patched into the caches optimistically; fold the
                // server's task (which carries server-resolved fields like
                // statusColumnId) into the caches in place.
                const structural =
                    input.projectId !== undefined ||
                    input.sprintId !== undefined;
                if (structural) {
                    queryClient.invalidateQueries({ queryKey: ["tasks"] });
                } else if (result.data) {
                    const updated = result.data;
                    queryClient.setQueriesData<TaskWithRelations[]>({ queryKey: ["tasks"] }, (old) => {
                        if (!old) return old;
                        return old.map((task) => (task.id === updated.id ? { ...task, ...updated } : task));
                    });
                }
                queryClient.invalidateQueries({ queryKey: ["task", input.id] });
                // Silent success — inline edits (assignee toggle, status, dates)
                // fire this hook constantly; toasting on every one is noisy.
            } else {
                toast.error(result.error);
            }
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            context?.previousTasks?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
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
                queryClient.invalidateQueries({ queryKey: ["task"] });
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
            // Optimistic update across every task list (keys are
            // ["tasks", projectId, sprintId], so prefix-match them all).
            await queryClient.cancelQueries({ queryKey: ["tasks"] });
            const previousTasks = queryClient.getQueriesData<TaskWithRelations[]>({ queryKey: ["tasks"] });

            // Input is array of { id, status, statusColumnId, sortOrder }
            queryClient.setQueriesData<TaskWithRelations[]>({ queryKey: ["tasks"] }, (old) => {
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
            // Drags fire this constantly and the input already carries the full
            // placement (status, column, sortOrder) which onMutate applied to
            // the caches — refetching every open task list after each drop is
            // pure amplification. Only re-sync from the server when it refused.
            if (!result.success) {
                toast.error(result.error);
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }
        },
        onError: (_error, _variables, context) => {
            // Rollback on error, then re-sync from the server.
            context?.previousTasks?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            toast.error("Failed to reorder tasks");
        },
    });
}
