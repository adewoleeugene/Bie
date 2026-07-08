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
import { Check, ChevronsUpDown, FolderGit2, Home, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Workspace {
    id: string;
    name: string;
    type: "PERSONAL" | "ORGANIZATION";
}

interface InvitedProject {
    id: string;
    name: string;
    organizationId: string;
    workspaceName: string;
}

interface WorkspaceSwitcherProps {
    workspaces: Workspace[];
    invitedProjects: InvitedProject[];
    currentWorkspaceId: string | null;
    currentWorkspaceName: string | null;
}

export function WorkspaceSwitcher({
    workspaces,
    invitedProjects,
    currentWorkspaceId,
    currentWorkspaceName,
}: WorkspaceSwitcherProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const currentName = currentWorkspaceName ?? workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? "Workspace";
    const totalOptions = workspaces.length + invitedProjects.length;

    // Only one place to be — keep the plain label.
    if (totalOptions <= 1) {
        return (
            <span className="mono hidden max-w-[180px] truncate text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">
                {currentName}
            </span>
        );
    }

    const handleSwitchWorkspace = (id: string) => {
        if (id === currentWorkspaceId || isPending) return;
        startTransition(async () => {
            const result = await switchWorkspace(id);
            if (result.success) {
                router.push("/dashboard");
                router.refresh();
            } else {
                toast.error(result.error || "Couldn't switch workspace");
            }
        });
    };

    const handleOpenProject = (project: InvitedProject) => {
        if (isPending) return;
        startTransition(async () => {
            const result = await switchWorkspace(project.organizationId);
            if (result.success) {
                router.push(`/projects/${project.id}`);
                router.refresh();
            } else {
                toast.error(result.error || "Couldn't open project");
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
            <DropdownMenuContent align="start" className="w-64 border-[color:var(--border)] bg-[color:var(--popover)]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    Workspaces
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                {workspaces.map((workspace) => (
                    <DropdownMenuItem
                        key={workspace.id}
                        onClick={() => handleSwitchWorkspace(workspace.id)}
                        className="flex items-center gap-2"
                    >
                        {workspace.type === "PERSONAL" ? (
                            <Home className="h-4 w-4 shrink-0 text-neutral-500" />
                        ) : (
                            <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
                        )}
                        <span className="flex-1 truncate">{workspace.name}</span>
                        {workspace.id === currentWorkspaceId && (
                            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        )}
                    </DropdownMenuItem>
                ))}

                {invitedProjects.length > 0 && (
                    <>
                        <DropdownMenuLabel className="mt-1 text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                            Invited projects
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                        {invitedProjects.map((project) => (
                            <DropdownMenuItem
                                key={project.id}
                                onClick={() => handleOpenProject(project)}
                                className="flex items-center gap-2"
                            >
                                <FolderGit2 className="h-4 w-4 shrink-0 text-neutral-500" />
                                <div className="flex-1 truncate">
                                    <span className="truncate">{project.name}</span>
                                    <span className="block truncate text-[10px] text-neutral-500">
                                        {project.workspaceName}
                                    </span>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
