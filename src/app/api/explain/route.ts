import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      original,
      translated,
      sourceLang = "Hindi",
      targetLang = "English",
    } = await request.json();
    if (!original || !translated) {
      return NextResponse.json(
        { error: "original and translated required" },
        { status: 400 }
      );
    }

    const prompt = `You are a friendly bilingual teacher helping a young child (age 5-10) learn ${targetLang}.

The child just heard this sentence in ${targetLang}: "${translated}"
The original ${sourceLang} sentence was: "${original}"

Return ONLY a JSON object (no markdown, no code fences) with:
{
  "motherTongue": "the original phrase in ${sourceLang}",
  "english": "the English translation",
  "keyPhrases": [
    {"${sourceLang.toLowerCase()}": "word/phrase in ${sourceLang}", "${targetLang.toLowerCase()}": "word/phrase in ${targetLang}", "example": "a simple example sentence using this word"}
  ],
  "funFact": "an optional fun/interesting fact about a word or concept in the sentence, appropriate for a child"
}

Pick 2-4 of the most important or useful words/phrases to highlight.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const result = cleanJsonResponse(getResponseText(response));
    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Explain error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Explanation failed", details: message },
      { status: 500 }
    );
  }
}
