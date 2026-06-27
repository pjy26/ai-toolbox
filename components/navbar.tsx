"use client";

import Link from "next/link";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { LogIn, User, Heart } from "lucide-react";

export function Navbar() {
  const { session } = useSessionContext();

  if (!session) return null;

  return (
    <nav className="fixed top-0 w-full z-50" style={{ borderBottom: "1px solid rgba(201,169,110,0.06)", background: "rgba(15,13,11,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-normal text-sm" style={{ color: "#E8D5C4", letterSpacing: 3 }}>
          <Heart className="w-4 h-4" style={{ color: "#D4849A" }} />
          Amara
        </Link>
        <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(232,213,196,0.4)" }}>
          <Link href="/" className="hover:text-white transition" style={{ letterSpacing: 1 }}>
            选择
          </Link>
          <span style={{ color: "rgba(232,213,196,0.15)" }}>·</span>
          <Link href="/pricing" className="hover:text-white transition" style={{ letterSpacing: 1 }}>
            定价
          </Link>
          <span style={{ color: "rgba(232,213,196,0.15)" }}>·</span>
          <Link href="/contact" className="hover:text-white transition" style={{ letterSpacing: 1 }}>
            联系
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.15)" }}>
            <User className="w-3.5 h-3.5" style={{ color: "rgba(201,169,110,0.5)" }} />
          </div>
        </div>
      </div>
    </nav>
  );
}
