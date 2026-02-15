"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Particles } from "@/components/particles";
import { NavDots, type ScreenName } from "@/components/nav-dots";
import { VoiceSetup } from "@/components/voice-setup";
import { StoryInput, type PageData } from "@/components/story-input";
import { StoryReader } from "@/components/story-reader";
import { Quiz } from "@/components/quiz";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

function HomeContent() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("book");

  const [activeScreen, setActiveScreen] = useState<ScreenName>("setup");
  const [completedScreens, setCompletedScreens] = useState<Set<ScreenName>>(
    new Set()
  );
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [sourceLang, setSourceLang] = useState("Hindi");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);

  const markComplete = useCallback((screen: ScreenName) => {
    setCompletedScreens((prev) => new Set([...prev, screen]));
  }, []);

  useEffect(() => {
    if (!bookId) return;

    const loadSavedBook = async () => {
      setLoadingBook(true);
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: book } = await supabase
          .from("books")
          .select("*")
          .eq("id", bookId)
          .single();

        if (!book) return;

        const pagesPath = `${user.id}/${bookId}_pages.json`;
        const { data: pagesBlob } = await supabase.storage
          .from("Books")
          .download(pagesPath);

        if (!pagesBlob) return;

        const pagesText = await pagesBlob.text();
        const loadedPages: PageData[] = JSON.parse(pagesText);

        setPages(loadedPages);
        setSourceLang(book.source_language || "Hindi");

        const filePath = `${user.id}/${bookId}.pdf`;
        const { data: pdfData } = await supabase.storage
          .from("Books")
          .download(filePath);

        if (pdfData) {
          const file = new File([pdfData], `${book.title}.pdf`, {
            type: "application/pdf",
          });
          setPdfFile(file);
        }

        const { data: voices } = await supabase
          .from("voices")
          .select("voice_id")
          .eq("user_id", user.id)
          .limit(1);

        if (voices && voices.length > 0) {
          setVoiceId(voices[0].voice_id);
          markComplete("setup");
        }

        markComplete("story-input");
        setActiveScreen("reader");
      } catch (err) {
        console.error("Failed to load saved book:", err);
      } finally {
        setLoadingBook(false);
      }
    };

    loadSavedBook();
  }, [bookId, markComplete]);

  const handleVoiceSelected = useCallback(
    (id: string, _name: string) => {
      setVoiceId(id);
      markComplete("setup");
      setTimeout(() => setActiveScreen("story-input"), 800);
    },
    [markComplete]
  );

  const handlePagesReady = useCallback(
    (newPages: PageData[], lang: string, file: File) => {
      setPages(newPages);
      setSourceLang(lang);
      setPdfFile(file);
      markComplete("story-input");
      setTimeout(() => setActiveScreen("reader"), 1000);
    },
    [markComplete]
  );

  const handleGoToQuiz = useCallback(() => {
    setActiveScreen("quiz");
  }, []);

  if (loadingBook) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loader-dark" />
          <p className="text-sm text-muted-foreground">Loading your book...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Particles />
      <AppHeader />

      <NavDots
        activeScreen={activeScreen}
        completedScreens={completedScreens}
        hasPages={pages.length > 0}
        onNavigate={setActiveScreen}
      />

      <VoiceSetup
        active={activeScreen === "setup"}
        onVoiceSelected={handleVoiceSelected}
      />

      <StoryInput
        active={activeScreen === "story-input"}
        voiceId={voiceId}
        onPagesReady={handlePagesReady}
        onNavigateToSetup={() => setActiveScreen("setup")}
      />

      <StoryReader
        active={activeScreen === "reader"}
        pages={pages}
        voiceId={voiceId}
        pdfFile={pdfFile}
        onExit={() => setActiveScreen("story-input")}
        onGoToQuiz={handleGoToQuiz}
      />

      <Quiz
        active={activeScreen === "quiz"}
        pages={pages}
        sourceLang={sourceLang}
        voiceId={voiceId}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="loader-dark" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
