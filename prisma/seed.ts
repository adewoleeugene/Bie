import { ProjectStatus, TaskStatus, TaskPriority } from "@prisma/client";
import { db as prisma } from "../src/lib/db";

async function main() {
    console.log("🌱 Seeding database...");

    // 1. Get or Create Organization
    const org = await prisma.organization.upsert({
        where: { slug: "christex" },
        update: {},
        create: {
            name: "Christex Foundation",
            slug: "christex",
            plan: "FREE",
        },
    });
    console.log("✅ Organization:", org.name);

    // 2. Cleanup existing Tasks and Projects for this Org to avoid duplicates
    await prisma.task.deleteMany({ where: { organizationId: org.id } });
    await prisma.project.deleteMany({ where: { organizationId: org.id } });
    console.log("🗑️ Cleaned up existing tasks and projects");

    // 3. Create Projects
    const projectNames = ["ChristBase MVP", "Website Redesign", "Community Platform"];
    const projects = [];
    for (const name of projectNames) {
        const project = await prisma.project.create({
            data: {
                name,
                description: `Project for ${name}`,
                status: "ACTIVE" as ProjectStatus,
                organizationId: org.id,
            },
        });
        projects.push(project);
    }
    console.log(`✅ Created ${projects.length} projects`);

    // 4. Create 20 Tasks
    const statuses: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
    const priorities: TaskPriority[] = ["P0", "P1", "P2", "P3"];

    console.log("⏳ Creating 20 tasks...");
    for (let i = 1; i <= 20; i++) {
        const project = projects[(i - 1) % projects.length];
        const status = statuses[(i - 1) % statuses.length];
        const priority = priorities[(i - 1) % priorities.length];

        await prisma.task.create({
            data: {
                title: `Task ${i}: ${project.name} - ${status}`,
                description: `This is a seeded description for task ${i}.`,
                status,
                priority,
                sortOrder: i,
                organizationId: org.id,
                projectId: project.id,
            },
        });
    }

    console.log("✅ Created 20 tasks");
    console.log("🎉 Seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
