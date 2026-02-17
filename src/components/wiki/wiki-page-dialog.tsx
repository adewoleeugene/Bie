"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WikiNamespace } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createWikiPage } from "@/actions/wiki";
import { useWikiTemplates } from "@/hooks/use-wiki";
import { Plus } from "lucide-react";

interface WikiPageDialogProps {
    organizationId: string;
    projectId?: string;
    parentPageId?: string;
    namespace?: WikiNamespace;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function WikiPageDialog({
    organizationId,
    projectId,
    parentPageId,
    namespace = WikiNamespace.COMPANY,
    trigger,
    onSuccess,
}: WikiPageDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [selectedNamespace, setSelectedNamespace] = useState<WikiNamespace>(namespace);
    const [isTemplate, setIsTemplate] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

    const { data: templates } = useWikiTemplates(organizationId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let content = null;
        if (selectedTemplateId && selectedTemplateId !== "none" && templates) {
            const template = templates.find((t: any) => t.id === selectedTemplateId);
            if (template) {
                content = template.content;
            }
        }

        const result = await createWikiPage({
            title,
            content,
            organizationId,
            projectId: selectedNamespace === WikiNamespace.PROJECT ? projectId : undefined,
            parentPageId,
            namespace: selectedNamespace,
            template: isTemplate,
        });

        setLoading(false);

        if (result.success) {
            setOpen(false);
            setTitle("");
            setIsTemplate(false);
            setSelectedTemplateId("none");
            if (onSuccess) {
                onSuccess();
            }
            router.refresh();
        } else {
            alert(result.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Page
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Wiki Page</DialogTitle>
                        <DialogDescription>
                            Create a new page in your wiki. You can start blank or use a template.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Page Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter page title"
                                required
                            />
                        </div>
                        {!projectId && (
                            <div className="space-y-2">
                                <Label htmlFor="namespace">Namespace</Label>
                                <Select
                                    value={selectedNamespace}
                                    onValueChange={(value) => setSelectedNamespace(value as WikiNamespace)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={WikiNamespace.COMPANY}>Company Wiki</SelectItem>
                                        <SelectItem value={WikiNamespace.PROJECT}>Project Wiki</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {!isTemplate && templates && templates.length > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="template">Use Template (Optional)</Label>
                                <Select
                                    value={selectedTemplateId}
                                    onValueChange={setSelectedTemplateId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None (Blank Page)</SelectItem>
                                        {templates.map((template: any) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.name || template.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="template"
                                checked={isTemplate}
                                onChange={(e) => setIsTemplate(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label htmlFor="template" className="cursor-pointer">
                                Save as template
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Page"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
