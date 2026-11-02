"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";
import { BookOpen, CloudMoon, HeartHandshake, Home, Mail, Settings, UserRound, UsersRound } from "lucide-react";
import { PageLoader } from "@/components/amara-ui";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";

const navigation = [
  { href: "/app", key: "today", icon: Home },
  { href: "/memories", key: "about", icon: BookOpen },
  { href: "/people", key: "people", icon: UsersRound },
  { href: "/moments", key: "moments", icon: HeartHandshake },
  { href: "/dreams", key: "dreams", icon: CloudMoon },
  { href: "/letters", key: "letters", icon: Mail },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

const mobileLabels = {
  en: { today: "Today", about: "About", people: "People", moments: "Moments", dreams: "Dreams", letters: "Letters", settings: "Settings" },
  zh: { today: "今天", about: "关于你", people: "人物", moments: "瞬间", dreams: "梦境", letters: "信件", settings: "设置" },
};

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

function LetterDot({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#b64f43]" aria-label={label} title={label} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, isLoading } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale];
  const [unreadLetters, setUnreadLetters] = useState(false);

  useEffect(() => {
    const update = (event: Event) => setUnreadLetters(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("amara:letters-unread", update);
    return () => window.removeEventListener("amara:letters-unread", update);
  }, []);

  if (isLoading) {
    return <main className="min-h-screen bg-[#f8f5ef]"><PageLoader label={locale === "zh" ? "正在打开你的空间…" : "Opening your space…"} /></main>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5ef] px-6 py-16">
        <div className="w-full max-w-md border-t border-[#cfc5b7] pt-8 text-center">
          <div className="mb-8 flex justify-center"><Wordmark /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{locale === "zh" ? "你的空间是私密的" : "Your space is private"}</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#282621]">{locale === "zh" ? "登录后，回到 Amara。" : "Sign in to return to Amara."}</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#6e685f]">{locale === "zh" ? "你的对话、记忆和梦境，都在你的账号里等你。" : "Your conversations, memories, and Dreams are waiting behind your account."}</p>
          <Link href={`/login?redirect=${encodeURIComponent(pathname || "/app")}`} className="mt-8 inline-flex min-h-12 w-full items-center justify-center bg-[#a34f3d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] sm:w-auto">
            {locale === "zh" ? "登录" : "Sign in"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#ded7cc] bg-[#f3eee6] px-6 py-8 md:flex">
        <Wordmark />
        <p className="mt-3 max-w-40 text-xs leading-5 text-[#817a70]">{copy.nav.tagline}</p>
        <nav className="mt-9 space-y-1" aria-label="Main navigation">
          {navigation.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 border-l-2 px-3 text-sm transition-colors ${active ? "border-[#a34f3d] bg-[#ebe2d7] font-semibold text-[#813d30]" : "border-transparent text-[#6e685f] hover:bg-[#ece5db] hover:text-[#282621]"}`}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span className="leading-5">{copy.nav[key]}</span>
                {key === "letters" && <LetterDot show={unreadLetters} label={copy.nav.unread} />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-[#ded7cc] pt-5 text-xs leading-5 text-[#817a70]">
          <div className="flex items-start gap-2"><UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /><p>{copy.nav.care}</p></div>
          <LocaleToggle className="mt-4 !min-h-9 !px-0 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" />
        </div>
      </aside>

      <header className="flex h-16 items-center justify-between border-b border-[#ded7cc] bg-[#f8f5ef] px-5 md:hidden">
        <Wordmark />
        <div className="flex items-center gap-3"><LocaleToggle className="!min-h-9 !px-1 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" /></div>
      </header>

      <main className="pb-28 md:pb-12 md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-7 border-t border-[#d8d0c4] bg-[#fffdf8] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden" aria-label="Mobile navigation">
        {navigation.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 text-[9px] ${active ? "text-[#923f30]" : "text-[#756f66]"}`}>
              <span className="relative"><Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2 : 1.6} aria-hidden="true" />{key === "letters" && unreadLetters && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#b64f43]" aria-label={copy.nav.unread} />}</span>
              <span className="max-w-full truncate px-0.5">{mobileLabels[locale][key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
