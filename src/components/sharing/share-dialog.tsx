"use client";

import { useEffect, useState } from "react";
import { ResourceMemberRole, ResourceVisibility } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Globe, Lock, Trash2, Copy, ExternalLink, Eye } from "lucide-react";
import { useMembers } from "@/hooks/use-members";
import { toast } from "sonner";

/**
 * Generic share dialog. Resource-agnostic — just hand it the current state
 * and a set of mutation callbacks. Used by both wiki pages and databases.
 */

export interface ShareMember {
    userId: string;
    role: ResourceMemberRole;
    user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
    };
}

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    visibility: ResourceVisibility;
    members: ShareMember[];
    /** Resource owner's user id; viewer matching this id sees the transfer UI. */
    ownerId?: string;
    viewerUserId?: string;
    onSetVisibility: (v: ResourceVisibility) => Promise<void> | void;
    onAddMember: (userId: string, role: ResourceMemberRole) => Promise<void> | void;
    onRemoveMember: (userId: string) => Promise<void> | void;
    onTransferOwnership?: (newOwnerId: string) => Promise<void> | void;
    /** When provided, shows a "Copy link" button (publishes + copies a public link). */
    onCopyLink?: () => Promise<void> | void;
    /** When provided, shows a "Preview" link opening the public page in a new tab. */
    previewUrl?: string;
}

