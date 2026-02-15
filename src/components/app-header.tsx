"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Library, BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const initials = user.user_metadata?.first_name
    ? `${user.user_metadata.first_name[0]}${user.user_metadata.last_name?.[0] || ""}`.toUpperCase()
    : user.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] border-b border-border/50 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Left: Wordmark */}
        <Link href="/app" className="flex items-center gap-2 text-foreground no-underline">
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-white">
            <BookOpen className="size-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">Kahaani</span>
        </Link>

        {/* Right: Nav + User */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Library className="size-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-secondary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user.user_metadata?.first_name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer no-underline">
                  <Library className="mr-2 size-4" />
                  My Library
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={signOut}
              >
                <LogOut className="mr-2 size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
