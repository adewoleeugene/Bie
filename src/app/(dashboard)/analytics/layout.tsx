import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Insights",
    description: "Key metrics, team performance, and project progress",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
