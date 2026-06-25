"use client";

import { useState, useEffect, useRef } from "react";
import { WikiPage, User, WikiPageVersion } from "@prisma/client";
import {
    MoreVertical,
    History,
    Trash2,
    ExternalLink,
    Globe,
    Lock,
    Copy,
    ChevronRight,
    Share2,
} from "lucide-react";
import {
    addWikiPageMember,
    getWikiPageSharing,
    removeWikiPageMember,
    setWikiPageVisibility,
    transferWikiPageOwnership,
} from "@/actions/wiki";
import { ShareDialog, ShareMember } from "@/components/sharing/share-dialog";
import { useQuery } from "@tanstack/react-query";
import { ResourceVisibility } from "@prisma/client";
import { useViewerUserId } from "@/hooks/use-viewer";
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
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { AttachmentParent } from "@prisma/client";
import { WikiBacklinks } from "@/components/wiki/wiki-backlinks";
import { WikiBlockComments } from "@/components/wiki/wiki-block-comments";
import { WikiHistoryDialog } from "@/components/wiki/wiki-history-dialog";
import { deleteWikiPage, updateWikiPage, duplicateWikiPage, trackWikiPageView, getWikiPageAnalytics } from "@/actions/wiki";
import { createWikiTemplate } from "@/actions/wiki-template";
import { useFavorites, useToggleFavorite, useTrackRecent } from "@/hooks/use-favorites";
import { Star, Download, FileText, Eye } from "lucide-react";
import { blocknoteToMarkdown } from "@/lib/blocknote-to-markdown";
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
    // Wiki pages are inline-editable by default (Notion-style); the published
    // read-only view passes readOnly to keep it locked.
    const [isEditing, setIsEditing] = useState(true);
    const [title, setTitle] = useState(page.title);
    const [content, setContent] = useState(page.content);
    const [shareOpen, setShareOpen] = useState(false);
    const viewerUserId = useViewerUserId();
    const { data: sharing, refetch: refetchSharing } = useQuery({
        queryKey: ["wiki-page-sharing", page.id],
        queryFn: () => getWikiPageSharing(page.id),
        enabled: shareOpen,
    });
    const [isPublished, setIsPublished] = useState(page.published);
    const [icon, setIcon] = useState(page.icon || "");
    const [coverImage, setCoverImage] = useState(page.coverImage || "");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCoverInput, setShowCoverInput] = useState(false);
    const [path, setPath] = useState<{ id: string; title: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const { data: favorites } = useFavorites();
    const toggleFavorite = useToggleFavorite();
    const trackRecent = useTrackRecent();
    const isFavorited = favorites?.some((f: any) => f.itemId === page.id && f.itemType === "wiki_page");

    // Track page view as recent item + analytics
    useEffect(() => {
        trackRecent.mutate({
            itemType: "wiki_page",
            itemId: page.id,
            itemTitle: page.title,
            itemUrl: `/wiki/${page.id}`,
        });
        trackWikiPageView(page.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page.id]);

    const { data: analytics } = useQuery({
        queryKey: ["wiki-page-analytics", page.id],
        queryFn: () => getWikiPageAnalytics(page.id),
        staleTime: 60_000,
    });

    // Sync state with props when page changes
    useEffect(() => {
        setTitle(page.title);
        setContent(page.content);
        setIsPublished(page.published);
        setIcon(page.icon || "");
        setCoverImage(page.coverImage || "");
        if (page.title === "Untitled" && !readOnly) {
            setIsEditing(true);
        }
    }, [page.id, page.title, page.content, page.published, page.icon, page.coverImage, readOnly]);

    const exportMarkdown = () => {
        const md = blocknoteToMarkdown(content);
        const blob = new Blob([`# ${title}\n\n${md}`], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9]/g, "-")}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const contentRef = useRef<HTMLDivElement>(null);

    const exportPdf = async () => {
        if (!contentRef.current) return;
        const html2pdf = (await import("html2pdf.js")).default;
        html2pdf()
            .from(contentRef.current)
            .set({
                margin: [10, 10],
                filename: `${title.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .save();
    };

    const saveIcon = async (newIcon: string) => {
        setIcon(newIcon);
        await updateWikiPage({ id: page.id, icon: newIcon || null });
        router.refresh();
    };

    const saveCover = async (url: string) => {
        setCoverImage(url);
        setShowCoverInput(false);
        await updateWikiPage({ id: page.id, coverImage: url || null });
        router.refresh();
    };

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
            if (newContent) setContent(newContent);
        } else {
            toast.error(result.error || "Failed to save page");
        }
    };

    // Debounced autosave for content edits — avoids a save (and previously a
    // toast + full router.refresh) on every keystroke.
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleSave = (newContent: string) => {
        if (readOnly) return;
        setContent(newContent);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setIsSaving(true);
            const result = await updateWikiPage({
                id: page.id,
                title,
                content: newContent,
                published: isPublished,
            });
            setIsSaving(false);
            if (!result.success) {
                toast.error(result.error || "Failed to save page");
            }
        }, 800);
    };

    useEffect(() => {
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, []);

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

                    {analytics && analytics.totalViews > 0 && (
                        <span
                            className="flex items-center gap-1 text-[10px] text-muted-foreground"
                            title={`${analytics.uniqueViewers} unique viewers${analytics.lastViewedBy ? `, last viewed by ${analytics.lastViewedBy.name}` : ""}`}
                        >
                            <Eye className="h-3 w-3" />
                            {analytics.totalViews}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() =>
                            toggleFavorite.mutate({
                                itemType: "wiki_page",
                                itemId: page.id,
                                itemTitle: page.title,
                                itemUrl: `/wiki/${page.id}`,
                            })
                        }
                        className="rounded p-1.5 hover:bg-muted transition-colors"
                        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Star
                            className={cn(
                                "h-4 w-4",
                                isFavorited
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground"
                            )}
                        />
                    </button>

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
                        <span className="px-2 text-xs text-muted-foreground">
                            {isSaving ? "Saving…" : "Saved"}
                        </span>
                    )}

                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 text-xs font-medium"
                            onClick={() => setShareOpen(true)}
                        >
                            <Share2 className="h-3.5 w-3.5" />
                            Share
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
                                    <DropdownMenuItem onClick={async () => {
                                        const result = await createWikiTemplate({
                                            name: title,
                                            description: `Template from "${title}"`,
                                            content,
                                            organizationId: page.organizationId,
                                        });
                                        if (result.success) {
                                            toast.success("Saved as template");
                                        } else {
                                            toast.error(result.error || "Failed to save template");
                                        }
                                    }}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Save as Template
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={exportMarkdown}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export as Markdown
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportPdf}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Export as PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={async () => {
                                        const result = await duplicateWikiPage(page.id);
                                        if (result.success && result.data) {
                                            toast.success("Page duplicated");
                                            router.push(`/wiki/${result.data.id}`);
                                        } else {
                                            toast.error(result.error || "Failed to duplicate");
                                        }
                                    }}>
                                        <Copy className="mr-2 h-4 w-4" />
                                        Duplicate Page
                                    </DropdownMenuItem>
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
                {/* Cover image */}
                {coverImage ? (
                    <div className="group relative h-[200px] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                        <img
                            src={coverImage}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                        {!readOnly && (
                            <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCoverInput(true)}
                                    className="rounded bg-black/60 px-2 py-1 text-[11px] text-white hover:bg-black/80"
                                >
                                    Change cover
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveCover("")}
                                    className="rounded bg-black/60 px-2 py-1 text-[11px] text-white hover:bg-black/80"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Cover URL input */}
                {showCoverInput && (
                    <div className="border-b bg-muted/30 px-8 py-3 lg:px-12">
                        <div className="mx-auto flex max-w-4xl items-center gap-2">
                            <input
                                autoFocus
                                placeholder="Paste image URL..."
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") saveCover((e.target as HTMLInputElement).value);
                                    if (e.key === "Escape") setShowCoverInput(false);
                                }}
                                className="flex-1 rounded border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCoverInput(false)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="max-w-3xl mx-auto py-12 lg:py-16 px-8 lg:px-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Hover actions: add icon / add cover */}
                    {!readOnly && (!icon || !coverImage) && (
                        <div className="mb-3 flex items-center gap-2 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
                            {!icon && (
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(true)}
                                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                                >
                                    Add icon
                                </button>
                            )}
                            {!coverImage && (
                                <button
                                    type="button"
                                    onClick={() => setShowCoverInput(true)}
                                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                                >
                                    Add cover
                                </button>
                            )}
                        </div>
                    )}

                    {/* Page icon */}
                    {icon && (
                        <div className="mb-4 group/icon relative inline-block">
                            <button
                                type="button"
                                onClick={!readOnly ? () => setShowEmojiPicker(true) : undefined}
                                className={`text-6xl leading-none ${!readOnly ? "cursor-pointer hover:opacity-80" : ""}`}
                            >
                                {icon}
                            </button>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => saveIcon("")}
                                    className="absolute -right-5 -top-1 hidden rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground group-hover/icon:inline-block"
                                >
                                    x
                                </button>
                            )}
                        </div>
                    )}

                    {/* Emoji picker (simple grid) */}
                    {showEmojiPicker && (
                        <EmojiPicker
                            onPick={(emoji) => {
                                saveIcon(emoji);
                                setShowEmojiPicker(false);
                            }}
                            onClose={() => setShowEmojiPicker(false)}
                        />
                    )}

                    <div className="mb-10 space-y-4">
                        {isEditing && !readOnly ? (
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => handleSave()}
                                className="w-full text-4xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-0 placeholder:opacity-20"
                                placeholder="Untitled"
                            />
                        ) : (
                            <h1 className="text-4xl font-bold tracking-tight leading-tight">
                                {icon && <span className="mr-3">{icon}</span>}
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

                    <div
                        ref={contentRef}
                        className={cn(
                        "max-w-none min-h-[500px]",
                        !isEditing && "leading-relaxed"
                    )}>
                        <BlockEditor
                            initialContent={content}
                            onChange={(newContent) => scheduleSave(newContent)}
                            editable={isEditing && !readOnly}
                            onActiveBlockChange={setActiveBlockId}
                        />
                    </div>

                    {!readOnly && (
                        <div className="mt-8 border-t pt-6">
                            <AttachmentPanel
                                parentType={AttachmentParent.WIKI_PAGE}
                                parentId={page.id}
                            />
                        </div>
                    )}

                    {!readOnly && (
                        <div className="mt-8 border-t pt-6">
                            <WikiBlockComments
                                pageId={page.id}
                                activeBlockId={activeBlockId}
                            />
                        </div>
                    )}

                    <div className="mt-8 border-t pt-6">
                        <WikiBacklinks pageId={page.id} />
                    </div>
                </div>
            </main>

            {/* Version Footer (Only in Edit Mode) */}
            {!readOnly && isEditing && page.versions && page.versions.length > 0 && (
                <footer className="border-t bg-muted/30 px-12 py-4 mt-auto">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        <button
                            type="button"
                            onClick={() => setHistoryOpen(true)}
                            className="flex items-center gap-4 text-xs text-muted-foreground hover:text-primary"
                        >
                            <History className="h-3.5 w-3.5" />
                            <span>Version History ({page.versions.length})</span>
                        </button>
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

            <WikiHistoryDialog
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                pageId={page.id}
                currentContent={content}
                versions={page.versions || []}
            />

            <ShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                title={title || page.title}
                visibility={(sharing?.visibility ?? "ORG") as ResourceVisibility}
                members={(sharing?.members ?? []) as ShareMember[]}
                ownerId={sharing?.authorId}
                viewerUserId={viewerUserId}
                onSetVisibility={async (v) => {
                    await setWikiPageVisibility({ pageId: page.id, visibility: v });
                    await refetchSharing();
                }}
                onAddMember={async (userId, role) => {
                    await addWikiPageMember({ pageId: page.id, userId, role });
                    await refetchSharing();
                }}
                onRemoveMember={async (userId) => {
                    await removeWikiPageMember({ pageId: page.id, userId });
                    await refetchSharing();
                }}
                onTransferOwnership={async (newOwnerId) => {
                    await transferWikiPageOwnership({ pageId: page.id, newOwnerId });
                    await refetchSharing();
                }}
            />
        </div>
    );
}

// ─── Emoji Picker ───────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
    {
        label: "Common",
        emojis: [
            "📄", "📝", "📋", "📌", "📎", "📁", "📂", "📊", "📈", "📉",
            "💡", "🎯", "🚀", "⭐", "🔥", "✨", "💎", "🏆", "🎉", "🎨",
            "🔧", "⚙️", "🛠️", "🔑", "🔒", "🔓", "📱", "💻", "🖥️", "🌐",
        ],
    },
    {
        label: "People",
        emojis: [
            "👤", "👥", "🧑‍💻", "👨‍💼", "👩‍💼", "🤝", "💬", "🗣️", "👋", "✋",
            "🙌", "👏", "🤔", "💭", "❤️", "😊", "😎", "🧠", "💪", "👀",
        ],
    },
    {
        label: "Objects",
        emojis: [
            "📅", "⏰", "⏱️", "📞", "✉️", "📮", "🗂️", "🗄️", "📦", "🏷️",
            "🔖", "📐", "📏", "✏️", "🖊️", "🖋️", "📓", "📔", "📒", "📕",
        ],
    },
    {
        label: "Symbols",
        emojis: [
            "✅", "❌", "⚠️", "❓", "❗", "💯", "🔴", "🟡", "🟢", "🔵",
            "⬛", "⬜", "🟣", "🟠", "♻️", "🏁", "🚩", "🎵", "🔔", "📢",
        ],
    },
    {
        label: "Nature",
        emojis: [
            "🌱", "🌿", "🍀", "🌸", "🌺", "🌻", "🌈", "☀️", "🌙", "⛅",
            "🌊", "🏔️", "🌍", "🦋", "🐝", "🐾", "🌵", "🍎", "🍕", "☕",
        ],
    },
];

function EmojiPicker({
    onPick,
    onClose,
}: {
    onPick: (emoji: string) => void;
    onClose: () => void;
}) {
    return (
        <div className="mb-4 rounded-lg border bg-background p-3 shadow-lg max-w-sm">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Pick an icon</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    Cancel
                </button>
            </div>
            {EMOJI_GROUPS.map((group) => (
                <div key={group.label} className="mb-2">
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {group.label}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                        {group.emojis.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => onPick(emoji)}
                                className="h-8 w-8 rounded text-lg hover:bg-muted transition-colors flex items-center justify-center"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
