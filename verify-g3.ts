import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function verifyGemini3() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    console.log("🔍 Verifying Gemini 3 Flash Preview...");
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const result = await model.generateContent("WORKING?");
        const response = await result.response;
        console.log("✅ Success! Gemini 3 Response:", response.text().trim());
    } catch (err: any) {
        console.error("❌ Gemini 3 failed. Error:", err.message);
    }
}

verifyGemini3();
