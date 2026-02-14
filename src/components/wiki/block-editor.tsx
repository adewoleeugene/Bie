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
        editor.isEditable = editable;
    }, [editable, editor]);

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
            />
        </div>
    );
}
