"use client";

import { useState, useEffect } from "react";
import { WikiPage, User, WikiPageVersion } from "@prisma/client";
import {
    MoreVertical,
    History,
    Trash2,
    ExternalLink,
    Globe,
    Lock,
    Copy,
    ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { BlockEditor } from "./block-editor";
import { deleteWikiPage, updateWikiPage } from "@/actions/wiki";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getWikiPagePath } from "@/actions/wiki-path";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface WikiPageViewProps {
    page: WikiPage & {
        author: User;
        versions: (WikiPageVersion & { editedBy: User })[];
    };
    readOnly?: boolean;
}

export function WikiPageView({ page, readOnly = false }: WikiPageViewProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(page.title);
    const [content, setContent] = useState(page.content);
    const [isPublished, setIsPublished] = useState(page.published);
    const [path, setPath] = useState<{ id: string; title: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sync state with props when page changes
    useEffect(() => {
        setTitle(page.title);
        setContent(page.content);
        setIsPublished(page.published);
        if (page.title === "Untitled" && !readOnly) {
            setIsEditing(true);
        }
    }, [page.id, page.title, page.content, page.published, readOnly]);

    useEffect(() => {
        async function fetchPath() {
            if (page.id) {
                const result = await getWikiPagePath(page.id);
                if (result.success && result.path) {
                    setPath(result.path);
                }
            }
        }
        fetchPath();
    }, [page.id]);

    const handleSave = async (newContent?: string) => {
        if (readOnly) return;
        setIsSaving(true);
        const result = await updateWikiPage({
            id: page.id,
            title,
            content: newContent ?? content,
            published: isPublished,
        });
        setIsSaving(false);

        if (result.success) {
            toast.success("Page saved");
            if (newContent) setContent(newContent);
            router.refresh();
        } else {
            toast.error(result.error || "Failed to save page");
        }
    };

    const handleDelete = async () => {
        if (readOnly) return;
        const confirmed = confirm("Are you sure you want to delete this page?");
        if (!confirmed) return;

        const result = await deleteWikiPage(page.id);
        if (result.success) {
            toast.success("Page deleted");
            router.push("/wiki");
        } else {
            toast.error(result.error);
        }
    };

    const copyPublicLink = () => {
        const url = `${window.location.protocol}//${window.location.host}/published-wiki/${page.id}`;
        navigator.clipboard.writeText(url);
        toast.success("Public link copied to clipboard");
    };

    const togglePublished = async () => {
        if (readOnly) return;
        const newPublished = !isPublished;
        setIsPublished(newPublished);
        const result = await updateWikiPage({
            id: page.id,
            published: newPublished,
        });
        if (result.success) {
            toast.success(newPublished ? "Page published" : "Page unpublished");
            router.refresh();
        } else {
            setIsPublished(!newPublished);
            toast.error(result.error);
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-background selection:bg-primary/10">
            {/* Contextual Header / Breadcrumbs */}
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-md px-6 lg:px-12">
                <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground overflow-hidden whitespace-nowrap">
                    {path.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-1.5 shrink-0">
                            {index > 0 && <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />}
                            <Link
                                href={`${readOnly ? "/published-wiki" : "/wiki"}/${item.id}`}
                                className={cn(
                                    "hover:text-foreground transition-colors max-w-[120px] truncate",
                                    index === path.length - 1 && "text-foreground font-semibold"
                                )}
                            >
                                {item.title}
                            </Link>
                        </div>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    {isSaving && (
                        <span className="text-[10px] text-muted-foreground animate-pulse mr-2">Saving...</span>
                    )}

                    {!readOnly && (
                        <Badge
                            variant={isPublished ? "default" : "outline"}
                            className={cn(
                                "gap-1 px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider",
                                isPublished ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" : "bg-muted"
                            )}
                        >
                            {isPublished ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                            {isPublished ? "Published" : "Draft"}
                        </Badge>
                    )}

                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 text-xs font-medium"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? "View mode" : "Edit mode"}
                        </Button>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {!readOnly && (
                                <>
                                    <DropdownMenuItem onClick={togglePublished}>
                                        {isPublished ? (
                                            <>
                                                <Lock className="mr-2 h-4 w-4" />
                                                Unpublish Page
                                            </>
                                        ) : (
                                            <>
                                                <Globe className="mr-2 h-4 w-4" />
                                                Publish Page
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}

                            {isPublished && (
                                <DropdownMenuItem onClick={copyPublicLink}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy Public Link
                                </DropdownMenuItem>
                            )}

                            {isPublished && (
                                <DropdownMenuItem asChild>
                                    <Link href={`/published-wiki/${page.id}`} target="_blank">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        View Public Page
                                    </Link>
                                </DropdownMenuItem>
                            )}

                            {!readOnly && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Page
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto py-12 lg:py-20 px-8 lg:px-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="mb-10 space-y-4">
                        {isEditing && !readOnly ? (
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => handleSave()}
                                className="w-full text-4xl lg:text-5xl font-black bg-transparent border-none outline-none focus:ring-0 placeholder:opacity-20"
                                placeholder="Untitled"
                            />
                        ) : (
                            <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                                {page.title}
                            </h1>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {page.author.name?.charAt(0)}
                                </div>
                                <span>{page.author.name}</span>
                            </div>
                            <span className="opacity-20">•</span>
                            <span>Last edited {formatDistanceToNow(new Date(page.updatedAt))} ago</span>
                        </div>
                    </div>

                    <div className={cn(
                        "prose prose-neutral dark:prose-invert max-w-none min-h-[500px]",
                        !isEditing && "leading-relaxed"
                    )}>
                        <BlockEditor
                            initialContent={content}
                            onChange={(newContent) => handleSave(newContent)}
                            editable={isEditing && !readOnly}
                        />
                    </div>
                </div>
            </main>

            {/* Version Footer (Only in Edit Mode) */}
            {!readOnly && isEditing && page.versions && page.versions.length > 0 && (
                <footer className="border-t bg-muted/30 px-12 py-4 mt-auto">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <History className="h-3.5 w-3.5" />
                            <span>Version History ({page.versions.length})</span>
                        </div>
                        <div className="flex -space-x-1.5">
                            {Array.from(new Set(page.versions.map(v => v.editedBy.id))).slice(0, 5).map(userId => {
                                const user = page.versions.find(v => v.editedBy.id === userId)?.editedBy;
                                return (
                                    <div
                                        key={userId}
                                        className="h-6 w-6 rounded-full border-2 border-background bg-slate-200 flex items-center justify-center text-[8px] font-bold"
                                        title={user?.name || "Editor"}
                                    >
                                        {user?.name?.charAt(0)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
