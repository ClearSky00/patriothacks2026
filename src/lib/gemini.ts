import { GoogleGenAI } from "@google/genai";

export const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getResponseText(response: any): string {
  if (typeof response.text === "string") return response.text;
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.candidates[0].content.parts[0].text;
  }
  if (typeof response.text === "function") return response.text();
  throw new Error(
    "Could not extract text from Gemini response: " +
      JSON.stringify(response).slice(0, 200)
  );
}

export function cleanJsonResponse(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
