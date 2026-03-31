import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-flash-latest";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isTransientGeminiError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("503") ||
    message.includes("service unavailable") ||
    message.includes("high demand") ||
    message.includes("temporarily unavailable") ||
    message.includes("overloaded") ||
    message.includes("deadline exceeded") ||
    message.includes("timeout") ||
    message.includes("429")
  );
};

export const getGeminiErrorStatus = (error: unknown): number => {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("429") || message.includes("rate limit")) return 429;
  if (isTransientGeminiError(error)) return 503;
  return 500;
};

export const getGeminiErrorMessage = (error: unknown): string => {
  const status = getGeminiErrorStatus(error);
  if (status === 429) {
    return "AI rate limit reached. Please wait a moment and try again.";
  }
  if (status === 503) {
    return "AI service is temporarily busy. Please retry in a few seconds.";
  }
  return getErrorMessage(error) || "Gemini request failed.";
};

export const createGeminiModel = (
  apiKey: string,
  generationConfig?: Record<string, unknown>
): GenerativeModel => {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig,
  });
};

export async function generateGeminiText(
  model: GenerativeModel,
  prompt: string,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1200;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === maxAttempts) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 250);
      await delay(baseDelayMs * attempt + jitterMs);
    }
  }

  throw lastError;
}
