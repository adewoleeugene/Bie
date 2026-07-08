"use client";

import { useState } from "react";
import { OrgRole, ProjectRole } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Copy, Link2, Mail, MoreHorizontal, Plus, Shield, ShieldCheck, Trash2, User, UserMinus } from "lucide-react";
import {
    useMembers,
    useInviteMember,
    useCreateInviteLink,
    useWorkspaceInvites,
    useRevokeInvitation,
    useRemoveMember,
    useUpdateMemberRole,
} from "@/hooks/use-members";
import { useProjects } from "@/hooks/use-projects";
import { inviteProjectMember, createProjectInviteLink } from "@/actions/members";
import { toast } from "sonner";

const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    EDITOR: "Editor",
    VIEWER: "Viewer",
};

const PROJECT_INVITE_ROLES: ProjectRole[] = [ProjectRole.EDITOR, ProjectRole.VIEWER, ProjectRole.ADMIN];

const WORKSPACE_SCOPE = "workspace";

function roleLabelOf(role: string) {
    return (
        ROLE_CONFIG[role as OrgRole]?.label ??
        PROJECT_ROLE_LABELS[role as ProjectRole] ??
        role
    );
}

const LINK_EXPIRY_OPTIONS: { label: string; value: string; minutes: number | null }[] = [
    { label: "10 minutes", value: "10", minutes: 10 },
    { label: "1 hour", value: "60", minutes: 60 },
    { label: "24 hours", value: "1440", minutes: 60 * 24 },
    { label: "7 days", value: "10080", minutes: 60 * 24 * 7 },
    { label: "No expiry", value: "never", minutes: null },
];

function formatLinkExpiry(expiresAt: Date | string) {
    const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    const ms = end.getTime() - Date.now();
    if (ms <= 0) return "Expired";
    if (ms / 86_400_000 > 365) return "No expiry";
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return `Expires in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Expires in ${hours}h`;
    return `Expires in ${Math.floor(hours / 24)}d`;
}

