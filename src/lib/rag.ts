import { genai } from "@/lib/gemini";

// ---------- Types ----------

export interface PageInput {
  pageNum: number;
  originalText: string;
  translatedText: string;
  vocab: { english: string; original: string }[];
  isIllustration: boolean;
}

export interface Chunk {
  id: number;
  pageNums: number[];
  text: string;
  originalText: string;
  vocab: { english: string; original: string }[];
  embedding: number[];
}

// ---------- Chunking ----------

export function chunkPages(pages: PageInput[]): Omit<Chunk, "embedding">[] {
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

// ---------- Similarity ----------

export function cosineSimilarity(a: number[], b: number[]): number {
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

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

export function retrieveTopChunks(
  queryEmbedding: number[],
  chunks: Chunk[],
  topK: number
): ScoredChunk[] {
  const scored = chunks.map((c) => ({
    chunk: c,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ---------- Formatting ----------

export function formatPageRef(pageNums: number[]): string {
  if (pageNums.length === 1) return `Page ${pageNums[0]}`;
  return `Pages ${pageNums[0]}–${pageNums[pageNums.length - 1]}`;
}

// ---------- Embedding ----------

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  const response = await genai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
    config: {
      taskType,
      outputDimensionality: 256,
    },
  });
  return texts.map((_, i) => response.embeddings?.[i]?.values ?? []);
}

export async function buildChunksWithEmbeddings(
  pages: PageInput[]
): Promise<Chunk[]> {
  const rawChunks = chunkPages(pages);
  if (rawChunks.length === 0) return [];

  const embeddings = await embedTexts(
    rawChunks.map((c) => c.text),
    "RETRIEVAL_DOCUMENT"
  );

  return rawChunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
  }));
}
