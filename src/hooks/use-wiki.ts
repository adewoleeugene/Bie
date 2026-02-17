"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WikiNamespace } from "@prisma/client";
import {
    getWikiPages,
    getWikiPage,
    createWikiPage,
    updateWikiPage,
    deleteWikiPage,
} from "@/actions/wiki";
import {
    getWikiTemplates,
    createWikiTemplate,
    deleteWikiTemplate
} from "@/actions/wiki-template";

export function useWikiPages(organizationId: string, namespace?: WikiNamespace, projectId?: string) {
    return useQuery({
        queryKey: ["wiki-pages", organizationId, namespace, projectId],
        queryFn: async () => {
            const result = await getWikiPages(organizationId, namespace, projectId);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useWikiPage(id: string) {
    return useQuery({
        queryKey: ["wiki-page", id],
        queryFn: async () => {
            const result = await getWikiPage(id);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
        enabled: !!id,
    });
}

export function useWikiTemplates(organizationId: string) {
    return useQuery({
        queryKey: ["wiki-templates", organizationId],
        queryFn: async () => {
            const result = await getWikiTemplates(organizationId);
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
    });
}

export function useCreateWikiPage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createWikiPage,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
        },
    });
}

export function useUpdateWikiPage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateWikiPage,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
            queryClient.invalidateQueries({ queryKey: ["wiki-page", variables.id] });
        },
    });
}

export function useDeleteWikiPage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteWikiPage,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wiki-pages"] });
        },
    });
}
