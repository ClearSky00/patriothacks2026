import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import {
  type PageInput,
  chunkPages,
  buildChunksWithEmbeddings,
  retrieveTopChunks,
  formatPageRef,
  embedTexts,
} from "@/lib/rag";

// ---------- Fallback (original approach) ----------

async function fallbackQuiz(storyText: string) {
  const prompt = `You are a children's English teacher. Based on the following story, create a short quiz to test a young child's (age 5-10) comprehension of the English text.

Story:
${storyText}

Return ONLY a JSON object (no markdown, no code fences) with:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "the question text",
      "options": ["answer text one", "answer text two", "answer text three", "answer text four"],
      "correct": 0,
      "explanation": "why this answer is correct"
    }
  ]
}

IMPORTANT: Each option must be the answer text ONLY. Do NOT prefix options with letters like "A. ", "B. ", "C. ", "D. " — just the plain answer text.

Generate exactly 10 multiple-choice questions. Keep language simple and encouraging.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  return JSON.parse(cleanJsonResponse(getResponseText(response)));
}

// ---------- RAG pipeline ----------

async function ragQuiz(pages: PageInput[]) {
  // Step 1: Chunk & embed pages
  const chunks = await buildChunksWithEmbeddings(pages);
  if (chunks.length === 0) {
    throw new Error("No text chunks produced from pages");
  }

  // Step 2: Generate question topics (1 API call)
  const chunkSummary = chunks
    .map((c) => `[${formatPageRef(c.pageNums)}]:\n${c.text}`)
    .join("\n\n");

  const topicsPrompt = `You are a children's English teacher preparing a quiz for a young child (age 5-10) about a story they just read.

Here is the story divided into sections:

${chunkSummary}

Generate exactly 10 specific question TOPICS — short descriptions of what each question should ask about. Cover different parts of the story.

Rules:
- All 10 topics are for multiple-choice questions
- Each topic MUST reference a specific detail, character action, or event from a specific section
- Do NOT use generic topics like "What is the story about?" or "Who is the main character?"
- Each topic should be 1 sentence

Return ONLY a JSON object:
{
  "topics": [
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" },
    { "topic": "...", "type": "multiple_choice" }
  ]
}`;

  const topicsResponse = await genai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: topicsPrompt,
    config: { responseMimeType: "application/json" },
  });

  const topicsData = JSON.parse(
    cleanJsonResponse(getResponseText(topicsResponse))
  );
  const topics: { topic: string; type: string }[] = topicsData.topics;

  // Step 3: Embed topics & retrieve (1 API call)
  const topicEmbeddings = await embedTexts(
    topics.map((t) => t.topic),
    "RETRIEVAL_QUERY"
  );

  const retrievedContexts = topics.map((t, i) => {
    const topScoredChunks = retrieveTopChunks(topicEmbeddings[i], chunks, 2);
    return {
      topic: t.topic,
      type: t.type,
      chunks: topScoredChunks.map((s) => s.chunk),
      pageRef: formatPageRef(
        [
          ...new Set(
            topScoredChunks.flatMap((s) => s.chunk.pageNums)
          ),
        ].sort((a, b) => a - b)
      ),
    };
  });

  // Step 4: Generate grounded questions (1 API call)
  const questionsPrompt = `You are a children's English teacher. Generate quiz questions for a young child (age 5-10) based on the story context provided for each topic.

${retrievedContexts
    .map(
      (ctx, i) =>
        `--- Question ${i + 1} (${ctx.type}) ---
Topic: ${ctx.topic}
Relevant story text (${ctx.pageRef}):
${ctx.chunks.map((c) => c.text).join("\n")}
Page reference: ${ctx.pageRef}`
    )
    .join("\n\n")}

For each topic above, generate ONE multiple-choice question. Return ONLY a JSON object:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "the question text",
      "options": ["answer text one", "answer text two", "answer text three", "answer text four"],
      "correct": 0,
      "explanation": "why this answer is correct",
      "pageRef": "the page reference from above"
    }
  ]
}

Rules:
- Keep language simple and encouraging
- Questions must be answerable from the provided text
- Include the exact pageRef provided for each question
- Generate questions in the same order as the topics above
- Each option must be the answer text ONLY — do NOT prefix with "A. ", "B. ", "C. ", "D. " or any letter`;

  const questionsResponse = await genai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: questionsPrompt,
    config: { responseMimeType: "application/json" },
  });

  return JSON.parse(cleanJsonResponse(getResponseText(questionsResponse)));
}

// ---------- Route handler ----------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { pages, lines, sourceLang = "Hindi" } = await request.json();
    void sourceLang;

    // Support both new (pages) and legacy (lines) payloads
    const pageData: PageInput[] | null = pages ?? null;

    if (pageData && pageData.length > 0) {
      // RAG path
      try {
        const result = await ragQuiz(pageData);
        return NextResponse.json(result);
      } catch (ragErr) {
        console.error("RAG quiz failed, falling back:", ragErr);
        // Fall back to simple approach
        const storyText = pageData
          .map((p) => p.translatedText)
          .join("\n");
        const result = await fallbackQuiz(storyText);
        return NextResponse.json(result);
      }
    } else if (lines && lines.length > 0) {
      // Legacy path
      const storyText = lines
        .map((l: { translated: string }) => l.translated)
        .join("\n");
      const result = await fallbackQuiz(storyText);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "pages or lines required" },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("Quiz error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Quiz generation failed", details: message },
      { status: 500 }
    );
  }
}
