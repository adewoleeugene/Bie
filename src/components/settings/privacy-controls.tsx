"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Download, FileWarning, ShieldAlert } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    useCreatePrivacyRequest,
    useExportPersonalData,
    usePrivacyRequests,
} from "@/hooks/use-privacy";

export function PrivacyControls() {
    const [details, setDetails] = useState("");
    const [confirmDeletion, setConfirmDeletion] = useState(false);
    const { data: requests = [] } = usePrivacyRequests();
    const createRequest = useCreatePrivacyRequest();
    const exportData = useExportPersonalData();

    const pendingDeletion = useMemo(
        () => requests.find((request) => request.kind === "DELETION" && request.status === "PENDING"),
        [requests],
    );

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

    const handleRequest = async (kind: "EXPORT" | "DELETION") => {
        const result = await createRequest.mutateAsync({
            kind,
            details: details.trim() || undefined,
        });

        if (!result.success) {
            toast.error(result.error || "Failed to submit request");
            return;
        }

        setDetails("");
        setConfirmDeletion(false);
        toast.success(kind === "DELETION" ? "Deletion request submitted" : "Export request submitted");
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Privacy and Data</CardTitle>
                    <CardDescription>
                        Download your personal data or submit privacy-related requests.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-sm font-medium">Self-service data export</h3>
                                <p className="text-sm text-muted-foreground">
                                    Download a JSON export of your profile, memberships, preferences, reflections,
                                    tasks, wiki records, messages, and submitted privacy requests.
                                </p>
                            </div>
                            <Button onClick={handleDownload} disabled={exportData.isPending}>
                                <Download className="mr-2 h-4 w-4" />
                                {exportData.isPending ? "Preparing..." : "Download JSON"}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="privacy-request-details">Request details</Label>
                        <Textarea
                            id="privacy-request-details"
                            placeholder="Add context for your request, such as scope, timing, or legal basis."
                            value={details}
                            onChange={(event) => setDetails(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            These details are stored with the request and emailed to the privacy contact if SMTP is configured.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            onClick={() => handleRequest("EXPORT")}
                            disabled={createRequest.isPending}
                        >
                            <FileWarning className="mr-2 h-4 w-4" />
                            Request manual export review
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setConfirmDeletion(true)}
                            disabled={createRequest.isPending || Boolean(pendingDeletion)}
                        >
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            {pendingDeletion ? "Deletion request pending" : "Request account deletion"}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <h3 className="text-sm font-medium">Recent requests</h3>
                            <p className="text-sm text-muted-foreground">
                                Last 10 privacy requests linked to your account.
                            </p>
                        </div>
                        {requests.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No privacy requests submitted yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {requests.map((request) => (
                                    <div
                                        key={request.id}
                                        className="flex items-start justify-between gap-4 rounded-lg border p-3"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">
                                                    {request.kind === "DELETION" ? "Account deletion" : "Data export"}
                                                </span>
                                                <Badge variant="outline">{request.status}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Submitted {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                                            </p>
                                            {request.details ? (
                                                <p className="text-sm text-muted-foreground">{request.details}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
                        <AlertDialogAction onClick={() => handleRequest("DELETION")}>
                            Submit request
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
