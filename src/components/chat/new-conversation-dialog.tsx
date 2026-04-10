"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useMembers } from "@/hooks/use-members";
import { useCreateConversation } from "@/hooks/use-chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

interface NewConversationDialogProps {
    onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ onCreated }: NewConversationDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");

    const { data: members } = useMembers();
    const { data: session } = useSession();
    const createConversation = useCreateConversation();

    const filteredMembers = (members || []).filter(
        (m: any) =>
            m.id !== session?.user?.id &&
            m.name?.toLowerCase().includes(search.toLowerCase())
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
        if (selectedIds.size === 0) return;

        const result = await createConversation.mutateAsync({
            name: selectedIds.size > 1 ? name || undefined : undefined,
            memberIds: Array.from(selectedIds),
            isGroup: selectedIds.size > 1,
        });

        if (result.success && result.data) {
            onCreated(result.data.id);
            setOpen(false);
            setName("");
            setSelectedIds(new Set());
            setSearch("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    New
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    {selectedIds.size > 1 && (
                        <Input
                            placeholder="Group name (optional)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    )}

                    <Input
                        placeholder="Search members..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {filteredMembers.map((member: any) => (
                            <button
                                key={member.id}
                                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                        {filteredMembers.length === 0 && (
                            <p className="text-sm text-neutral-500 text-center py-4">No members found</p>
                        )}
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleCreate}
                        disabled={selectedIds.size === 0 || createConversation.isPending}
                    >
                        {createConversation.isPending
                            ? "Creating..."
                            : `Start Chat${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
