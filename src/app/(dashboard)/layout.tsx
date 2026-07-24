import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { getProjects } from "@/actions/project";
import { DashboardClientProviders } from "@/components/layout/dashboard-client-providers";
import { AssistantChat } from "@/components/ai/assistant-chat";
import { ensurePersonalWorkspace } from "@/lib/workspaces";
import { getUserWorkspaces } from "@/lib/user-organization";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/login");
    }

    let user = await db.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: true,
                },
            },
        },
    });

    if (!user) {
        redirect("/login");
    }

    await ensurePersonalWorkspace(db, user);

    user = await db.user.findUnique({
        where: { id: user.id },
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

    const projects = await getProjects();
    const { workspaces, invitedProjects, currentId, currentName } = await getUserWorkspaces();

    return (
        <div className="flex h-screen overflow-hidden">
            <div className="hidden md:block">
                <Sidebar projects={projects} />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav
                    user={{
                        name: user.name,
                        email: user.email,
                        image: user.image,
                    }}
                    workspaces={workspaces}
                    invitedProjects={invitedProjects}
                    currentWorkspaceId={currentId}
                    currentWorkspaceName={currentName}
                    projects={projects}
                />
                <main className="flex-1 overflow-auto bg-neutral-50 dark:bg-neutral-900">
                    {children}
                </main>
                <AssistantChat />
                <DashboardClientProviders />
            </div>
        </div>
    );
}
