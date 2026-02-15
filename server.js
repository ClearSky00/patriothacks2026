import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, 'public')));

// Multer for file uploads (voice samples + PDFs)
const upload = multer({ dest: 'uploads/', limits: { fileSize: 25 * 1024 * 1024 } });

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const EL_KEY = process.env.ELEVENLABS_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const genai = new GoogleGenAI({ apiKey: GEMINI_KEY });

// Helper to safely extract text from Gemini response
function getResponseText(response) {
    // Try .text property first (newer SDK)
    if (typeof response.text === 'string') return response.text;
    // Try candidates path
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        return response.candidates[0].content.parts[0].text;
    }
    // If text is a getter/function
    if (typeof response.text === 'function') return response.text();
    throw new Error('Could not extract text from Gemini response: ' + JSON.stringify(response).slice(0, 200));
}

// ─── Voice Cloning ──────────────────────────────────────────────────────────

app.post('/api/clone-voice', upload.single('audio'), async (req, res) => {
    try {
        const { name } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No audio file uploaded' });

        console.log('Cloning voice for:', name, 'file:', file.originalname, 'size:', file.size, 'type:', file.mimetype);
        console.log('Using ElevenLabs key starting with:', EL_KEY?.slice(0, 8) + '...');

        const fileBuffer = fs.readFileSync(file.path);

        // Use native File object (Node 20+)
        const audioFile = new File(
            [fileBuffer],
            file.originalname || 'voice_sample.wav',
            { type: file.mimetype || 'audio/wav' }
        );

        const formData = new FormData();
        formData.append('name', name || 'Parent Voice');
        formData.append('description', 'Cloned parent voice for story reading');
        formData.append('files', audioFile);

        const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
            method: 'POST',
            headers: { 'xi-api-key': EL_KEY },
            body: formData,
        });

        // Clean up uploaded file
        fs.unlinkSync(file.path);

        const responseText = await response.text();
        console.log('ElevenLabs clone response status:', response.status, 'body:', responseText);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Voice cloning failed', details: responseText });
        }

        const data = JSON.parse(responseText);
        res.json({ voiceId: data.voice_id, name: name });
    } catch (err) {
        console.error('Clone voice error:', err);
        res.status(500).json({ error: 'Server error during voice cloning' });
    }
});

// ─── Text-to-Speech ─────────────────────────────────────────────────────────

app.post('/api/speak', async (req, res) => {
    try {
        const { text, voiceId } = req.body;
        if (!text || !voiceId) return res.status(400).json({ error: 'text and voiceId required' });

        const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': EL_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                    style: 0.0,
                    use_speaker_boost: true,
                },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('ElevenLabs TTS error:', err);
            return res.status(response.status).json({ error: 'TTS failed', details: err });
        }

        res.set('Content-Type', 'audio/mpeg');
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error('Speak error:', err);
        res.status(500).json({ error: 'Server error during TTS' });
    }
});

// ─── Get available voices ───────────────────────────────────────────────────

app.get('/api/voices', async (req, res) => {
    try {
        const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
            headers: { 'xi-api-key': EL_KEY },
        });
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch voices' });
        }
        const data = await response.json();
        res.json(data.voices.map(v => ({ voice_id: v.voice_id, name: v.name, category: v.category })));
    } catch (err) {
        console.error('Voices error:', err);
        res.status(500).json({ error: 'Failed to fetch voices' });
    }
});

// ─── Translate (Gemini) ─────────────────────────────────────────────────────

app.post('/api/translate', async (req, res) => {
    try {
        const { text, sourceLang = 'Hindi', targetLang = 'English' } = req.body;
        if (!text) return res.status(400).json({ error: 'text required' });

        const prompt = `You are a precise translator. Translate the following ${sourceLang} text into ${targetLang}. 
The translation is for a children's story, so keep the language simple and age-appropriate.
Return ONLY a JSON object with this exact format (no markdown, no code fences):
{"lines": [{"original": "original line", "translated": "translated line"}]}

Split the text by sentences or natural phrase breaks. Each line should be a complete thought suitable for a child to read.

Text to translate:
${text}`;

        const response = await genai.models.generateContent({
            model: 'gemini-2.0-flash-lite',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            },
        });

        let result = getResponseText(response).trim();
        // Strip markdown code fences if present
        result = result.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('Translate raw response:', result.slice(0, 200));

        const parsed = JSON.parse(result);
        res.json(parsed);
    } catch (err) {
        console.error('Translate error:', err);
        res.status(500).json({ error: 'Translation failed', details: err.message });
    }
});

// ─── Explain Phrase (Gemini) ─────────────────────────────────────────────────

