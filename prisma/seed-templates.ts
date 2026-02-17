import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const org = await prisma.organization.findFirst();
    const user = await prisma.user.findFirst();

    if (!org || !user) {
        console.log("No organization or user found. Please seed the database first.");
        return;
    }

    const templates = [
        {
            name: "Meeting Minutes",
            description: "Standard template for recording meeting discussions and actions.",
            content: {
                type: "doc",
                content: [
                    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Meeting Minutes: [Meeting Name]" }] },
                    { type: "paragraph", content: [{ type: "text", text: "Date: " }, { type: "text", marks: [{ type: "italic" }], text: "YYYY-MM-DD" }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Attendees" }] },
                    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Person 1" }] }] }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
                    { type: "paragraph", content: [{ type: "text", text: "Summary of topics discussed..." }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
                    { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Follow up with..." }] }] }] },
                ]
            }
        },
        {
            name: "Project Progress Report",
            description: "Weekly or monthly project standing update.",
            content: {
                type: "doc",
                content: [
                    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Project Progress Report" }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Executive Summary" }] },
                    { type: "paragraph", content: [{ type: "text", text: "Overall health: [Green/Yellow/Red]" }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key Achievements" }] },
                    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Achievement 1" }] }] }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Current Blockers" }] },
                    { type: "paragraph", content: [{ type: "text", text: "None if applicable." }] },
                ]
            }
        },
        {
            name: "Technical Specification",
            description: "Template for documenting technical designs and requirements.",
            content: {
                type: "doc",
                content: [
                    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Technical Specification: [System Name]" }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Background" }] },
                    { type: "paragraph", content: [{ type: "text", text: "Why are we building this?" }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Architecture" }] },
                    { type: "paragraph", content: [{ type: "text", text: "[Insert Diagram or Description]" }] },
                    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Data Model" }] },
                    { type: "codeBlock", attrs: { language: "typescript" }, content: [{ type: "text", text: "// Schema definition here" }] },
                ]
            }
        }
    ];

    for (const template of templates) {
        await prisma.wikiTemplate.create({
            data: {
                ...template,
                organizationId: org.id,
                authorId: user.id,
            }
        });
    }

    console.log(`Seeded ${templates.length} wiki templates.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
