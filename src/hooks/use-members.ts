"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createInviteLink,
    createProjectInviteLink,
    getOrganizationMembers,
    getWorkspaceInvites,
    inviteMember,
    inviteProjectMember,
    removeMember,
    revokeInvitation,
    updateMemberRole,
} from "@/actions/members";
import { OrgRole, ProjectRole } from "@prisma/client";

const INVITE_KEYS = [["members"], ["workspace-invites"]] as const;

function useInvalidateInvites() {
    const queryClient = useQueryClient();
    return () => INVITE_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}

export function useMembers() {
    return useQuery({
        queryKey: ["members"],
        queryFn: getOrganizationMembers,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useWorkspaceInvites() {
    return useQuery({
        queryKey: ["workspace-invites"],
        queryFn: getWorkspaceInvites,
    });
}

export function useInviteMember() {
    const invalidate = useInvalidateInvites();
    return useMutation({
        mutationFn: ({ email, role }: { email: string; role?: OrgRole }) =>
            inviteMember(email, role),
        onSuccess: invalidate,
    });
}

export function useCreateInviteLink() {
    const invalidate = useInvalidateInvites();
    return useMutation({
        mutationFn: ({ role, expiresInMinutes }: { role?: OrgRole; expiresInMinutes?: number | null }) =>
            createInviteLink(role, expiresInMinutes),
        onSuccess: invalidate,
    });
}

export function useInviteProjectMember(projectId: string) {
    const invalidate = useInvalidateInvites();
    return useMutation({
        mutationFn: ({ email, role }: { email: string; role?: ProjectRole }) =>
            inviteProjectMember(projectId, email, role),
        onSuccess: invalidate,
    });
}

export function useCreateProjectInviteLink(projectId: string) {
    const invalidate = useInvalidateInvites();
    return useMutation({
        mutationFn: ({ role, expiresInMinutes }: { role?: ProjectRole; expiresInMinutes?: number | null }) =>
            createProjectInviteLink(projectId, role, expiresInMinutes),
        onSuccess: invalidate,
    });
}

export function useRevokeInvitation() {
    const invalidate = useInvalidateInvites();
    return useMutation({
        mutationFn: (invitationId: string) => revokeInvitation(invitationId),
        onSuccess: invalidate,
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
