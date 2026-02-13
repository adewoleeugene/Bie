"use client";

import * as React from "react";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    Search,
    FileText,
    CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { globalSearch, type SearchResult } from "@/actions/search";

export function SearchDialog() {
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
            const res = await globalSearch(debouncedQuery);
            setLoading(false);

            if (res.success && res.results) {
                setResults(res.results);
            }
        };

        search();
    }, [debouncedQuery]);

    const handleSelect = (result: SearchResult) => {
        setOpen(false);
        router.push(result.url);
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="text-sm text-muted-foreground w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 rounded-md border border-transparent hover:border-border transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <span>Search...</span>
                </div>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search..." value={query} onValueChange={setQuery} />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    {results.length > 0 && query.length >= 2 && (
                        <CommandGroup heading="Search Results">
                            {results.map((result) => (
                                <CommandItem
                                    key={`${result.type}-${result.id}`}
                                    onSelect={() => handleSelect(result)}
                                    value={result.title}
                                >
                                    {result.type === "page" ? (
                                        <FileText className="mr-2 h-4 w-4" />
                                    ) : (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                    )}
                                    <div className="flex flex-col">
                                        <span>{result.title}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {result.subtitle}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Default commands if query is empty */}
                    {!query && (
                        <>
                            <CommandGroup heading="Suggestions">
                                <CommandItem onSelect={() => {
                                    setOpen(false);
                                    router.push("/dashboard");
                                }}>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    <span>Dashboard</span>
                                </CommandItem>
                                <CommandItem onSelect={() => {
                                    setOpen(false);
                                    router.push("/wiki");
                                }}>
                                    <Smile className="mr-2 h-4 w-4" />
                                    <span>Wiki</span>
                                </CommandItem>
                                <CommandItem onSelect={() => {
                                    setOpen(false);
                                    router.push("/settings");
                                }}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Settings</span>
                                </CommandItem>
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}
