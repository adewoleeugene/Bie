"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Toggle block — collapsible section with a summary and hidden content.
 *
 * Stored as: { type: "toggle", props: { summary } }
 * The toggle's inner content uses BlockNote's nested `content` mechanism.
 */
export const ToggleBlock = createReactBlockSpec(
    {
        type: "toggle",
        propSchema: {
            summary: { default: "Toggle" },
        } as const,
        content: "inline",
    },
    {
        render: ({ block, editor, contentRef }) => {
            const [open, setOpen] = useState(false);
            const editable = editor.isEditable;

            return (
                <div className="my-1">
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/50"
                    >
                        <ChevronRight
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                open ? "rotate-90" : ""
                            }`}
                        />
                        {editable ? (
                            <input
                                value={block.props.summary}
                                onChange={(e) =>
                                    editor.updateBlock(block, {
                                        type: "toggle",
                                        props: { summary: e.target.value },
                                    } as any)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-transparent text-sm font-medium outline-none"
                                placeholder="Toggle heading..."
                            />
                        ) : (
                            <span className="flex-1 text-sm font-medium">
                                {block.props.summary || "Toggle"}
                            </span>
                        )}
                    </button>
                    <div
                        className={`ml-5 border-l border-muted pl-3 ${
                            open ? "mt-1" : "hidden"
                        }`}
                        ref={contentRef}
                    />
                </div>
            );
        },
    },
);
