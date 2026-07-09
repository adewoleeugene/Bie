"use client";

import { useEffect, useState } from "react";
import { ProjectRole, ProjectVisibility } from "@prisma/client";
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
import { Copy, Link2, Trash2, UserPlus } from "lucide-react";
import { useInviteProjectMember, useCreateProjectInviteLink } from "@/hooks/use-members";
import {
    useProjectSharing,
    useRemoveProjectMember,
    useSetProjectVisibility,
    useUpdateProjectMemberRole,
} from "@/hooks/use-projects";
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
    const [open, setOpen] = useState(false);
    const inviteMember = useInviteProjectMember(projectId);
    const createLink = useCreateProjectInviteLink(projectId);
    const { data: sharing } = useProjectSharing(projectId, open);
    const setVisibility = useSetProjectVisibility(projectId);
    const updateRole = useUpdateProjectMemberRole(projectId);
    const removeMember = useRemoveProjectMember(projectId);

    const [email, setEmail] = useState("");
    const [role, setRole] = useState<ProjectRole>(ProjectRole.EDITOR);
    const [visibility, setVisibilityValue] = useState<ProjectVisibility>(ProjectVisibility.ORG_VISIBLE);
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

    useEffect(() => {
        if (sharing?.success && sharing.data) {
            setVisibilityValue(sharing.data.visibility);
        }
    }, [sharing]);

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

    const handleVisibilityChange = async (value: ProjectVisibility) => {
        setVisibilityValue(value);
        const result = await setVisibility.mutateAsync(value);
        if (result.success) {
            toast.success("Project visibility updated");
        } else {
            toast.error(result.error || "Failed to update visibility");
        }
    };

    const handleRoleChange = async (userId: string, nextRole: ProjectRole) => {
        const result = await updateRole.mutateAsync({ userId, role: nextRole });
        if (result.success) {
            toast.success("Access updated");
        } else {
            toast.error(result.error || "Failed to update access");
        }
    };

    const handleRemoveMember = async (userId: string) => {
        const result = await removeMember.mutateAsync(userId);
        if (result.success) {
            toast.success("Removed from project");
        } else {
            toast.error(result.error || "Failed to remove member");
        }
    };

    const handleCopy = async (value: string, label: string) => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        toast.success(`${label} copied`);
    };

    const sharingData = sharing?.success ? sharing.data : undefined;

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
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Share project</DialogTitle>
                    <DialogDescription>
                        Control who can see this project and what they can do.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Visibility</Label>
                        <Select
                            value={visibility}
                            onValueChange={(v) => handleVisibilityChange(v as ProjectVisibility)}
                            disabled={setVisibility.isPending}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ProjectVisibility.ORG_VISIBLE}>
                                    Org-visible
                                </SelectItem>
                                <SelectItem value={ProjectVisibility.PRIVATE}>
                                    Private
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {sharingData && sharingData.members.length > 0 && (
                        <div className="space-y-2">
                            <Label>People with access</Label>
                            <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-2">
                                {sharingData.members.map((member) => (
                                    <div key={member.userId} className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{member.user.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                                        </div>
                                        <Select
                                            value={member.role}
                                            onValueChange={(v) => handleRoleChange(member.userId, v as ProjectRole)}
                                            disabled={updateRole.isPending}
                                        >
                                            <SelectTrigger className="w-28">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={ProjectRole.VIEWER}>Viewer</SelectItem>
                                                <SelectItem value={ProjectRole.EDITOR}>Editor</SelectItem>
                                                <SelectItem value={ProjectRole.ADMIN}>Full</SelectItem>
                                                <SelectItem value={ProjectRole.OWNER}>Owner</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveMember(member.userId)}
                                            disabled={removeMember.isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Remove member</span>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
