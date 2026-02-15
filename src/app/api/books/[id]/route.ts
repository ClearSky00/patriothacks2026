import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/books/[id] — load a book's metadata, pages JSON, and PDF */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: book } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .single();

    if (!book)
      return NextResponse.json({ error: "Book not found" }, { status: 404 });

    // Load pages JSON
    const { data: pagesBlob } = await supabase.storage
      .from("Books")
      .download(`${user.id}/${id}_pages.json`);

    let pages = null;
    if (pagesBlob) {
      pages = JSON.parse(await pagesBlob.text());
    }

    // Load PDF as base64
    const { data: pdfData } = await supabase.storage
      .from("Books")
      .download(`${user.id}/${id}.pdf`);

    let pdfBase64 = null;
    if (pdfData) {
      const buffer = await pdfData.arrayBuffer();
      pdfBase64 = Buffer.from(buffer).toString("base64");
    }

    // Load user's voice
    const { data: voices } = await supabase
      .from("voices")
      .select("voice_id")
      .eq("user_id", user.id)
      .limit(1);

    return NextResponse.json({
      book,
      pages,
      pdfBase64,
      voiceId: voices?.[0]?.voice_id || null,
    });
  } catch (err) {
    console.error("Load book error:", err);
    return NextResponse.json({ error: "Failed to load book" }, { status: 500 });
  }
}

/** PATCH /api/books/[id] — rename a book */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title } = await request.json();
    if (!title?.trim())
      return NextResponse.json({ error: "title required" }, { status: 400 });

    const { error } = await supabase
      .from("books")
      .update({ title: title.trim() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Rename book error:", err);
    return NextResponse.json(
      { error: "Failed to rename book" },
      { status: 500 }
    );
  }
}

/** DELETE /api/books/[id] — delete a book and its files */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await supabase.storage
      .from("Books")
      .remove([`${user.id}/${id}.pdf`, `${user.id}/${id}_pages.json`]);

    await supabase.from("book_pages").delete().eq("book_id", id);

    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete book error:", err);
    return NextResponse.json(
      { error: "Failed to delete book" },
      { status: 500 }
    );
  }
}
