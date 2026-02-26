import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages, systemInstruction } = await req.json();

        // The @ai-sdk/google provider automatically uses the GOOGLE_GENERATIVE_AI_API_KEY environment variable.
        // It can also fallback to GEMINI_API_KEY if configured, but let's ensure it's set if the process relies on it.
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "API key not configured" }, { status: 500 });
        }

        const google = createGoogleGenerativeAI({
            apiKey: apiKey,
        });

        // Actually, we can use generateText with the text and system messages 
        // Vercel AI SDK standardizes roles perfectly.
        const { text } = await generateText({
            model: google("gemini-2.5-flash"),
            system: systemInstruction || "You are BieAI, a helpful project management assistant for Bie. You help the user manage tasks, projects, and navigate the system. Keep responses concise and friendly.",
            messages: messages.map((m: any) => ({
                role: m.role,
                content: m.content,
            })),
        });

        return NextResponse.json({ message: text });
    } catch (error: any) {
        console.error("AI chat error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate AI response" }, { status: 500 });
    }
}
