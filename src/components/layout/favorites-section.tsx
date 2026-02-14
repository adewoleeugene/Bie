"use client";

import Link from "next/link";
import { useFavorites, useRecentItems } from "@/hooks/use-favorites";
import { Button } from "@/components/ui/button";
import { Star, Clock, FolderKanban, CheckSquare, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
    project: <FolderKanban className="h-3.5 w-3.5 text-blue-500" />,
    task: <CheckSquare className="h-3.5 w-3.5 text-green-500" />,
    wiki_page: <BookOpen className="h-3.5 w-3.5 text-purple-500" />,
};

export function FavoritesSection() {
    const { data: favorites } = useFavorites();
    const { data: recentItems } = useRecentItems(8);
    const [favoritesOpen, setFavoritesOpen] = useState(true);
    const [recentOpen, setRecentOpen] = useState(true);

    const hasFavorites = favorites && favorites.length > 0;
    const hasRecent = recentItems && recentItems.length > 0;

    if (!hasFavorites && !hasRecent) return null;

    return (
        <div className="space-y-1">
            {/* Favorites */}
            {hasFavorites && (
                <div>
                    <button
                        onClick={() => setFavoritesOpen(!favoritesOpen)}
                        className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                        {favoritesOpen ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                        <Star className="h-3 w-3 text-amber-500" />
                        Favorites
                    </button>
                    {favoritesOpen && (
                        <div className="space-y-0.5 ml-1">
                            {favorites.map((fav: any) => (
                                <Link key={fav.id} href={fav.itemUrl}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-full justify-start text-xs font-normal gap-2 px-3"
                                    >
                                        {ITEM_TYPE_ICONS[fav.itemType] || <Star className="h-3.5 w-3.5" />}
                                        <span className="truncate">{fav.itemTitle}</span>
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recent */}
            {hasRecent && (
                <div>
                    <button
                        onClick={() => setRecentOpen(!recentOpen)}
                        className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                        {recentOpen ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                        <Clock className="h-3 w-3" />
                        Recent
                    </button>
                    {recentOpen && (
                        <div className="space-y-0.5 ml-1">
                            {recentItems.map((item: any) => (
                                <Link key={item.id} href={item.itemUrl}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-full justify-start text-xs font-normal gap-2 px-3 text-muted-foreground"
                                    >
                                        {ITEM_TYPE_ICONS[item.itemType] || <Clock className="h-3.5 w-3.5" />}
                                        <span className="truncate">{item.itemTitle}</span>
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
