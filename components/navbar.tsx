"use client";

import Link from "next/link";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { Sparkles, LogIn, User, CreditCard } from "lucide-react";

export function Navbar() {
  const { session } = useSessionContext();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-surface-dark/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Sparkles className="w-5 h-5 text-brand" />
          <span className="gradient-text">AI 工具箱</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <Link href="/tools" className="hover:text-white transition">工具</Link>
          <Link href="/pricing" className="hover:text-white transition">定价</Link>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
              >
                <CreditCard className="w-4 h-4" />
                <span>控制台</span>
              </Link>
              <Link
                href="/dashboard"
                className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center"
              >
                <User className="w-4 h-4 text-brand-light" />
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg gradient-btn text-sm font-medium text-white"
            >
              <LogIn className="w-4 h-4" />
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
