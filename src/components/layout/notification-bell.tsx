"use client";

import { useState } from "react";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, CheckCheck, MessageSquare, AlertTriangle, Clock, UserPlus, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
    MENTION: <AtSign className="h-4 w-4 text-blue-500" />,
    COMMENT: <MessageSquare className="h-4 w-4 text-green-500" />,
    ASSIGNED: <UserPlus className="h-4 w-4 text-purple-500" />,
    DUE_SOON: <Clock className="h-4 w-4 text-amber-500" />,
    OVERDUE: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const { data: notifications } = useNotifications();
    const { data: unreadCount } = useUnreadCount();
    const markRead = useMarkRead();
    const markAllRead = useMarkAllRead();
    const router = useRouter();

    const handleNotificationClick = (notification: any) => {
        if (!notification.read) {
            markRead.mutate(notification.id);
        }
        if (notification.linkUrl) {
            router.push(notification.linkUrl);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    <Bell className="h-4.5 w-4.5 text-neutral-600 dark:text-neutral-400" />
                    {(unreadCount ?? 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-in fade-in zoom-in">
                            {unreadCount! > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="end">
                {/* Header */}
                <div className="flex items-center justify-between border-b p-3">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">Notifications</h4>
                        {(unreadCount ?? 0) > 0 && (
                            <Badge variant="secondary" className="h-5 text-[10px]">
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    {(unreadCount ?? 0) > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => markAllRead.mutate()}
                        >
                            <CheckCheck className="h-3 w-3" />
                            Mark all read
                        </Button>
                    )}
                </div>

                {/* Notification List */}
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications && notifications.length > 0 ? (
                        notifications.map((notification: any) => (
                            <button
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`w-full flex items-start gap-3 p-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors border-b last:border-b-0 ${!notification.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                                    }`}
                            >
                                <div className="mt-0.5 shrink-0">
                                    {NOTIFICATION_ICONS[notification.type] || <Bell className="h-4 w-4 text-neutral-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-snug ${!notification.read ? "font-medium" : "text-neutral-600 dark:text-neutral-400"}`}>
                                        {notification.title}
                                    </p>
                                    {notification.body && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                            {notification.body}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                                {!notification.read && (
                                    <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 mb-3">
                                <Bell className="h-5 w-5 text-neutral-400" />
                            </div>
                            <p className="text-sm font-medium text-neutral-500">All caught up!</p>
                            <p className="text-xs text-muted-foreground mt-1">No notifications yet</p>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
