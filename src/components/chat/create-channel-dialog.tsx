"use client";

import { useMemo, useState } from "react";
import { Hash } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCreateChannel } from "@/hooks/use-chat";
import { useMembers } from "@/hooks/use-members";

interface CreateChannelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (conversationId: string) => void;
}

type ChatMember = {
    id: string;
    name: string;
    image: string | null;
    role: OrgRole;
};

export function CreateChannelDialog({ open, onOpenChange, onCreated }: CreateChannelDialogProps) {
    const { data: session } = useSession();
    const { data: members } = useMembers();
    const createChannel = useCreateChannel();

    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");

    const chatMembers = useMemo(() => (members || []) as ChatMember[], [members]);
    const currentMember = chatMembers.find((member) => member.id === session?.user?.id);
    const canCreate = currentMember?.role === OrgRole.OWNER || currentMember?.role === OrgRole.ADMIN;

    const selectableMembers = useMemo(
        () => chatMembers.filter((member) =>
            member.id !== session?.user?.id &&
            member.name?.toLowerCase().includes(search.toLowerCase())
        ),
        [chatMembers, search, session?.user?.id],
    );

    const toggleMember = (userId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleCreate = async () => {
        if (!name.trim()) return;

        const result = await createChannel.mutateAsync({
            name,
            topic,
            isPrivate,
            memberIds: Array.from(selectedIds),
        });

        if (result.success && result.data) {
            onCreated(result.data.id);
            onOpenChange(false);
        }
    };

    if (!canCreate) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        New channel
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <Input
                        placeholder="channel-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoFocus
                    />
                    <Textarea
                        placeholder="Topic (optional)"
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        className="min-h-20"
                    />
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div>
                            <Label htmlFor="private-channel" className="text-sm">
                                Private channel
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {isPrivate ? "Only invited people can see it" : "Everyone in the workspace can join"}
                            </p>
                        </div>
                        <Switch
                            id="private-channel"
                            checked={isPrivate}
                            onCheckedChange={setIsPrivate}
                        />
                    </div>

                    {isPrivate && (
                        <>
                            <Input
                                placeholder="Search people..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                            <div className="max-h-[240px] space-y-1 overflow-y-auto">
                                {selectableMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted"
                                        onClick={() => toggleMember(member.id)}
                                    >
                                        <Checkbox checked={selectedIds.has(member.id)} />
                                        <Avatar className="h-7 w-7">
                                            <AvatarImage src={member.image || undefined} />
                                            <AvatarFallback className="text-[10px]">
                                                {member.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{member.name}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <Button
                        className="w-full"
                        onClick={handleCreate}
                        disabled={!name.trim() || createChannel.isPending}
                    >
                        {createChannel.isPending ? "Creating..." : "Create channel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
