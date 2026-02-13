"use client";

import { useEffect, useMemo } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";

interface BlockEditorProps {
    initialContent?: any;
    onChange?: (content: any) => void;
    editable?: boolean;
}

export function BlockEditor({ initialContent, onChange, editable = true }: BlockEditorProps) {
    const editor = useCreateBlockNote({
        initialContent: initialContent
            ? (initialContent as PartialBlock[])
            : undefined,
    });

    useEffect(() => {
        if (!editable) {
            editor.isEditable = false;
        }
    }, [editable, editor]);

    return (
        <div className="border rounded-lg overflow-hidden">
            <BlockNoteView
                editor={editor}
                theme="light"
                onChange={() => {
                    if (onChange) {
                        onChange(editor.document);
                    }
                }}
            />
        </div>
    );
}
