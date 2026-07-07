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
import { createWikiTemplate } from "@/actions/wiki-template";
import { useWikiTemplates } from "@/hooks/use-wiki";
import { useProjects } from "@/hooks/use-projects";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Layout, Info, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");

    const { data: templates } = useWikiTemplates(organizationId);
    const { data: projects } = useProjects();
    const queryClient = useQueryClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Resolve which project (if any) the page belongs to. In a project
        // context the projectId prop is fixed; from the company wiki the user
        // picks one when they choose "Specific Project Wiki".
        const effectiveProjectId = projectId
            ? projectId
            : selectedNamespace === WikiNamespace.PROJECT
              ? selectedProjectId || undefined
              : undefined;

        if (selectedNamespace === WikiNamespace.PROJECT && !effectiveProjectId) {
            toast.error("Choose a project for this page");
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading("Creating page...");

        let content = null;
        if (selectedTemplateId && selectedTemplateId !== "none" && templates) {
            const template = templates.find((t: any) => t.id === selectedTemplateId);
            if (template) {
                content = template.content;
            }
        }

        try {
            const result = await createWikiPage({
                title,
                content,
                organizationId,
                projectId: effectiveProjectId,
                parentPageId,
                namespace: selectedNamespace,
                template: isTemplate,
            });

            if (result.success) {
                // "Save as template" also registers a reusable WikiTemplate so it
                // shows up in the sidebar Templates list + the template dropdown
                // (which read the WikiTemplate model, not the page flag).
                if (isTemplate && result.data) {
                    const tpl = await createWikiTemplate({
                        name: title,
                        content: result.data.content ?? [],
                        organizationId,
                    });
                    if (tpl.success) {
                        queryClient.invalidateQueries({ queryKey: ["wiki-templates"] });
                    }
                }

                toast.success(
                    isTemplate
                        ? "Page created and saved as a template"
                        : "Page created successfully",
                    { id: loadingToast },
                );
                setOpen(false);
                setTitle("");
                setIsTemplate(false);
                setSelectedTemplateId("none");
                setSelectedProjectId("");
                if (onSuccess) {
                    onSuccess();
                }
                router.refresh();
                // Navigate to the new page
                if (result.data) {
                    const basePath = effectiveProjectId
                        ? `/projects/${effectiveProjectId}/wiki`
                        : "/wiki";
                    router.push(`${basePath}/${result.data.id}`);
                }
            } else {
                toast.error(result.error || "Failed to create page", { id: loadingToast });
            }
        } catch (error) {
            toast.error("An unexpected error occurred", { id: loadingToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Page
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Create New Wiki Page</DialogTitle>
                        <DialogDescription>
                            Organize your documents. Start with a blank page or use a preset template.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-semibold">Page Title</Label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Project Roadmap"
                                    required
                                    className="pl-9"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {!projectId && (
                            <div className="space-y-2">
                                <Label htmlFor="namespace" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Location</Label>
                                <Select
                                    value={selectedNamespace}
                                    onValueChange={(value) => setSelectedNamespace(value as WikiNamespace)}
                                >
                                    <SelectTrigger className="w-full">
                                        <div className="flex items-center gap-2">
                                            <Layout className="h-4 w-4 text-muted-foreground" />
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={WikiNamespace.COMPANY}>Company-wide Wiki</SelectItem>
                                        <SelectItem value={WikiNamespace.PROJECT}>Specific Project Wiki</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {!projectId && selectedNamespace === WikiNamespace.PROJECT && (
                            <div className="space-y-2">
                                <Label htmlFor="project" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Project</Label>
                                <Select
                                    value={selectedProjectId}
                                    onValueChange={setSelectedProjectId}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(projects ?? []).length === 0 ? (
                                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                No projects yet
                                            </div>
                                        ) : (
                                            (projects ?? []).map((p: { id: string; name: string }) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {templates && templates.length > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="template" className="text-sm font-semibold">Template</Label>
                                <Select
                                    value={selectedTemplateId}
                                    onValueChange={setSelectedTemplateId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <span>Blank Page</span>
                                            </div>
                                        </SelectItem>
                                        {templates.map((template: any) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-3 rounded-lg border bg-neutral-50 dark:bg-neutral-900 border-dashed">
                            <div className="flex items-center gap-2">
                                <Layout className="h-4 w-4 text-primary/60" />
                                <div className="flex flex-col">
                                    <Label htmlFor="template-mode" className="text-sm cursor-pointer select-none">Save as template</Label>
                                    <span className="text-[10px] text-muted-foreground">Make this available for others to reuse</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsTemplate(!isTemplate)}
                                className={cn(
                                    "h-5 w-5 rounded border transition-colors flex items-center justify-center",
                                    isTemplate ? "bg-primary border-primary text-primary-foreground" : "bg-background border-input"
                                )}
                                id="template-mode"
                            >
                                {isTemplate && <Check className="h-3 w-3" />}
                            </button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="px-8 shadow-sm">
                            {loading ? "Creating..." : "Create Page"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
