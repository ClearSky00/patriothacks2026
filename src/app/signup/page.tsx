"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { BookOpen, AlertCircle, Mail, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-foreground text-white">
            <Mail className="size-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Check Your Email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{" "}
            <strong className="text-foreground">{email}</strong>.<br />
            Click the link in the email to activate your account.
          </p>
          <Button variant="outline" className="mt-8" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back to Login
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2 text-foreground no-underline">
            <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-white">
              <BookOpen className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">StoryTime</span>
          </Link>

          <h1 className="mt-8 text-2xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join StoryTime and start learning with your own voice
          </p>

          {error && (
            <div className="mt-6 flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertCircle className="size-4 shrink-0 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium">
                  First name
                </label>
                <Input
                  type="text"
                  id="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium">
                  Last name
                </label>
                <Input
                  type="text"
                  id="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
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
              {loading ? <span className="loader" /> : "Create Account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground no-underline hover:underline">
                Sign in
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
