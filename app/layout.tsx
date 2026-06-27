import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "Amara · AI 情感陪伴",
  description: "TA 会记得你说的每句话，懂你的情绪，在你需要的时候，刚好都在。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <Navbar />
          <main className="pt-16">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
