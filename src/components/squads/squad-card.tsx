"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Users, FolderKanban, Pencil, Trash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Squad } from "@prisma/client";
import { useDeleteSquad } from "@/hooks/use-squads";
import { useState } from "react";
import { SquadDialog } from "./squad-dialog";
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

interface SquadWithDetails extends Squad {
    members: {
        userId: string;
        user: {
            id: string;
            name: string | null;
            image: string | null;
            email: string | null;
        }
    }[];
    _count: {
        projects: number;
    };
}

interface SquadCardProps {
    squad: SquadWithDetails;
}

export function SquadCard({ squad }: SquadCardProps) {
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const deleteSquad = useDeleteSquad();

    const handleDelete = async () => {
        try {
            await deleteSquad.mutateAsync({ id: squad.id });
            setShowDeleteDialog(false);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <>
            <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <CardTitle>
                            <Link href={`/squads/${squad.id}`} className="hover:underline">
                                {squad.name}
                            </Link>
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                            {squad.description || "No description provided."}
                        </CardDescription>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setShowDeleteDialog(true)}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                            <Users className="mr-1 h-3 w-3" />
                            {squad.members.length} Members
                        </div>
                        <div className="flex items-center">
                            <FolderKanban className="mr-1 h-3 w-3" />
                            {squad._count.projects} Projects
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <div className="flex -space-x-2 overflow-hidden">
                        {squad.members.slice(0, 5).map((member) => (
                            <Avatar key={member.user.id} className="inline-block h-6 w-6 ring-2 ring-background">
                                <AvatarImage src={member.user.image || undefined} />
                                <AvatarFallback className="text-[10px]">
                                    {member.user.name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                        {squad.members.length > 5 && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-2 ring-background text-[10px] font-medium">
                                +{squad.members.length - 5}
                            </div>
                        )}
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(squad.updatedAt), { addSuffix: true })}
                    </div>
                </CardFooter>
            </Card>

            <SquadDialog
                squad={squad}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
            />

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the squad
                            and unlink all associated projects.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteSquad.isPending ? "Deleting..." : "Delete Squad"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
