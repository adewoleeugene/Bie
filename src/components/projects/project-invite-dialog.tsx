"use client";

import { useState } from "react";
import { ProjectRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Copy, Link2, UserPlus } from "lucide-react";
import { useInviteProjectMember, useCreateProjectInviteLink } from "@/hooks/use-members";
import { toast } from "sonner";

const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    EDITOR: "Editor",
    VIEWER: "Viewer",
};

const INVITE_ROLES: ProjectRole[] = [ProjectRole.EDITOR, ProjectRole.VIEWER, ProjectRole.ADMIN];

const LINK_EXPIRY_OPTIONS: { label: string; value: string; minutes: number | null }[] = [
    { label: "10 minutes", value: "10", minutes: 10 },
    { label: "1 hour", value: "60", minutes: 60 },
    { label: "24 hours", value: "1440", minutes: 60 * 24 },
    { label: "7 days", value: "10080", minutes: 60 * 24 * 7 },
    { label: "No expiry", value: "never", minutes: null },
];

export function ProjectInviteDialog({ projectId }: { projectId: string }) {
    const inviteMember = useInviteProjectMember(projectId);
    const createLink = useCreateProjectInviteLink(projectId);

    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<ProjectRole>(ProjectRole.EDITOR);
    const [personalLink, setPersonalLink] = useState("");
    const [shareLink, setShareLink] = useState("");
    const [linkExpiry, setLinkExpiry] = useState<string>("1440");

    const reset = () => {
        setEmail("");
        setRole(ProjectRole.EDITOR);
        setPersonalLink("");
        setShareLink("");
        setLinkExpiry("1440");
    };

    const handleInvite = async () => {
        if (!email.trim()) return;

        const result = await inviteMember.mutateAsync({ email: email.trim(), role });
        if (result.success) {
            if (result.inviteUrl) {
                setPersonalLink(new URL(result.inviteUrl, window.location.origin).toString());
                toast.success(`Invite sent to ${email.trim()}`);
                return;
            }
            toast.success("Added to project");
            reset();
            setOpen(false);
        } else {
            toast.error(result.error || "Failed to invite");
        }
    };

    const handleCreateShareLink = async () => {
        const expiresInMinutes = LINK_EXPIRY_OPTIONS.find((o) => o.value === linkExpiry)?.minutes ?? null;
        const result = await createLink.mutateAsync({ role, expiresInMinutes });
        if (result.success && result.inviteUrl) {
            setShareLink(new URL(result.inviteUrl, window.location.origin).toString());
            toast.success("Shareable link ready");
        } else {
            toast.error(result.error || "Failed to create link");
        }
    };

    const handleCopy = async (value: string, label: string) => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        toast.success(`${label} copied`);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite to project</DialogTitle>
                    <DialogDescription>
                        Give someone access to just this project, by email or a shareable link.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                            value={role}
                            onValueChange={(v) => {
                                setRole(v as ProjectRole);
                                setShareLink("");
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {INVITE_ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {PROJECT_ROLE_LABELS[r]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="project-invite-email">Invite by email</Label>
                        <div className="flex gap-2">
                            <Input
                                id="project-invite-email"
                                type="email"
                                placeholder="colleague@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                            />
                            <Button
                                onClick={handleInvite}
                                disabled={!email.trim() || inviteMember.isPending}
                            >
                                {inviteMember.isPending ? "Sending..." : "Send"}
                            </Button>
                        </div>
                        {personalLink && (
                            <>
                                <div className="flex gap-2 pt-1">
                                    <Input value={personalLink} readOnly className="font-mono text-xs" />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleCopy(personalLink, "Invite link")}
                                    >
                                        <Copy className="h-4 w-4" />
                                        <span className="sr-only">Copy invite link</span>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    This link only works for {email.trim()}.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-background px-2 text-xs uppercase text-muted-foreground">
                                or
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Shareable link</Label>
                        {shareLink ? (
                            <>
                                <div className="flex gap-2">
                                    <Input value={shareLink} readOnly className="font-mono text-xs" />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleCopy(shareLink, "Shareable link")}
                                    >
                                        <Copy className="h-4 w-4" />
                                        <span className="sr-only">Copy shareable link</span>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Anyone with this link can join this project as {PROJECT_ROLE_LABELS[role]}.
                                </p>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Link expires in..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LINK_EXPIRY_OPTIONS.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.minutes === null ? o.label : `Expires in ${o.label}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleCreateShareLink}
                                    disabled={createLink.isPending}
                                >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    {createLink.isPending
                                        ? "Creating..."
                                        : `Create link for ${PROJECT_ROLE_LABELS[role]}s`}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
