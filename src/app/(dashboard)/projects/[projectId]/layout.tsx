import { db } from "@/lib/db";
import { ProjectTabs } from "@/components/projects/project-tabs";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { name: true, description: true }
    });

    return {
        title: project?.name ? `${project.name}` : "Project",
        description: project?.description || "Project dashboard",
    };
}

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;
    return (
        <div className="flex h-full flex-col">
            <ProjectTabs projectId={projectId} />
            <div className="flex-1 overflow-hidden">{children}</div>
        </div>
    );
}
