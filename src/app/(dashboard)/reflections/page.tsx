"use client";

import { useReflectionHistory } from "@/hooks/use-reflections";
import { BookOpen } from "lucide-react";
import { format } from "date-fns";

const MOOD_EMOJI: Record<number, string> = {
    1: "\uD83D\uDE29",
    2: "\uD83D\uDE15",
    3: "\uD83D\uDE10",
    4: "\uD83D\uDE42",
    5: "\uD83D\uDE0A",
};

export default function ReflectionsPage() {
    const { data: reflections, isLoading } = useReflectionHistory(60);

    return (
        <div className="mx-auto max-w-3xl p-8">
            <div className="mb-8 flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-amber-500" />
                <h1 className="text-2xl font-semibold">Reflections</h1>
            </div>

            {isLoading ? (
                <p className="text-sm text-neutral-500">Loading...</p>
            ) : !reflections || reflections.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
                    <BookOpen className="mx-auto h-8 w-8 text-neutral-300" />
                    <p className="mt-3 text-sm text-neutral-500">
                        No reflections yet. Complete a focus session or visit My Day to write your first one.
                    </p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {reflections.map((r: any) => (
                        <li
                            key={r.id}
                            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {r.mood && (
                                        <span className="text-xl">
                                            {MOOD_EMOJI[r.mood] || ""}
                                        </span>
                                    )}
                                    <span className="text-sm font-medium">
                                        {format(new Date(r.date), "EEEE, MMMM d")}
                                    </span>
                                </div>
                                {r.energyLevel && (
                                    <span className="text-xs text-neutral-500">
                                        Energy: {r.energyLevel}/5
                                    </span>
                                )}
                            </div>
                            {r.highlights && (
                                <p className="text-sm">
                                    <span className="text-neutral-500">Went well:</span>{" "}
                                    {r.highlights}
                                </p>
                            )}
                            {r.improvements && (
                                <p className="mt-1 text-sm">
                                    <span className="text-neutral-500">Improve:</span>{" "}
                                    {r.improvements}
                                </p>
                            )}
                            {r.content && (
                                <p className="mt-2 text-xs text-neutral-500 line-clamp-3">
                                    {r.content}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
