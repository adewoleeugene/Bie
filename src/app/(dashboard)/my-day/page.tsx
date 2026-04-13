import type { Metadata } from "next";
import { MyDayView } from "@/components/daily-planner/my-day-view";

export const metadata: Metadata = {
    title: "My Day",
    description: "Daily planner and task overview",
};

export default function MyDayPage() {
    return <MyDayView />;
}
