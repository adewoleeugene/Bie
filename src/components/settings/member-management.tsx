"use client";

import { useState } from "react";
import { OrgRole } from "@prisma/client";
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
import { MoreHorizontal, Plus, Shield, ShieldCheck, User, UserMinus } from "lucide-react";
import { useMembers, useInviteMember, useRemoveMember, useUpdateMemberRole } from "@/hooks/use-members";
import { toast } from "sonner";

const ROLE_CONFIG: Record<OrgRole, { label: string; color: string; icon: typeof Shield }> = {
    OWNER: { label: "Owner", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: ShieldCheck },
    ADMIN: { label: "Admin", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Shield },
    MEMBER: { label: "Member", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", icon: User },
    GUEST: { label: "Guest", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: User },
};

export function MemberManagement() {
    const { data: members = [], isLoading } = useMembers();
    const inviteMember = useInviteMember();
    const removeMember = useRemoveMember();
    const updateRole = useUpdateMemberRole();

    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<OrgRole>(OrgRole.MEMBER);
    const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string } | null>(null);

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;

        const result = await inviteMember.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
        if (result.success) {
            toast.success("Member invited successfully");
            setInviteEmail("");
            setInviteRole(OrgRole.MEMBER);
            setInviteOpen(false);
        } else {
            toast.error(result.error || "Failed to invite member");
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
                        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
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
                                        Invite a user to your workspace by email.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="invite-email">Email address</Label>
                                        <Input
                                            id="invite-email"
                                            type="email"
                                            placeholder="colleague@example.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <Select
                                            value={inviteRole}
                                            onValueChange={(v) => setInviteRole(v as OrgRole)}
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
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleInvite}
                                        disabled={!inviteEmail.trim() || inviteMember.isPending}
                                    >
                                        {inviteMember.isPending ? "Inviting..." : "Send Invite"}
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
