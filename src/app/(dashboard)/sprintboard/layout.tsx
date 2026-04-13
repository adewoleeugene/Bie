import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sprint Board",
    description: "Sprint planning and task management",
};

export default function SprintboardLayout({ children }: { children: React.ReactNode }) {
    return children;
}
