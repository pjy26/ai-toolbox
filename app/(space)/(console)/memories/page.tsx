"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { useConsoleKey, useConsoleQuery } from "@/components/console-query";
import { BookOpen, Check, Trash2 } from "lucide-react";
import { apiRequest, ConfirmDialog, ErrorState, formatDate, Memory, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";
import { consoleCopy } from "@/lib/console-copy";
import { displayMemoryText } from "@/lib/memory-display";

export default function MemoriesPage() {
  const { mutate } = useSWRConfig();
  const homeKey = useConsoleKey("/api/app/home");
  const { locale } = useLocale();
  const copy = consoleCopy[locale].memories;
  const { data, loading, errorMessage: error, mutate: load } = useConsoleQuery<{ memories: Memory[] }>("/api/memories");
  const memories = data?.memories || [];
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [editing,setEditing] = useState<Memory | null>(null);
  const [draft,setDraft] = useState("");
  const [saving,setSaving] = useState(false);
  const [evidence,setEvidence] = useState<{id:string;text:string;history:Array<{revision:number;summary:string}>} | null>(null);

  async function showSource(memory:Memory) {
    try {
      const {source,history} = await apiRequest<{history:Array<{revision:number;summary:string}>;source:null | {text:string;at:string}}>("/api/memories/"+encodeURIComponent(memory.id));
      setEvidence({id:memory.id,history:history || [],text:source ? formatDate(source.at,true,locale)+" · "+source.text : (locale==="zh"?"没有可核实的原文":"No verified source available")});
    } catch { setActionError(copy.failed); }
  }

  async function saveCorrection() {
    if (!editing || !draft.trim() || saving) return;
    const target = editing;
    const correctedText = draft.trim();
    setSaving(true);
    setActionError("");
    // Optimistic editing keeps the reading flow immediate; server truth is restored on failure.
    setEditing(null);
    setEvidence(null);
    setSelected(new Set());
    void load((current) => current && {
      memories: current.memories.map((memory) => memory.id === target.id
        ? { ...memory, summary: correctedText, provenance: "user_edit" }
        : memory),
    }, { revalidate: false });
    try {
      await apiRequest("/api/memories/"+encodeURIComponent(target.id),{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:correctedText,revision:target.revision,updated_at:target.updated_at})});
      // A legacy profile field can acquire a new ID. Drop the old home preview.
      await mutate(homeKey,undefined,{revalidate:false});
      await load();
    } catch {
      setActionError(locale==="zh"?"未能保存。请重新打开这条记忆，核对最新内容后再试。":"Could not save. Reopen the memory and check its latest wording.");
      await load();
    } finally {setSaving(false);}
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function removeMemories(ids: string[]) {
    if (!ids.length || deleteBusy) return;
    setDeleteBusy(true);
    setActionError("");
    const requested = new Set(ids);
    const keepRequested = (memory: Memory) => !requested.has(memory.id);
    setSelected(new Set());
    setDeleting(null);
    setBulkDeleting(false);
    // Remove immediately, then reconcile with the server so failed writes reappear.
    void load((current) => current && { memories: current.memories.filter(keepRequested) }, { revalidate: false });
    void mutate(homeKey, (current?: { recentMemories: Memory[] }) => current && { ...current, recentMemories: current.recentMemories.filter(keepRequested) }, { revalidate: false });
    const removed = new Set<string>();
    // Sequential writes prevent two profile deletions from overwriting each other.
    for (const id of ids) {
      try {
        const memory=memories.find(item=>item.id===id);
        await apiRequest(`/api/memories/${encodeURIComponent(id)}`, {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:memory?.revision,expectedValue:memory?.expectedValue})});
        removed.add(id);
      } catch { /* Failed items are restored by revalidation below. */ }
    }
    await Promise.all([load(), mutate(homeKey)]);
    if (removed.size !== ids.length) setActionError(copy.failed);
    setDeleteBusy(false);
  }

  const allSelected = memories.length > 0 && selected.size === memories.length;

  return (
    <>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">{copy.body}</p>
      </header>

      {actionError && <div className="mt-6 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{actionError}</div>}

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : memories.length === 0 ? (
        <div className="py-16 sm:py-20"><BookOpen className="h-7 w-7 text-[#a98a78]" strokeWidth={1.4} /><h2 className="mt-5 font-serif text-3xl">{copy.emptyTitle}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#6e685f]">{copy.emptyBody}</p></div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded7cc] py-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#625d55]">
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(memories.map((memory) => memory.id)))} className="h-4 w-4 accent-[#9e4837]" />
              {copy.select} · {memories.length} {copy.count}
            </label>
            <button type="button" disabled={!selected.size} onClick={() => setBulkDeleting(true)} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] px-4 text-sm font-medium text-[#9e4837] micro-lift rounded-[10px] hover:bg-[#f6eae4] disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 className="h-4 w-4" />{copy.deleteSelected}{selected.size > 0 && ` (${selected.size})`}
            </button>
          </div>
          <ul className="divide-y divide-[#e4ddd3]">
            {memories.map((memory) => {
              const displayText = displayMemoryText(memory.summary, locale);
              return (
              <li key={memory.id} className={`py-5 transition-colors sm:px-4 ${selected.has(memory.id) ? "bg-[#f3ebe2]" : ""}`}>
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => toggle(memory.id)} aria-label={`${copy.select}: ${displayText}`} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center border ${selected.has(memory.id) ? "border-[#9e4837] bg-[#9e4837] text-white" : "border-[#cfc5b7] bg-[#fffdf8]"}`}>
                    {selected.has(memory.id) && <Check className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-7 text-[#37332d]">{displayText}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#817a70]"><span>{memory.source_session_id ? copy.fromChat : copy.saved}</span><span>{copy.updated} {formatDate(memory.updated_at || memory.created_at, false, locale)}</span></div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#6e574d]">
                      <span>{memory.provenance==="user_edit" ? (locale==="zh"?"由你纠正":"Corrected by you") : memory.source_message_id ? (locale==="zh"?"来自你的原话":"From your words") : (locale==="zh"?"历史记录 · 无逐条原文":"Legacy record · no verified quote")}</span>
                      {(memory.source_message_id || (memory.revision || 1)>1) && <button className="underline" onClick={()=>void showSource(memory)}>{locale==="zh"?"来源与版本":"Source and history"}</button>}
                      <button className="underline" onClick={()=>{setEditing(memory);setDraft(memory.summary);}}>{locale==="zh"?"纠正":"Correct"}</button>
                    </div>
                    {evidence?.id===memory.id && <blockquote className="mt-2 border-l-2 pl-3 text-sm">{evidence.text}
                      {evidence.history.length>0 && <ol className="mt-2 space-y-1">{evidence.history.map(v=><li key={v.revision}>{locale==="zh"?"旧版本":"Previous version"} {v.revision} · {v.summary}</li>)}</ol>}
                    </blockquote>}
                    {editing?.id===memory.id && <form className="mt-3 space-y-2" onSubmit={e=>{e.preventDefault();void saveCorrection();}}>
                      <textarea aria-label={locale==="zh"?"纠正后的记忆":"Corrected memory"} maxLength={1000} required value={draft} onChange={e=>setDraft(e.target.value)} className="block w-full border p-2" />
                      <button className="mr-4 underline" disabled={saving || !draft.trim()}>{locale==="zh"?"保存":"Save"}</button>
                      <button type="button" disabled={saving} onClick={()=>setEditing(null)}>{locale==="zh"?"取消":"Cancel"}</button>
                    </form>}
                  </div>
                  <button type="button" onClick={() => setDeleting(memory)} className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-medium text-[#9e4837] micro-lift rounded-[10px] hover:bg-[#f6eae4]" aria-label={`${copy.delete}: ${displayText}`}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">{copy.delete}</span></button>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {deleting && <ConfirmDialog title={copy.deleteTitle} description={`“${displayMemoryText(deleting.summary, locale)}”\n${copy.deleteBody}`} confirmLabel={copy.deleteConfirm} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={() => void removeMemories([deleting.id])} />}
      {bulkDeleting && <ConfirmDialog title={copy.bulkTitle} description={`${selected.size} ${copy.selected}。${copy.bulkBody}`} confirmLabel={copy.bulkConfirm} busy={deleteBusy} onCancel={() => setBulkDeleting(false)} onConfirm={() => void removeMemories(Array.from(selected))} />}
    </>
  );
}
