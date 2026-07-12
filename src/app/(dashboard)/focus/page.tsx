import { redirect } from "next/navigation";

// The Focus page was folded into Today (copilot + streak) and Insights
// (focus stats + history). Keep the URL alive as a redirect so old
// bookmarks and links don't break.
export default function FocusPage() {
    redirect("/my-day");
}
