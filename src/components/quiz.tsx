"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PageData } from "./story-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Trophy,
  RotateCcw,
  CheckCircle2,
  XCircle,
  PartyPopper,
  TrendingUp,
  BookOpen,
  MessageCircle,
  Send,
  Volume2,
  Loader2,
  Mic,
  Languages,
} from "lucide-react";

const LANG_TO_BCP47: Record<string, string> = {
  hindi: "hi-IN",
  spanish: "es-ES",
  french: "fr-FR",
  arabic: "ar-SA",
  chinese: "zh-CN",
  mandarin: "zh-CN",
  cantonese: "zh-HK",
  japanese: "ja-JP",
  korean: "ko-KR",
  portuguese: "pt-BR",
  russian: "ru-RU",
  german: "de-DE",
  italian: "it-IT",
  turkish: "tr-TR",
  vietnamese: "vi-VN",
  thai: "th-TH",
  bengali: "bn-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  marathi: "mr-IN",
  gujarati: "gu-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
  punjabi: "pa-IN",
  urdu: "ur-PK",
  persian: "fa-IR",
  farsi: "fa-IR",
  polish: "pl-PL",
  ukrainian: "uk-UA",
  dutch: "nl-NL",
  swedish: "sv-SE",
  tagalog: "fil-PH",
  filipino: "fil-PH",
  indonesian: "id-ID",
  malay: "ms-MY",
  swahili: "sw-KE",
  amharic: "am-ET",
  somali: "so-SO",
  "haitian creole": "ht-HT",
  nepali: "ne-NP",
  burmese: "my-MM",
  khmer: "km-KH",
  lao: "lo-LA",
  czech: "cs-CZ",
  romanian: "ro-RO",
  hungarian: "hu-HU",
  greek: "el-GR",
  hebrew: "he-IL",
  english: "en-US",
};

function getBcp47(langName: string): string {
  return LANG_TO_BCP47[langName.toLowerCase().trim()] || "en-US";
}

/** Strip leading letter prefixes like "A. ", "B) ", "C: ", "D - " from quiz options */
function stripOptionPrefix(text: string): string {
  return text.replace(/^[A-Da-d][.):\-\s]\s*/, "");
}

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

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  translatedText?: string | null;
  detectedLanguage?: string | null;
}

