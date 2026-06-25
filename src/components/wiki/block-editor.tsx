"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
    BlockNoteSchema,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    PartialBlock,
} from "@blocknote/core";

// Lightweight substring filter — `filterSuggestionItems` is not re-exported
// from the @blocknote/core package root in this version.
function filterItems<T extends { title: string; aliases?: string[] }>(
    items: T[],
    query: string,
): T[] {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
        (i) =>
            i.title.toLowerCase().includes(q) ||
            (i.aliases || []).some((a) => a.toLowerCase().includes(q)),
    );
}
import { BlockNoteView } from "@blocknote/mantine";
import {
    createReactInlineContentSpec,
    useCreateBlockNote,
    SuggestionMenuController,
    DefaultReactSuggestionItem,
    getDefaultReactSlashMenuItems,
    type SuggestionMenuProps,
} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import { searchMentionTargets } from "@/actions/wiki";
import { uploadEditorFile } from "@/actions/attachments";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Calendar, Users, Database, ChevronRight, MessageSquare, Link2 } from "lucide-react";
import { DatabaseEmbedBlock } from "@/components/wiki/database-embed-block";
import { ToggleBlock } from "@/components/wiki/toggle-block";
import { CalloutBlock } from "@/components/wiki/callout-block";

/**
 * Custom inline content: a "mention" chip.
 *
 * Stored in BlockNote JSON as:
 *   { type: "mention", props: { mentionType, targetId, label }, content: undefined }
 *
 * The `mentionType` and `targetId` props are what `extractMentions()` reads
 * server-side to populate the WikiMention table.
 */
const Mention = createReactInlineContentSpec(
    {
        type: "mention",
        propSchema: {
            mentionType: { default: "user" }, // "user" | "page" | "date"
            targetId: { default: "" },
            label: { default: "" },
        } as const,
        content: "none",
    },
    {
        render: (props) => {
            const { mentionType, targetId, label } = props.inlineContent.props;
            const href =
                mentionType === "page"
                    ? `/wiki/${targetId}`
                    : mentionType === "user"
                      ? `/users/${targetId}`
                      : mentionType === "date"
                        ? `/dates/${targetId}`
                        : mentionType === "everyone"
                          ? undefined
                          : undefined;

            const chip = (
                <span
                    data-mention-type={mentionType}
                    data-mention-id={targetId}
                    className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-sm font-medium text-primary"
                >
                    @{label || targetId}
                </span>
            );

            return href ? <Link href={href}>{chip}</Link> : chip;
        },
    },
);

const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        databaseEmbed: DatabaseEmbedBlock(),
        toggle: ToggleBlock(),
        callout: CalloutBlock(),
    },
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        mention: Mention,
    },
});

interface BlockEditorProps {
    initialContent?: any;
    onChange?: (content: any) => void;
    editable?: boolean;
    onActiveBlockChange?: (blockId: string | null) => void;
}

/**
 * Custom slash-menu renderer. Two reasons we don't use the default:
 *  1. onMouseDown + preventDefault keeps the editor focused so a *mouse click*
 *     reliably fires the command (the default lost focus → only keyboard
 *     selection worked).
 *  2. Stable per-index keys avoid React duplicate-key issues.
 * Renders grouped items with icons, subtext, and shortcut badges to match the
 * default look.
 */
