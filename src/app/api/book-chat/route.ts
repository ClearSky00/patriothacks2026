import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { question, storyText } = await request.json();
    if (!question || !storyText) {
      return NextResponse.json(
        { error: "question and storyText required" },
        { status: 400 }
      );
    }

    const prompt = `You are a friendly children's reading helper. A young child (age 5-10) just read a story and wants to ask questions about it.

Story:
${storyText}

The child asks: "${question}"

Instructions:
1. Detect the language of the child's question.
2. Determine if the question is related to the story. If NOT related (e.g. weather, math, personal questions, anything unrelated), set isRelevant to false.
3. If related, answer in 2-3 simple sentences a child would understand. Always provide the answer in English.
4. If the question is NOT in English, also provide "translatedAnswer" — the same answer translated into the language the child used. If the question IS in English, set "translatedAnswer" to null.
5. Set "detectedLanguage" to the language name of the question (e.g. "Spanish", "Hindi", "Arabic", "English").

Return ONLY a JSON object:
{
  "isRelevant": true or false,
  "answer": "your English response here",
  "translatedAnswer": "response in the child's language, or null if question was in English",
  "detectedLanguage": "the language name"
}

If not relevant, use an answer like: "That's a great question, but let's focus on the story! Try asking me something about what happened in the book." — and translate that redirect too if the question was not in English.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const data = JSON.parse(cleanJsonResponse(getResponseText(response)));
    return NextResponse.json(data);
  } catch (err) {
    console.error("Book chat error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Chat failed", details: message },
      { status: 500 }
    );
  }
}
