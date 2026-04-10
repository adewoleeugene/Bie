"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AttachmentParent } from "@prisma/client";
import {
    listAttachments,
    uploadAttachment,
    deleteAttachment,
} from "@/actions/attachments";
import { toast } from "sonner";

const key = (parentType: AttachmentParent, parentId: string) =>
    ["attachments", parentType, parentId] as const;

export function useAttachments(parentType: AttachmentParent, parentId: string | undefined) {
    return useQuery({
        queryKey: parentId ? key(parentType, parentId) : ["attachments", parentType, "none"],
        queryFn: () => (parentId ? listAttachments(parentType, parentId) : Promise.resolve([])),
        enabled: !!parentId,
    });
}

export function useUploadAttachment(parentType: AttachmentParent, parentId: string) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("parentType", parentType);
            fd.append("parentId", parentId);
            return uploadAttachment(fd);
        },
        onSuccess: (result) => {
            if (result?.success) {
                qc.invalidateQueries({ queryKey: key(parentType, parentId) });
                toast.success("File uploaded");
            } else {
                toast.error(result?.error || "Upload failed");
            }
        },
        onError: () => toast.error("Upload failed"),
    });
}

export function useDeleteAttachment(parentType: AttachmentParent, parentId: string) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
        onSuccess: (result) => {
            if (result?.success) {
                qc.invalidateQueries({ queryKey: key(parentType, parentId) });
                toast.success("File deleted");
            } else {
                toast.error(result?.error || "Delete failed");
            }
        },
        onError: () => toast.error("Delete failed"),
    });
}
