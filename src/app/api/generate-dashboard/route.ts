import { NextResponse } from "next/server";
import { buildDashboardPrompt } from "@/lib/buildPrompt";
import { DatasetSchema } from "@/lib/schemaExtractor";
import {
  createGeminiModel,
  generateGeminiText,
  getGeminiErrorMessage,
  getGeminiErrorStatus,
} from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Please add it to your .env.local file and RESTART the server." },
        { status: 500 }
      );
    }

    const { schema }: { schema: DatasetSchema } = await req.json();

    if (!schema || !schema.tables || schema.tables.length === 0) {
      return NextResponse.json(
        { error: "Invalid schema provided." },
        { status: 400 }
      );
    }

    const prompt = buildDashboardPrompt(schema);

    const model = createGeminiModel(apiKey, {
      responseMimeType: "application/json",
    });

    let config = null;
    let attempts = 0;
    let lastError = "";

    // Retry loop strictly to handle intermittent JSON parse failures from the AI
    while (attempts < 3 && !config) {
      try {
        attempts++;
        let outputText = await generateGeminiText(model, prompt, { maxAttempts: 3, baseDelayMs: 1200 });
        
        // Sometimes the AI still outputs markdown despite MIME type settings
        outputText = outputText.replace(/```json/gi, "").replace(/```/g, "").trim();
        config = JSON.parse(outputText);
      } catch (parseErr: unknown) {
        if (parseErr instanceof SyntaxError) {
          lastError = parseErr.message;
          console.error(`Parse attempt ${attempts} failed:`, parseErr);
          continue;
        }
        throw parseErr;
      }
    }

    if (!config) {
      throw new Error("AI returned malformed JSON: " + lastError);
    }

    return NextResponse.json({ config });

  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: getGeminiErrorMessage(error) || "Failed to generate dashboard configuration from AI." },
      { status: getGeminiErrorStatus(error) }
    );
  }
}
