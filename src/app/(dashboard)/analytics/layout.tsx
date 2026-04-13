import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Analytics",
    description: "Project analytics and team productivity metrics",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
