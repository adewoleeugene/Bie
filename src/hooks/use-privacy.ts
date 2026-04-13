"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createPrivacyRequest,
    exportPersonalData,
    getOrganizationPrivacyRequests,
    getPrivacyRequests,
    updatePrivacyRequestStatus,
} from "@/actions/privacy";

export function usePrivacyRequests() {
    return useQuery({
        queryKey: ["privacy-requests"],
        queryFn: getPrivacyRequests,
    });
}

export function useCreatePrivacyRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPrivacyRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["privacy-requests"] });
        },
    });
}

export function useExportPersonalData() {
    return useMutation({
        mutationFn: exportPersonalData,
    });
}

export function useOrganizationPrivacyRequests(enabled = true) {
    return useQuery({
        queryKey: ["organization-privacy-requests"],
        queryFn: getOrganizationPrivacyRequests,
        enabled,
    });
}

export function useUpdatePrivacyRequestStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updatePrivacyRequestStatus,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["privacy-requests"] });
            queryClient.invalidateQueries({ queryKey: ["organization-privacy-requests"] });
        },
    });
}
