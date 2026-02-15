import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[GET /api/voices] No authenticated user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's saved voices from the database
    const { data: dbVoices, error: dbError } = await supabase
      .from("voices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("[GET /api/voices] Supabase query error:", dbError.message, dbError.details);
      return NextResponse.json({ error: "Failed to fetch voices from database" }, { status: 500 });
    }

    if (!dbVoices || dbVoices.length === 0) {
      return NextResponse.json([]);
    }

    // Verify each voice still exists in ElevenLabs by looking up its voice_id
    const results = await Promise.allSettled(
      dbVoices.map(async (dbVoice) => {
        const res = await fetch(`${ELEVENLABS_BASE}/voices/${dbVoice.voice_id}`, {
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
        });
        if (!res.ok) {
          console.warn(
            `[GET /api/voices] ElevenLabs voice ${dbVoice.voice_id} returned ${res.status} — marking stale`
          );
          return { dbVoice, exists: false };
        }
        return { dbVoice, exists: true };
      })
    );

    const validVoices: typeof dbVoices = [];
    const staleIds: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.exists) {
          validVoices.push(result.value.dbVoice);
        } else {
          staleIds.push(result.value.dbVoice.id);
        }
      } else {
        // Network error hitting ElevenLabs — keep the voice rather than deleting it
        console.error("[GET /api/voices] ElevenLabs fetch rejected:", result.reason);
      }
    }

    // Clean up stale entries from the database
    if (staleIds.length > 0) {
      console.log(`[GET /api/voices] Removing ${staleIds.length} stale voice(s) from database`);
      const { error: deleteError } = await supabase
        .from("voices")
        .delete()
        .in("id", staleIds);
      if (deleteError) {
        console.error("[GET /api/voices] Failed to delete stale voices:", deleteError.message);
      }
    }

    return NextResponse.json(validVoices);
  } catch (err) {
    console.error("[GET /api/voices] Unhandled error:", err);
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[DELETE /api/voices] No authenticated user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { voiceId } = body;
    if (!voiceId) {
      console.error("[DELETE /api/voices] Missing voiceId in request body:", body);
      return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
    }

    console.log(`[DELETE /api/voices] Deleting voice ${voiceId} for user ${user.id}`);

    // Delete from ElevenLabs
    const elResponse = await fetch(`${ELEVENLABS_BASE}/voices/${voiceId}`, {
      method: "DELETE",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    });

    if (!elResponse.ok && elResponse.status !== 404) {
      const elText = await elResponse.text();
      console.error(
        `[DELETE /api/voices] ElevenLabs delete failed (${elResponse.status}):`,
        elText
      );
    } else {
      console.log(`[DELETE /api/voices] ElevenLabs voice ${voiceId} deleted (or already gone)`);
    }

    // Delete from Supabase
    const { error } = await supabase
      .from("voices")
      .delete()
      .eq("voice_id", voiceId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[DELETE /api/voices] Supabase delete error:", error.message, error.details);
      return NextResponse.json({ error: "Failed to delete voice from database" }, { status: 500 });
    }

    console.log(`[DELETE /api/voices] Successfully deleted voice ${voiceId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/voices] Unhandled error:", err);
    return NextResponse.json(
      { error: "Failed to delete voice" },
      { status: 500 }
    );
  }
}
