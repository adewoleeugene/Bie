"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";
import { searchWikiPages } from "@/actions/wiki";
import { useDebounce } from "@/hooks/use-debounce";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WikiSearchProps {
    organizationId: string;
    basePath?: string;
}

export function WikiSearch({ organizationId, basePath = "/wiki" }: WikiSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        searchWikiPages(debouncedQuery, organizationId).then((res) => {
            if (res.success) {
                setResults(res.data || []);
            }
            setIsSearching(false);
        });
    }, [debouncedQuery, organizationId]);

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <Input
                    placeholder="Search wiki..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShowResults(true);
                    }}
                    onFocus={() => query.length >= 2 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    className="pl-8 h-8 text-sm"
                />
            </div>

            {showResults && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
                    {isSearching ? (
                        <div className="p-3 text-sm text-neutral-500 text-center">Searching...</div>
                    ) : results.length === 0 ? (
                        <div className="p-3 text-sm text-neutral-500 text-center">No pages found</div>
                    ) : (
                        results.map((page) => (
                            <Link
                                key={page.id}
                                href={`${basePath}/${page.id}`}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                onClick={() => {
                                    setShowResults(false);
                                    setQuery("");
                                }}
                            >
                                <FileText className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                                <span className="truncate">{page.title}</span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
