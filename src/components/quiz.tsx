"use client";

import { useState, useEffect, useCallback } from "react";
import type { PageData } from "./story-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Mic, Lightbulb, Eye, RotateCcw, CheckCircle2, XCircle, PartyPopper, TrendingUp, BookOpen } from "lucide-react";

interface QuizProps {
  active: boolean;
  pages: PageData[];
  sourceLang: string;
}

interface MCQuestion {
  type: "multiple_choice";
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  pageRef?: string;
}

interface OEQuestion {
  type: "open_ended";
  question: string;
  sampleAnswer: string;
  hint: string;
  pageRef?: string;
}

type Question = MCQuestion | OEQuestion;

export function Quiz({ active, pages, sourceLang }: QuizProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [hintsShown, setHintsShown] = useState<Set<number>>(new Set());
  const [sampleAnswersShown, setSampleAnswersShown] = useState<Set<number>>(
    new Set()
  );
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [loadKey, setLoadKey] = useState(0);

  const loadQuiz = useCallback(async () => {
    if (pages.length === 0) return;
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setShowResults(false);
    setHintsShown(new Set());
    setSampleAnswersShown(new Set());
    setTranscripts({});

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, sourceLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quiz generation failed");

      setQuestions(data.questions);
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

  const mcQuestions = questions.filter(
    (q): q is MCQuestion => q.type === "multiple_choice"
  );
  const totalMC = mcQuestions.length;
  const answeredMC = Object.keys(answers).filter((k) =>
    questions[parseInt(k)]?.type === "multiple_choice"
  ).length;

  const mcScore = Object.entries(answers).reduce((score, [idx, selected]) => {
    const q = questions[parseInt(idx)];
    if (q?.type === "multiple_choice" && selected === q.correct) score++;
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

  const startRecording = (qIdx: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setTranscripts((prev) => ({ ...prev, [qIdx]: transcript }));
    };

    recognition.start();
  };

  let mcNum = 0;
  let oeNum = 0;

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
            if (q.type === "multiple_choice") {
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
                        {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              );
            } else {
              oeNum++;
              return (
                <div
                  key={qIdx}
                  className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
                  style={{ animationDelay: `${qIdx * 50}ms` }}
                >
                  <div className="p-6">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Open Ended
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

                    <div className="mt-5 flex flex-col items-center gap-3">
                      <button
                        className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-transparent px-6 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-foreground hover:text-foreground active:scale-95"
                        onClick={() => startRecording(qIdx)}
                      >
                        <Mic className="size-4" />
                        Tap to Answer
                      </button>
                      {transcripts[qIdx] && (
                        <p className="w-full rounded-xl bg-secondary px-4 py-3 text-sm italic text-foreground">
                          {transcripts[qIdx]}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() =>
                          setHintsShown((prev) => new Set([...prev, qIdx]))
                        }
                      >
                        <Lightbulb className="size-3.5" />
                        Hint
                      </button>
                      <button
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() =>
                          setSampleAnswersShown(
                            (prev) => new Set([...prev, qIdx])
                          )
                        }
                      >
                        <Eye className="size-3.5" />
                        Show Answer
                      </button>
                    </div>

                    {hintsShown.has(qIdx) && (
                      <div className="mt-3 rounded-xl bg-secondary px-4 py-3 text-xs italic leading-relaxed text-muted-foreground">
                        {q.hint || "Think about what happened in the story!"}
                      </div>
                    )}
                    {sampleAnswersShown.has(qIdx) && (
                      <div className="mt-2 rounded-xl border-l-2 border-foreground bg-secondary px-4 py-3 text-xs leading-relaxed">
                        <strong>Sample:</strong> {q.sampleAnswer}
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
