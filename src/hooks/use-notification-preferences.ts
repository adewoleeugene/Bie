import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getNotificationPreferences,
    updateNotificationPreference,
} from "@/actions/notification-preferences";
import { NotificationType } from "@prisma/client";

export function useNotificationPreferences() {
    return useQuery({
        queryKey: ["notification-preferences"],
        queryFn: () => getNotificationPreferences(),
    });
}

export function useUpdateNotificationPreference() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            type,
            field,
            value,
        }: {
            type: NotificationType;
            field: "inApp" | "email" | "whatsapp";
            value: boolean;
        }) => updateNotificationPreference(type, field, value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
        },
    });
}
