"use client";

import { ArrowRight, X } from "lucide-react";

interface VocabBarProps {
  visible: boolean;
  word: string;
  translation: string;
  onDismiss?: () => void;
}

export function VocabBar({ visible, word, translation, onDismiss }: VocabBarProps) {
  return (
    <div className={`vocab-bar ${visible ? "visible" : ""}`}>
      <span className="font-semibold">{word}</span>
      <ArrowRight className="size-3.5 shrink-0 opacity-50" />
      <span className="opacity-80">{translation}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 cursor-pointer border-none bg-transparent p-0.5 text-white/40 transition-colors hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
