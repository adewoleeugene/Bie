import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Trash",
    description: "Deleted items available for recovery",
};

export default function TrashLayout({ children }: { children: React.ReactNode }) {
    return children;
}
