"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createInviteLink, getOrganizationMembers, inviteMember, removeMember, updateMemberRole } from "@/actions/members";
import { OrgRole } from "@prisma/client";

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
