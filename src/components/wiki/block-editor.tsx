"use client";

import { useEffect, useMemo } from "react";
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
} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import { searchMentionTargets } from "@/actions/wiki";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Calendar, Users, Database, ChevronRight, MessageSquare } from "lucide-react";
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
    });

    useEffect(() => {
        editor.isEditable = editable;
    }, [editable, editor]);

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
                theme="light"
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
                    getItems={async (query) =>
                        filterItems(
                            [
                                ...getDefaultReactSlashMenuItems(editor as any),
                                {
                                    title: "Database",
                                    subtext: "Embed a database",
                                    aliases: ["db", "database", "table"],
                                    group: "Other",
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
                                    group: "Basic blocks",
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
                                    group: "Basic blocks",
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
        </div>
    );
}
