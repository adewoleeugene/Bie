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
} from "lucide-react";
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

type WikiPageWithDetails = WikiPage & {
    author: User;
    versions?: (WikiPageVersion & { editedBy: User })[];
};

interface WikiPageViewProps {
    page: WikiPageWithDetails;
}

export function WikiPageView({ page }: WikiPageViewProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(page.title);
    const [content, setContent] = useState(page.content);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setTitle(page.title);
        setContent(page.content);
    }, [page]);

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateWikiPage({
            id: page.id,
            title,
            content,
        });

        setIsSaving(false);

        if (result.success) {
            setIsEditing(false);
            router.refresh();
        } else {
            alert(result.error);
        }
    };

    const handleDelete = async () => {
        const result = await deleteWikiPage(page.id);
        if (result.success) {
            router.push("/wiki");
            router.refresh();
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
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="border-b p-4 flex items-center justify-between">
                <div className="flex-1">
                    {isEditing ? (
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0"
                            placeholder="Page title"
                        />
                    ) : (
                        <h1 className="text-2xl font-bold">{page.title}</h1>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            <span>{page.author.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                                Updated {formatDistanceToNow(new Date(page.updatedAt))} ago
                            </span>
                        </div>
                    </div>
                </div>
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

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                <BlockEditor
                    initialContent={content}
                    onChange={setContent}
                    editable={isEditing}
                />
            </div>

            {/* Version History Sidebar */}
            {page.versions && page.versions.length > 0 && !isEditing && (
                <div className="border-l w-64 p-4 overflow-auto">
                    <h3 className="font-semibold mb-4">Version History</h3>
                    <div className="space-y-3">
                        {page.versions.map((version) => (
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
