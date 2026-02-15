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

First, determine if this question is related to the story above. If it is NOT related to the story (e.g. questions about weather, math, personal questions, or anything unrelated), respond with isRelevant: false and a gentle redirect.

If it IS related, answer in 2-3 simple sentences a child would understand.

Return ONLY a JSON object:
{
  "isRelevant": true or false,
  "answer": "your response here"
}

If not relevant, use an answer like: "That's a great question, but let's focus on the story! Try asking me something about what happened in the book."`;

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
