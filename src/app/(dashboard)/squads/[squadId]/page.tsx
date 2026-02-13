"use client";

import { useSquad } from "@/hooks/use-squads";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, FolderKanban, Users, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SquadDialog } from "@/components/squads/squad-dialog";

export default function SquadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const squadId = params.squadId as string;
    const { data: squad, isLoading, error } = useSquad(squadId);
    const [showEditDialog, setShowEditDialog] = useState(false);

    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    if (error || !squad) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <h2 className="text-xl font-semibold">Squad not found</h2>
                <Button onClick={() => router.push("/squads")}>Back to Squads</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/squads")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">{squad.name}</h1>
                    <p className="text-muted-foreground">{squad.description || "No description provided."}</p>
                </div>
                <Button variant="outline" onClick={() => setShowEditDialog(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Squad
                </Button>
            </div>

            <SquadDialog
                squad={squad}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
            />

            <div className="grid gap-6 md:grid-cols-12">
                {/* Main Content Area - Projects */}
                <div className="md:col-span-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <FolderKanban className="h-5 w-5" />
                            Active Projects
                        </h2>
                        {/* Could add Create Project button here later */}
                    </div>

                    {squad.projects.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                            No active projects assigned to this squad.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {squad.projects.map((project) => (
                                <Card key={project.id} className="hover:shadow-sm transition-shadow">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base truncate">
                                                <Link href={`/projects/${project.id}`} className="hover:underline">
                                                    {project.name}
                                                </Link>
                                            </CardTitle>
                                            <Badge variant={project.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                {project.status}
                                            </Badge>
                                        </div>
                                        <CardDescription className="line-clamp-2 text-xs">
                                            {project.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pb-2 text-xs text-muted-foreground">
                                        <div className="flex justify-between mt-2">
                                            <span>{project._count.tasks} Tasks</span>
                                            <span>{project.lead ? `Lead: ${project.lead.name}` : 'No Lead'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar - Members */}
                <div className="md:col-span-4 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Members ({squad.members.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {squad.members.map((member) => (
                                    <div key={member.user.id} className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.user.image || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {member.user.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{member.user.name}</span>
                                            <span className="text-xs text-muted-foreground break-all">{member.user.email}</span>
                                        </div>
                                    </div>
                                ))}
                                {squad.members.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        No members assigned.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setShowEditDialog(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Manage Members
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