export function Quiz({ active, pages, sourceLang, voiceId }: QuizProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<MCQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [playingMsgIdx, setPlayingMsgIdx] = useState<number | null>(null);
  const [micLang, setMicLang] = useState<"source" | "en">("source");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        (data.questions as MCQuestion[])
          .filter((q) => q.type === "multiple_choice")
          .map((q) => ({
            ...q,
            options: q.options.map(stripOptionPrefix),
          }))
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

  // --- Chatbot logic ---

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingResponse(false);
    setPlayingMsgIdx(null);
  }, []);

  const playTTS = useCallback(
    async (text: string, msgIdx?: number) => {
      if (!voiceId || !text) return;
      // If already playing, stop
      if (audioRef.current) {
        stopTTS();
        return;
      }
      try {
        setIsPlayingResponse(true);
        if (msgIdx !== undefined) setPlayingMsgIdx(msgIdx);
        const ttsRes = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId }),
        });
        if (ttsRes.ok) {
          const audioBlob = await ttsRes.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => {
            setIsPlayingResponse(false);
            setPlayingMsgIdx(null);
            URL.revokeObjectURL(audioUrl);
          };
          audio.onerror = () => {
            setIsPlayingResponse(false);
            setPlayingMsgIdx(null);
            URL.revokeObjectURL(audioUrl);
          };
          await audio.play();
        } else {
          setIsPlayingResponse(false);
          setPlayingMsgIdx(null);
        }
      } catch {
        setIsPlayingResponse(false);
        setPlayingMsgIdx(null);
      }
    },
    [voiceId]
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || chatLoading) return;

      const userMsg: ChatMessage = { role: "user", text: text.trim() };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput("");
      setChatLoading(true);

      try {
        const res = await fetch("/api/book-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text.trim(), pages }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Chat failed");

        const assistantMsg: ChatMessage = {
          role: "assistant",
          text: data.answer,
          translatedText: data.translatedAnswer || null,
          detectedLanguage: data.detectedLanguage || null,
        };
        setChatMessages((prev) => [...prev, assistantMsg]);

        // Play English answer TTS if we have a voiceId
        if (voiceId && data.answer) {
          await playTTS(data.answer);
        }
      } catch (err) {
        console.error("Chat error:", err);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Sorry, I had trouble answering. Try again!",
          },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading, pages, voiceId, playTTS]
  );

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition =
      w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang =
      micLang === "en" ? "en-US" : getBcp47(sourceLang);
    recognition.interimResults = false;
    recognition.continuous = false;

    setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) {
        sendChatMessage(transcript);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.start();
  }, [sendChatMessage, micLang, sourceLang]);

  // --- Result helpers ---

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
            <p className="text-sm text-muted-foreground">
              Generating questions...
            </p>
          </div>
        )}

        {/* Questions */}
        <div className="mt-8 space-y-5">
          {questions.map((q, qIdx) => {
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
                      Question {qIdx + 1}
                    </span>

                  </span>
                  <p className="mt-3 text-sm font-semibold leading-relaxed">
                    {q.question}
                  </p>
                  <div className="mt-4 space-y-2">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = answered && oIdx === q.correct;
                      const isIncorrect =
                        answered &&
                        oIdx === selected &&
                        selected !== q.correct;

                      return (
                        <button
                          key={oIdx}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-transparent px-4 py-3 text-left text-sm transition-all",
                            !answered &&
                            "border-border hover:border-foreground/40 hover:bg-secondary/50",
                            isCorrect && "border-success/50 bg-success/5",
                            isIncorrect &&
                            "border-destructive/50 bg-destructive/5",
                            answered &&
                            !isCorrect &&
                            !isIncorrect &&
                            "border-border opacity-40"
                          )}
                          onClick={() => handleAnswer(qIdx, oIdx)}
                        >
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all",
                              !answered &&
                              "bg-secondary text-muted-foreground",
                              isCorrect && "bg-success text-white",
                              isIncorrect && "bg-destructive text-white",
                              answered &&
                              !isCorrect &&
                              !isIncorrect &&
                              "bg-secondary text-muted-foreground"
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
              <span className="text-lg font-medium text-muted-foreground">
                {" "}
                / {totalMC}
              </span>
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

        {/* Chatbot section */}
        {questions.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-foreground text-white">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Ask About the Story
                </h2>
                <p className="text-xs text-muted-foreground">
                  Have a question? Ask me anything about the book!
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              {/* Chat messages */}
              <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    Ask a question about the story to get started!
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className="max-w-[80%] space-y-1.5">
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm",
                          msg.role === "user"
                            ? "bg-foreground text-white"
                            : "bg-secondary text-foreground"
                        )}
                      >
                        {msg.text}
                      </div>
                      {msg.role === "assistant" && msg.translatedText && (
                        <div className="rounded-2xl border border-border bg-white px-4 py-2.5 text-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            {msg.detectedLanguage || "Translation"}
                          </p>
                          <p>{msg.translatedText}</p>
                          {voiceId && (
                            <button
                              className={cn(
                                "mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                                isPlayingResponse && playingMsgIdx === i && "text-foreground"
                              )}
                              onClick={() =>
                                isPlayingResponse && playingMsgIdx === i
                                  ? stopTTS()
                                  : playTTS(msg.translatedText!, i)
                              }
                              disabled={isPlayingResponse && playingMsgIdx !== i}
                            >
                              {isPlayingResponse && playingMsgIdx === i ? (
                                <>
                                  <Volume2 className="size-3.5 animate-pulse" />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <Volume2 className="size-3.5" />
                                  Listen in {msg.detectedLanguage || "your language"}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
                {isPlayingResponse && playingMsgIdx === null && (
                  <div className="flex justify-start">
                    <button
                      className="flex cursor-pointer items-center gap-2 rounded-2xl border-none bg-secondary px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      onClick={stopTTS}
                    >
                      <Volume2 className="size-3.5 animate-pulse" />
                      Speaking... tap to stop
                    </button>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="flex items-center gap-2 border-t border-border p-3">
                <button
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border-none bg-secondary px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() =>
                    setMicLang((l) => (l === "source" ? "en" : "source"))
                  }
                  title={`Mic language: ${micLang === "en" ? "English" : sourceLang}. Click to switch.`}
                >
                  <Languages className="size-3.5" />
                  {micLang === "en" ? "EN" : sourceLang.slice(0, 3).toUpperCase()}
                </button>
                <button
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none transition-all",
                    isListening
                      ? "bg-destructive text-white animate-pulse"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                  onClick={startListening}
                  disabled={chatLoading || isListening}
                >
                  <Mic className="size-4" />
                </button>
                <input
                  type="text"
                  className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/40"
                  placeholder="Type your question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage(chatInput);
                    }
                  }}
                  disabled={chatLoading}
                />
                <button
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-foreground text-white transition-all hover:opacity-80",
                    (!chatInput.trim() || chatLoading) && "opacity-40"
                  )}
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
