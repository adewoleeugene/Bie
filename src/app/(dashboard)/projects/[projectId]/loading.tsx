import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
    return (
        <div className="flex h-full w-full flex-col p-6 space-y-4">
            <div className="flex justify-between items-center mb-2">
                <Skeleton className="h-8 w-56" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-20" />
                </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 border-b pb-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
            </div>
            {/* Content area */}
            <div className="flex-1">
                <Skeleton className="h-full w-full rounded-lg" />
            </div>
        </div>
    );
}
