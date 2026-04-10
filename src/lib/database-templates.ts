import { DatabasePropertyType, DatabaseViewType } from "@prisma/client";

export interface DatabaseTemplate {
    key: string;
    name: string;
    description: string;
    icon: string;
    properties: {
        name: string;
        type: DatabasePropertyType;
        config?: unknown;
        sortOrder: number;
    }[];
    views: {
        name: string;
        type: DatabaseViewType;
        sortOrder: number;
    }[];
}

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
    {
        key: "tasks",
        name: "Tasks",
        description: "Track work items with status, priority, assignee, and due dates.",
        icon: "✅",
        properties: [
            { name: "Task", type: "TEXT", sortOrder: 0 },
            {
                name: "Status",
                type: "STATUS",
                sortOrder: 1,
                config: {
                    groups: [
                        { id: "todo", name: "To-do", color: "gray" },
                        { id: "in_progress", name: "In progress", color: "blue" },
                        { id: "done", name: "Done", color: "green" },
                    ],
                    options: [
                        { id: "not_started", name: "Not started", color: "gray", groupId: "todo" },
                        { id: "in_progress", name: "In progress", color: "blue", groupId: "in_progress" },
                        { id: "done", name: "Done", color: "green", groupId: "done" },
                    ],
                },
            },
            {
                name: "Priority",
                type: "SELECT",
                sortOrder: 2,
                config: {
                    options: [
                        { id: "urgent", name: "Urgent", color: "red" },
                        { id: "high", name: "High", color: "orange" },
                        { id: "medium", name: "Medium", color: "blue" },
                        { id: "low", name: "Low", color: "gray" },
                    ],
                },
            },
            { name: "Assignee", type: "PERSON", sortOrder: 3 },
            { name: "Due date", type: "DATE", sortOrder: 4 },
        ],
        views: [
            { name: "All tasks", type: "TABLE", sortOrder: 0 },
            { name: "Board", type: "BOARD", sortOrder: 1 },
        ],
    },
    {
        key: "crm",
        name: "CRM",
        description: "Manage contacts, companies, and deals in a simple pipeline.",
        icon: "🤝",
        properties: [
            { name: "Name", type: "TEXT", sortOrder: 0 },
            { name: "Company", type: "TEXT", sortOrder: 1 },
            { name: "Email", type: "EMAIL", sortOrder: 2 },
            {
                name: "Stage",
                type: "SELECT",
                sortOrder: 3,
                config: {
                    options: [
                        { id: "lead", name: "Lead", color: "gray" },
                        { id: "contacted", name: "Contacted", color: "blue" },
                        { id: "proposal", name: "Proposal", color: "purple" },
                        { id: "negotiation", name: "Negotiation", color: "orange" },
                        { id: "won", name: "Won", color: "green" },
                        { id: "lost", name: "Lost", color: "red" },
                    ],
                },
            },
            { name: "Deal value", type: "NUMBER", sortOrder: 4 },
            { name: "Last contact", type: "DATE", sortOrder: 5 },
            { name: "Notes", type: "TEXT", sortOrder: 6 },
        ],
        views: [
            { name: "All contacts", type: "TABLE", sortOrder: 0 },
            { name: "Pipeline", type: "BOARD", sortOrder: 1 },
        ],
    },
    {
        key: "content-calendar",
        name: "Content Calendar",
        description: "Plan and schedule content across channels with publish dates.",
        icon: "📅",
        properties: [
            { name: "Title", type: "TEXT", sortOrder: 0 },
            {
                name: "Status",
                type: "SELECT",
                sortOrder: 1,
                config: {
                    options: [
                        { id: "idea", name: "Idea", color: "gray" },
                        { id: "drafting", name: "Drafting", color: "blue" },
                        { id: "review", name: "In review", color: "purple" },
                        { id: "scheduled", name: "Scheduled", color: "orange" },
                        { id: "published", name: "Published", color: "green" },
                    ],
                },
            },
            {
                name: "Channel",
                type: "MULTI_SELECT",
                sortOrder: 2,
                config: {
                    options: [
                        { id: "blog", name: "Blog", color: "blue" },
                        { id: "twitter", name: "Twitter/X", color: "gray" },
                        { id: "linkedin", name: "LinkedIn", color: "blue" },
                        { id: "youtube", name: "YouTube", color: "red" },
                        { id: "newsletter", name: "Newsletter", color: "purple" },
                    ],
                },
            },
            { name: "Author", type: "PERSON", sortOrder: 3 },
            { name: "Publish date", type: "DATE", sortOrder: 4 },
            { name: "URL", type: "URL", sortOrder: 5 },
        ],
        views: [
            { name: "All content", type: "TABLE", sortOrder: 0 },
            { name: "Calendar", type: "CALENDAR", sortOrder: 1 },
            { name: "Board", type: "BOARD", sortOrder: 2 },
        ],
    },
    {
        key: "reading-list",
        name: "Reading List",
        description: "Track books, articles, and resources you want to read.",
        icon: "📚",
        properties: [
            { name: "Title", type: "TEXT", sortOrder: 0 },
            { name: "Author", type: "TEXT", sortOrder: 1 },
            {
                name: "Status",
                type: "SELECT",
                sortOrder: 2,
                config: {
                    options: [
                        { id: "to_read", name: "To read", color: "gray" },
                        { id: "reading", name: "Reading", color: "blue" },
                        { id: "finished", name: "Finished", color: "green" },
                        { id: "abandoned", name: "Abandoned", color: "red" },
                    ],
                },
            },
            {
                name: "Type",
                type: "SELECT",
                sortOrder: 3,
                config: {
                    options: [
                        { id: "book", name: "Book", color: "purple" },
                        { id: "article", name: "Article", color: "blue" },
                        { id: "paper", name: "Paper", color: "orange" },
                        { id: "video", name: "Video", color: "red" },
                    ],
                },
            },
            { name: "Link", type: "URL", sortOrder: 4 },
            { name: "Rating", type: "NUMBER", sortOrder: 5 },
            { name: "Notes", type: "TEXT", sortOrder: 6 },
        ],
        views: [
            { name: "All", type: "TABLE", sortOrder: 0 },
            { name: "Gallery", type: "GALLERY", sortOrder: 1 },
        ],
    },
];
