"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle, PlugZap, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WHATSAPP_COUNTRIES } from "@/lib/phone";
import {
    disconnectWhatsAppNumber,
    getWhatsAppSettings,
    requestWhatsAppVerification,
    updateWhatsAppSettings,
    verifyWhatsAppCode,
} from "@/actions/whatsapp";
import { toast } from "sonner";

interface WhatsAppSettingsData {
    phone: string | null;
    phoneCountry: string | null;
    phoneVerifiedAt: Date | string | null;
    whatsappEnabled: boolean;
    whatsappQuietHoursEnabled: boolean;
    whatsappQuietStart: string;
    whatsappQuietEnd: string;
    whatsappTimezone: string;
    whatsappDigestTime: string;
}

export function WhatsAppSettings({ compact = false }: { compact?: boolean }) {
    const [settings, setSettings] = useState<WhatsAppSettingsData | null>(null);
    const [country, setCountry] = useState("SL");
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [pending, startTransition] = useTransition();

    const verified = Boolean(settings?.phoneVerifiedAt && settings.phone);

    async function refresh() {
        const result = await getWhatsAppSettings();
        if (result.success && result.data) {
            setSettings(result.data);
            setCountry(result.data.phoneCountry || "SL");
        }
    }

    useEffect(() => {
        let cancelled = false;

        getWhatsAppSettings().then((result) => {
            if (cancelled) return;
            if (result.success && result.data) {
                setSettings(result.data);
                setCountry(result.data.phoneCountry || "SL");
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    function requestCode() {
        startTransition(async () => {
            const result = await requestWhatsAppVerification({ country, phone });
            if (result.success) {
                toast.success("Verification code sent on WhatsApp");
            } else {
                toast.error(result.error || "Could not send code");
            }
        });
    }

    function verifyCode() {
        startTransition(async () => {
            const result = await verifyWhatsAppCode({ code });
            if (result.success) {
                toast.success("WhatsApp number verified");
                setPhone("");
                setCode("");
                await refresh();
            } else {
                toast.error(result.error || "Could not verify code");
            }
        });
    }

    function saveSettings(next: Partial<WhatsAppSettingsData>) {
        const merged = { ...settings, ...next };
        setSettings(merged as WhatsAppSettingsData);
        startTransition(async () => {
            const result = await updateWhatsAppSettings({
                enabled: merged.whatsappEnabled,
                quietHoursEnabled: merged.whatsappQuietHoursEnabled,
                quietStart: merged.whatsappQuietStart,
                quietEnd: merged.whatsappQuietEnd,
                timezone: merged.whatsappTimezone,
                digestTime: merged.whatsappDigestTime,
            });

            if (!result.success) {
                toast.error(result.error || "Could not update WhatsApp settings");
                await refresh();
            }
        });
    }

    function disconnect() {
        startTransition(async () => {
            const result = await disconnectWhatsAppNumber();
            if (result.success) {
                toast.success("WhatsApp disconnected");
                await refresh();
            } else {
                toast.error(result.error || "Could not disconnect WhatsApp");
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                </CardTitle>
                <CardDescription>
                    Verify a number Bie can message. This is not used for login.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {verified ? (
                    <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-medium">{settings?.phone}</p>
                            <p className="text-xs text-muted-foreground">Verified WhatsApp contact channel</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={settings?.whatsappEnabled ?? false}
                                disabled={pending}
                                onCheckedChange={(checked) => saveSettings({ whatsappEnabled: checked })}
                            />
                            <Button variant="outline" size="sm" onClick={disconnect} disabled={pending}>
                                <Unplug className="mr-2 h-4 w-4" />
                                Disconnect
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp-country">Country</Label>
                        <Select value={country} onValueChange={setCountry} disabled={pending}>
                            <SelectTrigger id="whatsapp-country" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {WHATSAPP_COUNTRIES.map((item) => (
                                    <SelectItem key={item.code} value={item.code}>
                                        {item.name} {item.dialCode}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp-phone">WhatsApp number</Label>
                        <div className="flex gap-2">
                            <Input
                                id="whatsapp-phone"
                                inputMode="tel"
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                placeholder="Number"
                                disabled={pending}
                            />
                            <Button type="button" onClick={requestCode} disabled={pending || !phone.trim()}>
                                <PlugZap className="mr-2 h-4 w-4" />
                                Send Code
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-2 sm:max-w-sm">
                    <Label htmlFor="whatsapp-code">Verification code</Label>
                    <div className="flex gap-2">
                        <Input
                            id="whatsapp-code"
                            inputMode="numeric"
                            maxLength={6}
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            placeholder="6 digits"
                            disabled={pending}
                        />
                        <Button type="button" onClick={verifyCode} disabled={pending || code.replace(/\D/g, "").length !== 6}>
                            Verify
                        </Button>
                    </div>
                </div>

                {verified && !compact ? (
                    <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-3 rounded-md border p-4">
                            <div>
                                <p className="text-sm font-medium">Quiet hours</p>
                                <p className="text-xs text-muted-foreground">Normal notifications pause during this window.</p>
                            </div>
                            <Switch
                                checked={settings?.whatsappQuietHoursEnabled ?? true}
                                disabled={pending}
                                onCheckedChange={(checked) => saveSettings({ whatsappQuietHoursEnabled: checked })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="quiet-start">From</Label>
                                <Input
                                    id="quiet-start"
                                    type="time"
                                    value={settings?.whatsappQuietStart ?? "18:00"}
                                    onChange={(event) => saveSettings({ whatsappQuietStart: event.target.value })}
                                    disabled={pending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quiet-end">Until</Label>
                                <Input
                                    id="quiet-end"
                                    type="time"
                                    value={settings?.whatsappQuietEnd ?? "08:00"}
                                    onChange={(event) => saveSettings({ whatsappQuietEnd: event.target.value })}
                                    disabled={pending}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="whatsapp-timezone">Timezone</Label>
                            <Input
                                id="whatsapp-timezone"
                                value={settings?.whatsappTimezone ?? "Africa/Freetown"}
                                onChange={(event) => saveSettings({ whatsappTimezone: event.target.value })}
                                disabled={pending}
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="whatsapp-digest-time">Daily digest time</Label>
                            <Input
                                id="whatsapp-digest-time"
                                type="time"
                                value={settings?.whatsappDigestTime ?? "08:00"}
                                onChange={(event) => saveSettings({ whatsappDigestTime: event.target.value })}
                                disabled={pending}
                            />
                            <p className="text-xs text-muted-foreground">
                                Your task digest arrives around this time each day (your timezone). Turn the Daily Digest WhatsApp channel on under Notifications to receive it.
                            </p>
                        </div>
                    </div>
                ) : null}
            </CardContent>
            {compact ? (
                <CardFooter className="justify-end border-t pt-6">
                    <Button variant="outline" asChild>
                        <a href="/dashboard">Skip for now</a>
                    </Button>
                </CardFooter>
            ) : null}
        </Card>
    );
}
