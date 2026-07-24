"use client";

import { formatDistanceToNow } from "date-fns";
import { OrgRole } from "@prisma/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    useOrganizationPrivacyRequests,
    useUpdatePrivacyRequestStatus,
} from "@/hooks/use-privacy";

const STATUS_STYLES: Record<string, string> = {
    PENDING: "border-amber-500/30 text-amber-600",
    IN_REVIEW: "border-blue-500/30 text-blue-600",
    COMPLETED: "border-emerald-500/30 text-emerald-600",
};

export function PrivacyAdminPanel({ role }: { role?: OrgRole }) {
    const canManage = role === OrgRole.OWNER || role === OrgRole.ADMIN;
    const { data: requests = [], isLoading } = useOrganizationPrivacyRequests(canManage);
    const updateStatus = useUpdatePrivacyRequestStatus();

    if (!canManage) {
        return null;
    }

    const handleStatus = async (
        requestId: string,
        status: "PENDING" | "IN_REVIEW" | "COMPLETED",
    ) => {
        const result = await updateStatus.mutateAsync({ requestId, status });
        if (result.success) {
            toast.success(`Request marked ${status.toLowerCase().replace("_", " ")}`);
        } else {
            toast.error(result.error || "Failed to update request");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Privacy Request Review</CardTitle>
                <CardDescription>
                    Review export and deletion requests for this workspace.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading privacy requests...</p>
                ) : requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No privacy requests found for this workspace.</p>
                ) : (
                    <div className="space-y-3">
                        {requests.map((request) => {
                            const initials = request.user.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase();

                            return (
                                <div key={request.id} className="rounded-lg border p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={request.user.image || undefined} />
                                                <AvatarFallback>{initials || "?"}</AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-medium">
                                                        {request.kind === "DELETION" ? "Account deletion" : "Data export"}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className={STATUS_STYLES[request.status] || ""}
                                                    >
                                                        {request.status}
                                                    </Badge>
                                                    {request.isFormerMember && (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-neutral-500/30 text-muted-foreground"
                                                        >
                                                            Former member
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm">{request.user.name}</p>
                                                <p className="text-xs text-muted-foreground">{request.user.email}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Submitted {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                                                </p>
                                                {request.details ? (
                                                    <p className="text-sm text-muted-foreground">{request.details}</p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={updateStatus.isPending || request.status === "PENDING"}
                                                onClick={() => handleStatus(request.id, "PENDING")}
                                            >
                                                Mark pending
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={updateStatus.isPending || request.status === "IN_REVIEW"}
                                                onClick={() => handleStatus(request.id, "IN_REVIEW")}
                                            >
                                                Mark in review
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={updateStatus.isPending || request.status === "COMPLETED"}
                                                onClick={() => handleStatus(request.id, "COMPLETED")}
                                            >
                                                Complete
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
