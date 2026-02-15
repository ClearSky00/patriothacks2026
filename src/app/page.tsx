import Link from "next/link";
import { Mic, BookOpen, Headphones, Brain, Globe, FileText, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Mic,
    title: "Clone a Voice",
    description: "Record a short audio sample of a parent or loved one. We'll create a personalized voice clone.",
  },
  {
    icon: BookOpen,
    title: "Upload a Story",
    description: "Upload any children's book PDF in 15+ languages. We'll translate every page to English.",
  },
  {
    icon: Headphones,
    title: "Listen & Learn",
    description: "Hear the story read aloud in English using the cloned voice. Tap any word to hear its meaning.",
  },
];

const features = [
  {
    icon: Mic,
    title: "Voice Cloning",
    description: "AI-powered voice synthesis that sounds like a real family member reading to the child.",
  },
  {
    icon: Globe,
    title: "15+ Languages",
    description: "Hindi, Spanish, Mandarin, Arabic, Tagalog, Vietnamese, Korean, French, and more.",
  },
  {
    icon: Brain,
    title: "AI Quizzes",
    description: "Auto-generated comprehension quizzes with multiple choice and open-ended questions.",
  },
  {
    icon: FileText,
    title: "PDF Reader",
    description: "Built-in PDF viewer with bilingual text display and interactive vocabulary highlighting.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-foreground no-underline">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-white">
              <BookOpen className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Kahaani</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-foreground/85"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-14">
        <div className="bg-dots absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="size-3.5" />
            Built for PatriotHacks 2026
          </div>
          <h1 className="text-gradient-hero animate-fade-in-up-delay-1 mt-8 text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl md:text-7xl">
            Stories in every language, read in a voice they love
          </h1>
          <p className="animate-fade-in-up-delay-2 mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            Help children of immigrant families learn English by hearing stories
            read aloud in a parent&apos;s cloned voice.
          </p>
          <div className="animate-fade-in-up-delay-3 mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center rounded-xl bg-foreground px-8 text-base font-semibold text-white no-underline shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-all hover:bg-foreground/85 hover:-translate-y-px"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center rounded-xl border border-border px-8 text-base font-semibold text-foreground no-underline transition-all hover:bg-secondary"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-secondary/30 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Three simple steps
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="relative flex flex-col items-center text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground text-white shadow-lg">
                    <Icon className="size-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Step {idx + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-border p-6 transition-all hover:border-foreground/20 hover:shadow-sm"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-white">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold">{feat.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-secondary/30 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to start?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Create an account and upload your first story in minutes.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-foreground px-8 text-base font-semibold text-white no-underline shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-all hover:bg-foreground/85 hover:-translate-y-px"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-white">
              <BookOpen className="size-3" />
            </div>
            <span className="text-sm font-semibold">Kahaani</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built for PatriotHacks 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
