import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, voiceId, lang } = await request.json();
    if (!text || !voiceId) {
      return NextResponse.json(
        { error: "text and voiceId required" },
        { status: 400 }
      );
    }

    const isEnglish = lang === "en";

    // Wrap text in SSML with <break> tags for natural pauses.
    // Strip ellipsis which ElevenLabs vocalizes as "uh".
    const cleaned = text
      .replace(/\.{2,}/g, ".")               // collapse ellipsis to period
      .replace(/\u2026/g, ".");              // collapse Unicode ellipsis to period

    // Insert SSML break tags after punctuation
    const withBreaks = cleaned
      .replace(/([.!?])\s+/g, '$1 <break time="0.5s" /> ')   // long pause after sentences
      .replace(/([,;:])\s+/g, '$1 <break time="0.5s" /> ');  // medium pause after commas/semicolons/colons

    const processedText = `<speak>${withBreaks}</speak>`;

    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: processedText,
          model_id: isEnglish ? "eleven_turbo_v2" : "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.85,
            style: 0.0,
            use_speaker_boost: true,
            ...(isEnglish ? { speed: 0.7 } : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs TTS error:", err);
      return NextResponse.json(
        { error: "TTS failed", details: err },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    console.error("Speak error:", err);
    return NextResponse.json(
      { error: "Server error during TTS" },
      { status: 500 }
    );
  }
}
