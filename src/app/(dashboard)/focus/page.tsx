import type { Metadata } from "next";
import { FocusSessionList } from "@/components/focus/focus-session-list";

export const metadata: Metadata = {
    title: "Focus",
    description: "Focus sessions and deep work tracking",
};

export default function FocusPage() {
    return <FocusSessionList />;
}
