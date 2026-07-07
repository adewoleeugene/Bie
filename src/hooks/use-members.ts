"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createInviteLink,
    createProjectInviteLink,
    getOrganizationMembers,
    inviteMember,
    inviteProjectMember,
    removeMember,
    updateMemberRole,
} from "@/actions/members";
import { OrgRole, ProjectRole } from "@prisma/client";

export function useMembers() {
    return useQuery({
        queryKey: ["members"],
        queryFn: getOrganizationMembers,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useInviteMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ email, role }: { email: string; role?: OrgRole }) =>
            inviteMember(email, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
    });
}

export function useCreateInviteLink() {
    return useMutation({
        mutationFn: (role?: OrgRole) => createInviteLink(role),
    });
}

export function useInviteProjectMember(projectId: string) {
    return useMutation({
        mutationFn: ({ email, role }: { email: string; role?: ProjectRole }) =>
            inviteProjectMember(projectId, email, role),
    });
}

export function useCreateProjectInviteLink(projectId: string) {
    return useMutation({
        mutationFn: (role?: ProjectRole) => createProjectInviteLink(projectId, role),
    });
}

export function useRemoveMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => removeMember(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
    });
}

export function useUpdateMemberRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
            updateMemberRole(userId, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
    });
}
