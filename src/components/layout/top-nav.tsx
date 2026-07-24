"use client";

import { SearchDialog } from "@/components/search-dialog";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PomodoroTimer } from "@/components/focus/pomodoro-timer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useState } from "react";
import { DoorOpen, LogOut, User, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { leaveWorkspace } from "@/actions/workspace";

interface TopNavProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    workspaces: { id: string; name: string; type: "PERSONAL" | "ORGANIZATION" }[];
    invitedProjects: { id: string; name: string; organizationId: string; workspaceName: string }[];
    currentWorkspaceId: string | null;
    currentWorkspaceName: string | null;
    projects: any[];
}

export function TopNav({
    user,
    workspaces,
    invitedProjects,
    currentWorkspaceId,
    currentWorkspaceName,
    projects,
}: TopNavProps) {
    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U";

    // You can only leave a real organization you're a full member of — never
    // your personal workspace. Guest orgs surface via projects, not here.
    const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
    const canLeaveWorkspace = currentWorkspace?.type === "ORGANIZATION";

    const [leaveOpen, setLeaveOpen] = useState(false);
    const [leaving, setLeaving] = useState(false);

    const handleLeaveWorkspace = async () => {
        setLeaving(true);
        const result = await leaveWorkspace();
        setLeaving(false);

        if (result.success) {
            toast.success(`Left ${result.workspaceName ?? "the workspace"}`);
            // Hard navigation so the server re-resolves the new active workspace.
            window.location.href = "/dashboard";
        } else {
            setLeaveOpen(false);
            toast.error(result.error || "Couldn't leave workspace");
        }
    };

    return (
        <div className="flex h-14 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--background)]/70 px-5 backdrop-blur-xl">
            <div className="flex items-center gap-4">
                <Sheet>
                    <SheetTrigger asChild>
                        <button className="block rounded-md p-1.5 text-neutral-400 hover:bg-white/[0.05] hover:text-white md:hidden">
                            <Menu className="h-5 w-5" />
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[260px] border-[color:var(--border)] bg-[color:var(--sidebar)] p-0">
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                        <Sidebar projects={projects} />
                    </SheetContent>
                </Sheet>
                <WorkspaceSwitcher
                    workspaces={workspaces}
                    invitedProjects={invitedProjects}
                    currentWorkspaceId={currentWorkspaceId}
                    currentWorkspaceName={currentWorkspaceName}
                />
                <div className="hidden h-4 w-px bg-[color:var(--border)] sm:block" />
                <div className="w-[220px] sm:w-[320px]">
                    <SearchDialog />
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                <PomodoroTimer />
                <NotificationBell />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                            <div className="hidden text-right sm:block">
                                <p className="text-[12px] font-medium leading-tight text-white">{user.name}</p>
                                <p className="mono text-[10px] leading-tight text-neutral-500">{user.email}</p>
                            </div>
                            <Avatar className="h-8 w-8 ring-1 ring-[color:var(--border)]">
                                <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                                <AvatarFallback className="bg-[color:var(--secondary)] text-[11px] text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 border-[color:var(--border)] bg-[color:var(--popover)]">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                            My account
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                        <DropdownMenuItem asChild>
                            <Link href="/profile">
                                <User className="mr-2 h-4 w-4" />
                                Profile
                            </Link>
                        </DropdownMenuItem>
                        {canLeaveWorkspace && (
                            <DropdownMenuItem onSelect={() => setLeaveOpen(true)}>
                                <DoorOpen className="mr-2 h-4 w-4" />
                                Leave workspace
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                        <DropdownMenuItem
                            className="text-[color:var(--bz-red)] focus:text-[color:var(--bz-red)]"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Leave {currentWorkspaceName ?? "this workspace"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You&apos;ll lose access to its projects, tasks, and docs. An
                            admin can invite you back later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={leaving}
                            onClick={(e) => {
                                e.preventDefault();
                                void handleLeaveWorkspace();
                            }}
                        >
                            {leaving ? "Leaving…" : "Leave workspace"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
