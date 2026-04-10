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
