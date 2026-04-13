import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Focus Session",
    description: "Deep focus mode for concentrated work",
};

/**
 * Focus layout — zero chrome. No sidebar, no top nav, no dashboard layout.
 * Used by /focus/session for the deep focus experience.
 */
export default function FocusLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
