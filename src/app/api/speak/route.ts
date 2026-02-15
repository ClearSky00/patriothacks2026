import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, voiceId } = await request.json();
    if (!text || !voiceId) {
      return NextResponse.json(
        { error: "text and voiceId required" },
        { status: 400 }
      );
    }

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
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.0,
            use_speaker_boost: true,
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
