/**
 * Serialize BlockNote JSON to Markdown.
 *
 * Handles: headings, paragraphs, bullet lists, numbered lists, checkboxes,
 * code blocks, images, tables, bold, italic, underline, strikethrough,
 * inline code, links, mentions, toggle, callout, database embeds.
 */

interface BNBlock {
    type?: string;
    content?: BNInline[] | string;
    props?: Record<string, unknown>;
    children?: BNBlock[];
}

interface BNInline {
    type?: string;
    text?: string;
    content?: BNInline[];
    props?: Record<string, unknown>;
    styles?: Record<string, unknown>;
}

function inlineToMd(content: unknown): string {
    if (!content) return "";
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";

    return (content as BNInline[])
        .map((node) => {
            if (node.type === "mention") {
                return `@${(node.props as Record<string, unknown>)?.label || ""}`;
            }
            if (node.type === "link") {
                const url = (node.props as Record<string, unknown>)?.url || "";
                const text = inlineToMd(node.content);
                return `[${text}](${url})`;
            }
            let text = node.text || inlineToMd(node.content) || "";
            if (!text) return "";
            const s = node.styles || {};
            if (s.code) text = `\`${text}\``;
            if (s.bold) text = `**${text}**`;
            if (s.italic) text = `*${text}*`;
            if (s.strikethrough) text = `~~${text}~~`;
            return text;
        })
        .join("");
}

/** A single table cell is either a bare inline-content array (older BlockNote)
 *  or an object `{ type: "tableCell", content: [...] }` (current). */
function cellToMd(cell: unknown): string {
    const inline = Array.isArray(cell)
        ? cell
        : (cell as { content?: unknown })?.content;
    return inlineToMd(inline)
        .replace(/\|/g, "\\|") // pipes would break the table grid
        .replace(/\r?\n/g, "<br>"); // keep multi-line cells on one Markdown row
}

/** Serialize a BlockNote `tableContent` block to a GitHub-flavored Markdown table. */
function tableToMd(content: unknown, indent: string): string {
    const rows = (content as { rows?: { cells?: unknown[] }[] })?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return `${indent}[Table]`;

    const cols = Math.max(...rows.map((r) => r.cells?.length ?? 0));
    if (cols === 0) return `${indent}[Table]`;

    const renderRow = (cells: unknown[] = []) => {
        const out = Array.from({ length: cols }, (_, i) => cellToMd(cells[i] ?? ""));
        return `${indent}| ${out.join(" | ")} |`;
    };

    const [header, ...body] = rows;
    const separator = `${indent}| ${Array(cols).fill("---").join(" | ")} |`;
    return [renderRow(header.cells), separator, ...body.map((r) => renderRow(r.cells))].join("\n");
}

function blockToMd(block: BNBlock, indent = ""): string {
    const type = block.type || "paragraph";
    const text = inlineToMd(block.content);
    const children = block.children || [];
    const childMd = children.map((c) => blockToMd(c, indent + "  ")).join("\n");

    let result = "";

    switch (type) {
        case "heading": {
            const level = Number((block.props as Record<string, unknown>)?.level) || 1;
            result = `${indent}${"#".repeat(level)} ${text}`;
            break;
        }
        case "bulletListItem":
            result = `${indent}- ${text}`;
            break;
        case "numberedListItem":
            result = `${indent}1. ${text}`;
            break;
        case "checkListItem": {
            const checked = (block.props as Record<string, unknown>)?.checked ? "x" : " ";
            result = `${indent}- [${checked}] ${text}`;
            break;
        }
        case "codeBlock": {
            const lang = (block.props as Record<string, unknown>)?.language || "";
            result = `${indent}\`\`\`${lang}\n${text}\n${indent}\`\`\``;
            break;
        }
        case "image": {
            const url = (block.props as Record<string, unknown>)?.url || "";
            const caption = (block.props as Record<string, unknown>)?.caption || "";
            result = `${indent}![${caption}](${url})`;
            break;
        }
        case "toggle": {
            const summary = (block.props as Record<string, unknown>)?.summary || "Toggle";
            result = `${indent}<details>\n${indent}<summary>${summary}</summary>\n\n${childMd}\n${indent}</details>`;
            return result; // children already included
        }
        case "callout": {
            const variant = (block.props as Record<string, unknown>)?.variant || "info";
            result = `${indent}> **${String(variant).toUpperCase()}:** ${text}`;
            break;
        }
        case "databaseEmbed": {
            const dbId = (block.props as Record<string, unknown>)?.databaseId || "";
            result = `${indent}[Database: ${dbId}]`;
            break;
        }
        case "table": {
            result = tableToMd(block.content, indent);
            break;
        }
        default:
            result = text ? `${indent}${text}` : "";
    }

    if (childMd && type !== "toggle") {
        return result + "\n" + childMd;
    }
    return result;
}

export function blocknoteToMarkdown(doc: unknown): string {
    if (!Array.isArray(doc)) return "";
    return (doc as BNBlock[])
        .map((block) => blockToMd(block))
        .filter(Boolean)
        .join("\n\n");
}
