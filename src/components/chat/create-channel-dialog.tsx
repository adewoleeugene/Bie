"use client";

import { useMemo, useState } from "react";
import { Hash, Plus } from "lucide-react";
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
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCreateChannel } from "@/hooks/use-chat";
import { useMembers } from "@/hooks/use-members";

interface CreateChannelDialogProps {
    onCreated: (conversationId: string) => void;
}

type ChatMember = {
    id: string;
    name: string;
    image: string | null;
    role: OrgRole;
};

export function CreateChannelDialog({ onCreated }: CreateChannelDialogProps) {
    const { data: session } = useSession();
    const { data: members } = useMembers();
    const createChannel = useCreateChannel();

    const [open, setOpen] = useState(false);
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
            member.role !== OrgRole.GUEST &&
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

    const reset = () => {
        setName("");
        setTopic("");
        setIsPrivate(false);
        setSelectedIds(new Set());
        setSearch("");
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
            setOpen(false);
            reset();
        }
    };

    if (!canCreate) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Create channel</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Create Channel
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <Input
                        placeholder="channel-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <Textarea
                        placeholder="Topic"
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        className="min-h-20"
                    />
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <Label htmlFor="private-channel" className="text-sm">
                            Private channel
                        </Label>
                        <Switch
                            id="private-channel"
                            checked={isPrivate}
                            onCheckedChange={setIsPrivate}
                        />
                    </div>

                    {isPrivate && (
                        <>
                            <Input
                                placeholder="Search members..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                            <div className="max-h-[240px] overflow-y-auto space-y-1">
                                {selectableMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        className="w-full flex items-center gap-3 rounded-md px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                        {createChannel.isPending ? "Creating..." : "Create Channel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
