"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Loader2, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { OrgRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNotificationPreferences, useUpdateNotificationPreference } from "@/hooks/use-notification-preferences";
import { useMembers } from "@/hooks/use-members";
import { updateUserAvatar, updateUserProfile } from "@/actions/user";
import { MemberManagement } from "@/components/settings/member-management";
import { PrivacyAdminPanel } from "@/components/settings/privacy-admin-panel";
import { PrivacyControls } from "@/components/settings/privacy-controls";
import { WhatsAppSettings } from "@/components/settings/whatsapp-settings";

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const [name, setName] = useState(session?.user?.name || "");
    const [loading, setLoading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { data: notifPrefs } = useNotificationPreferences();
    const { data: members = [] } = useMembers();
    const updatePref = useUpdateNotificationPreference();
    const currentMembership = members.find((member) => member.email === session?.user?.email);
    const currentRole = (currentMembership?.role as OrgRole | undefined) ?? undefined;
    const nameDirty = name.trim() !== (session?.user?.name || "").trim();

    const NOTIF_TYPE_LABELS: Record<string, string> = {
        MENTION: "Chat Mentions",
        DUE_SOON: "Due Soon Reminders",
        OVERDUE: "Overdue Alerts",
        ASSIGNED: "Task Assignments",
        COMMENT: "Comments",
        ACCESS_REQUEST: "Access Requests",
        ACCESS_GRANTED: "Access Granted",
        DAILY_DIGEST: "Daily Digest",
        DAILY_REPORT: "Daily Report",
        OWNER_REPORT: "Owner Report",
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        const result = await updateUserProfile({ name });
        setLoading(false);
        if (result.success) {
            await update({ name });
            toast.success("Profile updated successfully");
        } else {
            toast.error(result.error || "Failed to update profile");
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAvatarUploading(true);
        const formData = new FormData();
        formData.append("avatar", file);

        const result = await updateUserAvatar(formData);
        setAvatarUploading(false);

        if (result.success && result.url) {
            await update({ image: result.url });
            toast.success("Avatar updated");
        } else {
            toast.error(result.error || "Failed to upload avatar");
        }

        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Settings</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Manage your public profile information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarUploading}
                            aria-label="Change avatar"
                            className="group relative shrink-0 rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                        >
                            <Avatar className="h-20 w-20 border border-border">
                                <AvatarImage src={session?.user?.image || undefined} />
                                <AvatarFallback className="text-xl">
                                    {session?.user?.name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                {avatarUploading ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                ) : (
                                    <Camera className="h-5 w-5 text-white" />
                                )}
                            </span>
                        </button>
                        <div className="text-center sm:text-left">
                            <p className="text-sm font-medium leading-tight">
                                {session?.user?.name || "Your name"}
                            </p>
                            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                Click the avatar to upload a new photo. JPG, PNG, GIF or WebP.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-5 max-w-md">
                        <div className="space-y-2">
                            <Label htmlFor="name">Display Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Input
                                    id="email"
                                    value={session?.user?.email || ""}
                                    disabled
                                    className="pr-9"
                                />
                                <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t pt-6">
                    <Button onClick={handleSaveProfile} disabled={loading || !nameDirty}>
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose which notifications you receive.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-[1fr_72px_72px_88px] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                            <span>Type</span>
                            <span className="text-center">In-App</span>
                            <span className="text-center">Email</span>
                            <span className="text-center">WhatsApp</span>
                        </div>
                        {notifPrefs?.map((pref) => (
                            <div key={pref.type} className="grid grid-cols-[1fr_72px_72px_88px] gap-2 items-center">
                                <span className="text-sm font-medium">
                                    {NOTIF_TYPE_LABELS[pref.type] || pref.type}
                                </span>
                                <div className="flex justify-center">
                                    <Switch
                                        checked={pref.inApp}
                                        onCheckedChange={(checked) =>
                                            updatePref.mutate({ type: pref.type, field: "inApp", value: checked })
                                        }
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <Switch
                                        checked={pref.email}
                                        onCheckedChange={(checked) =>
                                            updatePref.mutate({ type: pref.type, field: "email", value: checked })
                                        }
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <Switch
                                        checked={pref.whatsapp}
                                        onCheckedChange={(checked) =>
                                            updatePref.mutate({ type: pref.type, field: "whatsapp", value: checked })
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <WhatsAppSettings />

            <MemberManagement limit={5} />
            <PrivacyControls />
            <PrivacyAdminPanel role={currentRole} />
        </div>
    );
}
