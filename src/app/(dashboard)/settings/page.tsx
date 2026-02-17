"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const [name, setName] = useState(session?.user?.name || "");
    const [loading, setLoading] = useState(false);

    const handleSaveProfile = async () => {
        setLoading(true);
        // In a real app, this would call a server action
        // For now, we'll just simulate it
        setTimeout(() => {
            setLoading(false);
            toast.success("Profile updated successfully");
        }, 1000);
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
                        <Button variant="outline">Change Avatar</Button>
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
                    <CardTitle>Preferences</CardTitle>
                    <CardDescription>Customize your workspace experience.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Theme</Label>
                            <p className="text-sm text-muted-foreground">Select your preferred interface theme.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">Light</Button>
                            <Button variant="outline" size="sm">Dark</Button>
                            <Button variant="secondary" size="sm">System</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
