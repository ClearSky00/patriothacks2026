"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Lightbulb } from "lucide-react";

interface ExplainModalProps {
  open: boolean;
  onClose: () => void;
  original: string;
  translated: string;
  sourceLang: string;
}

interface ExplainData {
  motherTongue: string;
  english: string;
  keyPhrases: Record<string, string>[];
  funFact?: string;
}

export function ExplainModal({
  open,
  onClose,
  original,
  translated,
  sourceLang,
}: ExplainModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExplainData | null>(null);

  const loadExplanation = async () => {
    if (data) return;
    setLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original, translated, sourceLang }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
    } catch (err) {
      console.error("Explain error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (open && !data && !loading) {
    loadExplanation();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-border bg-background sm:max-w-[520px]">
        {loading && (
          <div className="space-y-4 py-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="h-px bg-border" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        )}

        {data && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Phrase Breakdown
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-secondary p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Original
                  </p>
                  <p className="mt-2 text-sm font-medium leading-relaxed">{data.motherTongue}</p>
                </div>
                <div className="rounded-xl bg-secondary p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    English
                  </p>
                  <p className="mt-2 text-sm font-medium leading-relaxed">{data.english}</p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Key Phrases
                </p>
                <div className="mt-3 space-y-2">
                  {data.keyPhrases.map((kp, i) => {
                    const sourceKey = sourceLang.toLowerCase();
                    const targetKey = "english";
                    return (
                      <div
                        key={i}
                        className="rounded-xl bg-secondary p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {kp[sourceKey]}
                          </span>
                          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            {kp[targetKey]}
                          </span>
                        </div>
                        {kp.example && (
                          <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
                            {kp.example}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {data.funFact && (
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-muted-foreground" />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Fun Fact
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {data.funFact}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
