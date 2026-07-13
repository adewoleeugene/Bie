"use client";

import { useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreatePrivacyRequest, useExportPersonalData } from "@/hooks/use-privacy";

export function PrivacyControls() {
    const [confirmDeletion, setConfirmDeletion] = useState(false);
    const createRequest = useCreatePrivacyRequest();
    const exportData = useExportPersonalData();

    const handleDownload = async () => {
        const result = await exportData.mutateAsync();
        if (!result.success) {
            toast.error(result.error || "Failed to export data");
            return;
        }

        const blob = new Blob([JSON.stringify(result.data.payload, null, 2)], {
            type: "application/json;charset=utf-8",
        });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        toast.success("Personal data export downloaded");
    };

    const handleDeletionRequest = async () => {
        const result = await createRequest.mutateAsync({
            kind: "DELETION",
        });

        if (!result.success) {
            toast.error(result.error || "Failed to submit request");
            return;
        }

        setConfirmDeletion(false);
        toast.success("Deletion request submitted");
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Privacy and Data</CardTitle>
                    <CardDescription>
                        Download your personal data or request account deletion.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-lg border p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <h3 className="text-sm font-medium">Download your data</h3>
                                <p className="text-sm text-muted-foreground">
                                    Export a JSON copy of your profile, workspace records, tasks, wiki pages,
                                    messages, and preferences.
                                </p>
                            </div>
                            <Button onClick={handleDownload} disabled={exportData.isPending} className="sm:shrink-0">
                                <Download className="mr-2 h-4 w-4" />
                                {exportData.isPending ? "Preparing..." : "Download JSON"}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-destructive/30 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <h3 className="text-sm font-medium">Danger zone</h3>
                                <p className="text-sm text-muted-foreground">
                                    Request account deletion if you want maintainers to review and remove your account data.
                                </p>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={() => setConfirmDeletion(true)}
                                disabled={createRequest.isPending}
                                className="sm:shrink-0"
                            >
                                <ShieldAlert className="mr-2 h-4 w-4" />
                                Delete account
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={confirmDeletion} onOpenChange={setConfirmDeletion}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit deletion request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This creates a tracked deletion request for the maintainers. It does not immediately erase your account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletionRequest}>
                            Submit request
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