app.post('/api/explain', async (req, res) => {
    try {
        const { original, translated, sourceLang = 'Hindi', targetLang = 'English' } = req.body;
        if (!original || !translated) return res.status(400).json({ error: 'original and translated required' });

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
            model: 'gemini-2.0-flash-lite',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            },
        });

        let result = getResponseText(response).trim();
        result = result.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

        const parsed = JSON.parse(result);
        res.json(parsed);
    } catch (err) {
        console.error('Explain error:', err);
        res.status(500).json({ error: 'Explanation failed', details: err.message });
    }
});

// ─── Quiz Generation (Gemini) ───────────────────────────────────────────────

app.post('/api/quiz', async (req, res) => {
    try {
        const { lines, sourceLang = 'Hindi' } = req.body;
        if (!lines || !lines.length) return res.status(400).json({ error: 'lines required' });

        const storyText = lines.map(l => `${l.translated}`).join('\n');

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
    },
    {
      "type": "open_ended",
      "question": "the question text",
      "sampleAnswer": "a sample good answer",
      "hint": "a helpful hint for the child"
    }
  ]
}

Generate exactly 3 multiple-choice questions and 2 open-ended questions. Keep language simple and encouraging.`;

        const response = await genai.models.generateContent({
            model: 'gemini-2.0-flash-lite',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            },
        });

        let result = getResponseText(response).trim();
        result = result.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

        const parsed = JSON.parse(result);
        res.json(parsed);
    } catch (err) {
        console.error('Quiz error:', err);
        res.status(500).json({ error: 'Quiz generation failed', details: err.message });
    }
});

// ─── Process PDF ────────────────────────────────────────────────────────────

app.post('/api/process-pdf', upload.single('pdf'), async (req, res) => {
    try {
        const file = req.file;
        const { sourceLang = 'Hindi' } = req.body;
        if (!file) return res.status(400).json({ error: 'No PDF file uploaded' });

        console.log('Processing PDF:', file.originalname, 'size:', file.size);

        const pdfBuffer = fs.readFileSync(file.path);
        const pdfBase64 = pdfBuffer.toString('base64');

        // Clean up uploaded file
        fs.unlinkSync(file.path);

        // Step 1: Send entire PDF to Gemini for per-page OCR + classification
        console.log('Sending PDF to Gemini for OCR + classification...');
        const ocrResponse = await genai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
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
            config: {
                responseMimeType: 'application/json',
            },
        });

        let ocrResult = getResponseText(ocrResponse).trim();
        ocrResult = ocrResult.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('OCR result length:', ocrResult.length);

        const ocrData = JSON.parse(ocrResult);
        // Include both content pages (with text) and illustration pages (image-only)
        const storyPages = ocrData.pages.filter(p => p.type === 'content' || p.type === 'illustration');
        const textPages = storyPages.filter(p => p.text && p.text.trim().length > 0);

        console.log(`Found ${ocrData.pages.length} total pages, ${storyPages.length} story pages (${textPages.length} with text)`);

        if (storyPages.length === 0) {
            return res.status(400).json({ error: 'No story pages found in the PDF' });
        }

        // Step 2: Translate only pages that have text
        let translateMap = {};
        if (textPages.length > 0) {
            const allText = textPages.map((p, i) => `[PAGE ${p.pageNum}]\n${p.text}`).join('\n\n');

            console.log('Translating', textPages.length, 'text pages...');
            const translateResponse = await genai.models.generateContent({
                model: 'gemini-2.0-flash',
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
                config: {
                    responseMimeType: 'application/json',
                },
            });

            let translateResult = getResponseText(translateResponse).trim();
            translateResult = translateResult.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            const translateData = JSON.parse(translateResult);
            // Build a map for easy lookup
            translateData.pages.forEach((tp, i) => {
                // Try matching by pageNum first, fall back to index
                const matchPage = textPages.find(sp => sp.pageNum === tp.pageNum) || textPages[i];
                if (matchPage) {
                    translateMap[matchPage.pageNum] = {
                        text: tp.translated,
                        vocab: tp.vocab || []
                    };
                }
            });
        }

        // Step 3: Build final page array (text + illustration pages)
        const pages = storyPages.map(p => {
            const translation = translateMap[p.pageNum] || { text: '', vocab: [] };
            return {
                pageNum: p.pageNum,
                originalText: p.text || '',
                translatedText: translation.text,
                vocab: translation.vocab,
                isIllustration: !p.text || p.text.trim().length === 0,
            };
        });

        console.log('PDF processing complete:', pages.length, 'pages ready');
        res.json({ pages, totalPdfPages: ocrData.pages.length });
    } catch (err) {
        console.error('Process PDF error:', err);
        res.status(500).json({ error: 'PDF processing failed', details: err.message });
    }
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🎙️  Kahaani server running at http://localhost:${PORT}\n`);
});
