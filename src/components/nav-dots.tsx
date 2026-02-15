"use client";

import { cn } from "@/lib/utils";
import { Mic, BookOpen, Volume2, Brain, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ScreenName = "setup" | "story-input" | "reader" | "quiz";

interface NavDotsProps {
  activeScreen: ScreenName;
  completedScreens: Set<ScreenName>;
  hasPages: boolean;
  onNavigate: (screen: ScreenName) => void;
}

const steps: { screen: ScreenName; label: string; icon: typeof Mic }[] = [
  { screen: "setup", label: "Voice", icon: Mic },
  { screen: "story-input", label: "Upload", icon: BookOpen },
  { screen: "reader", label: "Read", icon: Volume2 },
  { screen: "quiz", label: "Quiz", icon: Brain },
];

export function NavDots({
  activeScreen,
  completedScreens,
  hasPages,
  onNavigate,
}: NavDotsProps) {
  const activeIdx = steps.findIndex((s) => s.screen === activeScreen);

  return (
    <nav className="step-nav fixed top-14 left-0 right-0 z-50 flex items-center justify-center gap-0 border-b border-border/50 bg-white/80 px-8 py-3 backdrop-blur-md">
      {steps.map((step, idx) => {
        const isActive = activeScreen === step.screen;
        const isCompleted = completedScreens.has(step.screen);
        const isDisabled =
          (step.screen === "reader" || step.screen === "quiz") && !hasPages;

        const Icon = step.icon;

        return (
          <div key={step.screen} className="flex items-center">
            {idx > 0 && (
              <div
                className={cn(
                  "h-px w-8 transition-colors duration-300 sm:w-16",
                  idx <= activeIdx ? "bg-foreground" : "bg-border"
                )}
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => !isDisabled && onNavigate(step.screen)}
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:px-4 sm:py-2 sm:text-sm",
                    isActive
                      ? "border-foreground bg-foreground text-white shadow-sm"
                      : isCompleted
                        ? "border-foreground/30 bg-white text-foreground"
                        : "border-border bg-white text-muted-foreground",
                    isDisabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="size-3.5 sm:size-4" />
                  ) : (
                    <Icon className="size-3.5 sm:size-4" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="sm:hidden">
                {step.label}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </nav>
  );
}
