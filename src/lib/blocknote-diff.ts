/**
 * Block-level diff for BlockNote documents.
 *
 * Strategy:
 *  1. Match blocks across versions by their BlockNote `id`.
 *  2. Use LCS over the id sequences to find a common spine, so removed blocks
 *     are emitted at their *original position* relative to surrounding kept
 *     blocks, not appended at the end.
 *  3. For matched-but-changed blocks: if only the children differ, recurse
 *     into the children and emit a `children-changed` entry. If the block
 *     itself differs, emit `modified` (caller renders side-by-side).
 */

interface RawBlock {
    id?: string;
    type?: string;
    content?: unknown;
    children?: RawBlock[];
    props?: Record<string, unknown>;
}

export type BlockDiffEntry =
    | { type: "same"; block: RawBlock }
    | { type: "added"; block: RawBlock }
    | { type: "removed"; block: RawBlock }
    | { type: "modified"; oldBlock: RawBlock; newBlock: RawBlock }
    | {
          type: "children-changed";
          block: RawBlock; // unchanged shell, for context
          childDiff: BlockDiffEntry[];
      };

function stableJson(value: unknown): string {
    return JSON.stringify(value, (_, v) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
            return Object.keys(v)
                .sort()
                .reduce<Record<string, unknown>>((acc, k) => {
                    acc[k] = (v as Record<string, unknown>)[k];
                    return acc;
                }, {});
        }
        return v;
    });
}

/** JSON of the block excluding `id` and `children` — captures "self" only. */
function selfJson(block: RawBlock): string {
    const { id: _id, children: _c, ...rest } = block;
    return stableJson(rest);
}

/** LCS table over two id sequences. */
function lcsTable(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
        new Array(n + 1).fill(0),
    );
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] =
                a[i] === b[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    return dp;
}

function diffBlockArray(
    oldBlocks: RawBlock[],
    newBlocks: RawBlock[],
): BlockDiffEntry[] {
    // Treat blocks without ids by giving them a synthetic, position-based id
    // so they never accidentally match across versions.
    const oldIds = oldBlocks.map(
        (b, i) => (typeof b?.id === "string" ? b.id : `__old_${i}`),
    );
    const newIds = newBlocks.map(
        (b, i) => (typeof b?.id === "string" ? b.id : `__new_${i}`),
    );

    const dp = lcsTable(oldIds, newIds);
    const oldById = new Map<string, RawBlock>();
    oldBlocks.forEach((b, i) => oldById.set(oldIds[i], b));
    const newById = new Map<string, RawBlock>();
    newBlocks.forEach((b, i) => newById.set(newIds[i], b));

    const out: BlockDiffEntry[] = [];
    let i = 0;
    let j = 0;

    while (i < oldBlocks.length && j < newBlocks.length) {
        if (oldIds[i] === newIds[j]) {
            // Common anchor — same id in both sequences. Now compare contents.
            const ob = oldBlocks[i];
            const nb = newBlocks[j];
            out.push(...compareMatchedBlock(ob, nb));
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            // Skip old → it's a removal at this position.
            out.push({ type: "removed", block: oldBlocks[i] });
            i++;
        } else {
            // Skip new → it's an addition at this position.
            out.push({ type: "added", block: newBlocks[j] });
            j++;
        }
    }
    while (i < oldBlocks.length) {
        out.push({ type: "removed", block: oldBlocks[i++] });
    }
    while (j < newBlocks.length) {
        out.push({ type: "added", block: newBlocks[j++] });
    }

    return out;
}

function compareMatchedBlock(
    ob: RawBlock,
    nb: RawBlock,
): BlockDiffEntry[] {
    const selfSame = selfJson(ob) === selfJson(nb);
    const oldChildren = Array.isArray(ob.children) ? ob.children : [];
    const newChildren = Array.isArray(nb.children) ? nb.children : [];
    const childrenSame = stableJson(oldChildren) === stableJson(newChildren);

    if (selfSame && childrenSame) {
        return [{ type: "same", block: nb }];
    }

    if (selfSame && !childrenSame) {
        // Only the children moved — render the shell unchanged with a
        // recursive child diff inside.
        return [
            {
                type: "children-changed",
                block: nb,
                childDiff: diffBlockArray(oldChildren, newChildren),
            },
        ];
    }

    // Self differs (and possibly children). Treat as fully modified.
    return [{ type: "modified", oldBlock: ob, newBlock: nb }];
}

export function diffBlocks(
    oldDoc: unknown,
    newDoc: unknown,
): BlockDiffEntry[] {
    const oldBlocks = Array.isArray(oldDoc) ? (oldDoc as RawBlock[]) : [];
    const newBlocks = Array.isArray(newDoc) ? (newDoc as RawBlock[]) : [];
    return diffBlockArray(oldBlocks, newBlocks);
}
