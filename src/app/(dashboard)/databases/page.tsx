"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDatabases, useCreateDatabase, useDeleteDatabase } from "@/hooks/use-databases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Database, Plus, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DATABASE_TEMPLATES } from "@/lib/database-templates";
import { createDatabaseFromTemplate } from "@/actions/databases";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function DatabasesPage() {
    const router = useRouter();
    const qc = useQueryClient();
    const { data: databases, isLoading } = useDatabases();
    const create = useCreateDatabase();
    const deleteCollection = useDeleteDatabase();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name.trim()) return;
        const result = await create.mutateAsync({
            name: name.trim(),
            description: description.trim() || undefined,
        });
        if (result.success) {
            setName("");
            setDescription("");
            setOpen(false);
        }
    };

    const handleTemplate = async (templateKey: string) => {
        setCreatingTemplate(templateKey);
        try {
            const result = await createDatabaseFromTemplate(templateKey);
            if (result.success && result.data) {
                toast.success("Collection created from template");
                qc.invalidateQueries({ queryKey: ["databases"] });
                router.push(`/databases/${result.data.id}`);
            } else {
                toast.error(result.error || "Failed");
            }
        } finally {
            setCreatingTemplate(null);
        }
    };

    return (
        <div className="mx-auto max-w-5xl p-8">
            <div className="mb-8 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Collections</h1>
                <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New collection
                </Button>
            </div>

            {/* Templates */}
            <div className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Start from a template
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {DATABASE_TEMPLATES.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            disabled={creatingTemplate !== null}
                            onClick={() => handleTemplate(t.key)}
                            className="group rounded-md border border-neutral-200 p-3 text-left transition-all hover:border-primary hover:shadow-sm dark:border-neutral-800"
                        >
                            <div className="mb-2 text-2xl">{t.icon}</div>
                            <div className="text-sm font-medium">
                                {creatingTemplate === t.key ? (
                                    <Loader2 className="inline mr-1 h-3 w-3 animate-spin" />
                                ) : null}
                                {t.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-neutral-500 line-clamp-2">
                                {t.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Existing collections */}
            {isLoading ? (
                <p className="text-sm text-neutral-500">Loading…</p>
            ) : !databases || databases.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
                    <Database className="mx-auto h-8 w-8 text-neutral-400" />
                    <p className="mt-3 text-sm text-neutral-500">
                        No collections yet. Pick a template above or create a blank one.
                    </p>
                </div>
            ) : (
                <>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Your collections
                    </h2>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {databases.map((db) => (
                            <li key={db.id} className="group relative">
                                <Link
                                    href={`/databases/${db.id}`}
                                    className="block rounded-md border border-neutral-200 p-4 pr-12 hover:border-primary hover:shadow-sm dark:border-neutral-800"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                                            <Database className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate font-medium">{db.name}</h3>
                                            {db.description && (
                                                <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                                                    {db.description}
                                                </p>
                                            )}
                                            <p className="mt-2 text-[10px] uppercase text-neutral-400">
                                                {db._count.rows} rows · {db._count.properties} properties
                                                · updated{" "}
                                                {formatDistanceToNow(new Date(db.updatedAt), {
                                                    addSuffix: true,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Delete collection"
                                    aria-label={`Delete ${db.name}`}
                                    disabled={deleteCollection.isPending}
                                    onClick={() => deleteCollection.mutate(db.id)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 text-neutral-500 hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New collection</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            placeholder="Collection name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <Input
                            placeholder="Description (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
