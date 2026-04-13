import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Squads",
    description: "Team squads and member groups",
};

export default function SquadsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