function EditorSuggestionMenu(
    props: SuggestionMenuProps<DefaultReactSuggestionItem>,
) {
    const { items, selectedIndex, onItemClick } = props;
    let lastGroup: string | undefined;
    return (
        <div className="z-50 max-h-[360px] w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-[color:var(--card)] p-1 shadow-xl dark:border-neutral-800">
            {items.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                    No matches
                </div>
            )}
            {items.map((item, i) => {
                const showHeader = !!item.group && item.group !== lastGroup;
                lastGroup = item.group;
                return (
                    <div key={`${item.group ?? ""}-${item.title}-${i}`}>
                        {showHeader && (
                            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                {item.group}
                            </div>
                        )}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onItemClick?.(item)}
                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                                i === selectedIndex ? "bg-muted" : "hover:bg-muted"
                            }`}
                        >
                            {item.icon && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                    {item.icon}
                                </span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">{item.title}</span>
                                {item.subtext && (
                                    <span className="truncate text-[11px] text-muted-foreground">
                                        {item.subtext}
                                    </span>
                                )}
                            </span>
                            {item.badge && (
                                <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export function BlockEditor({
    initialContent,
    onChange,
    editable = true,
    onActiveBlockChange,
}: BlockEditorProps) {
    const editor = useCreateBlockNote({
        schema,
        initialContent: initialContent
            ? (initialContent as PartialBlock[])
            : undefined,
        // Enables the Image/Video/Audio/File blocks to actually upload.
        uploadFile: async (file: File) => {
            const fd = new FormData();
            fd.append("file", file);
            return await uploadEditorFile(fd);
        },
    });

    useEffect(() => {
        editor.isEditable = editable;
    }, [editable, editor]);

    // Inline link popover (used by the "/" → Link command) instead of a
    // browser prompt. Anchored to the caret position.
    const [linkPos, setLinkPos] = useState<{ left: number; top: number } | null>(
        null,
    );
    const [linkUrl, setLinkUrl] = useState("");
    const [linkText, setLinkText] = useState("");
    const linkUrlRef = useRef<HTMLInputElement>(null);

    const openLinkInput = () => {
        let left = 240;
        let top = 240;
        const sel = typeof window !== "undefined" ? window.getSelection() : null;
        if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            if (rect && (rect.left || rect.bottom)) {
                left = rect.left;
                top = rect.bottom + 6;
            }
        }
        setLinkUrl("");
        setLinkText("");
        setLinkPos({ left, top });
        setTimeout(() => linkUrlRef.current?.focus(), 0);
    };

    const submitLink = () => {
        const raw = linkUrl.trim();
        if (!raw) {
            setLinkPos(null);
            return;
        }
        const href = /^(https?:\/\/|mailto:|\/)/i.test(raw) ? raw : `https://${raw}`;
        editor.insertInlineContent([
            { type: "link", href, content: linkText.trim() || raw },
            " ",
        ]);
        setLinkPos(null);
        editor.focus();
    };

    /**
     * Builds suggestion items for the @-menu.
     * Queries users + wiki pages for the current org, plus a "today" date entry.
     */
    const getMentionItems = useMemo(
        () =>
            async (query: string): Promise<DefaultReactSuggestionItem[]> => {
                const { users, pages } = await searchMentionTargets(query);

                const userItems: DefaultReactSuggestionItem[] = users.map((u) => ({
                    title: u.name || u.email || "Unknown",
                    subtext: u.email ?? undefined,
                    icon: (
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={u.image || undefined} />
                            <AvatarFallback className="text-[10px]">
                                {(u.name || u.email || "?").substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    ),
                    onItemClick: () => {
                        editor.insertInlineContent([
                            {
                                type: "mention",
                                props: {
                                    mentionType: "user",
                                    targetId: u.id,
                                    label: u.name || u.email || "user",
                                },
                            },
                            " ",
                        ]);
                    },
                }));

                const pageItems: DefaultReactSuggestionItem[] = pages.map((p) => ({
                    title: p.title,
                    subtext: "Wiki page",
                    icon: <FileText className="h-4 w-4 text-neutral-500" />,
                    onItemClick: () => {
                        editor.insertInlineContent([
                            {
                                type: "mention",
                                props: {
                                    mentionType: "page",
                                    targetId: p.id,
                                    label: p.title,
                                },
                            },
                            " ",
                        ]);
                    },
                }));

                const today = new Date().toISOString().slice(0, 10);
                const dateItems: DefaultReactSuggestionItem[] = [
                    {
                        title: `Today (${today})`,
                        subtext: "Date",
                        icon: <Calendar className="h-4 w-4 text-neutral-500" />,
                        onItemClick: () => {
                            editor.insertInlineContent([
                                {
                                    type: "mention",
                                    props: {
                                        mentionType: "date",
                                        targetId: today,
                                        label: today,
                                    },
                                },
                                " ",
                            ]);
                        },
                    },
                ];

                // Server already filtered users/pages by `query`; date entry is always relevant.
                return [...userItems, ...pageItems, ...dateItems];
            },
        [editor],
    );

    return (
        <div className="min-h-[500px]">
            <BlockNoteView
                editor={editor}
                theme="dark"
                editable={editable}
                onChange={() => {
                    if (onChange) {
                        onChange(editor.document);
                    }
                }}
                onSelectionChange={() => {
                    if (onActiveBlockChange) {
                        try {
                            const pos = editor.getTextCursorPosition();
                            onActiveBlockChange(pos.block.id ?? null);
                        } catch {
                            onActiveBlockChange(null);
                        }
                    }
                }}
            >
                <SuggestionMenuController
                    triggerCharacter={"/"}
                    suggestionMenuComponent={EditorSuggestionMenu}
                    getItems={async (query) =>
                        filterItems(
                            [
                                ...getDefaultReactSlashMenuItems(editor as any),
                                {
                                    title: "Link",
                                    subtext: "Insert a hyperlink",
                                    aliases: ["link", "url", "hyperlink", "href", "anchor"],
                                    group: "Wiki blocks",
                                    icon: <Link2 className="h-4 w-4 text-neutral-500" />,
                                    onItemClick: () => openLinkInput(),
                                },
                                {
                                    title: "Database",
                                    subtext: "Embed a database",
                                    aliases: ["db", "database", "table"],
                                    group: "Wiki blocks",
                                    icon: <Database className="h-4 w-4 text-neutral-500" />,
                                    onItemClick: () => {
                                        editor.insertBlocks(
                                            [
                                                {
                                                    type: "databaseEmbed",
                                                    props: { databaseId: "" },
                                                } as any,
                                            ],
                                            editor.getTextCursorPosition().block,
                                            "after",
                                        );
                                    },
                                },
                                {
                                    title: "Toggle",
                                    subtext: "Collapsible section",
                                    aliases: ["toggle", "collapse", "accordion", "expand"],
                                    group: "Wiki blocks",
                                    icon: <ChevronRight className="h-4 w-4 text-neutral-500" />,
                                    onItemClick: () => {
                                        editor.insertBlocks(
                                            [{ type: "toggle", props: { summary: "" } } as any],
                                            editor.getTextCursorPosition().block,
                                            "after",
                                        );
                                    },
                                },
                                {
                                    title: "Callout",
                                    subtext: "Highlighted note with icon",
                                    aliases: ["callout", "note", "info", "warning", "tip"],
                                    group: "Wiki blocks",
                                    icon: <MessageSquare className="h-4 w-4 text-neutral-500" />,
                                    onItemClick: () => {
                                        editor.insertBlocks(
                                            [{ type: "callout", props: { variant: "info" } } as any],
                                            editor.getTextCursorPosition().block,
                                            "after",
                                        );
                                    },
                                },
                            ],
                            query,
                        )
                    }
                />
                <SuggestionMenuController
                    triggerCharacter={"@"}
                    getItems={getMentionItems}
                />
                <SuggestionMenuController
                    triggerCharacter={"@@"}
                    getItems={async (): Promise<DefaultReactSuggestionItem[]> => [
                        {
                            title: "Everyone",
                            subtext: "Notify the whole organization",
                            icon: <Users className="h-4 w-4 text-neutral-500" />,
                            onItemClick: () => {
                                editor.insertInlineContent([
                                    {
                                        type: "mention",
                                        props: {
                                            mentionType: "everyone",
                                            targetId: "everyone",
                                            label: "everyone",
                                        },
                                    },
                                    " ",
                                ]);
                            },
                        },
                    ]}
                />
            </BlockNoteView>

            {linkPos && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setLinkPos(null)}
                    />
                    <div
                        style={{
                            position: "fixed",
                            left: linkPos.left,
                            top: linkPos.top,
                            zIndex: 50,
                        }}
                        className="w-72 rounded-lg border border-neutral-200 bg-[color:var(--card)] p-2 shadow-xl dark:border-neutral-800"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setLinkPos(null);
                        }}
                    >
                        <input
                            ref={linkUrlRef}
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    submitLink();
                                }
                            }}
                            placeholder="Paste or type a link"
                            className="mb-1.5 h-8 w-full rounded border border-neutral-200 bg-[color:var(--background)] px-2 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-neutral-800"
                        />
                        <input
                            value={linkText}
                            onChange={(e) => setLinkText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    submitLink();
                                }
                            }}
                            placeholder="Display text (optional)"
                            className="mb-2 h-8 w-full rounded border border-neutral-200 bg-[color:var(--background)] px-2 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-neutral-800"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setLinkPos(null)}
                                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitLink}
                                className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                            >
                                Add link
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
