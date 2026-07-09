"use client";

import { useMemo, useState } from "react";
import { ConversationType, OrgRole } from "@prisma/client";
import { Archive, Settings, UserMinus, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import type { ConversationWithPreview } from "@/actions/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAddChannelMembers, useArchiveChannel, useRemoveChannelMember, useRenameChannel } from "@/hooks/use-chat";
import { useMembers } from "@/hooks/use-members";

interface ChannelSettingsDialogProps {
    conversation: ConversationWithPreview;
    onArchived?: () => void;
}

type ChatMember = {
    id: string;
    name: string;
    image: string | null;
    role: OrgRole;
};

export function ChannelSettingsDialog({ conversation, onArchived }: ChannelSettingsDialogProps) {
    const { data: session } = useSession();
    const { data: members } = useMembers();
    const renameChannel = useRenameChannel();
    const archiveChannel = useArchiveChannel();
    const addMembers = useAddChannelMembers();
    const removeMember = useRemoveChannelMember();

    const [open, setOpen] = useState(false);
    const [name, setName] = useState(conversation.name ?? "");
    const [topic, setTopic] = useState(conversation.topic ?? "");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const chatMembers = useMemo(() => (members || []) as ChatMember[], [members]);
    const currentMember = chatMembers.find((member) => member.id === session?.user?.id);
    const canManage =
        conversation.type === ConversationType.CHANNEL &&
        (conversation.createdById === session?.user?.id ||
            currentMember?.role === OrgRole.OWNER ||
            currentMember?.role === OrgRole.ADMIN);

    const existingMemberIds = new Set(conversation.members.map((member) => member.userId));
    const availableMembers = chatMembers.filter(
        (member) => member.role !== OrgRole.GUEST && !existingMemberIds.has(member.id),
    );

    const toggleMember = (userId: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleSave = async () => {
        await renameChannel.mutateAsync({
            conversationId: conversation.id,
            input: { name, topic },
        });

        if (selectedIds.size > 0) {
            await addMembers.mutateAsync({
                conversationId: conversation.id,
                memberIds: Array.from(selectedIds),
            });
            setSelectedIds(new Set());
        }

        setOpen(false);
    };

    const handleArchive = async () => {
        await archiveChannel.mutateAsync(conversation.id);
        setOpen(false);
        onArchived?.();
    };

    if (!canManage) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Channel settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Channel Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                    <div className="space-y-3">
                        <Input value={name} onChange={(event) => setName(event.target.value)} />
                        <Textarea
                            value={topic}
                            onChange={(event) => setTopic(event.target.value)}
                            placeholder="Topic"
                            className="min-h-20"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <UserMinus className="h-4 w-4" />
                            Current members
                        </div>
                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                            {conversation.members.map((member) => (
                                <div key={member.userId} className="flex items-center gap-2 rounded-md px-2 py-1">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={member.user.image || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                            {member.user.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="flex-1 text-sm">{member.user.name}</span>
                                    {member.userId !== session?.user?.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-red-500 hover:text-red-600"
                                            onClick={() => removeMember.mutate({
                                                conversationId: conversation.id,
                                                memberId: member.userId,
                                            })}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {availableMembers.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <UserPlus className="h-4 w-4" />
                                Add members
                            </div>
                            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                                {availableMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                        onClick={() => toggleMember(member.id)}
                                    >
                                        <Checkbox checked={selectedIds.has(member.id)} />
                                        <Avatar className="h-7 w-7">
                                            <AvatarImage src={member.image || undefined} />
                                            <AvatarFallback className="text-[10px]">
                                                {member.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{member.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            className="gap-1.5 text-red-600 hover:text-red-700"
                            onClick={handleArchive}
                            disabled={archiveChannel.isPending}
                        >
                            <Archive className="h-4 w-4" />
                            Archive
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!name.trim() || renameChannel.isPending || addMembers.isPending}
                        >
                            Save changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
