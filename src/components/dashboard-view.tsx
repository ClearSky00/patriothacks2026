"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Book } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Library,
  BookOpen,
  ArrowRight,
  Globe,
  Calendar,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

interface DashboardViewProps {
  books: Book[];
  userId: string;
}

/* ─── PDF first-page thumbnail ─── */

function BookThumbnail({ bookId, userId }: { bookId: string; userId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from("Books")
          .download(`${userId}/${bookId}.pdf`);
        if (error || !data) return;

        const PDFJS_VERSION = "5.4.624";
        const cdnUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
        const pdfjsLib = await import(/* webpackIgnore: true */ cdnUrl);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await data.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await doc.getPage(1);

        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (!cancelled) setLoaded(true);
        }
      } catch (err) {
        console.error("Thumbnail render error:", err);
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [bookId, userId]);

  return (
    <div className="flex h-40 items-center justify-center overflow-hidden bg-secondary transition-colors group-hover:bg-secondary/70">
      <canvas
        ref={canvasRef}
        className={`h-full w-auto object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {!loaded && (
        <BookOpen className="absolute size-8 text-muted-foreground/50" />
      )}
    </div>
  );
}

/* ─── Dashboard ─── */

export function DashboardView({ books: initialBooks, userId }: DashboardViewProps) {
  const [books, setBooks] = useState(initialBooks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = useCallback((book: Book) => {
    setEditingId(book.id);
    setEditTitle(book.title);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
  }, []);

  const commitRename = useCallback(
    async (bookId: string) => {
      const trimmed = editTitle.trim();
      if (!trimmed) {
        cancelRename();
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("books")
        .update({ title: trimmed })
        .eq("id", bookId);

      if (!error) {
        setBooks((prev) =>
          prev.map((b) => (b.id === bookId ? { ...b, title: trimmed } : b))
        );
      }
      setEditingId(null);
      setEditTitle("");
    },
    [editTitle, cancelRename]
  );

  const deleteBook = useCallback(
    async (book: Book) => {
      setDeletingId(book.id);
      try {
        const supabase = createClient();
        await supabase.storage
          .from("Books")
          .remove([`${userId}/${book.id}.pdf`, `${userId}/${book.id}_pages.json`]);
        await supabase.from("book_pages").delete().eq("book_id", book.id);
        const { error } = await supabase
          .from("books")
          .delete()
          .eq("id", book.id)
          .eq("user_id", userId);
        if (!error) {
          setBooks((prev) => prev.filter((b) => b.id !== book.id));
        }
      } catch (err) {
        console.error("Delete book error:", err);
      } finally {
        setDeletingId(null);
      }
    },
    [userId]
  );

  return (
    <>
      <AppHeader />
      <div className="mx-auto min-h-screen w-full max-w-5xl px-6 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground text-white shadow-lg">
              <Library className="size-6" />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight">My Library</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your saved books
            </p>
          </div>
          <Button variant="primary" asChild>
            <Link href="/app">
              New Story
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Books */}
        <div className="mt-10">
          {books.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
                <BookOpen className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                No books yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload your first story to get started
              </p>
              <Button variant="primary" className="mt-6" asChild>
                <Link href="/app">
                  Get Started
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="group relative overflow-hidden rounded-2xl border border-border transition-all hover:border-foreground/20 hover:shadow-sm"
                >
                  {/* Thumbnail — clickable */}
                  <Link href={`/app?book=${book.id}`} className="relative block">
                    <BookThumbnail bookId={book.id} userId={userId} />
                  </Link>

                  {/* Info */}
                  <div className="p-4">
                    {editingId === book.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          ref={inputRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(book.id);
                            if (e.key === "Escape") cancelRename();
                          }}
                          onBlur={() => commitRename(book.id)}
                          className="h-7 text-sm font-semibold"
                        />
                        <button
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            commitRename(book.id);
                          }}
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            cancelRename();
                          }}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/app?book=${book.id}`}
                          className="min-w-0 truncate text-sm font-semibold text-foreground no-underline hover:underline"
                        >
                          {book.title}
                        </Link>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => startRename(book)}
                            title="Rename"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteBook(book)}
                            disabled={deletingId === book.id}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Globe className="size-3" />
                        {book.source_language || "Unknown"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(book.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
