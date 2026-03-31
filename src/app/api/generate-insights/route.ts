import { NextResponse } from "next/server";
import type { DataSummary } from "@/lib/dataPreprocessor";
import {
  createGeminiModel,
  generateGeminiText,
  getGeminiErrorMessage,
  getGeminiErrorStatus,
} from "@/lib/gemini";

export interface InsightResult {
  summary: string;
  keyInsights: string[];
  trends: string[];
  anomalies: string[];
  recommendations: string[];
  riskAreas: string[];
  suggestedQuestions?: string[];
}

export function buildInsightPrompt(summary: DataSummary): string {
  let context = `You are a senior business data analyst reviewing a dataset for a non-technical business owner.
  
DATASET OVERVIEW:
- Total rows: ${summary.totalRows.toLocaleString()}
- Tables/sheets: ${summary.totalTables}
- Business domain: ${summary.domain}

`;

  for (const table of summary.tables) {
    context += `\nTABLE: "${table.name}" (${table.rows.toLocaleString()} rows)\n`;

    if (table.dateRange) {
      context += `Date range: ${table.dateRange.from} to ${table.dateRange.to}\n`;
    }

    if (table.rowsAnalyzed < table.rows) {
      context += `Summary stats below are based on a representative sample of ${table.rowsAnalyzed.toLocaleString()} rows.\n`;
    }

    if (table.numericColumns.length > 0) {
      context += `\nNumeric metrics:\n`;
      for (const col of table.numericColumns.slice(0, 8)) {
        context += `  - ${col.name}: avg=${col.mean.toLocaleString()}, min=${col.min.toLocaleString()}, max=${col.max.toLocaleString()}, non-null=${col.nonNullCount.toLocaleString()}\n`;
      }
    }

    if (table.keyAggregations.length > 0) {
      context += `\nKey breakdowns:\n`;
      for (const agg of table.keyAggregations.slice(0, 3)) {
        context += `  By ${agg.groupBy} → ${agg.metric}:\n`;
        for (const g of agg.topGroups.slice(0, 5)) {
          context += `    • ${g.label}: ${g.value.toLocaleString()}\n`;
        }
      }
    }

    if (table.categoricalColumns.length > 0) {
      context += `\nTop categories:\n`;
      for (const col of table.categoricalColumns.slice(0, 4)) {
        const top3 = col.topValues.slice(0, 3).map(v => `${v.value}(${v.count})`).join(', ');
        context += `  - ${col.name}: ${top3} (${col.uniqueCount} unique)\n`;
      }
    }
  }

  context += `
INSTRUCTIONS:
Generate a comprehensive business analysis. Write in plain English — no technical jargon. Be specific about numbers. 
Think like a trusted advisor helping a business owner understand what's happening in their data.

Return ONLY valid JSON matching this exact structure:
{
  "summary": "2-3 sentence overview of what this dataset is and what it reveals at a high level",
  "keyInsights": ["5-7 specific, numbered insights with actual numbers from the data"],
  "trends": ["3-5 trend observations — what is growing, declining, or changing over time"],
  "anomalies": ["2-4 surprising findings, outliers, or things that need attention"],
  "recommendations": ["4-6 clear, actionable business recommendations"],
  "riskAreas": ["2-3 risk areas or concerns the business should watch"],
  "suggestedQuestions": ["4-5 short, engaging follow-up questions tailored to this exact dataset. Keep each one under 12 words, make them concrete and curiosity-driven, and avoid repeating the same pattern."]
}`;

  return context;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
    }

    const { summary }: { summary: DataSummary } = await req.json();
    if (!summary) {
      return NextResponse.json({ error: "No dataset summary provided." }, { status: 400 });
    }

    const model = createGeminiModel(apiKey, { responseMimeType: "application/json" });

    const prompt = buildInsightPrompt(summary);
    const rawText = await generateGeminiText(model, prompt, { maxAttempts: 3, baseDelayMs: 1500 });
    const text = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed: InsightResult = JSON.parse(text);
    const insights: InsightResult = {
      ...parsed,
      suggestedQuestions: (parsed.suggestedQuestions || [])
        .map((question) => question.trim())
        .filter(Boolean)
        .slice(0, 5),
    };

    return NextResponse.json({ insights });
  } catch (err: unknown) {
    console.error("Insight generation error:", err);
    return NextResponse.json(
      { error: getGeminiErrorMessage(err) },
      { status: getGeminiErrorStatus(err) }
    );
  }
}