const ROLE_CONFIG: Record<OrgRole, { label: string; color: string; icon: typeof Shield }> = {
    OWNER: { label: "Owner", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: ShieldCheck },
    ADMIN: { label: "Admin", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Shield },
    MEMBER: { label: "Member", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", icon: User },
    GUEST: { label: "Guest", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: User },
};

export function MemberManagement() {
    const { data: members = [], isLoading } = useMembers();
    const { data: projects = [] } = useProjects();
    const { data: invites } = useWorkspaceInvites();
    const inviteMember = useInviteMember();
    const createInviteLink = useCreateInviteLink();
    const revokeInvite = useRevokeInvitation();
    const removeMember = useRemoveMember();
    const updateRole = useUpdateMemberRole();

    const pendingInvites = invites?.pending ?? [];
    const shareableLinks = invites?.links ?? [];

    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteScope, setInviteScope] = useState<string>(WORKSPACE_SCOPE);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<OrgRole>(OrgRole.MEMBER);
    const [projectRole, setProjectRole] = useState<ProjectRole>(ProjectRole.EDITOR);
    const [personalLink, setPersonalLink] = useState("");
    const [shareLink, setShareLink] = useState("");
    const [linkExpiry, setLinkExpiry] = useState<string>("1440");
    const [isInviting, setIsInviting] = useState(false);
    const [isLinking, setIsLinking] = useState(false);
    const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string } | null>(null);

    const isProjectScope = inviteScope !== WORKSPACE_SCOPE;
    const currentRoleLabel = isProjectScope
        ? PROJECT_ROLE_LABELS[projectRole]
        : ROLE_CONFIG[inviteRole].label;

    const resetInvite = () => {
        setInviteScope(WORKSPACE_SCOPE);
        setInviteEmail("");
        setInviteRole(OrgRole.MEMBER);
        setProjectRole(ProjectRole.EDITOR);
        setPersonalLink("");
        setShareLink("");
        setLinkExpiry("1440");
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;

        setIsInviting(true);
        const email = inviteEmail.trim();
        const result = isProjectScope
            ? await inviteProjectMember(inviteScope, email, projectRole)
            : await inviteMember.mutateAsync({ email, role: inviteRole });
        setIsInviting(false);

        if (result.success) {
            if (result.inviteUrl) {
                setPersonalLink(new URL(result.inviteUrl, window.location.origin).toString());
                toast.success(`Invite sent to ${email}`);
                return;
            }

            toast.success(isProjectScope ? "Added to project" : "Member added successfully");
            resetInvite();
            setInviteOpen(false);
        } else {
            toast.error(result.error || "Failed to invite member");
        }
    };

    const handleCreateShareLink = async () => {
        const expiresInMinutes = LINK_EXPIRY_OPTIONS.find((o) => o.value === linkExpiry)?.minutes ?? null;
        setIsLinking(true);
        const result = isProjectScope
            ? await createProjectInviteLink(inviteScope, projectRole, expiresInMinutes)
            : await createInviteLink.mutateAsync({ role: inviteRole, expiresInMinutes });
        setIsLinking(false);

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

    const handleRevoke = async (invitationId: string) => {
        const result = await revokeInvite.mutateAsync(invitationId);
        if (result.success) {
            toast.success("Invite revoked");
        } else {
            toast.error(result.error || "Failed to revoke invite");
        }
    };

    const handleRemove = async (userId: string) => {
        const result = await removeMember.mutateAsync(userId);
        if (result.success) {
            toast.success("Member removed");
        } else {
            toast.error(result.error || "Failed to remove member");
        }
        setRemoveConfirm(null);
    };

    const handleRoleChange = async (userId: string, role: OrgRole) => {
        const result = await updateRole.mutateAsync({ userId, role });
        if (result.success) {
            toast.success("Role updated");
        } else {
            toast.error(result.error || "Failed to update role");
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Members</CardTitle>
                            <CardDescription>Manage workspace members and their roles.</CardDescription>
                        </div>
                        <Dialog
                            open={inviteOpen}
                            onOpenChange={(open) => {
                                setInviteOpen(open);
                                if (!open) {
                                    resetInvite();
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Invite
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Invite Member</DialogTitle>
                                    <DialogDescription>
                                        Invite people by email, or share a link anyone can use to join.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label>Invite to</Label>
                                        <Select
                                            value={inviteScope}
                                            onValueChange={(v) => {
                                                setInviteScope(v);
                                                setShareLink("");
                                                setPersonalLink("");
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={WORKSPACE_SCOPE}>Whole workspace</SelectItem>
                                                {projects.map((project) => (
                                                    <SelectItem key={project.id} value={project.id}>
                                                        {project.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        {isProjectScope ? (
                                            <Select
                                                value={projectRole}
                                                onValueChange={(v) => {
                                                    setProjectRole(v as ProjectRole);
                                                    setShareLink("");
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PROJECT_INVITE_ROLES.map((r) => (
                                                        <SelectItem key={r} value={r}>
                                                            {PROJECT_ROLE_LABELS[r]}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Select
                                                value={inviteRole}
                                                onValueChange={(v) => {
                                                    setInviteRole(v as OrgRole);
                                                    setShareLink("");
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MEMBER">Member</SelectItem>
                                                    <SelectItem value="GUEST">Guest</SelectItem>
                                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                                    <SelectItem value="OWNER">Owner</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="invite-email">Invite by email</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="invite-email"
                                                type="email"
                                                placeholder="colleague@example.com"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                                            />
                                            <Button
                                                onClick={handleInvite}
                                                disabled={!inviteEmail.trim() || isInviting}
                                            >
                                                {isInviting ? "Sending..." : "Send"}
                                            </Button>
                                        </div>
                                        {personalLink && (
                                            <div className="flex gap-2 pt-1">
                                                <Input
                                                    value={personalLink}
                                                    readOnly
                                                    className="font-mono text-xs"
                                                />
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
                                        )}
                                        {personalLink && (
                                            <p className="text-xs text-muted-foreground">
                                                This link only works for {inviteEmail.trim()}.
                                            </p>
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
                                                    <Input
                                                        value={shareLink}
                                                        readOnly
                                                        className="font-mono text-xs"
                                                    />
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
                                                    Anyone with this link can join
                                                    {isProjectScope ? " this project" : ""} as {currentRoleLabel}.
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
                                                    disabled={isLinking}
                                                >
                                                    <Link2 className="mr-2 h-4 w-4" />
                                                    {isLinking
                                                        ? "Creating..."
                                                        : `Create link for ${currentRoleLabel}s`}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setInviteOpen(false)}>
                                        Done
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading members...</p>
                    ) : (
                        <div className="space-y-3">
                            {members.map((member) => {
                                const config = ROLE_CONFIG[member.role as OrgRole] ?? ROLE_CONFIG.MEMBER;
                                const initials = member.name
                                    ?.split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .toUpperCase() || "?";

                                return (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between py-2"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={member.image || undefined} />
                                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium leading-tight">
                                                    {member.name || "Unknown"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {member.email}
                                                </p>
                                                {(member.role !== "GUEST" || member.projects.length > 0) && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {member.role !== "GUEST" && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] font-normal text-muted-foreground"
                                                            >
                                                                {member.workspaceName} · {ROLE_CONFIG[member.role as OrgRole].label}
                                                            </Badge>
                                                        )}
                                                        {member.projects.map((project) => (
                                                            <Badge
                                                                key={project.id}
                                                                variant="outline"
                                                                className="text-[10px] font-normal text-muted-foreground"
                                                            >
                                                                {member.workspaceName} / {project.name} · {PROJECT_ROLE_LABELS[project.role]}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] ${config.color}`}
                                            >
                                                {config.label}
                                            </Badge>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>
                                                            <Shield className="mr-2 h-4 w-4" />
                                                            Change role
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent>
                                                            {(["OWNER", "ADMIN", "MEMBER", "GUEST"] as OrgRole[]).map((role) => (
                                                                <DropdownMenuItem
                                                                    key={role}
                                                                    disabled={member.role === role}
                                                                    onClick={() => handleRoleChange(member.id, role)}
                                                                >
                                                                    {ROLE_CONFIG[role].label}
                                                                    {member.role === role && " (current)"}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() =>
                                                            setRemoveConfirm({
                                                                id: member.id,
                                                                name: member.name || member.email || "this member",
                                                            })
                                                        }
                                                    >
                                                        <UserMinus className="mr-2 h-4 w-4" />
                                                        Remove member
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}

                            {members.length === 0 && (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    No members found.
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {pendingInvites.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pending invitations</CardTitle>
                        <CardDescription>People invited by email who haven&apos;t accepted yet.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {pendingInvites.map((invite) => (
                                <div key={invite.id} className="flex items-center justify-between gap-3 py-1">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-500/10">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-tight">{invite.email}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {invite.scope === "PROJECT"
                                                    ? `${invite.projectName ?? "Project"} · ${roleLabelOf(invite.role)}`
                                                    : `Whole workspace · ${roleLabelOf(invite.role)}`}
                                                {invite.invitedByName ? ` · invited by ${invite.invitedByName}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleRevoke(invite.id)}
                                        disabled={revokeInvite.isPending}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {shareableLinks.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Shareable links</CardTitle>
                        <CardDescription>Open links anyone can use to join. Revoke to disable.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {shareableLinks.map((link) => {
                                const url = new URL(`/invite/${link.token}`, window.location.origin).toString();
                                return (
                                    <div key={link.id} className="space-y-1.5">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            {link.scope === "PROJECT"
                                                ? `${link.projectName ?? "Project"} · ${roleLabelOf(link.role)}`
                                                : `Whole workspace · ${roleLabelOf(link.role)}`}
                                            <span className="ml-2 font-normal text-neutral-500">
                                                {formatLinkExpiry(link.expiresAt)}
                                            </span>
                                        </p>
                                        <div className="flex gap-2">
                                            <Input value={url} readOnly className="font-mono text-xs" />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleCopy(url, "Link")}
                                            >
                                                <Copy className="h-4 w-4" />
                                                <span className="sr-only">Copy link</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRevoke(link.id)}
                                                disabled={revokeInvite.isPending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Revoke link</span>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <AlertDialog open={!!removeConfirm} onOpenChange={() => setRemoveConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove member</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove {removeConfirm?.name} from the workspace?
                            They will lose access to all projects and data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => removeConfirm && handleRemove(removeConfirm.id)}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
