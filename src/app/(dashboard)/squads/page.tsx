"use client";

import { useSquads } from "@/hooks/use-squads";
import { SquadCard } from "@/components/squads/squad-card";
import { SquadDialog } from "@/components/squads/squad-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SquadsPage() {
    const { data: squads, isLoading } = useSquads();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Squads</h1>
                    <p className="text-muted-foreground">
                        Manage your teams and their projects.
                    </p>
                </div>
                <SquadDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {squads?.map((squad) => (
                    <SquadCard key={squad.id} squad={squad as any} />
                ))}
            </div>

            {squads?.length === 0 && (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 p-8 text-center animate-in fade-in-50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">No squads created</h3>
                    <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
                        Squads represent cross-functional teams that execute projects. Create a squad to get started.
                    </p>
                    <SquadDialog
                        trigger={
                            <Button>
                                Create Squad
                            </Button>
                        }
                    />
                </div>
            )}
        </div>
    );
}
