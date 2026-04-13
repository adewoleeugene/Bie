import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Reflections",
    description: "Daily reflections and journaling",
};

export default function ReflectionsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
