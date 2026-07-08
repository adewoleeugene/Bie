"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

    const NOTIF_TYPE_LABELS: Record<string, string> = {
        MENTION: "Mentions",
        DUE_SOON: "Due Soon Reminders",
        OVERDUE: "Overdue Alerts",
        ASSIGNED: "Task Assignments",
        COMMENT: "Comments",
        ACCESS_REQUEST: "Access Requests",
        ACCESS_GRANTED: "Access Granted",
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
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={session?.user?.image || undefined} />
                            <AvatarFallback className="text-xl">
                                {session?.user?.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                            <Button
                                variant="outline"
                                disabled={avatarUploading}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarUploading ? "Uploading..." : "Change Avatar"}
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 max-w-md">
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
                            <Input
                                id="email"
                                value={session?.user?.email || ""}
                                disabled
                            />
                            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                        </div>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose which notifications you receive.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                            <span>Type</span>
                            <span className="text-center">In-App</span>
                            <span className="text-center">Email</span>
                        </div>
                        {notifPrefs?.map((pref) => (
                            <div key={pref.type} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
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
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <MemberManagement limit={5} />
            <PrivacyControls />
            <PrivacyAdminPanel role={currentRole} />
        </div>
    );
}
