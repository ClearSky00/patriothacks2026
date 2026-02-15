"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Upload, Trash2, Check, Mic, AudioWaveform } from "lucide-react";
import type { Voice } from "@/lib/supabase/types";

interface VoiceSetupProps {
  active: boolean;
  onVoiceSelected: (voiceId: string, voiceName: string) => void;
}

export function VoiceSetup({ active, onVoiceSelected }: VoiceSetupProps) {
  const { user } = useAuth();
  const [parentName, setParentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cloning, setCloning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [savedVoices, setSavedVoices] = useState<Voice[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingSaved(true);
    fetch("/api/voices")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedVoices(data);
      })
      .catch((err) => console.error("Failed to load voices:", err))
      .finally(() => setLoadingSaved(false));
  }, [user]);

  const handleFileSelect = useCallback(() => {
    const file = fileInputRef.current?.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClone = async () => {
    if (!selectedFile) return;
    setCloning(true);
    try {
      const form = new FormData();
      form.append("audio", selectedFile);
      form.append("name", parentName || "Parent Voice");

      const res = await fetch("/api/clone-voice", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clone failed");

      if (data.saved) {
        setSavedVoices((prev) => [data.saved, ...prev]);
      }

      setSelectedVoiceId(data.voiceId);
      setStatusText(`Voice "${data.name}" cloned successfully!`);
      onVoiceSelected(data.voiceId, data.name);
    } catch (err) {
      alert("Voice cloning failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setCloning(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteVoice = async (voice: Voice) => {
    if (!user) return;
    setDeletingId(voice.id);
    try {
      const res = await fetch("/api/voices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: voice.voice_id }),
      });

      if (res.ok) {
        setSavedVoices((prev) => prev.filter((v) => v.id !== voice.id));
        if (selectedVoiceId === voice.voice_id) {
          setSelectedVoiceId(null);
          setStatusText("");
        }
      }
    } catch (err) {
      console.error("Delete voice error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const selectVoice = (v: Voice) => {
    setSelectedVoiceId(v.voice_id);
    setStatusText(`Using voice "${v.name}"`);
    onVoiceSelected(v.voice_id, v.name);
  };

  return (
    <section className={`screen ${active ? "active" : ""}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 pt-32 pb-12">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-foreground text-white shadow-lg">
            <Mic className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Voice Setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Clone a parent&apos;s voice, then listen to stories read aloud in English.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Saved Voices */}
          <div className="rounded-2xl border border-border p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your Voices
            </p>

            {loadingSaved && (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            )}

            {!loadingSaved && savedVoices.length === 0 && (
              <div className="mt-6 flex flex-col items-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
                  <AudioWaveform className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  No voices yet. Clone your first voice!
                </p>
              </div>
            )}

            {savedVoices.length > 0 && (
              <div className="mt-4 space-y-2">
                {savedVoices.map((v) => {
                  const isSelected = selectedVoiceId === v.voice_id;
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border px-4 py-3 transition-all",
                        isSelected
                          ? "border-foreground bg-foreground/5 shadow-sm"
                          : "border-border hover:border-foreground/30"
                      )}
                    >
                      <button
                        className="flex flex-1 cursor-pointer items-center gap-3 border-none bg-transparent p-0 text-left"
                        onClick={() => selectVoice(v)}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isSelected ? "bg-foreground text-white" : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {isSelected ? <Check className="size-4" /> : <Mic className="size-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{v.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(v.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <button
                        className="cursor-pointer border-none bg-transparent p-1.5 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                        disabled={deletingId === v.id}
                        onClick={() => deleteVoice(v)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Clone Form */}
          <div className="rounded-2xl border border-border p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Clone New Voice
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="parentName" className="mb-1.5 block text-sm font-medium">
                  Voice name
                </label>
                <Input
                  type="text"
                  id="parentName"
                  placeholder="e.g. Mama, Papa, Dadi..."
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                />
              </div>

              {!selectedFile ? (
                <div
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed py-10 transition-all",
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
                    if (e.dataTransfer.files.length) {
                      const dt = new DataTransfer();
                      dt.items.add(e.dataTransfer.files[0]);
                      if (fileInputRef.current) fileInputRef.current.files = dt.files;
                      setSelectedFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
                    <Upload className="size-5 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload audio file</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      MP3, WAV, or M4A &middot; 30s &ndash; 5min recommended
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="audio/*"
                    hidden
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-white">
                      <AudioWaveform className="size-4" />
                    </div>
                    <span className="truncate text-sm font-medium">{selectedFile.name}</span>
                  </div>
                  <button
                    className="cursor-pointer border-none bg-transparent p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={removeFile}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!selectedFile || cloning}
                onClick={handleClone}
              >
                {cloning ? (
                  <>
                    <span className="loader" />
                    Cloning...
                  </>
                ) : (
                  "Clone Voice"
                )}
              </Button>
            </div>

            {/* Status */}
            {statusText && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
                <Check className="size-4 shrink-0 text-success" />
                <span className="text-sm text-success">{statusText}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
