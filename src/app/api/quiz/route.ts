import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

// ---------- Types ----------

interface PageInput {
  pageNum: number;
  originalText: string;
  translatedText: string;
  vocab: { english: string; original: string }[];
  isIllustration: boolean;
}

interface Chunk {
  id: number;
  pageNums: number[];
  text: string;
  originalText: string;
  vocab: { english: string; original: string }[];
  embedding: number[];
}

// ---------- RAG utilities ----------

function chunkPages(pages: PageInput[]): Omit<Chunk, "embedding">[] {
  const chunks: Omit<Chunk, "embedding">[] = [];
  let current: PageInput[] = [];

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      id: chunks.length,
      pageNums: current.map((p) => p.pageNum),
      text: current.map((p) => p.translatedText).join("\n"),
      originalText: current.map((p) => p.originalText).join("\n"),
      vocab: current.flatMap((p) => p.vocab),
    });
    current = [];
  };

  for (const page of pages) {
    if (page.isIllustration || !page.translatedText.trim()) {
      flush();
      continue;
    }
    current.push(page);
    if (current.length >= 3) flush();
  }
  flush();

  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function retrieveTopChunks(
  queryEmbedding: number[],
  chunks: Chunk[],
  topK: number
): Chunk[] {
  const scored = chunks.map((c) => ({
    chunk: c,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

function formatPageRef(pageNums: number[]): string {
  if (pageNums.length === 1) return `Page ${pageNums[0]}`;
  return `Pages ${pageNums[0]}–${pageNums[pageNums.length - 1]}`;
}

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
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "why this answer is correct"
    }
  ]
}

Generate exactly 5 multiple-choice questions. Keep language simple and encouraging.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  return JSON.parse(cleanJsonResponse(getResponseText(response)));
}

// ---------- RAG pipeline ----------

async function ragQuiz(pages: PageInput[]) {
  // Step 1: Chunk pages
  const rawChunks = chunkPages(pages);
  if (rawChunks.length === 0) {
    throw new Error("No text chunks produced from pages");
  }

  // Step 2: Embed chunks (1 API call)
  const chunkTexts = rawChunks.map((c) => c.text);
  const chunkEmbedResponse = await genai.models.embedContent({
    model: "text-embedding-004",
    contents: chunkTexts,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 256,
    },
  });

  const chunks: Chunk[] = rawChunks.map((c, i) => ({
    ...c,
    embedding: chunkEmbedResponse.embeddings?.[i]?.values ?? [],
  }));

  // Step 3: Generate question topics (1 API call)
  const chunkSummary = chunks
    .map(
      (c) =>
        `[${formatPageRef(c.pageNums)}]:\n${c.text}`
    )
    .join("\n\n");

  const topicsPrompt = `You are a children's English teacher preparing a quiz for a young child (age 5-10) about a story they just read.

Here is the story divided into sections:

${chunkSummary}

Generate exactly 5 specific question TOPICS — short descriptions of what each question should ask about. Cover different parts of the story.

Rules:
- All 5 topics are for multiple-choice questions
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

  // Step 4: Embed topics & retrieve (1 API call)
  const topicStrings = topics.map((t) => t.topic);
  const topicEmbedResponse = await genai.models.embedContent({
    model: "text-embedding-004",
    contents: topicStrings,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 256,
    },
  });

  const retrievedContexts = topics.map((t, i) => {
    const queryEmb = topicEmbedResponse.embeddings?.[i]?.values ?? [];
    const topChunks = retrieveTopChunks(queryEmb, chunks, 2);
    return {
      topic: t.topic,
      type: t.type,
      chunks: topChunks,
      pageRef: formatPageRef(
        [...new Set(topChunks.flatMap((c) => c.pageNums))].sort(
          (a, b) => a - b
        )
      ),
    };
  });

  // Step 5: Generate grounded questions (1 API call)
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

For each topic above, generate ONE question. Return ONLY a JSON object:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "the question text",
      "options": ["A", "B", "C", "D"],
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
- Generate questions in the same order as the topics above`;

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
