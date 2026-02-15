import type { Metadata } from "next";
import { Outfit, Noto_Sans_Devanagari } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Kahaani — Stories in Every Language",
  description:
    "Clone a parent's voice and listen to stories read aloud in English. A bilingual story reader for kids of immigrant parents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${notoSansDevanagari.variable}`}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
