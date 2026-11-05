"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, CloudMoon, HeartHandshake, Home, LockKeyhole, Mail, Menu, Network, Settings, UsersRound, X } from "lucide-react";
import { PageLoader } from "@/components/amara-ui";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { useMembership } from "@/components/membership-provider";
import { consoleCopy } from "@/lib/console-copy";
import { letterUnreadCountFromEvent } from "@/lib/letter";
import { CompanionSwitcher } from "@/components/companion-switcher";
import { relationshipCopy } from "@/lib/relationship-copy";
import type { ConsoleFeature } from "@/lib/access";

const navigation = [
  { href: "/app", key: "today", icon: Home, plus: false },
  { href: "/memories", key: "about", icon: BookOpen, plus: false },
  { href: "/people", key: "people", icon: UsersRound, plus: false },
  { href: "/moments", key: "moments", icon: HeartHandshake, plus: true },
  { href: "/dreams", key: "dreams", icon: CloudMoon, plus: true },
  { href: "/letters", key: "letters", icon: Mail, plus: true },
  { href: "/insights", key: "insights", icon: Network, plus: true },
  { href: "/settings", key: "settings", icon: Settings, plus: false },
] as const;

const lockedRoutes: Record<string, Exclude<ConsoleFeature, "today" | "about" | "people">> = {
  "/moments": "moments",
  "/dreams": "dreams",
  "/letters": "letters",
  "/insights": "insights",
};

