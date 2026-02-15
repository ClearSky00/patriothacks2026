import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, sourceLang = "Hindi", targetLang = "English" } =
      await request.json();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const prompt = `You are a precise translator. Translate the following ${sourceLang} text into ${targetLang}.
The translation is for a children's story, so keep the language simple and age-appropriate.
Return ONLY a JSON object with this exact format (no markdown, no code fences):
{"lines": [{"original": "original line", "translated": "translated line"}]}

Split the text by sentences or natural phrase breaks. Each line should be a complete thought suitable for a child to read.

Text to translate:
${text}`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const result = cleanJsonResponse(getResponseText(response));
    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Translate error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Translation failed", details: message },
      { status: 500 }
    );
  }
}
