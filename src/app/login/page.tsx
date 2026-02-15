"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { BookOpen, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/app";
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2 text-foreground no-underline">
            <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-white">
              <BookOpen className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Kahaani</span>
          </Link>

          <h1 className="mt-8 text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to continue your learning journey
          </p>

          {error && (
            <div className="mt-6 flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertCircle className="size-4 shrink-0 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <Input
                type="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <Input
                type="password"
                id="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? <span className="loader" /> : "Sign In"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-foreground no-underline hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right: Branded panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-foreground lg:flex">
        <div className="bg-grid absolute inset-0 opacity-[0.04]" />
        <div className="relative flex flex-col items-center justify-center px-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <BookOpen className="size-8 text-white" />
          </div>
          <h2 className="mt-8 text-3xl font-bold text-white">
            Stories in every language
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Help children of immigrant families learn English by hearing stories
            read aloud in a parent&apos;s cloned voice.
          </p>
          <div className="mt-10 flex items-center gap-6 text-white/40">
            <div className="text-center">
              <p className="text-2xl font-bold text-white/80">15+</p>
              <p className="mt-1 text-xs">Languages</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white/80">AI</p>
              <p className="mt-1 text-xs">Voice Clone</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white/80">PDF</p>
              <p className="mt-1 text-xs">Reader</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
