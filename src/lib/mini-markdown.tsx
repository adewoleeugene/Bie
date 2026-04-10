import React from "react";

/**
 * Minimal markdown renderer — bullets, numbered lists, bold, italic, inline code.
 * Intentionally tiny: no headings, links, block code, tables. For "glanceable
 * AI replies," not a document renderer.
 */
export function MiniMarkdown({ text }: { text: string }) {
    const lines = text.split("\n");
    const out: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
        const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line);

        if (bullet || numbered) {
            const items: React.ReactNode[] = [];
            const ordered = !!numbered;
            while (i < lines.length) {
                const l = lines[i];
                const b = /^\s*[-*]\s+(.*)$/.exec(l);
                const n = /^\s*\d+\.\s+(.*)$/.exec(l);
                if (!b && !n) break;
                const content = (b ? b[1] : n![1]).trim();
                items.push(
                    <li key={`li-${i}`}>{renderInline(content)}</li>,
                );
                i++;
            }
            out.push(
                ordered ? (
                    <ol
                        key={`ol-${i}`}
                        className="my-1 list-decimal space-y-0.5 pl-5"
                    >
                        {items}
                    </ol>
                ) : (
                    <ul
                        key={`ul-${i}`}
                        className="my-1 list-disc space-y-0.5 pl-5"
                    >
                        {items}
                    </ul>
                ),
            );
            continue;
        }

        if (line.trim() === "") {
            out.push(<div key={`br-${i}`} className="h-1" />);
            i++;
            continue;
        }

        out.push(
            <p key={`p-${i}`} className="my-0.5">
                {renderInline(line)}
            </p>,
        );
        i++;
    }

    return <div className="text-sm leading-relaxed">{out}</div>;
}

/** Inline formatting: **bold**, *italic*, `code`. Regex-based, order matters. */
function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    // Tokenise greedily-but-safely.
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let k = 0;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith("**")) {
            parts.push(
                <strong key={`b-${k}`}>{token.slice(2, -2)}</strong>,
            );
        } else if (token.startsWith("*")) {
            parts.push(<em key={`i-${k}`}>{token.slice(1, -1)}</em>);
        } else if (token.startsWith("`")) {
            parts.push(
                <code
                    key={`c-${k}`}
                    className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em] dark:bg-neutral-800"
                >
                    {token.slice(1, -1)}
                </code>,
            );
        }
        lastIndex = match.index + token.length;
        k++;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}
