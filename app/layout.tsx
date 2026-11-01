import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { LocaleProvider } from "@/components/locale-provider";

export const metadata: Metadata = {
  title: "Amara · Your personal AI companion",
  description: "Meet Amara, your personal AI companion for ongoing conversations, meaningful memories, and Dreams inspired by your shared story.",
  other: {
    "waffo-verify": "e380c83311d7ed59ed0b12f763e69006",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
