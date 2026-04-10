"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Trash2, Plus, Layout } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWikiTemplates, deleteWikiTemplate } from "@/actions/wiki-template";
import { formatDistanceToNow } from "date-fns";

interface WikiTemplatesDialogProps {
    organizationId: string;
    onUseTemplate: (content: any, title: string) => void;
}

export function WikiTemplatesDialog({ organizationId, onUseTemplate }: WikiTemplatesDialogProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: templatesResult, isLoading } = useQuery({
        queryKey: ["wiki-templates", organizationId],
        queryFn: () => getWikiTemplates(organizationId),
        enabled: open,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteWikiTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wiki-templates"] });
        },
    });

    const templates = templatesResult?.data || [];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs w-full justify-start">
                    <Layout className="h-3.5 w-3.5" />
                    Templates
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layout className="h-5 w-5" />
                        Wiki Templates
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="py-8 text-center text-sm text-neutral-500">Loading...</div>
                    ) : templates.length === 0 ? (
                        <div className="py-8 text-center">
                            <FileText className="h-10 w-10 mx-auto text-neutral-300 dark:text-neutral-700 mb-3" />
                            <p className="text-sm text-neutral-500">No templates yet</p>
                            <p className="text-xs text-neutral-400 mt-1">
                                Save a wiki page as a template to reuse it.
                            </p>
                        </div>
                    ) : (
                        templates.map((template: any) => (
                            <div
                                key={template.id}
                                className="flex items-center justify-between rounded-lg border p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{template.name}</span>
                                    </div>
                                    {template.description && (
                                        <p className="text-xs text-neutral-500 mt-0.5 truncate">
                                            {template.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-neutral-400">
                                            by {template.author?.name}
                                        </span>
                                        <span className="text-[10px] text-neutral-400">
                                            {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 ml-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => {
                                            onUseTemplate(template.content, template.name);
                                            setOpen(false);
                                        }}
                                    >
                                        <Plus className="h-3 w-3" />
                                        Use
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-neutral-400 hover:text-red-500"
                                        onClick={() => deleteMutation.mutate(template.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
