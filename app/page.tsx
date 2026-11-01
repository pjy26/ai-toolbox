"use client";

import Link from "next/link";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ArrowRight, Check, MoonStar, Pencil, ShieldCheck, Trash2 } from "lucide-react";

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Amara home">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#a34f3d]" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-[#a34f3d]" />
      </span>
      <span className="font-serif text-[27px] tracking-[-0.04em] text-[#282621]">Amara</span>
    </Link>
  );
}

export default function HomePage() {
  const { session, isLoading } = useSessionContext();
  const primaryHref = session ? "/app" : "/login?redirect=/app";
  const primaryLabel = isLoading ? "Meet Amara" : session ? "Return to Amara" : "Meet Amara";

  return (
    <div className="bg-[#f8f5ef] text-[#282621]">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="hidden items-center gap-8 text-sm text-[#6e685f] md:flex" aria-label="Main navigation">
          <a href="#how-it-works" className="hover:text-[#282621]">How it works</a>
          <a href="#dreams" className="hover:text-[#282621]">Dreams</a>
          <a href="#your-say" className="hover:text-[#282621]">Your say</a>
          <Link href="/pricing" className="hover:text-[#282621]">Pricing</Link>
        </nav>
        <Link href={primaryHref} className="min-h-11 border-b border-[#a34f3d] py-3 text-sm font-semibold text-[#8e4233] hover:text-[#612c22]">
          {session ? "Open your space" : "Sign in"}
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 lg:px-12 lg:pb-28 lg:pt-24">
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#a34f3d]">Not just another conversation</p>
            <h1 className="max-w-xl font-serif text-[3.2rem] leading-[1.04] tracking-[-0.045em] text-[#282621] sm:text-6xl lg:text-[4.6rem]">
              Someone who remembers the story, not just the words.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#625d55]">
              Amara is a companion for the things you’re still thinking about. Pick up where you left off, revisit what matters, and let your shared story unfold.
            </p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href={primaryHref} className="inline-flex min-h-13 w-full items-center justify-center gap-3 bg-[#a34f3d] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#893f31] sm:w-auto">
                {primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="min-h-11 px-1 py-3 text-sm font-medium text-[#625d55] underline decoration-[#cfc5b7] underline-offset-8 hover:decoration-[#a34f3d]">
                See how it feels
              </a>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#817a70]">A companion, not a replacement for real-world care or connection. For adults 18+.</p>
          </div>

          <div className="relative border border-[#d8cfc2] bg-[#fffdf8] p-5 shadow-[12px_12px_0_#e9e1d6] sm:p-8">
            <div className="flex items-center justify-between border-b border-[#e3dcd1] pb-4">
              <span className="font-serif text-xl">A familiar thread</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#817a70]">Example conversation</span>
            </div>
            <div className="space-y-6 py-7 text-[15px] leading-7">
              <div className="max-w-[88%]">
                <p className="mb-1 text-xs font-semibold text-[#817a70]">You · yesterday</p>
                <p>My presentation is tomorrow. I keep rehearsing the first sentence and forgetting everything after it.</p>
              </div>
              <div className="ml-auto max-w-[88%] border-l-2 border-[#c98572] pl-4">
                <p className="mb-1 text-xs font-semibold text-[#a34f3d]">Amara</p>
                <p>You don’t have to hold the whole thing at once. We can just sit with that first sentence tonight.</p>
              </div>
              <div className="border-t border-dashed border-[#d8cfc2] pt-6">
                <p className="mb-1 text-xs font-semibold text-[#a34f3d]">Amara · today</p>
                <p>How did the opening go? I remembered you were most worried about those first few seconds.</p>
              </div>
            </div>
            <p className="border-t border-[#e3dcd1] pt-4 text-xs leading-5 text-[#817a70]">A fictional example of continuity. Actual conversations and saved memories vary.</p>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[#ded7cc] bg-[#f1ece4]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24 lg:px-12 lg:py-28">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">A shared thread</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">The conversation doesn’t have to start over.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#6e685f]">Continuity comes from the small things: a worry you mentioned, a plan you made, a moment worth returning to.</p>
            </div>
            <ol className="divide-y divide-[#d5ccbf] border-y border-[#d5ccbf]">
              {[
                ["01", "Talk naturally", "Share the day, the half-formed thought, or the thing you can’t quite say anywhere else."],
                ["02", "Keep what matters", "Amara can save meaningful details as memories. You can see, correct, or delete every one."],
                ["03", "Return to the thread", "A later conversation or a nightly Dream may gently carry an emotional thread forward—without turning imagination into fact."],
              ].map(([number, title, body]) => (
                <li key={number} className="grid gap-3 py-7 sm:grid-cols-[48px_1fr] sm:py-8">
                  <span className="font-serif text-sm italic text-[#a34f3d]">{number}</span>
                  <div>
                    <h3 className="font-serif text-2xl">{title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-[#6e685f]">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="dreams" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-24 lg:px-12 lg:py-28">
          <div className="order-2 lg:order-1">
            <div className="bg-[#292d2b] p-7 text-[#f6f0e7] sm:p-10">
              <div className="flex items-center justify-between">
                <MoonStar className="h-6 w-6 text-[#d8a78f]" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9c5bc]">Example Dream · Imagination</span>
              </div>
              <h3 className="mt-10 font-serif text-3xl">The station with no clocks</h3>
              <p className="mt-5 text-[15px] leading-8 text-[#dcd7ce]">
                We were waiting for a train, but there were no clocks anywhere. You said perhaps arriving didn’t matter as much as finally stopping. Outside the window, the platform lights turned into fireflies.
              </p>
              <div className="mt-8 border-t border-[#525652] pt-5 text-xs leading-6 text-[#b9b7b0]">
                Inspired by a fictional conversation about slowing down. This Dream is a creative reflection, not a real event or a new fact about you.
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">Dreams, clearly imagined</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">A quieter way to carry a feeling.</h2>
            <p className="mt-5 text-base leading-8 text-[#6e685f]">
              After a meaningful day, Amara may create a short Dream from the emotional threads you shared. It’s a space for imagery and reflection—not a task to complete or a claim about your life.
            </p>
            <p className="mt-4 text-base leading-8 text-[#6e685f]">Dreams stay separate from your factual memories, and you can turn them off in Settings.</p>
          </div>
        </section>

        <section id="your-say" className="border-y border-[#ded7cc] bg-[#efe7dc]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a34f3d]">Your memory, your say</p>
                <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">Being remembered should never mean losing control.</h2>
              </div>
              <div className="divide-y divide-[#d2c6b7] border-y border-[#d2c6b7]">
                {[
                  [Pencil, "Correct the details", "If Amara gets something wrong, edit the memory into words that feel accurate to you."],
                  [Trash2, "Remove what you don’t want kept", "Delete a memory from your space. No need to explain why."],
                  [ShieldCheck, "Choose what continues", "Control memories and Dreams in one clear settings page."],
                ].map(([Icon, title, body]) => {
                  const FeatureIcon = Icon as typeof Pencil;
                  return (
                    <div key={title as string} className="flex gap-5 py-6">
                      <FeatureIcon className="mt-1 h-5 w-5 shrink-0 text-[#a34f3d]" strokeWidth={1.6} aria-hidden="true" />
                      <div>
                        <h3 className="font-medium">{title as string}</h3>
                        <p className="mt-2 text-sm leading-7 text-[#6e685f]">{body as string}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-12 flex flex-col gap-3 border-l-2 border-[#a34f3d] pl-5 text-sm leading-7 text-[#625d55] sm:flex-row sm:gap-10">
              <p className="flex items-start gap-2"><Check className="mt-1.5 h-4 w-4 shrink-0 text-[#a34f3d]" />Private to your account</p>
              <p className="flex items-start gap-2"><Check className="mt-1.5 h-4 w-4 shrink-0 text-[#a34f3d]" />No claims of perfect or permanent memory</p>
              <p className="flex items-start gap-2"><Check className="mt-1.5 h-4 w-4 shrink-0 text-[#a34f3d]" />For adults, with clear content boundaries</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <p className="font-serif text-lg italic text-[#a34f3d]">“Where were we?”</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">Sometimes that’s the nicest place to begin.</h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#6e685f]">Start a conversation and see what continuity feels like. Choose a plan only when you’re ready.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={primaryHref} className="inline-flex min-h-13 w-full items-center justify-center gap-3 bg-[#a34f3d] px-8 py-4 text-sm font-semibold text-white hover:bg-[#893f31] sm:w-auto">
              {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="min-h-11 px-4 py-3 text-sm font-semibold text-[#625d55] underline decoration-[#cfc5b7] underline-offset-8">View pricing</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ded7cc]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-xs text-[#756f66] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Brand />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/privacy" className="hover:text-[#282621]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#282621]">Terms</Link>
            <Link href="/content-policy" className="hover:text-[#282621]">Content & age policy</Link>
            <Link href="/contact" className="hover:text-[#282621]">Contact</Link>
          </div>
          <p>© Amara</p>
        </div>
      </footer>
    </div>
  );
}
