import type { Metadata } from "next";
import { TimeTrackingView } from "@/components/time-tracking/time-tracking-view";

export const metadata: Metadata = {
    title: "Time Tracking",
    description: "Track time spent on tasks and projects",
};

export default function TimeTrackingPage() {
    return <TimeTrackingView />;
}
