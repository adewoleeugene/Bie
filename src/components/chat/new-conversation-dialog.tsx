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
} from "@/components/ui/dialog";
import { useMembers } from "@/hooks/use-members";
import { useCreateConversation } from "@/hooks/use-chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import { OrgRole, ProjectRole } from "@prisma/client";

interface NewConversationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (conversationId: string) => void;
}

type ConversationMember = {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: OrgRole;
    workspaceName: string;
    projects: { id: string; name: string; role: ProjectRole }[];
};

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");

    const { data: members } = useMembers();
    const { data: session } = useSession();
    const createConversation = useCreateConversation();

    const filteredMembers = ((members || []) as ConversationMember[]).filter(
        (m) =>
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
            onOpenChange(false);
        }
    };

    const isGroup = selectedIds.size > 1;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isGroup ? "New group message" : "New message"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    {isGroup && (
                        <Input
                            placeholder="Group name (optional)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    )}

                    <Input
                        placeholder="Search people..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />

                    <div className="max-h-[300px] space-y-1 overflow-y-auto">
                        {filteredMembers.map((member) => (
                            <button
                                key={member.id}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
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
                            <p className="py-4 text-center text-sm text-muted-foreground">No people found</p>
                        )}
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleCreate}
                        disabled={selectedIds.size === 0 || createConversation.isPending}
                    >
                        {createConversation.isPending
                            ? "Creating..."
                            : isGroup
                                ? `Start group (${selectedIds.size})`
                                : "Start message"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
