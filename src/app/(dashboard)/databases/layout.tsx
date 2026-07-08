import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Collections",
    description: "Custom collections and structured data",
};

export default function DatabasesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
