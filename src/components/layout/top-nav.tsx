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
import { LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";

interface TopNavProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    organizationName: string;
}

export function TopNav({ user, organizationName }: TopNavProps) {
    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U";

    return (
        <div className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-neutral-950">
            <div className="flex items-center gap-4">
                <h2 className="text-sm font-medium text-neutral-500">
                    {organizationName}
                </h2>
                <div className="w-[300px]">
                    <SearchDialog />
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Pomodoro Timer */}
                <PomodoroTimer />

                {/* Notification Bell */}
                <NotificationBell />

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                            <div className="text-right">
                                <p className="text-sm font-medium">{user.name}</p>
                                <p className="text-xs text-neutral-500">{user.email}</p>
                            </div>
                            <Avatar>
                                <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <User className="mr-2 h-4 w-4" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
