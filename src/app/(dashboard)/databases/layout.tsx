import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Databases",
    description: "Custom databases and structured data",
};

export default function DatabasesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
