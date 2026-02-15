import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/books — list all books for the authenticated user */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: books, error } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ books: books || [] });
  } catch (err) {
    console.error("List books error:", err);
    return NextResponse.json({ error: "Failed to list books" }, { status: 500 });
  }
}

/** POST /api/books — save a new book (title, source_language, pages JSON, PDF) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const sourceLanguage = formData.get("source_language") as string;
    const pagesJson = formData.get("pages") as string;
    const pdf = formData.get("pdf") as File | null;

    if (!title || !pagesJson) {
      return NextResponse.json(
        { error: "title and pages required" },
        { status: 400 }
      );
    }

    const { data: book, error: bookErr } = await supabase
      .from("books")
      .insert({
        title,
        user_id: user.id,
        source_language: sourceLanguage || "Unknown",
      })
      .select()
      .single();

    if (bookErr || !book) {
      return NextResponse.json(
        { error: bookErr?.message || "Failed to create book" },
        { status: 500 }
      );
    }

    if (pdf) {
      await supabase.storage
        .from("Books")
        .upload(`${user.id}/${book.id}.pdf`, pdf, {
          contentType: "application/pdf",
          upsert: true,
        });
    }

    const pagesBlob = new Blob([pagesJson], { type: "application/json" });
    await supabase.storage
      .from("Books")
      .upload(`${user.id}/${book.id}_pages.json`, pagesBlob, {
        contentType: "application/json",
        upsert: true,
      });

    return NextResponse.json({ book });
  } catch (err) {
    console.error("Save book error:", err);
    return NextResponse.json({ error: "Failed to save book" }, { status: 500 });
  }
}
