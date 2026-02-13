"use client";

import { useSprints, useDeleteSprint } from "@/hooks/use-sprints";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SprintDialog } from "@/components/sprints/sprint-dialog";
import { format } from "date-fns";
import { Calendar, MoreHorizontal, Pencil, Trash, ExternalLink } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

export default function SprintsPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;
    const { data: sprints, isLoading } = useSprints(projectId);
    const deleteSprint = useDeleteSprint();

    // State for dialogs
    const [editingSprint, setEditingSprint] = useState<any>(null);
    const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);

    if (isLoading) {
        return <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>;
    }

    const handleDelete = async () => {
        if (deletingSprintId) {
            await deleteSprint.mutateAsync({ id: deletingSprintId });
            setDeletingSprintId(null);
        }
    }

    return (
        <div className="flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sprints</h1>
                    <p className="text-sm text-muted-foreground">Manage project sprints and timelines.</p>
                </div>
                <SprintDialog projectId={projectId} />
            </div>

            <div className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sprints?.map((sprint) => (
                    <Card key={sprint.id} className={`hover:shadow-md transition-shadow ${sprint.status === 'ACTIVE' ? 'border-primary/50' : ''}`}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base">
                                            {sprint.name}
                                        </CardTitle>
                                        {sprint.status === 'ACTIVE' && <Badge>Active</Badge>}
                                        {sprint.status === 'COMPLETED' && <Badge variant="secondary">Completed</Badge>}
                                        {sprint.status === 'PLANNING' && <Badge variant="outline">Planning</Badge>}
                                    </div>
                                    <CardDescription className="line-clamp-2 min-h-[2.5em]">
                                        {sprint.goal || "No goal defined."}
                                    </CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setEditingSprint(sprint)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-red-600"
                                            onClick={() => setDeletingSprintId(sprint.id)}
                                        >
                                            <Trash className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2 text-sm text-muted-foreground space-y-2">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    {format(new Date(sprint.startDate), "MMM d")} - {format(new Date(sprint.endDate), "MMM d, yyyy")}
                                </span>
                            </div>
                            <div className="text-xs">
                                {sprint._count?.tasks || 0} tasks linked
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Link href={`/projects/${projectId}/board?sprint=${sprint.id}`} className="w-full">
                                <Button variant="outline" className="w-full">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Board
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                ))}

                {sprints?.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                        No sprints found. Create one to get started.
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            {editingSprint && (
                <SprintDialog
                    projectId={projectId}
                    sprint={editingSprint}
                    open={!!editingSprint}
                    onOpenChange={(open) => !open && setEditingSprint(null)}
                />
            )}

            {/* Delete Alert */}
            <AlertDialog open={!!deletingSprintId} onOpenChange={(open) => !open && setDeletingSprintId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Sprint?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{sprints?.find(s => s.id === deletingSprintId)?.name}". Tasks linked to this sprint will be unlinked (moved to backlog).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
