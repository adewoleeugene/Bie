import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
    return (
        <div className="flex h-full w-full">
            {/* Conversation list */}
            <div className="hidden md:flex w-72 flex-col border-r p-4 space-y-3">
                <Skeleton className="h-9 w-full" />
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                    </div>
                ))}
            </div>
            {/* Message area */}
            <div className="flex-1 flex flex-col p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="flex-1" />
                <Skeleton className="h-12 w-full rounded-lg" />
            </div>
        </div>
    );
}
