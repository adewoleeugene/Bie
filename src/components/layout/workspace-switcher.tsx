"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchWorkspace } from "@/actions/workspace";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

interface WorkspaceSwitcherProps {
    workspaces: { id: string; name: string }[];
    currentWorkspaceId: string;
}

export function WorkspaceSwitcher({ workspaces, currentWorkspaceId }: WorkspaceSwitcherProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const current = workspaces.find((w) => w.id === currentWorkspaceId);
    const currentName = current?.name ?? "Workspace";

    // Nothing to switch between — keep the plain label.
    if (workspaces.length <= 1) {
        return (
            <span className="mono hidden max-w-[180px] truncate text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">
                {currentName}
            </span>
        );
    }

    const handleSwitch = (id: string) => {
        if (id === currentWorkspaceId || isPending) return;
        startTransition(async () => {
            const result = await switchWorkspace(id);
            if (result.success) {
                router.refresh();
            } else {
                toast.error(result.error || "Couldn't switch workspace");
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    disabled={isPending}
                    className="mono hidden max-w-[220px] items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-60 sm:inline-flex"
                >
                    <span className="truncate">{currentName}</span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 text-neutral-500" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 border-[color:var(--border)] bg-[color:var(--popover)]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    Switch workspace
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                {workspaces.map((workspace) => (
                    <DropdownMenuItem
                        key={workspace.id}
                        onClick={() => handleSwitch(workspace.id)}
                        className="flex items-center justify-between gap-2"
                    >
                        <span className="truncate">{workspace.name}</span>
                        {workspace.id === currentWorkspaceId && (
                            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
