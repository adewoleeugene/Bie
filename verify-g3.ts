import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function verifyGemini3() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    console.log("🔍 Verifying Gemini 3 Flash Preview...");
    const google = createGoogleGenerativeAI({
        apiKey: apiKey,
    });

    try {
        const { text } = await generateText({
            model: google("gemini-3-flash-preview"),
            prompt: "WORKING?",
        });
        console.log("✅ Success! Gemini 3 Response:", text.trim());
    } catch (err: any) {
        console.error("❌ Gemini 3 failed. Error:", err.message);
    }
}

verifyGemini3();
