import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import {
  type PageInput,
  buildChunksWithEmbeddings,
  retrieveTopChunks,
  formatPageRef,
  embedTexts,
} from "@/lib/rag";

const RELEVANCE_THRESHOLD = 0.3;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { question, pages } = await request.json();
    if (!question || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: "question and pages required" },
        { status: 400 }
      );
    }

    const pageData: PageInput[] = pages;

    // Step 1: Build chunks with embeddings
    const chunks = await buildChunksWithEmbeddings(pageData);

    if (chunks.length === 0) {
      // Fallback: no chunks, just use raw text
      return handleFallback(question, pageData);
    }

    // Step 2: Embed the user's question
    const [questionEmbedding] = await embedTexts([question], "RETRIEVAL_QUERY");

    // Step 3: Retrieve top relevant chunks with scores
    const topScoredChunks = retrieveTopChunks(questionEmbedding, chunks, 3);
    const topScore = topScoredChunks[0]?.score ?? 0;

    // Step 4: Build context from retrieved chunks
    const retrievedContext = topScoredChunks
      .map(
        (sc) =>
          `[${formatPageRef(sc.chunk.pageNums)}]:\n${sc.chunk.text}`
      )
      .join("\n\n");

    // Step 5: Generate answer with RAG context + relevance verification
    const prompt = `You are a friendly children's reading helper. A young child (age 5-10) just read a story and wants to ask questions about it.

Here are the most relevant sections from the story:

${retrievedContext}

The semantic similarity score between the question and the story content is ${topScore.toFixed(3)} (scale 0-1, where scores below ${RELEVANCE_THRESHOLD} suggest the question is unrelated).

The child asks: "${question}"

Instructions:
1. Detect the language of the child's question.
2. Determine if the question is related to the story. Consider BOTH:
   - Whether the retrieved context above actually helps answer the question
   - Whether the similarity score indicates relevance (below ${RELEVANCE_THRESHOLD} is likely unrelated)
   If NOT related (e.g. weather, math, personal questions, anything unrelated to the story), set isRelevant to false.
3. If related, answer in 2-3 simple sentences a child would understand, using ONLY information from the retrieved story sections above. Always provide the answer in English.
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

    // Second-layer relevance check: if score is very low, override LLM
    if (topScore < RELEVANCE_THRESHOLD && data.isRelevant) {
      data.isRelevant = false;
      data.answer =
        "That's a great question, but let's focus on the story! Try asking me something about what happened in the book.";
      data.translatedAnswer = null;
    }

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

/** Fallback when chunking produces no results — uses raw page text */
async function handleFallback(question: string, pages: PageInput[]) {
  const storyText = pages.map((p) => p.translatedText).join("\n");

  const prompt = `You are a friendly children's reading helper. A young child (age 5-10) just read a story and wants to ask questions about it.

Story:
${storyText}

The child asks: "${question}"

Instructions:
1. Detect the language of the child's question.
2. Determine if the question is related to the story. If NOT related, set isRelevant to false.
3. If related, answer in 2-3 simple sentences a child would understand. Always provide the answer in English.
4. If the question is NOT in English, also provide "translatedAnswer". If in English, set "translatedAnswer" to null.
5. Set "detectedLanguage" to the language name.

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

  const data = JSON.parse(
    cleanJsonResponse(getResponseText(response))
  );
  return NextResponse.json(data);
}
