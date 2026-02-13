import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { getProjects } from "@/actions/project";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/login");
    }

    // Get user and organization
    const user = await db.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: true,
                },
            },
        },
    });

    if (!user || user.memberships.length === 0) {
        redirect("/login");
    }

    const organization = user.memberships[0].organization;
    const projects = await getProjects();

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar projects={projects} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav
                    user={{
                        name: user.name,
                        email: user.email,
                        image: user.image,
                    }}
                    organizationName={organization.name}
                />
                <main className="flex-1 overflow-auto bg-neutral-50 dark:bg-neutral-900">
                    {children}
                </main>
            </div>
        </div>
    );
}
