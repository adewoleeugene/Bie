import { redirect } from "next/navigation";

// Hours was folded into Insights (time totals, task breakdown, estimate
// vs actual) and Today (auto-logged focus time). Manual logging lives on
// as the "Log time" action in Insights. Keep the URL as a redirect so
// old bookmarks and links don't break.
export default function TimeTrackingPage() {
    redirect("/analytics");
}
