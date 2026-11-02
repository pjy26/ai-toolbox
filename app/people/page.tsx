"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { ChevronDown, ChevronUp, UserRound, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ErrorState, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";

type Person = { id: string; name: string; details: Array<[string, string]> };
type CompanionWithProfile = { id: string; profile?: { important_people?: unknown } | null };

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("、");
  return "";
}

function normalizePeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index): Person | null => {
    if (typeof raw === "string") return raw.trim() ? { id: `${index}-${raw}`, name: raw.trim(), details: [] } : null;
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const name = text(record.name ?? record.姓名 ?? record.名字 ?? record.nickname ?? record.relation ?? record.关系);
    if (!name) return null;
    const details = Object.entries(record)
      .filter(([key]) => !["name", "姓名", "名字", "nickname"].includes(key))
      .map(([key, item]) => [key, text(item)] as [string, string])
      .filter(([, item]) => item);
    return { id: `${index}-${name}`, name, details };
  }).filter((person): person is Person => Boolean(person));
}

export default function PeoplePage() {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = consoleCopy[locale].people;
  const [people, setPeople] = useState<Person[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ companions: CompanionWithProfile[] }>("/api/companion/list");
      setPeople(normalizePeople(result.companions?.[0]?.profile?.important_people));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const labels: Record<string, string> = locale === "zh"
    ? { relation: "关系", relationship: "关系", description: "关于这个人", notes: "记得的事", birthday: "生日", personality: "性格", 关系: "关系", 描述: "关于这个人", 备注: "记得的事" }
    : { relation: "Relationship", relationship: "Relationship", description: "About them", notes: "Remembered", birthday: "Birthday", personality: "Personality", 关系: "Relationship", 描述: "About them", 备注: "Remembered" };

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : people.length === 0 ? (
        <div className="py-16 sm:py-20"><UsersRound className="h-8 w-8 text-[#a98a78]" strokeWidth={1.3} /><h2 className="mt-5 font-serif text-3xl">{copy.emptyTitle}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{copy.emptyBody}</p></div>
      ) : (
        <div className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => {
            const open = openId === person.id;
            return (
              <article key={person.id} className={`border bg-[#fffdf8] transition-colors ${open ? "border-[#b9917f] sm:col-span-2 lg:col-span-2" : "border-[#ded7cc]"}`}>
                <button type="button" onClick={() => setOpenId(open ? null : person.id)} aria-expanded={open} className="flex min-h-24 w-full items-center justify-between gap-4 px-5 py-5 text-left">
                  <span className="flex min-w-0 items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0e4d8] text-[#94513f]"><UserRound className="h-5 w-5" strokeWidth={1.5} /></span><span className="truncate font-serif text-2xl text-[#37332d]">{person.name}</span></span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[#817a70]">{open ? copy.close : copy.open}{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                </button>
                {open && (
                  <div className="border-t border-[#e7ddd2] bg-[#f8f1e9] px-6 py-6">
                    {person.details.length ? <dl className="space-y-4">{person.details.map(([key, value]) => <div key={key}><dt className="text-xs font-semibold uppercase tracking-[0.13em] text-[#94513f]">{labels[key] || key.replaceAll("_", " ")}</dt><dd className="mt-1 text-sm leading-7 text-[#49453e]">{value}</dd></div>)}</dl> : <p className="text-sm leading-7 text-[#625d55]">{copy.detailFallback}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
