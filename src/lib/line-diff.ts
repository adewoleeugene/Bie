/**
 * Tiny line-level diff using longest common subsequence.
 * Returns an array of lines tagged "same" | "added" | "removed".
 * No deps — fine for short documents (a wiki page is rarely thousands of lines).
 */

export type DiffLine = { type: "same" | "added" | "removed"; text: string };

export function diffLines(oldText: string, newText: string): DiffLine[] {
    const a = oldText.split("\n");
    const b = newText.split("\n");
    const m = a.length;
    const n = b.length;

    // LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const result: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) {
            result.push({ type: "same", text: a[i] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            result.push({ type: "removed", text: a[i] });
            i++;
        } else {
            result.push({ type: "added", text: b[j] });
            j++;
        }
    }
    while (i < m) result.push({ type: "removed", text: a[i++] });
    while (j < n) result.push({ type: "added", text: b[j++] });
    return result;
}
