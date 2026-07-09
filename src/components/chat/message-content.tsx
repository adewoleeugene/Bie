"use client";

import { MessageRefType } from "@prisma/client";
import { CheckCircle2, CircleDot, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { MessageReferencePreview } from "@/actions/chat";

interface MessageContentProps {
    body: string;
    references: MessageReferencePreview[];
}

function statusLabel(status: string) {
    return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function MessageContent({ body, references }: MessageContentProps) {
    const refsByToken = new Map<string, MessageReferencePreview>();
    for (const ref of references) {
        const prefix = ref.targetType === MessageRefType.USER ? "@" : "#";
        refsByToken.set(`${prefix}[${ref.targetId}]`, ref);
    }

    const parts = body.split(/(@\[[^\]]+\]|#\[[^\]]+\])/g).filter(Boolean);

    return (
        <div className="space-y-2">
            <div className="whitespace-pre-wrap break-words">
                {parts.map((part, index) => {
                    const ref = refsByToken.get(part);
                    if (!ref) return <span key={`${part}-${index}`}>{part}</span>;

                    if (ref.targetType === MessageRefType.USER && ref.user) {
                        return (
                            <span
                                key={ref.id}
                                className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                            >
                                <UserRound className="h-3 w-3" />
                                {ref.user.name}
                            </span>
                        );
                    }

                    if (ref.targetType === MessageRefType.TASK && ref.task) {
                        return (
                            <a
                                key={ref.id}
                                href={ref.task.url}
                                className="mx-0.5 inline-flex max-w-full align-middle"
                            >
                                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900">
                                    <CircleDot className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                                    <span className="truncate font-medium">{ref.task.title}</span>
                                    <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                                        {ref.task.statusColumnName ?? statusLabel(ref.task.status)}
                                    </Badge>
                                </span>
                            </a>
                        );
                    }

                    return <span key={ref.id}>{part}</span>;
                })}
            </div>

            {references
                .filter((ref) => ref.targetType === MessageRefType.TASK && ref.task)
                .map((ref) => {
                    const task = ref.task!;
                    return (
                        <a
                            key={`card-${ref.id}`}
                            href={task.url}
                            className="block max-w-xl rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-neutral-500" />
                                        <span className="font-medium truncate">{task.title}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-neutral-500">
                                        {task.projectName ?? "No project"} · {task.priority}
                                    </div>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                    {task.statusColumnName ?? statusLabel(task.status)}
                                </Badge>
                            </div>
                            {task.assignees.length > 0 && (
                                <div className="mt-3 flex -space-x-2">
                                    {task.assignees.slice(0, 4).map((user) => (
                                        <Avatar key={user.id} className="h-6 w-6 border-2 border-neutral-50 dark:border-neutral-900">
                                            <AvatarImage src={user.image || undefined} />
                                            <AvatarFallback className="text-[10px]">
                                                {user.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                            )}
                        </a>
                    );
                })}
        </div>
    );
}
