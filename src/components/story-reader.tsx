"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { PageData } from "./story-input";
import { VocabBar } from "./vocab-bar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronLeft, ChevronRight, Volume2, Brain, Pause, LogOut } from "lucide-react";
import Link from "next/link";

interface StoryReaderProps {
  active: boolean;
  pages: PageData[];
  voiceId: string | null;
  pdfFile: File | null;
  onExit: () => void;
  onGoToQuiz: () => void;
}

export function StoryReader({
  active,
  pages,
  voiceId,
  pdfFile,
  onExit,
  onGoToQuiz,
}: StoryReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingBtn, setPlayingBtn] = useState<"english" | "original" | null>(null);
  const [vocabVisible, setVocabVisible] = useState(false);
  const [vocabWord, setVocabWord] = useState("");
  const [vocabTranslation, setVocabTranslation] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<unknown>(null);
  const vocabTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageIndexRef = useRef(currentPage);

  pageIndexRef.current = currentPage;

  useEffect(() => {
    if (!pdfFile || !active) return;

    let cancelled = false;

    const loadPdf = async () => {
      try {
        const PDFJS_VERSION = "5.4.624";
        const cdnUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
        const pdfjsLib = await import(/* webpackIgnore: true */ cdnUrl);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

        const fileUrl = URL.createObjectURL(pdfFile);
        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        if (!cancelled) {
          pdfDocRef.current = doc;
          renderPage(doc, pages[currentPage]?.pageNum);
        }
      } catch (err) {
        console.error("PDF load error:", err);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile, active]);

  const renderPage = useCallback(
    async (doc: unknown, pageNum: number) => {
      if (!doc || !canvasRef.current) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfPage = await (doc as any).getPage(pageNum);
        const scale = 1.5;
        const viewport = pdfPage.getViewport({ scale });

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        console.error("Render page error:", err);
      }
    },
    []
  );

  useEffect(() => {
    if (pdfDocRef.current && pages[currentPage]) {
      renderPage(pdfDocRef.current, pages[currentPage].pageNum);
    }
  }, [currentPage, pages, renderPage]);

  const resetAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setPlayingBtn(null);
  }, [currentAudio]);

  const goToPage = (idx: number) => {
    resetAudio();
    setVocabVisible(false);
    setCurrentPage(idx);
  };

  const playPageAudio = async (lang: "english" | "original") => {
    const page = pages[currentPage];
    if (!page || !voiceId) return;

    const text = lang === "english" ? page.translatedText : page.originalText;
    if (!text) return;

    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    setPlayingBtn(lang);
    const savedPage = currentPage;

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (pageIndexRef.current !== savedPage) {
        URL.revokeObjectURL(url);
        return;
      }

      const audio = new Audio(url);
      setCurrentAudio(audio);
      audio.play();

      audio.onended = () => {
        if (pageIndexRef.current === savedPage) {
          setPlayingBtn(null);
        }
        URL.revokeObjectURL(url);
        setCurrentAudio(null);
      };
    } catch (err) {
      console.error("Play error:", err);
      if (pageIndexRef.current === savedPage) {
        setPlayingBtn(null);
      }
    }
  };

  const handleVocabClick = async (english: string, original: string) => {
    if (vocabTimeoutRef.current) clearTimeout(vocabTimeoutRef.current);

    setVocabWord(english);
    setVocabTranslation(original);
    setVocabVisible(true);

    if (!currentAudio || currentAudio.paused) {
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${english}... ${original}`,
            voiceId,
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play();
        }
      } catch (err) {
        console.error("Vocab audio error:", err);
      }
    }

    vocabTimeoutRef.current = setTimeout(() => setVocabVisible(false), 5000);
  };

  const page = pages[currentPage];
  const isLastPage = currentPage === pages.length - 1;
  const progressPercent = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0;
  const hasEnglishText = !!page?.translatedText?.trim();
  const hasOriginalText = !!page?.originalText?.trim();

  const renderTranslatedText = () => {
    if (!page) return null;

    if (page.vocab && page.vocab.length > 0) {
      const text = page.translatedText || "";
      const ranges: {
        start: number;
        end: number;
        word: string;
        vocab: { english: string; original: string };
      }[] = [];

      const sortedVocab = [...page.vocab].sort(
        (a, b) => b.english.length - a.english.length
      );

      sortedVocab.forEach((v) => {
        const escaped = v.english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        let match;
        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          const isOverlapping = ranges.some(
            (r) => start < r.end && end > r.start
          );
          if (!isOverlapping) {
            ranges.push({ start, end, word: match[0], vocab: v });
          }
        }
      });

      ranges.sort((a, b) => a.start - b.start);

      const elements: React.ReactNode[] = [];
      let lastIndex = 0;

      ranges.forEach((r, i) => {
        if (r.start > lastIndex) {
          elements.push(text.substring(lastIndex, r.start));
        }
        elements.push(
          <span
            key={i}
            className="interactive-word"
            onClick={(e) => {
              e.stopPropagation();
              handleVocabClick(r.vocab.english, r.vocab.original);
            }}
          >
            {r.word}
          </span>
        );
        lastIndex = r.end;
      });

      if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
      }

      return elements;
    }

    return page.translatedText;
  };

  return (
    <section className={`screen ${active ? "active" : ""}`}>
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <div className="fixed top-14 left-0 right-0 z-40 border-b border-border/50 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
            <button
              className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={onExit}
            >
              <BookOpen className="size-4" />
              Change Story
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {currentPage + 1} / {pages.length}
              </span>
              <div className="hidden w-32 sm:block">
                <Progress value={progressPercent} className="h-1.5" />
              </div>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Exit</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main content: side-by-side on desktop */}
        <div className="flex flex-1 flex-col pt-28 lg:flex-row">
          {/* PDF (left / top) — fill available height */}
          <div className="flex items-center justify-center bg-secondary/30 p-4 lg:h-[calc(100vh-7rem)] lg:w-[60%] lg:p-6">
            <canvas
              ref={canvasRef}
              className="block h-full max-h-[60vh] w-auto max-w-full rounded-lg object-contain shadow-sm lg:max-h-full"
            />
          </div>

          {/* Text panels (right / bottom) */}
          <div className="flex flex-col gap-4 p-6 lg:h-[calc(100vh-7rem)] lg:w-[40%] lg:overflow-y-auto lg:p-8">
            {/* English text */}
            {hasEnglishText && (
              <div className="rounded-xl border border-border p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    English
                  </span>
                  <button
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      playingBtn === "english"
                        ? "border-foreground bg-foreground text-white"
                        : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                    onClick={() => playPageAudio("english")}
                    disabled={playingBtn === "english"}
                  >
                    {playingBtn === "english" ? (
                      <>
                        <Pause className="size-3" />
                        Playing
                      </>
                    ) : (
                      <>
                        <Volume2 className="size-3" />
                        Listen
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm leading-relaxed">
                  {renderTranslatedText()}
                </p>
              </div>
            )}

            {/* Original text */}
            {hasOriginalText && (
              <div className="rounded-xl border border-border p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Original
                  </span>
                  <button
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      playingBtn === "original"
                        ? "border-foreground bg-foreground text-white"
                        : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                    onClick={() => playPageAudio("original")}
                    disabled={playingBtn === "original"}
                  >
                    {playingBtn === "original" ? (
                      <>
                        <Pause className="size-3" />
                        Playing
                      </>
                    ) : (
                      <>
                        <Volume2 className="size-3" />
                        Listen
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm italic leading-relaxed text-muted-foreground">
                  {page?.originalText}
                </p>
              </div>
            )}

            {/* Page navigation */}
            <div className="mt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeft className="mr-1 size-4" />
                Previous
              </Button>

              {isLastPage ? (
                <Button variant="primary" onClick={onGoToQuiz} className="gap-2">
                  <Brain className="size-4" />
                  Take Quiz
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <VocabBar
        visible={vocabVisible}
        word={vocabWord}
        translation={vocabTranslation}
        onDismiss={() => setVocabVisible(false)}
      />
    </section>
  );
}
