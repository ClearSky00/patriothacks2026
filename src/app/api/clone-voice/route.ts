import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const name = (formData.get("name") as string) || "Parent Voice";
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file uploaded" },
        { status: 400 }
      );
    }

    const elForm = new FormData();
    elForm.append("name", name);
    elForm.append(
      "description",
      "Cloned voice for cross-language story reading. Optimized for speaking English from a non-English voice sample."
    );
    elForm.append("files", audioFile);
    elForm.append("remove_background_noise", "true");
    elForm.append(
      "labels",
      JSON.stringify({ use_case: "narration", language: "multilingual" })
    );

    const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      body: elForm,
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Voice cloning failed", details: responseText },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);

    // Save the ElevenLabs voice ID to the database, linked to the user
    const { data: saved, error: dbError } = await supabase
      .from("voices")
      .insert({
        voice_id: data.voice_id,
        name,
        user_id: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Failed to save voice to database:", dbError);
    }

    return NextResponse.json({
      voiceId: data.voice_id,
      name,
      saved: saved || null,
    });
  } catch (err) {
    console.error("Clone voice error:", err);
    return NextResponse.json(
      { error: "Server error during voice cloning" },
      { status: 500 }
    );
  }
}
