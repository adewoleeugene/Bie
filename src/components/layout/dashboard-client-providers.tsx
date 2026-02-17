"use client";

import { TaskAlertMonitor } from "@/components/notifications/task-alert-monitor";

/**
 * Client-side wrapper for all background processes that need to run
 * in the dashboard. Currently includes task alert monitoring.
 */
export function DashboardClientProviders() {
    return (
        <>
            <TaskAlertMonitor />
        </>
    );
}
