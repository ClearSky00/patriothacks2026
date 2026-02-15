"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Upload, Trash2, Check, FileText, BookOpen, Globe } from "lucide-react";
import type { Book } from "@/lib/supabase/types";

export interface PageData {
  pageNum: number;
  originalText: string;
  translatedText: string;
  vocab: { english: string; original: string }[];
  isIllustration: boolean;
}

interface StoryInputProps {
  active: boolean;
  voiceId: string | null;
  onPagesReady: (pages: PageData[], sourceLang: string, pdfFile: File) => void;
  onNavigateToSetup: () => void;
}

const LANGUAGES = [
  "Hindi", "Spanish", "Mandarin", "Arabic", "Tagalog", "Vietnamese",
  "Korean", "French", "Portuguese", "Urdu", "Bengali", "Tamil",
  "Telugu", "Gujarati", "Punjabi",
];

export function StoryInput({
  active,
  voiceId,
  onPagesReady,
  onNavigateToSetup,
}: StoryInputProps) {
  const { user } = useAuth();
  const [sourceLang, setSourceLang] = useState("Hindi");
  const [bookName, setBookName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const [savedBooks, setSavedBooks] = useState<Book[]>([]);
  const [loadingSavedBooks, setLoadingSavedBooks] = useState(false);
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingSavedBooks(true);
    const supabase = createClient();
    supabase
      .from("books")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load saved books:", error);
        setSavedBooks(data || []);
        setLoadingSavedBooks(false);
      });
  }, [user]);

  const handlePdfSelect = (file: File) => {
    setPdfFile(file);
    if (!bookName) setBookName(file.name.replace(/\.pdf$/i, ""));
  };

  const removePdf = () => {
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveBookToSupabase = async (pages: PageData[], lang: string, file: File, title: string) => {
    if (!user) return;
    try {
      const supabase = createClient();
      const { data: book, error: bookErr } = await supabase
        .from("books")
        .insert({ title, user_id: user.id, source_language: lang })
        .select()
        .single();
      if (bookErr || !book) { console.error("Failed to save book:", bookErr); return; }

      await supabase.storage.from("Books").upload(`${user.id}/${book.id}.pdf`, file, { contentType: "application/pdf", upsert: true });
      const pagesBlob = new Blob([JSON.stringify(pages)], { type: "application/json" });
      await supabase.storage.from("Books").upload(`${user.id}/${book.id}_pages.json`, pagesBlob, { contentType: "application/json", upsert: true });
      setSavedBooks((prev) => [book as Book, ...prev.filter((b) => b.id !== book.id)]);
    } catch (err) { console.error("Save to Supabase error:", err); }
  };

  const loadSavedBook = async (book: Book) => {
    if (!user) return;
    setLoadingBookId(book.id);
    try {
      const supabase = createClient();
      const { data: pagesBlob, error: pagesErr } = await supabase.storage.from("Books").download(`${user.id}/${book.id}_pages.json`);
      if (pagesErr || !pagesBlob) { alert("Could not load book pages."); return; }
      const loadedPages: PageData[] = JSON.parse(await pagesBlob.text());
      const { data: pdfData, error: pdfErr } = await supabase.storage.from("Books").download(`${user.id}/${book.id}.pdf`);
      if (pdfErr || !pdfData) { alert("Could not load book PDF."); return; }
      const file = new File([pdfData], `${book.title}.pdf`, { type: "application/pdf" });
      onPagesReady(loadedPages, book.source_language || "Hindi", file);
    } catch (err) { console.error("Load saved book error:", err); alert("Failed to load book."); }
    finally { setLoadingBookId(null); }
  };

  const deleteSavedBook = async (book: Book) => {
    if (!user) return;
    setDeletingBookId(book.id);
    try {
      const supabase = createClient();
      await supabase.storage.from("Books").remove([`${user.id}/${book.id}.pdf`, `${user.id}/${book.id}_pages.json`]);
      await supabase.from("book_pages").delete().eq("book_id", book.id);
      const { error } = await supabase.from("books").delete().eq("id", book.id).eq("user_id", user.id);
      if (!error) setSavedBooks((prev) => prev.filter((b) => b.id !== book.id));
    } catch (err) { console.error("Delete book error:", err); }
    finally { setDeletingBookId(null); }
  };

  const processBook = async () => {
    if (!pdfFile) return;
    if (!voiceId) { alert("Please set up a voice first!"); return; }
    setProcessing(true);
    setProgressText("Reading and translating pages...");
    try {
      const form = new FormData();
      form.append("pdf", pdfFile);
      form.append("sourceLang", sourceLang);
      const res = await fetch("/api/process-pdf", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PDF processing failed");
      setProgressText(`Found ${data.pages.length} story pages (of ${data.totalPdfPages} total)`);
      onPagesReady(data.pages, sourceLang, pdfFile);
      saveBookToSupabase(data.pages, sourceLang, pdfFile, bookName.trim() || pdfFile.name.replace(/\.pdf$/i, ""));
    } catch (err) {
      alert("PDF processing failed: " + (err instanceof Error ? err.message : "Unknown error"));
      setProgressText("");
    } finally { setProcessing(false); }
  };

  return (
    <section className={`screen ${active ? "active" : ""}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 pt-32 pb-12">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-foreground text-white shadow-lg">
            <BookOpen className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Choose a Book</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload a PDF children&apos;s book and we&apos;ll translate every page.
          </p>
        </div>

        <div className="mt-10 flex-1 space-y-8">
          {/* Saved Books Grid */}
          {loadingSavedBooks && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          )}

          {!loadingSavedBooks && savedBooks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Your Books
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedBooks.map((b) => (
                  <div
                    key={b.id}
                    className="group relative overflow-hidden rounded-xl border border-border p-5 transition-all hover:border-foreground/20 hover:shadow-sm"
                  >
                    <button
                      className="flex w-full cursor-pointer items-start gap-3 border-none bg-transparent p-0 text-left"
                      disabled={loadingBookId === b.id}
                      onClick={() => loadSavedBook(b)}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {loadingBookId === b.id ? "Loading..." : b.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Globe className="size-3" />
                          {b.source_language}
                          <span>&middot;</span>
                          {new Date(b.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                    <button
                      className="absolute top-3 right-3 cursor-pointer rounded-md border-none bg-transparent p-1.5 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                      disabled={deletingBookId === b.id}
                      onClick={() => deleteSavedBook(b)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or upload new</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {/* Upload Form */}
          <div className="mx-auto max-w-lg space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bookName" className="mb-1.5 block text-sm font-medium">
                  Book name
                </label>
                <Input
                  type="text"
                  id="bookName"
                  placeholder="e.g. The Giving Tree"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sourceLang" className="mb-1.5 block text-sm font-medium">
                  Language
                </label>
                <Select value={sourceLang} onValueChange={setSourceLang}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!pdfFile ? (
              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed py-12 transition-all",
                  dragOver
                    ? "border-foreground bg-foreground/5 scale-[1.01]"
                    : "border-border hover:border-foreground/40 hover:bg-secondary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) handlePdfSelect(e.dataTransfer.files[0]);
                }}
              >
                <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Upload PDF</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Drag & drop or click to browse &middot; Up to 25 MB
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="application/pdf"
                  hidden
                  onChange={() => { const file = fileInputRef.current?.files?.[0]; if (file) handlePdfSelect(file); }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-white">
                    <FileText className="size-4" />
                  </div>
                  <span className="truncate text-sm font-medium">{pdfFile.name}</span>
                </div>
                <button
                  className="cursor-pointer border-none bg-transparent p-1.5 text-muted-foreground hover:text-foreground"
                  onClick={removePdf}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}

            {processing && (
              <div className="space-y-2">
                <Progress value={undefined} className="h-1.5" />
                <p className="text-center text-xs text-muted-foreground">{progressText}</p>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!pdfFile || processing}
              onClick={processBook}
            >
              {processing ? (
                <>
                  <span className="loader" />
                  Processing...
                </>
              ) : (
                "Process Book"
              )}
            </Button>

            {!processing && progressText && (
              <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
                <Check className="size-4 shrink-0 text-success" />
                <span className="text-sm text-success">{progressText}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
