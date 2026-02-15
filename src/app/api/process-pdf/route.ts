import { NextRequest, NextResponse } from "next/server";
import { genai, getResponseText, cleanJsonResponse } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const sourceLang = (formData.get("sourceLang") as string) || "Hindi";

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file uploaded" },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pdfBase64 = pdfBuffer.toString("base64");

    // Step 1: Send entire PDF to Gemini for per-page OCR + classification
    const ocrResponse = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              text: `You are analyzing a children's book PDF. For EACH page in this PDF, extract the text and classify the page.

Return ONLY a JSON object (no markdown, no code fences) with this exact format:
{
  "pages": [
    {
      "pageNum": 1,
      "type": "cover",
      "text": "extracted text if any"
    },
    {
      "pageNum": 2,
      "type": "content",
      "text": "the story text on this page"
    }
  ]
}

Page types:
- "cover" = front cover or title page
- "publisher" = publisher info, copyright, ISBN, credits
- "content" = actual story content with readable text (this is what we want)
- "illustration" = story page that is primarily an illustration/picture with NO meaningful text (just an image). Set text to empty string for these.
- "back_cover" = back cover, author bio, or summary on the back
- "blank" = blank or largely empty pages

IMPORTANT: If a page is part of the story but has only an illustration with no real text (or just a page number), classify it as "illustration" with an empty text field. Do NOT invent or hallucinate text for illustration pages.
IMPORTANT: Ignore page numbers. Do NOT include page numbers (like "1", "2", "12", etc.) in the extracted text. Only extract the actual story text.
Extract ALL story text from content pages faithfully. The text is in ${sourceLang}. Do not translate it.`,
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const ocrResult = cleanJsonResponse(
      getResponseText(ocrResponse)
    );
    const ocrData = JSON.parse(ocrResult);

    const storyPages = ocrData.pages.filter(
      (p: { type: string }) =>
        p.type === "content" || p.type === "illustration"
    );
    const textPages = storyPages.filter(
      (p: { text?: string }) => p.text && p.text.trim().length > 0
    );

    if (storyPages.length === 0) {
      return NextResponse.json(
        { error: "No story pages found in the PDF" },
        { status: 400 }
      );
    }

    // Step 2: Translate only pages that have text
    const translateMap: Record<
      number,
      { text: string; vocab: { english: string; original: string }[] }
    > = {};

    if (textPages.length > 0) {
      const allText = textPages
        .map(
          (p: { pageNum: number; text: string }) =>
            `[PAGE ${p.pageNum}]\n${p.text}`
        )
        .join("\n\n");

      const translateResponse = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `You are a precise translator. Translate the following ${sourceLang} text into English.
The translation is for a children's story, so keep the language simple and age-appropriate.

The text is divided into pages marked with [PAGE N]. Preserve the page divisions and page numbers exactly.

For each page, provide a COMPREHENSIVE vocabulary mapping. Identify MOST or ALL content words and phrases in the English translation and map them to their ORIGINAL text. We want the reader to be able to click almost any word to see its original meaning.

Return ONLY a JSON object (no markdown, no code fences) with this format:
{
  "pages": [
    {
      "pageNum": 3,
      "translated": "translated text for page 3",
      "vocab": [
        { "english": "dog", "original": "canis" },
        { "english": "jumped", "original": "saltavit" }
      ]
    },
    ...
  ]
}

Text to translate:
${allText}`,
        config: { responseMimeType: "application/json" },
      });

      const translateResult = cleanJsonResponse(
        getResponseText(translateResponse)
      );
      const translateData = JSON.parse(translateResult);

      translateData.pages.forEach(
        (
          tp: {
            pageNum: number;
            translated: string;
            vocab?: { english: string; original: string }[];
          },
          i: number
        ) => {
          const matchPage =
            textPages.find(
              (sp: { pageNum: number }) => sp.pageNum === tp.pageNum
            ) || textPages[i];
          if (matchPage) {
            translateMap[matchPage.pageNum] = {
              text: tp.translated,
              vocab: tp.vocab || [],
            };
          }
        }
      );
    }

    // Step 3: Build final page array
    const pages = storyPages.map(
      (p: { pageNum: number; text?: string }) => {
        const translation = translateMap[p.pageNum] || {
          text: "",
          vocab: [],
        };
        return {
          pageNum: p.pageNum,
          originalText: p.text || "",
          translatedText: translation.text,
          vocab: translation.vocab,
          isIllustration: !p.text || p.text.trim().length === 0,
        };
      }
    );

    return NextResponse.json({
      pages,
      totalPdfPages: ocrData.pages.length,
    });
  } catch (err) {
    console.error("Process PDF error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "PDF processing failed", details: message },
      { status: 500 }
    );
  }
}
