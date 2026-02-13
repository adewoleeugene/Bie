import { db } from "../src/lib/db";
import { WikiNamespace } from "@prisma/client";

const templates = [
    {
        title: "Meeting Notes",
        content: [
            {
                type: "heading",
                props: { level: 1 },
                content: [{ type: "text", text: "Meeting Notes", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Date & Attendees", styles: {} }],
            },
            {
                type: "paragraph",
                content: [{ type: "text", text: "Date: ", styles: { bold: true } }],
            },
            {
                type: "paragraph",
                content: [{ type: "text", text: "Attendees: ", styles: { bold: true } }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Agenda", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "Item 1", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "Item 2", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Discussion Notes", styles: {} }],
            },
            {
                type: "paragraph",
                content: [],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Action Items", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "[ ] Action item 1", styles: {} }],
            },
        ],
    },
    {
        title: "Project Proposal",
        content: [
            {
                type: "heading",
                props: { level: 1 },
                content: [{ type: "text", text: "Project Proposal", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Executive Summary", styles: {} }],
            },
            {
                type: "paragraph",
                content: [{ type: "text", text: "Brief overview of the project...", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Problem Statement", styles: {} }],
            },
            {
                type: "paragraph",
                content: [],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Proposed Solution", styles: {} }],
            },
            {
                type: "paragraph",
                content: [],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Timeline & Milestones", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "Phase 1: ", styles: { bold: true } }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "Phase 2: ", styles: { bold: true } }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Resources Required", styles: {} }],
            },
            {
                type: "paragraph",
                content: [],
            },
        ],
    },
    {
        title: "Sprint Retrospective",
        content: [
            {
                type: "heading",
                props: { level: 1 },
                content: [{ type: "text", text: "Sprint Retrospective", styles: {} }],
            },
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "Sprint: ", styles: { bold: true } },
                    { type: "text", text: "[Sprint Name]", styles: {} },
                ],
            },
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "Date: ", styles: { bold: true } },
                    { type: "text", text: "[Date]", styles: {} },
                ],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "What Went Well 🎉", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "What Could Be Improved 🔧", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Action Items 🎯", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "[ ] ", styles: {} }],
            },
        ],
    },
    {
        title: "Concept Note",
        content: [
            {
                type: "heading",
                props: { level: 1 },
                content: [{ type: "text", text: "Concept Note", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Overview", styles: {} }],
            },
            {
                type: "paragraph",
                content: [{ type: "text", text: "High-level description of the concept...", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Key Features", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "Feature 1", styles: {} }],
            },
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "Feature 2", styles: {} }],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Technical Considerations", styles: {} }],
            },
            {
                type: "paragraph",
                content: [],
            },
            {
                type: "heading",
                props: { level: 2 },
                content: [{ type: "text", text: "Next Steps", styles: {} }],
            },
            {
                type: "numberedListItem",
                content: [],
            },
        ],
    },
];

async function seedTemplates() {
    console.log("Seeding wiki templates...");

    // Get the default organization
    const org = await db.organization.findFirst({
        where: { slug: "christex" },
    });

    if (!org) {
        console.error("Default organization not found");
        return;
    }

    // Get the first user to be the author
    const user = await db.user.findFirst();

    if (!user) {
        console.error("No users found");
        return;
    }

    for (const template of templates) {
        const existing = await db.wikiPage.findFirst({
            where: {
                organizationId: org.id,
                title: template.title,
                template: true,
            },
        });

        if (!existing) {
            await db.wikiPage.create({
                data: {
                    title: template.title,
                    content: template.content,
                    namespace: WikiNamespace.COMPANY,
                    organizationId: org.id,
                    authorId: user.id,
                    template: true,
                },
            });
            console.log(`Created template: ${template.title}`);
        } else {
            console.log(`Template already exists: ${template.title}`);
        }
    }

    console.log("Wiki templates seeded successfully!");
}

seedTemplates()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
