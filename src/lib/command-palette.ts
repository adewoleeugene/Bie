/**
 * Opens the global command palette (the ⌘K dialog mounted in providers).
 * Call from anywhere — it dispatches a window event the palette listens for.
 */
export function openCommandPalette() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("command-palette:open"));
}
