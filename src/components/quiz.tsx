"use client";

import { useState, useEffect, useCallback } from "react";
import type { PageData } from "./story-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, RotateCcw, CheckCircle2, XCircle, PartyPopper, TrendingUp, BookOpen, Volume2, Pause } from "lucide-react";

interface QuizProps {
  active: boolean;
  pages: PageData[];
  sourceLang: string;
  voiceId: string | null;
}

interface MCQuestion {
  type: "multiple_choice";
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  pageRef?: string;
}

export function Quiz({ active, pages, sourceLang, voiceId }: QuizProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<MCQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const loadQuiz = useCallback(async () => {
    if (pages.length === 0) return;
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setShowResults(false);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, sourceLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quiz generation failed");

      setQuestions(
        (data.questions as MCQuestion[]).filter(
          (q) => q.type === "multiple_choice"
        )
      );
    } catch (err) {
      console.error("Quiz load error:", err);
    } finally {
      setLoading(false);
    }
  }, [pages, sourceLang]);

  useEffect(() => {
    if (active && pages.length > 0) {
      loadQuiz();
    }
  }, [active, loadKey, loadQuiz, pages.length]);

  const totalMC = questions.length;
  const answeredMC = Object.keys(answers).length;

  const mcScore = Object.entries(answers).reduce((score, [idx, selected]) => {
    const q = questions[parseInt(idx)];
    if (q && selected === q.correct) score++;
    return score;
  }, 0);

  useEffect(() => {
    if (totalMC > 0 && answeredMC === totalMC && !showResults) {
      const timer = setTimeout(() => setShowResults(true), 800);
      return () => clearTimeout(timer);
    }
  }, [answeredMC, totalMC, showResults]);

  const handleAnswer = (qIdx: number, optIdx: number) => {
    if (answers[qIdx] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const narrate = async (key: string, text: string) => {
    if (!voiceId) return;

    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    if (playingKey === key) {
      setPlayingKey(null);
      return;
    }

    setPlayingKey(key);

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, lang: "en" }),
      });
      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setCurrentAudio(audio);
      audio.play();
      audio.onended = () => {
        setPlayingKey(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("Narrate error:", err);
      setPlayingKey(null);
    }
  };

  let mcNum = 0;

  const getResultIcon = () => {
    const pct = mcScore / totalMC;
    if (pct === 1) return PartyPopper;
    if (pct >= 0.6) return TrendingUp;
    return BookOpen;
  };

  const getResultMessage = () => {
    const pct = mcScore / totalMC;
    if (pct === 1) return "Perfect! You understood everything!";
    if (pct >= 0.6) return "Great job! You understood most of the story!";
    return "Keep practicing! Try reading the story again.";
  };

  const ResultIcon = showResults ? getResultIcon() : null;

  return (
    <section className={`screen ${active ? "active" : ""}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 pt-32 pb-12">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-foreground text-white shadow-lg">
            <Trophy className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Quiz Time</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Let&apos;s see how much you understood!
          </p>
        </div>

        {loading && (
          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="loader-dark" />
            <p className="text-sm text-muted-foreground">Generating questions...</p>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {questions.map((q, qIdx) => {
            {
              mcNum++;
              const answered = answers[qIdx] !== undefined;
              const selected = answers[qIdx];

              return (
                <div
                  key={qIdx}
                  className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
                  style={{ animationDelay: `${qIdx * 50}ms` }}
                >
                  <div className="p-6">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Question {mcNum}
                      </span>
                      {q.pageRef && (
                        <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          {q.pageRef}
                        </span>
                      )}
                    </span>
                    <p className="mt-3 text-sm font-semibold leading-relaxed">
                      {q.question}
                    </p>
                    {voiceId && (
                      <button
                        className={cn(
                          "mt-2 flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          playingKey === `q-${qIdx}`
                            ? "border-foreground bg-foreground text-white"
                            : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        )}
                        onClick={() => {
                          const fullText = `${q.question} <break time="0.5s" /> A. ${q.options[0]}. <break time="0.5s" /> B. ${q.options[1]}. <break time="0.8s" /> C. ${q.options[2]}. <break time="0.8s" /> ${q.options[3] ? `D. ${q.options[3]}.` : ""}`;
                          narrate(`q-${qIdx}`, fullText);
                        }}
                      >
                        {playingKey === `q-${qIdx}` ? (
                          <><Pause className="size-3" /> Playing</>
                        ) : (
                          <><Volume2 className="size-3" /> Listen</>
                        )}
                      </button>
                    )}
                    <div className="mt-4 space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = answered && oIdx === q.correct;
                        const isIncorrect =
                          answered && oIdx === selected && selected !== q.correct;

                        return (
                          <button
                            key={oIdx}
                            className={cn(
                              "flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-transparent px-4 py-3 text-left text-sm transition-all",
                              !answered && "border-border hover:border-foreground/40 hover:bg-secondary/50",
                              isCorrect && "border-success/50 bg-success/5",
                              isIncorrect && "border-destructive/50 bg-destructive/5",
                              answered && !isCorrect && !isIncorrect && "border-border opacity-40",
                            )}
                            onClick={() => handleAnswer(qIdx, oIdx)}
                          >
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all",
                                !answered && "bg-secondary text-muted-foreground",
                                isCorrect && "bg-success text-white",
                                isIncorrect && "bg-destructive text-white",
                                answered && !isCorrect && !isIncorrect && "bg-secondary text-muted-foreground",
                              )}
                            >
                              {isCorrect ? (
                                <CheckCircle2 className="size-4" />
                              ) : isIncorrect ? (
                                <XCircle className="size-4" />
                              ) : (
                                String.fromCharCode(65 + oIdx)
                              )}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {answered && (
                      <div className="mt-4 rounded-xl bg-secondary px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                        <div className="flex items-start justify-between gap-2">
                          <span>{q.explanation}</span>
                          {voiceId && (
                            <button
                              className={cn(
                                "ml-2 flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-all",
                                playingKey === `exp-${qIdx}`
                                  ? "border-foreground bg-foreground text-white"
                                  : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                              )}
                              onClick={() => narrate(`exp-${qIdx}`, q.explanation)}
                            >
                              {playingKey === `exp-${qIdx}` ? (
                                <><Pause className="size-3" /> Playing</>
                              ) : (
                                <><Volume2 className="size-3" /> Listen</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>

        {/* Score card */}
        {showResults && ResultIcon && (
          <div className="animate-fade-in-up mt-10 overflow-hidden rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-foreground text-white">
              <ResultIcon className="size-6" />
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your Score
            </p>
            <p className="mt-3 text-5xl font-extrabold tracking-tight">
              {mcScore}
              <span className="text-lg font-medium text-muted-foreground"> / {totalMC}</span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {getResultMessage()}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => setLoadKey((k) => k + 1)}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
