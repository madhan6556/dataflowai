import { NextResponse } from "next/server";
import type { DataSummary } from "@/lib/dataPreprocessor";
import {
  createGeminiModel,
  generateGeminiText,
  getGeminiErrorMessage,
  getGeminiErrorStatus,
} from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

    const { message, context }: { message: string; context: DataSummary } = await req.json();
    if (!message) return NextResponse.json({ error: "No message provided." }, { status: 400 });

    const model = createGeminiModel(apiKey);

    // Build a compact context string from the data summary
    let dataContext = `You are a friendly business data analyst answering questions about a dataset.\n\nDATASET CONTEXT:\n`;
    dataContext += `- Domain: ${context?.domain || 'general'}, Total rows: ${context?.totalRows?.toLocaleString() || 'unknown'}\n`;

    if (context?.tables) {
      for (const table of context.tables.slice(0, 3)) {
        dataContext += `\nTable "${table.name}" (${table.rows.toLocaleString()} rows):\n`;
        if (table.dateRange) dataContext += `  Date range: ${table.dateRange.from} to ${table.dateRange.to}\n`;
        if (table.rowsAnalyzed < table.rows) {
          dataContext += `  Stats below come from a representative sample of ${table.rowsAnalyzed.toLocaleString()} rows.\n`;
        }
        for (const col of table.numericColumns.slice(0, 5)) {
          dataContext += `  ${col.name}: avg=${col.mean.toLocaleString()}, min=${col.min.toLocaleString()}, max=${col.max.toLocaleString()}\n`;
        }
        for (const agg of table.keyAggregations.slice(0, 2)) {
          dataContext += `  Top ${agg.groupBy} by ${agg.metric}: `;
          dataContext += agg.topGroups.slice(0, 3).map(g => `${g.label}=${g.value.toLocaleString()}`).join(', ') + '\n';
        }
      }
    }

    dataContext += `\nIMPORTANT: Answer in plain English, be specific with numbers, be concise (2-4 sentences max unless a list is needed). If you don't have enough data to answer definitively, say so honestly.`;
    
    const fullPrompt = `${dataContext}\n\nUSER QUESTION: ${message}\n\nANSWER:`;

    const answer = await generateGeminiText(model, fullPrompt, { maxAttempts: 3, baseDelayMs: 1200 });

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getGeminiErrorMessage(err) },
      { status: getGeminiErrorStatus(err) }
    );
  }
}