const mobileLabels = {
  en: { today: "Today", about: "About", people: "People", moments: "Moments", dreams: "Dreams", letters: "Letters", insights: "Analysis", settings: "Settings" },
  zh: { today: "今天", about: "关于你", people: "人物", moments: "瞬间", dreams: "梦境", letters: "信件", insights: "分析", settings: "设置" },
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
  const membership = useMembership();
  const copy = consoleCopy[locale];
  const relationship = relationshipCopy[locale];
  const [unreadLetters, setUnreadLetters] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const userId = session?.user.id;
  const lockedFeature = Object.entries(lockedRoutes).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1];
  const showLock = Boolean(lockedFeature && membership.tier === "free" && !membership.loading);

  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [moreOpen]);

  useEffect(() => {
    let cancelled = false;
    let eventVersion = 0;
    const controller = new AbortController();
    const update = (event: Event) => {
      const count = letterUnreadCountFromEvent((event as CustomEvent<unknown>).detail);
      if (count === null) return;
      eventVersion += 1;
      setUnreadLetters(count > 0);
    };
    window.addEventListener("amara:letters-unread", update);

    if (!userId || membership.tier === "free") {
      setUnreadLetters(false);
    } else {
      const versionAtStart = eventVersion;
      fetch("/api/letters/unread-count", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json() as { unreadCount?: unknown };
          if (!cancelled && versionAtStart === eventVersion && typeof data.unreadCount === "number") setUnreadLetters(data.unreadCount > 0);
        })
        .catch(() => { /* Optional unread state never blocks the shell. */ });
    }
    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener("amara:letters-unread", update);
    };
  }, [userId, membership.tier]);

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
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#6e685f]">{relationship.tagline}</p>
          <Link href={`/login?redirect=${encodeURIComponent(pathname || "/app")}`} className="mt-8 inline-flex min-h-12 w-full items-center justify-center bg-[#a34f3d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] sm:w-auto">
            {locale === "zh" ? "登录" : "Sign in"}
          </Link>
        </div>
      </main>
    );
  }

  const renderLink = ({ href, key, icon: Icon, plus }: (typeof navigation)[number], mobile = false) => {
    const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
    const locked = Boolean(plus && membership.tier === "free");
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={mobile
          ? `relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 text-[10px] ${active ? "text-[#923f30]" : "text-[#756f66]"}`
          : `flex min-h-11 items-center gap-3 border-l-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f3d] ${active ? "border-[#a34f3d] bg-[#ebe2d7] font-semibold text-[#813d30]" : "border-transparent text-[#6e685f] hover:bg-[#ece5db] hover:text-[#282621]"}`}
      >
        <span className={mobile ? "relative" : "contents"}>
          <Icon className={mobile ? "h-[19px] w-[19px]" : "h-[17px] w-[17px] shrink-0"} strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
          {key === "letters" && unreadLetters && mobile && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#b64f43]" aria-label={copy.nav.unread} />}
        </span>
        <span className={mobile ? "max-w-full truncate px-0.5" : "leading-5"}>{mobile ? mobileLabels[locale][key] : key === "insights" ? relationship.lockedFeatures.insights.title : copy.nav[key]}</span>
        {locked && <LockKeyhole className={mobile ? "absolute right-1 top-2 h-3 w-3 text-[#a38d7d]" : "ml-auto h-3.5 w-3.5 text-[#a38d7d]"} aria-label={relationship.plusBadge} />}
        {key === "letters" && !mobile && <LetterDot show={unreadLetters} label={copy.nav.unread} />}
      </Link>
    );
  };

  const primaryMobile = navigation.filter((item) => ["today", "about", "people", "insights"].includes(item.key));
  const moreItems = navigation.filter((item) => ["moments", "dreams", "letters", "settings"].includes(item.key));

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#282621]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-[#ded7cc] bg-[#f3eee6] px-6 py-8 md:flex">
        <Wordmark />
        <p className="mt-3 max-w-44 text-xs leading-5 text-[#817a70]">{relationship.tagline}</p>
        <div className="mt-5"><CompanionSwitcher compact /></div>
        <nav className="mt-7 space-y-1" aria-label="Main navigation">{navigation.map((item) => renderLink(item))}</nav>
        <div className="mt-auto pt-6">
          {membership.tier === "free" && <Link href="/pricing" className="mb-4 flex min-h-11 items-center justify-between border-y border-[#d8cfc2] py-3 text-xs font-semibold text-[#923f30] hover:text-[#6f3025]">{relationship.upgrade}<ArrowRight className="h-4 w-4" /></Link>}
          <div className="border-t border-[#ded7cc] pt-5 text-xs leading-5 text-[#817a70]"><LocaleToggle className="!min-h-9 !px-0 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" /></div>
        </div>
      </aside>

      <header className="flex h-16 items-center justify-between border-b border-[#ded7cc] bg-[#f8f5ef] px-5 md:hidden"><Wordmark /><LocaleToggle className="!min-h-9 !px-1 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d]" /></header>
      <div className="border-b border-[#ded7cc] bg-[#f8f5ef] px-5 py-2 text-center md:hidden"><CompanionSwitcher compact /></div>

      <main className="pb-28 md:pb-12 md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          {showLock && lockedFeature ? <FeatureLock feature={lockedFeature} /> : children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#d8d0c4] bg-[#fffdf8] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden" aria-label="Mobile navigation">
        {primaryMobile.map((item) => renderLink(item, true))}
        <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className={`flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] ${moreItems.some((item) => pathname.startsWith(item.href)) ? "text-[#923f30]" : "text-[#756f66]"}`}><Menu className="h-[19px] w-[19px]" /><span>{relationship.more}</span></button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#282621]/35 md:hidden" role="dialog" aria-modal="true" aria-label={relationship.more} onClick={() => setMoreOpen(false)}>
          <div className="w-full bg-[#f8f5ef] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><p className="font-serif text-2xl">{relationship.more}</p><button type="button" onClick={() => setMoreOpen(false)} aria-label={relationship.closeMore} className="flex min-h-11 min-w-11 items-center justify-center"><X className="h-5 w-5" /></button></div>
            <nav className="grid grid-cols-2 gap-2">{moreItems.map((item) => renderLink(item))}</nav>
            {membership.tier === "free" && <Link href="/pricing" className="mt-5 flex min-h-12 items-center justify-center gap-2 bg-[#a34f3d] px-5 text-sm font-semibold text-white">{relationship.upgrade}<ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureLock({ feature }: { feature: Exclude<ConsoleFeature, "today" | "about" | "people"> }) {
  const { locale } = useLocale();
  const copy = relationshipCopy[locale];
  const featureCopy = copy.lockedFeatures[feature];
  return (
    <section className="mx-auto max-w-3xl py-8 sm:py-14">
      <LockKeyhole className="h-8 w-8 text-[#a34f3d]" strokeWidth={1.35} aria-hidden="true" />
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.lockEyebrow}</p>
      <h1 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{featureCopy.title}</h1>
      <p className="mt-5 max-w-2xl font-serif text-2xl leading-9 text-[#51483f]">{featureCopy.body}</p>
      <p className="mt-6 max-w-2xl text-base leading-7 text-[#6e685f]">{copy.lockBody}</p>
      <ul className="mt-8 divide-y divide-[#ded7cc] border-y border-[#ded7cc]">
        {copy.lockPoints.map((point) => <li key={point} className="flex items-center gap-3 py-4 text-sm text-[#49453e]"><Check className="h-4 w-4 shrink-0 text-[#a34f3d]" />{point}</li>)}
      </ul>
      <Link href={`/pricing?from=${feature}`} className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 bg-[#a34f3d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a34f3d] sm:w-auto">{copy.upgrade}<ArrowRight className="h-4 w-4" /></Link>
    </section>
  );
}
