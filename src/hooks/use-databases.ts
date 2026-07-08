"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listDatabases,
    getDatabase,
    createDatabase,
    updateDatabase,
    deleteDatabase,
    addProperty,
    updateProperty,
    deleteProperty,
    addRow,
    setRowValue,
    setRowContent,
    deleteRow,
    createView,
    updateView,
    deleteView,
} from "@/actions/databases";
import { toast } from "sonner";

export function useDatabases() {
    return useQuery({
        queryKey: ["databases"],
        queryFn: () => listDatabases(),
    });
}

export function useDatabase(databaseId: string | undefined) {
    return useQuery({
        queryKey: ["database", databaseId],
        queryFn: () => (databaseId ? getDatabase(databaseId) : Promise.resolve(null)),
        enabled: !!databaseId,
    });
}

export function useCreateDatabase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: { name: string; description?: string }) => createDatabase(args),
        onSuccess: (result) => {
            if (result.success) {
                qc.invalidateQueries({ queryKey: ["databases"] });
                toast.success("Collection created");
            } else {
                toast.error(result.error || "Failed");
            }
        },
    });
}

export function useUpdateDatabase(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: { name?: string; description?: string }) =>
            updateDatabase({ databaseId, ...args }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["database", databaseId] });
            qc.invalidateQueries({ queryKey: ["databases"] });
        },
    });
}

export function useDeleteDatabase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (databaseId: string) => deleteDatabase(databaseId),
        onSuccess: (result) => {
            if (result.success) {
                qc.invalidateQueries({ queryKey: ["databases"] });
                toast.success("Collection deleted");
            } else {
                toast.error(result.error || "Failed");
            }
        },
    });
}

export function useAddProperty(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: Parameters<typeof addProperty>[0]) => addProperty(args),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useUpdateProperty(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: Parameters<typeof updateProperty>[0]) => updateProperty(args),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useDeleteProperty(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (propertyId: string) => deleteProperty(propertyId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useAddRow(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => addRow(databaseId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useSetRowValue(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: Parameters<typeof setRowValue>[0]) => setRowValue(args),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useSetRowContent(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: Parameters<typeof setRowContent>[0]) => setRowContent(args),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useDeleteRow(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (rowId: string) => deleteRow(rowId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useCreateView(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: Parameters<typeof createView>[0]) => createView(args),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useUpdateView(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args: Parameters<typeof updateView>[0]) => updateView(args),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}

export function useDeleteView(databaseId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (viewId: string) => deleteView(viewId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["database", databaseId] }),
    });
}
