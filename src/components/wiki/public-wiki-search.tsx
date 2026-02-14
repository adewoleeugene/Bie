"use client";

import * as React from "react";
import { Search, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { publicWikiSearch, type SearchResult } from "@/actions/public-search";

interface PublicWikiSearchProps {
    organizationId: string;
}

export function PublicWikiSearch({ organizationId }: PublicWikiSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const debouncedQuery = useDebounce(query, 300);
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    React.useEffect(() => {
        const search = async () => {
            if (!debouncedQuery || debouncedQuery.length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            const res = await publicWikiSearch(debouncedQuery, organizationId);
            setLoading(false);

            if (res.success && res.results) {
                setResults(res.results);
            }
        };

        search();
    }, [debouncedQuery, organizationId]);

    const handleSelect = (result: SearchResult) => {
        setOpen(false);
        router.push(result.url);
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="text-sm text-muted-foreground w-64 flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 rounded-md border border-neutral-200 dark:border-neutral-800 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <span>Search wiki...</span>
                </div>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Search within this wiki..." value={query} onValueChange={setQuery} />
                <CommandList>
                    <CommandEmpty>No results found in public wiki.</CommandEmpty>
                    {results.length > 0 && query.length >= 2 && (
                        <CommandGroup heading="Search Results">
                            {results.map((result) => (
                                <CommandItem
                                    key={`${result.type}-${result.id}`}
                                    onSelect={() => handleSelect(result)}
                                    value={result.title}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{result.title}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}
