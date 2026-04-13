import { Skeleton } from "@/components/ui/skeleton";

export default function WikiLoading() {
    return (
        <div className="flex h-full w-full">
            {/* Sidebar */}
            <div className="hidden md:flex w-64 flex-col border-r p-4 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-40" />
            </div>
            {/* Content */}
            <div className="flex-1 p-6 space-y-4">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-40 w-full rounded-lg mt-4" />
            </div>
        </div>
    );
}
