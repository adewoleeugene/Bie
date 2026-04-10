/**
 * Flatten a BlockNote document (array of blocks) to plain text, one block per line.
 * Used by the wiki history diff viewer — block-level diff would be ideal, but
 * line-level over plain text is good enough for v1.
 */

interface InlineNode {
    type?: string;
    text?: string;
    content?: InlineNode[];
    props?: Record<string, unknown>;
}

interface Block {
    type?: string;
    content?: InlineNode[] | string;
    children?: Block[];
}

function inlineToText(nodes: InlineNode[] | undefined): string {
    if (!Array.isArray(nodes)) return "";
    return nodes
        .map((n) => {
            if (n?.type === "mention" && n.props) {
                return `@${(n.props as { label?: string }).label ?? ""}`;
            }
            if (typeof n?.text === "string") return n.text;
            if (Array.isArray(n?.content)) return inlineToText(n.content);
            return "";
        })
        .join("");
}

function blockToLines(block: Block, depth = 0, out: string[]) {
    const prefix = "  ".repeat(depth);
    let line = "";
    if (Array.isArray(block?.content)) {
        line = inlineToText(block.content as InlineNode[]);
    } else if (typeof block?.content === "string") {
        line = block.content;
    }
    if (line.length > 0 || block?.type) {
        out.push(`${prefix}${line}`);
    }
    if (Array.isArray(block?.children)) {
        for (const c of block.children) blockToLines(c, depth + 1, out);
    }
}

export function blocknoteToText(content: unknown): string {
    if (!Array.isArray(content)) return "";
    const out: string[] = [];
    for (const b of content as Block[]) blockToLines(b, 0, out);
    return out.join("\n");
}
