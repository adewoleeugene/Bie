"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WikiPage, User, WikiPageVersion } from "@prisma/client";
import { BlockEditor } from "@/components/wiki/block-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateWikiPage, deleteWikiPage } from "@/actions/wiki";
import {
    Edit2,
    Save,
    X,
    Trash2,
    Clock,
    User as UserIcon,
    Globe,
    Link as LinkIcon,
    ChevronRight,
    FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getWikiPagePath } from "@/actions/wiki-path";
import React from "react";

type WikiPageWithDetails = WikiPage & {
    author: User;
    versions?: (WikiPageVersion & { editedBy: User })[];
    published: boolean;
};

interface WikiPageViewProps {
    page: WikiPageWithDetails;
    readOnly?: boolean;
}

export function WikiPageView({ page, readOnly = false }: WikiPageViewProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(page.title);
    const [content, setContent] = useState(page.content);
    const [showHistory, setShowHistory] = useState(false);
    const [isPublished, setIsPublished] = useState(page.published);
    const [path, setPath] = useState<{ id: string; title: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setTitle(page.title);
        setContent(page.content);
        setIsPublished(page.published);

        // Auto-enter edit mode if page is "Untitled" (likely just created)
        if (page.title === "Untitled" && !readOnly) {
            setIsEditing(true);
        }

        async function fetchPath() {
            const res = await getWikiPagePath(page.id);
            if (res.success && res.path) {
                setPath(res.path);
            }
        }
        fetchPath();
    }, [page, readOnly]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateWikiPage({
                id: page.id,
                title,
                content,
            });

            if (result.success) {
                setIsEditing(false);
                router.refresh();
                toast.success("Page saved successfully");
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Failed to save page");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTogglePublished = async (checked: boolean) => {
        setIsPublished(checked);
        const result = await updateWikiPage({
            id: page.id,
            published: checked,
        });

        if (!result.success) {
            setIsPublished(!checked);
            toast.error(result.error);
        } else {
            router.refresh();
            toast.success(checked ? "Page published" : "Page unpublished");
        }
    };

    const handleDelete = async () => {
        const result = await deleteWikiPage(page.id);
        if (result.success) {
            router.push("/wiki");
        } else {
            alert(result.error);
        }
    };

    const handleCancel = () => {
        setTitle(page.title);
        setContent(page.content);
        setIsEditing(false);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background">
            {/* Header */}
            <div className={cn(
                "px-4 py-3 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-20",
                readOnly ? "border-none" : "border-b"
            )}>
                <div className="flex-1 min-w-0">
                    {/* Notion-style Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground/60 mb-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                        <Link href={readOnly ? "/published-wiki" : "/wiki"} className="hover:text-foreground transition-colors flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {readOnly ? "Wiki" : "Dashboard"}
                        </Link>
                        {path.slice(0, -1).map((item) => (
                            <React.Fragment key={item.id}>
                                <ChevronRight className="h-3 w-3 shrink-0" />
                                <Link
                                    href={`${readOnly ? "/published-wiki" : "/wiki"}/${item.id}`}
                                    className="hover:text-foreground transition-colors"
                                >
                                    {item.title}
                                </Link>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {isEditing ? (
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-xl font-bold h-9 px-2"
                                placeholder="Page title"
                            />
                        ) : (
                            <h1 className={cn(
                                "font-bold tracking-tight text-foreground truncate",
                                readOnly ? "text-4xl" : "text-2xl"
                            )}>
                                {page.title}
                            </h1>
                        )}
                        {!readOnly && isPublished && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium uppercase tracking-wider shrink-0">
                                <Globe className="h-3 w-3" />
                                Published
                            </div>
                        )}
                    </div>
                    {!readOnly && (
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground/60">
                            <div className="flex items-center gap-1">
                                <UserIcon className="h-3 w-3" />
                                <span>{page.author.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                    Modified {formatDistanceToNow(new Date(page.updatedAt))} ago
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                {!readOnly && (
                    <div className="flex items-center gap-4">
                        <Button
                            variant={isPublished ? "secondary" : "default"}
                            size="sm"
                            onClick={() => handleTogglePublished(!isPublished)}
                            className="mr-2"
                        >
                            {isPublished ? "Unpublish" : "Publish"}
                        </Button>
                        {isPublished && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const url = `${window.location.protocol}//wiki.${window.location.host.replace('wiki.', '')}/${page.id}`;
                                    navigator.clipboard.writeText(url);
                                    toast.success("Public link copied to clipboard");
                                }}
                            >
                                <LinkIcon className="h-4 w-4 mr-2" />
                                Copy Link
                            </Button>
                        )}
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancel}
                                        disabled={isSaving}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                        <Save className="h-4 w-4 mr-2" />
                                        {isSaving ? "Saving..." : "Save"}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Page</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this page? This action
                                                    cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDelete}>
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                <BlockEditor
                    initialContent={content}
                    onChange={setContent}
                    editable={isEditing}
                />
            </div>

            {/* Version History Sidebar */}
            {page.versions && page.versions.length > 0 && !isEditing && !readOnly && (
                <div className="border-l w-64 p-4 overflow-auto">
                    <h3 className="font-semibold mb-4">Version History</h3>
                    <div className="space-y-3">
                        {page.versions.map((version: WikiPageVersion & { editedBy: User }) => (
                            <div
                                key={version.id}
                                className="text-sm p-2 rounded-md hover:bg-accent cursor-pointer"
                            >
                                <div className="font-medium">{version.editedBy.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(version.createdAt))} ago
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
