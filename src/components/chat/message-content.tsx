"use client";

import { MessageRefType } from "@prisma/client";
import { CheckCircle2, CircleDot, FolderKanban, UserRound } from "lucide-react";
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
        const prefix =
            ref.targetType === MessageRefType.USER
                ? "@"
                : ref.targetType === MessageRefType.PROJECT
                    ? "+"
                    : "#";
        refsByToken.set(`${prefix}[${ref.targetId}]`, ref);
    }

    const parts = body.split(/(@\[[^\]]+\]|#\[[^\]]+\]|\+\[[^\]]+\])/g).filter(Boolean);

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
                                className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 align-middle font-medium text-current"
                            >
                                <UserRound className="h-3 w-3 opacity-80" />
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
                                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-current transition-colors hover:bg-white/25">
                                    <CircleDot className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                    <span className="truncate font-medium">{ref.task.title}</span>
                                    <Badge variant="outline" className="hidden shrink-0 border-current/30 text-current sm:inline-flex">
                                        {ref.task.statusColumnName ?? statusLabel(ref.task.status)}
                                    </Badge>
                                </span>
                            </a>
                        );
                    }

                    if (ref.targetType === MessageRefType.PROJECT && ref.project) {
                        return (
                            <a
                                key={ref.id}
                                href={ref.project.url}
                                className="mx-0.5 inline-flex max-w-full align-middle"
                            >
                                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-current transition-colors hover:bg-white/25">
                                    <FolderKanban className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                    <span className="truncate font-medium">{ref.project.name}</span>
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
                            className="block max-w-xl rounded-lg border border-current/15 bg-white/10 p-3 text-sm text-current transition-colors hover:bg-white/[0.16]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 shrink-0 opacity-70" />
                                        <span className="font-medium truncate">{task.title}</span>
                                    </div>
                                    <div className="mt-1 text-xs opacity-70">
                                        {task.projectName ?? "No project"} · {task.priority}
                                    </div>
                                </div>
                                <Badge variant="outline" className="shrink-0 border-current/30 text-current">
                                    {task.statusColumnName ?? statusLabel(task.status)}
                                </Badge>
                            </div>
                            {task.assignees.length > 0 && (
                                <div className="mt-3 flex -space-x-2">
                                    {task.assignees.slice(0, 4).map((user) => (
                                        <Avatar key={user.id} className="h-6 w-6 border-2 border-white/10">
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