export function ShareDialog({
    open,
    onOpenChange,
    title,
    visibility,
    members,
    ownerId,
    viewerUserId,
    onSetVisibility,
    onAddMember,
    onRemoveMember,
    onTransferOwnership,
    onCopyLink,
    previewUrl,
}: ShareDialogProps) {
    const isOwner =
        !!ownerId && !!viewerUserId && ownerId === viewerUserId;
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferTargetId, setTransferTargetId] = useState<string>("");
    const { data: orgMembers } = useMembers();
    const [search, setSearch] = useState("");
    const [pendingRole, setPendingRole] = useState<ResourceMemberRole>("EDITOR");

    useEffect(() => {
        if (!open) setSearch("");
    }, [open]);

    const memberIds = new Set(members.map((m) => m.userId));
    const candidates = (orgMembers || [])
        .filter((m) => !memberIds.has(m.id))
        .filter((m) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                (m.name || "").toLowerCase().includes(q) ||
                (m.email || "").toLowerCase().includes(q)
            );
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Share &quot;{title}&quot;</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Public link */}
                    {(onCopyLink || previewUrl) && (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Link to page</p>
                                <p className="text-[10px] text-neutral-500">
                                    Publishes the page and copies a public link.
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {previewUrl && (
                                    <Button asChild size="sm" variant="ghost">
                                        <a
                                            href={previewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                            Preview
                                        </a>
                                    </Button>
                                )}
                                {onCopyLink && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => onCopyLink()}
                                    >
                                        <Copy className="mr-2 h-3.5 w-3.5" />
                                        Copy link
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Visibility */}
                    <div>
                        <h4 className="mb-2 text-[10px] font-semibold uppercase text-neutral-500">
                            Who can access
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => onSetVisibility("ORG")}
                                className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left ${
                                    visibility === "ORG"
                                        ? "border-primary bg-primary/5"
                                        : "border-neutral-200 dark:border-neutral-800"
                                }`}
                            >
                                <Globe className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Org can edit</span>
                                <span className="text-[10px] text-neutral-500">
                                    Anyone in the org can view and edit.
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onSetVisibility("ORG_VIEW")}
                                className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left ${
                                    visibility === "ORG_VIEW"
                                        ? "border-primary bg-primary/5"
                                        : "border-neutral-200 dark:border-neutral-800"
                                }`}
                            >
                                <Eye className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Org can view</span>
                                <span className="text-[10px] text-neutral-500">
                                    Anyone in the org can read; only invited people edit.
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onSetVisibility("PRIVATE")}
                                className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left ${
                                    visibility === "PRIVATE"
                                        ? "border-primary bg-primary/5"
                                        : "border-neutral-200 dark:border-neutral-800"
                                }`}
                            >
                                <Lock className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Private</span>
                                <span className="text-[10px] text-neutral-500">
                                    Only the creator + people you add.
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Members list */}
                    {visibility === "PRIVATE" && (
                        <div>
                            <h4 className="mb-2 text-[10px] font-semibold uppercase text-neutral-500">
                                People with access
                            </h4>
                            {members.length === 0 ? (
                                <p className="text-xs italic text-neutral-500">
                                    Only the creator currently.
                                </p>
                            ) : (
                                <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 dark:divide-neutral-900 dark:border-neutral-800">
                                    {members.map((m) => (
                                        <li
                                            key={m.userId}
                                            className="flex items-center gap-2 px-3 py-2"
                                        >
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={m.user.image || undefined} />
                                                <AvatarFallback className="text-[10px]">
                                                    {(m.user.name || m.user.email || "?")
                                                        .substring(0, 2)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm">
                                                    {m.user.name || m.user.email}
                                                </div>
                                                <div className="truncate text-[10px] text-neutral-500">
                                                    {m.user.email}
                                                </div>
                                            </div>
                                            <Select
                                                value={m.role}
                                                onValueChange={async (v) => {
                                                    await onAddMember(
                                                        m.userId,
                                                        v as ResourceMemberRole,
                                                    );
                                                    toast.success("Role updated");
                                                }}
                                            >
                                                <SelectTrigger className="h-7 w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="VIEWER">Viewer</SelectItem>
                                                    <SelectItem value="EDITOR">Editor</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveMember(m.userId)}
                                                aria-label="Remove"
                                                className="text-neutral-400 hover:text-red-500"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Add new */}
                            <div className="mt-3">
                                <div className="mb-2 flex items-center gap-2">
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search org members…"
                                        className="h-8"
                                    />
                                    <Select
                                        value={pendingRole}
                                        onValueChange={(v) =>
                                            setPendingRole(v as ResourceMemberRole)
                                        }
                                    >
                                        <SelectTrigger className="h-8 w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="VIEWER">Viewer</SelectItem>
                                            <SelectItem value="EDITOR">Editor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {candidates.length === 0 ? (
                                    <p className="text-xs italic text-neutral-500">
                                        No matching members.
                                    </p>
                                ) : (
                                    <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-neutral-200 p-1 dark:border-neutral-800">
                                        {candidates.map((m) => (
                                            <li key={m.id}>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await onAddMember(m.id, pendingRole);
                                                        toast.success("Member added");
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                                >
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage
                                                            src={m.image || undefined}
                                                        />
                                                        <AvatarFallback className="text-[10px]">
                                                            {(m.name || m.email || "?")
                                                                .substring(0, 2)
                                                                .toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-xs font-medium">
                                                            {m.name || "Unknown"}
                                                        </div>
                                                        <div className="truncate text-[10px] text-neutral-500">
                                                            {m.email}
                                                        </div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {isOwner && onTransferOwnership && (
                        <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
                            {!transferOpen ? (
                                <button
                                    type="button"
                                    onClick={() => setTransferOpen(true)}
                                    className="text-xs text-neutral-500 hover:text-primary"
                                >
                                    Transfer ownership →
                                </button>
                            ) : (
                                <div>
                                    <h4 className="mb-2 text-[10px] font-semibold uppercase text-neutral-500">
                                        Transfer ownership
                                    </h4>
                                    <p className="mb-2 text-[11px] text-neutral-500">
                                        You&apos;ll keep edit access as a regular member.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={transferTargetId}
                                            onValueChange={setTransferTargetId}
                                        >
                                            <SelectTrigger className="h-8 flex-1">
                                                <SelectValue placeholder="Pick new owner…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(orgMembers || [])
                                                    .filter((m) => m.id !== viewerUserId)
                                                    .map((m) => (
                                                        <SelectItem key={m.id} value={m.id}>
                                                            {m.name || m.email}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            disabled={!transferTargetId}
                                            onClick={async () => {
                                                if (!transferTargetId) return;
                                                await onTransferOwnership(transferTargetId);
                                                toast.success("Ownership transferred");
                                                setTransferOpen(false);
                                                setTransferTargetId("");
                                                onOpenChange(false);
                                            }}
                                        >
                                            Transfer
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setTransferOpen(false);
                                                setTransferTargetId("");
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button onClick={() => onOpenChange(false)}>Done</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
