"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    listProjectSharing,
    removeProjectMember,
    setProjectVisibility,
    updateProjectMemberRole,
} from "@/actions/project";
import { CreateProjectInput, UpdateProjectInput, DeleteProjectInput } from "@/lib/validators/project";
import { ProjectRole, ProjectVisibility } from "@prisma/client";
import { toast } from "sonner";

export function useProjects() {
    return useQuery({
        queryKey: ["projects"],
        queryFn: () => getProjects(),
    });
}

export function useProject(id: string) {
    return useQuery({
        queryKey: ["project", id],
        queryFn: () => getProject(id),
        enabled: !!id,
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateProjectInput) => createProject(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["projects"] });
                toast.success("Project created successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to create project");
        },
    });
}

export function useUpdateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateProjectInput) => updateProject(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["projects"] });
                if (result.data) {
                    queryClient.invalidateQueries({ queryKey: ["project", result.data.id] });
                }
                toast.success("Project updated successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to update project");
        },
    });
}

export function useDeleteProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: DeleteProjectInput) => deleteProject(input),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["projects"] });
                toast.success("Project deleted successfully");
            } else {
                toast.error(result.error);
            }
        },
        onError: () => {
            toast.error("Failed to delete project");
        },
    });
}

export function useProjectSharing(projectId: string, enabled = true) {
    return useQuery({
        queryKey: ["project-sharing", projectId],
        queryFn: () => listProjectSharing(projectId),
        enabled: !!projectId && enabled,
    });
}

export function useSetProjectVisibility(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (visibility: ProjectVisibility) => setProjectVisibility(projectId, visibility),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-sharing", projectId] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });
}

export function useUpdateProjectMemberRole(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
            updateProjectMemberRole(projectId, userId, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-sharing", projectId] });
        },
    });
}

export function useRemoveProjectMember(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => removeProjectMember(projectId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-sharing", projectId] });
        },
    });
}
