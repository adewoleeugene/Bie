"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveFocusSession } from "@/actions/focus-sessions";
import { DeepFocusView } from "@/components/focus/deep-focus-view";
import { Loader2 } from "lucide-react";

interface SessionData {
    id: string;
    taskId: string | null;
    taskTitle: string;
    taskPriority?: string;
    projectName?: string;
    type: "POMODORO" | "FREE";
    startedAt: Date;
    pomodoroCount: number;
}

export default function FocusSessionPage() {
    const router = useRouter();
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const active = await getActiveFocusSession();
                if (!active) {
                    // No active session — redirect back
                    router.replace("/focus");
                    return;
                }
                // The active session includes task + project from the server action.
                const task = (active as { task?: { title?: string; priority?: string; project?: { name?: string } | null } | null }).task;
                setSession({
                    id: active.id,
                    taskId: active.taskId || null,
                    taskTitle: task?.title || "Untitled",
                    taskPriority: task?.priority,
                    projectName: task?.project?.name,
                    type: active.type as "POMODORO" | "FREE",
                    startedAt: new Date(active.startedAt),
                    pomodoroCount: active.pomodoroCount || 0,
                });
            } catch {
                router.replace("/focus");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <DeepFocusView
            sessionId={session.id}
            taskId={session.taskId}
            taskTitle={session.taskTitle}
            taskPriority={session.taskPriority}
            projectName={session.projectName}
            sessionType={session.type}
            startedAt={session.startedAt}
            pomodoroCount={session.pomodoroCount}
        />
    );
}
