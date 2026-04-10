"use client";

import { createReactBlockSpec } from "@blocknote/react";

const CALLOUT_STYLES: Record<
    string,
    { bg: string; border: string; icon: string }
> = {
    info: {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-900",
        icon: "💡",
    },
    warning: {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-900",
        icon: "⚠️",
    },
    success: {
        bg: "bg-green-50 dark:bg-green-950/30",
        border: "border-green-200 dark:border-green-900",
        icon: "✅",
    },
    error: {
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-900",
        icon: "🚨",
    },
    note: {
        bg: "bg-neutral-50 dark:bg-neutral-900/50",
        border: "border-neutral-200 dark:border-neutral-800",
        icon: "📝",
    },
};

const CALLOUT_TYPES = Object.keys(CALLOUT_STYLES);

/**
 * Callout block — colored box with an icon and inline text content.
 *
 * Stored as: { type: "callout", props: { variant } }
 * Content uses BlockNote's inline content mechanism.
 */
export const CalloutBlock = createReactBlockSpec(
    {
        type: "callout",
        propSchema: {
            variant: { default: "info", values: CALLOUT_TYPES },
        } as const,
        content: "inline",
    },
    {
        render: ({ block, editor, contentRef }) => {
            const variant = (block.props.variant as string) || "info";
            const style = CALLOUT_STYLES[variant] || CALLOUT_STYLES.info;
            const editable = editor.isEditable;

            const cycleVariant = () => {
                if (!editable) return;
                const idx = CALLOUT_TYPES.indexOf(variant);
                const next = CALLOUT_TYPES[(idx + 1) % CALLOUT_TYPES.length];
                editor.updateBlock(block, {
                    type: "callout",
                    props: { variant: next },
                } as any);
            };

            return (
                <div
                    className={`my-1 flex items-start gap-3 rounded-lg border p-3 ${style.bg} ${style.border}`}
                >
                    <button
                        type="button"
                        onClick={cycleVariant}
                        className={`mt-0.5 text-lg leading-none ${editable ? "cursor-pointer hover:opacity-70" : ""}`}
                        title={editable ? "Click to change style" : undefined}
                    >
                        {style.icon}
                    </button>
                    <div className="flex-1 text-sm" ref={contentRef} />
                </div>
            );
        },
    },
);
