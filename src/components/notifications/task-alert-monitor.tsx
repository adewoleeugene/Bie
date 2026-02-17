"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTaskAlerts, TaskAlert } from "@/actions/notifications";
import { toast } from "sonner";

const POLL_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const NOTIFICATION_COOLDOWN = 30 * 60 * 1000; // Don't re-notify for same task within 30 min

/**
 * TaskAlertMonitor — Background component that polls for overdue/due-soon tasks
 * and sends browser notifications. Mount once in the dashboard layout.
 */
export function TaskAlertMonitor() {
    const notifiedRef = useRef<Map<string, number>>(new Map());
    const hasRequestedPermission = useRef(false);

    // Request notification permission on mount
    useEffect(() => {
        if (hasRequestedPermission.current) return;
        hasRequestedPermission.current = true;

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const sendBrowserNotification = useCallback((title: string, body: string, tag: string) => {
        // Check cooldown
        const lastNotified = notifiedRef.current.get(tag);
        if (lastNotified && Date.now() - lastNotified < NOTIFICATION_COOLDOWN) {
            return; // Don't spam notifications
        }

        notifiedRef.current.set(tag, Date.now());

        if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification(title, {
                body,
                icon: "/favicon.ico",
                tag, // Prevents duplicate notifications
                requireInteraction: false,
            });

            // Auto-close after 8 seconds
            setTimeout(() => notification.close(), 8000);
        }
    }, []);

    // Poll for alerts
    const { data: alerts } = useQuery({
        queryKey: ["task-alerts"],
        queryFn: () => getTaskAlerts(),
        refetchInterval: POLL_INTERVAL,
        staleTime: POLL_INTERVAL - 10000,
    });

    // Process alerts and send notifications
    useEffect(() => {
        if (!alerts || alerts.length === 0) return;

        const overdueAlerts = alerts.filter((a) => a.type === "overdue");
        const dueTodayAlerts = alerts.filter((a) => a.type === "due_today");
        const dueSoonAlerts = alerts.filter((a) => a.type === "due_soon");

        // Overdue notifications — one notification per task
        overdueAlerts.forEach((alert) => {
            sendBrowserNotification(
                "⚠️ Overdue Task",
                `"${alert.title}" ${alert.projectName ? `(${alert.projectName})` : ""} is past its due date!`,
                `overdue-${alert.id}`
            );
        });

        // Due today — batch notification (only if there are any)
        if (dueTodayAlerts.length > 0) {
            if (dueTodayAlerts.length === 1) {
                sendBrowserNotification(
                    "📅 Task Due Today",
                    `"${dueTodayAlerts[0].title}" ${dueTodayAlerts[0].projectName ? `(${dueTodayAlerts[0].projectName})` : ""} is due today.`,
                    `due-today-batch`
                );
            } else {
                sendBrowserNotification(
                    `📅 ${dueTodayAlerts.length} Tasks Due Today`,
                    dueTodayAlerts.map((a) => a.title).join(", "),
                    `due-today-batch`
                );
            }
        }

        // Due soon — batch notification
        if (dueSoonAlerts.length > 0) {
            if (dueSoonAlerts.length === 1) {
                sendBrowserNotification(
                    "🔔 Task Due Tomorrow",
                    `"${dueSoonAlerts[0].title}" ${dueSoonAlerts[0].projectName ? `(${dueSoonAlerts[0].projectName})` : ""} is due tomorrow.`,
                    `due-soon-batch`
                );
            } else {
                sendBrowserNotification(
                    `🔔 ${dueSoonAlerts.length} Tasks Due Tomorrow`,
                    dueSoonAlerts.map((a) => a.title).join(", "),
                    `due-soon-batch`
                );
            }
        }

        // Also show in-app toasts for urgent items (initial load only)
        if (overdueAlerts.length > 0) {
            toast.warning(`${overdueAlerts.length} overdue ${overdueAlerts.length === 1 ? "task" : "tasks"}`, {
                description: overdueAlerts.length <= 3
                    ? overdueAlerts.map((a) => a.title).join(", ")
                    : `${overdueAlerts.slice(0, 3).map((a) => a.title).join(", ")} and ${overdueAlerts.length - 3} more`,
                duration: 6000,
            });
        }
    }, [alerts, sendBrowserNotification]);

    // This component renders nothing — it's a background monitor
    return null;
}
