import type { Metadata } from "next";
import { InsightsView } from "@/components/analytics/insights-view";

export const metadata: Metadata = {
    title: "Insights",
    description: "Key metrics, team performance, and project progress",
};

export default function AnalyticsPage() {
    return <InsightsView />;
}
