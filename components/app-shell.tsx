"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { BookOpen, CloudMoon, Home, MessageCircle, Settings } from "lucide-react";
import { PageLoader } from "@/components/amara-ui";

const desktopNavigation = [
  { href: "/app", label: "Today", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/memories", label: "Memories", icon: BookOpen },
  { href: "/dreams", label: "Dreams", icon: CloudMoon },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNavigation = [
  desktopNavigation[0],
  desktopNavigation[1],
  desktopNavigation[3],
  desktopNavigation[4],
];

function Wordmark() {
  return (
    <Link href="/app" className="inline-flex items-center gap-2.5" aria-label="Amara home">
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-[#a34f3d]" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-[#a34f3d]" />
      </span>
      <span className="font-serif text-[25px] tracking-[-0.03em] text-[#282621]">Amara</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, isLoading } = useSessionContext();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f8f5ef]">
        <PageLoader label="Opening your space…" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5ef] px-6 py-16">
        <div className="w-full max-w-md border-t border-[#cfc5b7] pt-8 text-center">
          <div className="mb-8 flex justify-center"><Wordmark /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">Your space is private</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#282621]">Sign in to return to Amara.</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#6e685f]">
            Your conversations, memories, and Dreams are waiting behind your account.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname || "/app")}`}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center bg-[#a34f3d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#ded7cc] bg-[#f3eee6] px-6 py-8 md:flex">
        <Wordmark />
        <p className="mt-3 text-xs leading-5 text-[#817a70]">A little continuity,<br />one conversation at a time.</p>
        <nav className="mt-12 space-y-1" aria-label="Main navigation">
          {desktopNavigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 border-l-2 px-3 text-sm transition-colors ${
                  active
                    ? "border-[#a34f3d] bg-[#ebe2d7] font-semibold text-[#813d30]"
                    : "border-transparent text-[#6e685f] hover:bg-[#ece5db] hover:text-[#282621]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-[#ded7cc] pt-5 text-xs leading-5 text-[#817a70]">
          Your memories are yours.<br />Review or remove them anytime.
        </div>
      </aside>

      <header className="flex h-16 items-center justify-between border-b border-[#ded7cc] bg-[#f8f5ef] px-5 md:hidden">
        <Wordmark />
        <Link href="/memories" className="flex min-h-11 items-center gap-2 text-xs font-medium text-[#6e685f]" aria-label="Open memories">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Memories
        </Link>
      </header>

      <main className="pb-28 md:pb-12 md:pl-60">
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12">{children}</div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#d8d0c4] bg-[#fffdf8] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="Mobile navigation"
      >
        {mobileNavigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-[#923f30]" : "text-[#756f66]"}`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
