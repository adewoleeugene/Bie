import { MentionTargetType } from "@prisma/client";

/**
 * Extracts mentions from a BlockNote document.
 *
 * Mention chips are stored as a custom inline content node:
 *   { type: "mention", props: { mentionType: "user"|"page"|"date", targetId: "..." } }
 *
 * The extractor walks every block (recursively into children) and every inline
 * content array, collecting mention nodes alongside their containing block id.
 */

export interface ExtractedMention {
    targetType: MentionTargetType;
    targetId: string;
    blockId: string | null;
}

interface InlineContentNode {
    type?: string;
    props?: Record<string, unknown>;
    content?: InlineContentNode[];
}

interface BlockNode {
    id?: string;
    content?: InlineContentNode[] | string;
    children?: BlockNode[];
}

function inlineMentionType(raw: unknown): MentionTargetType | null {
    if (raw === "user") return MentionTargetType.USER;
    if (raw === "page") return MentionTargetType.WIKI_PAGE;
    if (raw === "date") return MentionTargetType.DATE;
    if (raw === "everyone") return MentionTargetType.EVERYONE;
    return null;
}

function walkInline(
    nodes: InlineContentNode[] | undefined,
    blockId: string | null,
    out: ExtractedMention[],
) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
        if (node?.type === "mention" && node.props) {
            const t = inlineMentionType(node.props.mentionType);
            const id = node.props.targetId;
            if (t && typeof id === "string" && id.length > 0) {
                out.push({ targetType: t, targetId: id, blockId });
            }
        }
        if (Array.isArray(node?.content)) {
            walkInline(node.content, blockId, out);
        }
    }
}

function walkBlocks(blocks: BlockNode[] | undefined, out: ExtractedMention[]) {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
        const blockId = typeof block?.id === "string" ? block.id : null;
        if (Array.isArray(block?.content)) {
            walkInline(block.content as InlineContentNode[], blockId, out);
        }
        if (Array.isArray(block?.children)) {
            walkBlocks(block.children, out);
        }
    }
}

export function extractMentions(content: unknown): ExtractedMention[] {
    if (!Array.isArray(content)) return [];
    const out: ExtractedMention[] = [];
    walkBlocks(content as BlockNode[], out);

    // Deduplicate by (type|id|blockId) so a single chip in a block doesn't count twice.
    const seen = new Set<string>();
    return out.filter((m) => {
        const key = `${m.targetType}|${m.targetId}|${m.blockId ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Diff two mention sets by (targetType, targetId). Used to fire notifications
 * only for *newly added* user mentions on a page save.
 */
export function newlyAddedTargets(
    previous: ExtractedMention[],
    next: ExtractedMention[],
    targetType: MentionTargetType,
): string[] {
    const prevIds = new Set(
        previous.filter((m) => m.targetType === targetType).map((m) => m.targetId),
    );
    const added: string[] = [];
    for (const m of next) {
        if (m.targetType !== targetType) continue;
        if (!prevIds.has(m.targetId)) added.push(m.targetId);
    }
    return Array.from(new Set(added));
}
