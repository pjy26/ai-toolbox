"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, User, Crown, LogOut, ChevronRight, X } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { readSavedReply } from "@/lib/chat-reply";
import { chatCopy, fillCopy } from "@/lib/chat-copy";
import { formatUsd, SUPPORT_EMAIL } from "@/lib/membership-plans";
import { openWaffoCheckout } from "@/lib/waffo-browser";
import { useCompanionSpace } from "@/components/companion-space";
import { CompanionSwitcher } from "@/components/companion-switcher";
import { trackProductEvent } from "@/lib/product-events";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface Companion {
  id: string;
  relationship_type: "friend" | "lover";
  companion_name: string | null;
  user_nickname: string | null;
  persona?: string;
}

interface Quota {
  isMember: boolean;
  membershipType: string | null;
  expiresAt: string | null;
}

interface Plan {
  id: string;
  tier: "plus" | "premium";
  name: string;
  price: number;
  regularPrice?: number;
  period: string;
  popular: boolean;
  hint: string;
  available: boolean;
  autoRenew: boolean;
  offer?: "new_user_plus_trial";
}

function ChatInner() {
  const { session } = useSessionContext();
  const { locale, isReady: localeReady } = useLocale();
  const copy = chatCopy[locale];
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const userId = session?.user.id || null;
  const { profiles, reloadProfiles } = useCompanionSpace();
  const activeProfile = profiles?.companions.find((item) => item.id === profiles.activeCompanionId);
  const params = useSearchParams();
  // Amara is a romantic companion only; the friend variant has been removed.
  const role = "lover" as const;

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showMyDrawer, setShowMyDrawer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sendError,setSendError] = useState("");
  const sendingRef = useRef(false);
  const pendingRef = useRef<{fingerprint:string;id:string;session:string|null} | null>(null);
  const [greetingDone, setGreetingDone] = useState(false);
  const [showPaySuccess, setShowPaySuccess] = useState(false);
  const initRunRef = useRef(0);
  const typeWriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 支付成功回跳：刷新配额 + 显示成功提示（5 秒后自动消失）
  useEffect(() => {
    if (params.get("payment") === "success") {
      setShowPaySuccess(true);
      loadQuota();
      const t = setTimeout(() => setShowPaySuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (companion) void trackProductEvent("chat_opened", { companionId: companion.id, locale });
  }, [companion?.id]);

  useEffect(() => {
    if (showPaywall) void trackProductEvent("paywall_viewed", { companionId: companion?.id, locale });
  }, [showPaywall]);

  /* ── 初始化 ── */
  // 主动消息去重锁 + 当前 session 指针：均落 sessionStorage + companion_id 维度。
  // useRef 是组件实例内存锁，Suspense + useSearchParams 触发重挂载时会归零，
  // 导致 greeting 被反复请求、连发雷同消息。sessionStorage 跨组件实例持久，
  // 能扛住重挂载。生命周期 = tab 会话：
  //   - F5 刷新：不清 → greeting 锁命中、session 指针恢复 → 对话续上（正确）
  //   - 关 tab 重进：清空 → 锁失忆、重新发开场白 → 重新相遇（正确）
  // session 指针同理：重挂载后 useState 清空，需从 sessionStorage 恢复，
  // 否则只能退到 /sessions 取最近，有"刚新建空 session 排前面"的串台风险。
  const GREETING_KEY = (cid: string) => `amara_greeting_sent:${cid}`;
  const SESSION_KEY = (cid: string) => `amara_session:${cid}`;
  const init = useCallback(async () => {
    // 等设备选择或账号语言解析完成，再决定开场白语言。
    if (!localeReady) return;
    // 只允许最新一轮初始化更新界面。旧请求即使在新的会话之后才返回，
    // 也不能把旧消息铺进来，更不能让打字机继续写入新状态。
    const runId = ++initRunRef.current;
    const isCurrent = () => initRunRef.current === runId;
    if (typeWriterTimerRef.current) {
      clearTimeout(typeWriterTimerRef.current);
      typeWriterTimerRef.current = null;
    }
    setInitLoading(true);
    setCompanion(null);
    setMessages([]);
    setSessionId(null);
    setGreetingDone(false);

    // 无 session 的直接访问/登出不能卡在加载页。
    if (!userId) {
      if (isCurrent()) setInitLoading(false);
      return;
    }
    try {
      const qRes = await fetch("/api/companion/quota");
      const qData = qRes.ok ? await qRes.json() : null;
      if (!isCurrent()) return;
      if (qData) setQuota(qData);
      const c = activeProfile;

      if (!c) {
        // New accounts start with the independent female Amara profile.
        const createRes = await fetch("/api/companion/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relationship_type: role }),
        });
        if (!createRes.ok) throw new Error("Could not create Amara");
        await reloadProfiles();
        return;
      }
      setCompanion(c);
      // 先展示聊天框架，再恢复历史或生成开场白，避免长时间全屏加载。
      setInitLoading(false);

      // 去重锁命中：恢复本 tab 指向的同一会话历史。
      if (sessionStorage.getItem(GREETING_KEY(c.id))) {
        try {
          let lastSid = sessionStorage.getItem(SESSION_KEY(c.id));
          if (!lastSid) {
            const sRes = await fetch(`/api/companion/sessions?companion_id=${c.id}`);
            if (!isCurrent()) return;
            const sData = await sRes.json();
            if (!isCurrent()) return;
            lastSid = sData.sessions?.[0]?.id || null;
          }
          if (lastSid) {
            setSessionId(lastSid);
            const mRes = await fetch(`/api/companion/messages?session_id=${lastSid}`);
            if (!isCurrent()) return;
            if (mRes.ok) {
              const mData = await mRes.json();
              if (!isCurrent()) return;
              if (Array.isArray(mData.messages) && mData.messages.length > 0) {
                setMessages(mData.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
              }
            }
          }
        } catch (e) {
          if (isCurrent()) console.error(e);
        }
        if (isCurrent()) setGreetingDone(true);
      } else {
        sessionStorage.setItem(GREETING_KEY(c.id), "1");
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        // Provider 在挂载后才读取 localStorage；首个开场白直接读取同一键，避免中文选择被默认英文抢先覆盖。
        let storedLocale: string | null = null;
        try { storedLocale = window.localStorage.getItem("amara-locale"); } catch { /* use provider locale */ }
        const requestLocale = storedLocale === "zh" || storedLocale === "en" ? storedLocale : localeRef.current;
        const greetRes = await fetch(`/api/companion/greeting?companion_id=${encodeURIComponent(c.id)}&locale=${requestLocale}&timezone=${encodeURIComponent(timezone)}`);
        if (!isCurrent()) return;
        if (greetRes.ok) {
          const greetData = await greetRes.json();
          if (!isCurrent()) return;
          if (greetData.session_id) {
            setSessionId(greetData.session_id);
            sessionStorage.setItem(SESSION_KEY(c.id), greetData.session_id);
          }
          typeWriter(greetData.greeting, () => {
            if (isCurrent()) setGreetingDone(true);
          }, runId);
        } else {
          setGreetingDone(true);
        }
      }
    } catch (e) {
      if (!isCurrent()) return;
      console.error(e);
      setGreetingDone(true);
    } finally {
      if (isCurrent()) setInitLoading(false);
    }
  }, [userId, localeReady, role, activeProfile, reloadProfiles]);

  useEffect(() => {
    void init();
    return () => {
      initRunRef.current += 1;
      if (typeWriterTimerRef.current) {
        clearTimeout(typeWriterTimerRef.current);
        typeWriterTimerRef.current = null;
      }
    };
  }, [init]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages]);

  /* ── 打字机：保留出现节奏，但不让首句动画成为数秒的输入锁 ── */
  function typeWriter(text: string, onDone?: () => void, runId = initRunRef.current) {
    if (runId !== initRunRef.current) return;
    const msg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, msg]);
    let i = 0;
    const chunkSize = /[\u4e00-\u9fff]/.test(text) ? 2 : 4;
    function step() {
      if (runId !== initRunRef.current) return;
      if (i < text.length) {
        i = Math.min(text.length, i + chunkSize);
        setMessages((prev) => {
          const arr = [...prev];
          arr[arr.length - 1] = { ...arr[arr.length - 1], content: text.slice(0, i) };
          return arr;
        });
        const d = ["，", "。", "？", "！", "…", "、", ".", "?", "!"].includes(text.charAt(i - 1)) ? 40 : 18;
        typeWriterTimerRef.current = setTimeout(step, d);
      } else {
        typeWriterTimerRef.current = null;
        onDone?.();
      }
    }
    step();
  }

  /* ── 发送 ── */
  async function handleSend() {
    if (!input.trim() || !companion || sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);
    const text = input.trim();
    const key = "amara_pending:" + companion.id;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    const before = messages;
    setInput("");
    setSendError("");
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
      let pending = pendingRef.current;
      try { pending ||= JSON.parse(sessionStorage.getItem(key) || "null"); } catch { /* private browsing */ }
      const retry = pending?.fingerprint === fingerprint && (!pending.session || pending.session === sessionId);
      const id = retry && pending ? pending.id : crypto.randomUUID();
      const remember = (sid: string | null) => {
        pendingRef.current = {fingerprint,id,session:sid};
        try { sessionStorage.setItem(key,JSON.stringify(pendingRef.current)); } catch { /* use in-memory identity */ }
      };
      remember(sessionId);
      const base = retry && before.at(-1)?.role === "user" && before.at(-1)?.content === text ? before.slice(0,-1) : before;
      setMessages([...base,{role:"user",content:text},{role:"assistant",content:""}]);
      const response = await fetch("/api/companion",{
        method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,
        body:JSON.stringify({message:text,companion_id:companion.id,session_id:sessionId,client_turn_id:id,
          locale:localeRef.current,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}),
      });
      if (!response.ok || !response.body) {
        const problem = await response.json().catch(()=>({}));
        throw Error(problem.error || copy.errorGeneric);
      }
      const sid = response.headers.get("x-session-id");
      if (sid) {
        setSessionId(sid);
        remember(sid);
        try { sessionStorage.setItem(SESSION_KEY(companion.id),sid); } catch { /* session remains in memory */ }
      }
      const savedReply = await readSavedReply(response, copy.networkError, (_delta, accumulated) => {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role !== "assistant") return prev;
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: accumulated };
          return updated;
        });
      });
      const userMessageId = response.headers.get("x-user-message-id") || undefined;
      const replyId = response.headers.get("x-reply-message-id") || undefined;
      const confirmed = [...before];
      if (!userMessageId || !confirmed.some(message => message.id === userMessageId)) {
        confirmed.push({ id: userMessageId, role: "user", content: text });
      }
      if (!replyId || !confirmed.some(message => message.id === replyId)) {
        confirmed.push({ id: replyId, role: "assistant", content: savedReply });
      }
      setMessages(confirmed);
      pendingRef.current=null;
      try { sessionStorage.removeItem(key); } catch { /* private browsing */ }
    } catch (error) {
      setMessages(before);
      setInput(text);
      setSendError(error instanceof Error && error.name !== "AbortError" ? error.message : copy.networkError);
    } finally {
      clearTimeout(timeout);
      sendingRef.current=false;
      setLoading(false);
    }
  }

  const loadQuota = useCallback(async (): Promise<Quota | null> => {
    try {
      const r = await fetch("/api/companion/quota");
      if (!r.ok) return null;
      const data = await r.json() as Quota;
      setQuota(data);
      return data;
    } catch (error) {
      console.error("会员状态刷新失败:", error);
      return null;
    }
  }, []);

  if (!session) {
    return (
      <div className="flex h-screen h-[100dvh] items-center justify-center overflow-hidden px-6" style={{ background: "#F8F5EF" }}>
        <div className="w-full max-w-[720px] text-center" style={{ color: "#282621" }}>
          <p className="mb-6 text-lg leading-relaxed" style={{ letterSpacing: 2 }}>{copy.loginRequired}</p>
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl px-8 py-3 font-medium text-white transition duration-200 hover:-translate-y-px hover:bg-[#893F31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/20 active:scale-[0.98] motion-reduce:transform-none" style={{ letterSpacing: 2, background: "#A34F3D" }}>{copy.login}</Link>
        </div>
      </div>
    );
  }

  if (initLoading) return <ChatLoading />;

  return (
    <div className="relative flex h-screen h-[100dvh] min-w-0 flex-col overflow-hidden" style={{ background: "#F8F5EF" }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 60% 42% at 50% 100%, rgba(163,79,61,0.035) 0%, transparent 70%)" }} />

      {/* Header */}
      <header className="relative z-10 shrink-0 border-b border-[#DED7CC]/80 px-3 pb-2.5 pt-[max(10px,env(safe-area-inset-top))] sm:px-5 sm:pb-3 sm:pt-3" style={{ background: "rgba(248,245,239,0.82)", backdropFilter: "blur(20px) saturate(120%)", WebkitBackdropFilter: "blur(20px) saturate(120%)" }}>
        <div className="mx-auto grid w-full max-w-[720px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1 sm:gap-3">
          <Link href="/app" aria-label={copy.back} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-[#6E685F] no-underline transition duration-200 hover:-translate-y-px hover:bg-[#EEE9E1] hover:text-[#A34F3D] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/15 active:scale-[0.98] motion-reduce:transform-none">&lsaquo;</Link>
          <div className="flex min-w-0 items-center justify-center gap-2.5">
            <div className="relative h-9 w-9 shrink-0">
              <div className="h-9 w-9 rounded-full border border-[#D8C7B7]" style={{ background: "radial-gradient(circle at 35% 35%, #FFFDF8, #E7D6C7)", boxShadow: "0 3px 12px rgba(91,65,47,0.08)" }} />
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#F8F5EF] bg-[#6F8B5E] motion-reduce:!animate-none" style={{ boxShadow: "0 0 5px rgba(111,139,94,0.25)", animation: "statusPulse 3s ease-in-out infinite" }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight" style={{ letterSpacing: 2.5, color: "#282621" }}>Amara</div>
              <div className="mt-1 truncate text-[11px] font-light leading-tight" style={{ letterSpacing: 1, color: "#756F66" }}>
                {copy.loverTagline}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-0.5 sm:gap-2 [&_button]:min-h-11 [&_button]:min-w-11">
            <LocaleToggle />
            <button
              type="button"
              onClick={() => setShowMyDrawer(true)}
              aria-label={copy.myAccount}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#6E685F] transition duration-200 hover:-translate-y-px hover:bg-[#EEE9E1] hover:text-[#A34F3D] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/15 active:scale-[0.98] motion-reduce:transform-none"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mx-auto mt-1.5 w-full max-w-[720px] text-center sm:mt-2"><CompanionSwitcher compact /></div>
      </header>

      {/* 支付成功提示 */}
      {showPaySuccess && (
        <div className="relative z-10 px-4 py-2 text-center text-xs leading-relaxed" style={{ color: "#805A25", letterSpacing: 0.6, background: "#FFF1D6" }}>
          {copy.paymentSuccess}
        </div>
      )}

      {/* Free 方案说明：对话不限次数，其余差异见定价页 */}
      {quota && !quota.isMember && (
        <div className="relative z-10 flex min-h-11 flex-wrap items-center justify-center px-3 py-1 text-center text-xs leading-relaxed" style={{ color: "#6E685F", letterSpacing: 0.4, background: "rgba(241,236,228,0.88)" }}>
          <span>{copy.freePlanNote} · </span>
          <button
            type="button"
            onClick={() => setShowPaywall(true)}
            className="inline-flex min-h-11 items-center rounded-md px-1 font-medium text-[#A34F3D] underline underline-offset-[3px] transition-colors hover:text-[#893F31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A34F3D]/30"
          >
            {copy.loverMemberCta}
          </button>
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-8 pt-5 sm:px-6 sm:pt-7">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="my-5 flex items-center gap-4 motion-reduce:!animate-none sm:my-7" style={{ animation: "fadeIn 0.5s ease-out" }}>
            <span className="h-px flex-1 bg-[#DED7CC]/70" />
            <span className="text-[11px] font-light" style={{ color: "#817A70", letterSpacing: 1.5 }}>{copy.today}</span>
            <span className="h-px flex-1 bg-[#DED7CC]/70" />
          </div>

          <div className="space-y-8 sm:space-y-9">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const fadeFrom = Math.max(0, msg.content.length - 4);
              return (
                <article
                  key={i}
                  className={`flex min-w-0 flex-col motion-reduce:!animate-none ${isUser ? "items-end" : "items-start"}`}
                  style={{ animation: "msgIn 0.32s ease-out", animationDelay: `${Math.min(i, 8) * 0.02}s` }}
                >
                  <div className={`mb-2 flex items-center gap-1.5 text-[11px] leading-none ${isUser ? "pr-1 text-[#817A70]" : "pl-0 text-[#756F66]"}`} style={{ letterSpacing: 0.8 }}>
                    <span className={isUser ? "font-normal" : "font-medium text-[#5F5951]"}>{isUser ? (locale === "zh" ? "你" : "You") : "Amara"}</span>
                    <span aria-hidden="true" className="opacity-50">·</span>
                    <span>{copy.justNow}</span>
                  </div>
                  <div
                    className={isUser
                      ? "max-w-[88%] rounded-[14px] bg-[#ECE8E1] px-4 py-3 text-[#413D37] sm:max-w-[560px] sm:px-[18px]"
                      : "w-full max-w-[68ch] bg-transparent py-0.5 text-[#37332D]"}
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {msg.content ? (
                      <p className={`whitespace-pre-wrap break-words ${isUser ? "text-[15px] leading-[1.75]" : "text-base leading-[1.85] sm:text-[17px]"}`} style={{ letterSpacing: 0.15 }}>
                        {msg.content.slice(0, fadeFrom)}
                        <span key={`stream-${i}-${msg.content.length}`} className="motion-reduce:!animate-none" style={{ animation: "fadeIn 0.24s ease-out" }}>
                          {msg.content.slice(fadeFrom)}
                        </span>
                      </p>
                    ) : msg.role === "assistant" ? (
                      <div className="flex h-7 items-center gap-2" role="status" aria-label={locale === "zh" ? "Amara 正在思考" : "Amara is thinking"}>
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="h-2 w-2 rounded-full bg-[#B87964] opacity-40 animate-pulse motion-reduce:!animate-none"
                            style={{ animationDelay: `${dot * 0.24}s`, animationDuration: "1.8s" }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {sendError && <p role="alert" className="relative z-10 mx-auto w-full max-w-[720px] px-5 py-2 text-center text-sm leading-relaxed text-red-800">{sendError}</p>}
      {/* 输入框 */}
      <div className="relative z-10 shrink-0 border-t border-[#DED7CC]/70 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-[max(18px,env(safe-area-inset-bottom))] sm:pt-4" style={{ background: "rgba(241,236,228,0.88)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <div className="pointer-events-none absolute -top-5 left-0 right-0 h-5" style={{ background: "linear-gradient(180deg, transparent, rgba(241,236,228,0.88))" }} />
        <div className="mx-auto flex w-full max-w-[720px] items-center rounded-[22px] border border-[#D8CFC2] bg-[#FFFDF8] shadow-[0_4px_20px_rgba(91,65,47,0.05)] transition duration-200 focus-within:border-[#B87964] focus-within:ring-4 focus-within:ring-[#A34F3D]/10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={copy.inputPlaceholder}
            disabled={!greetingDone}
            className="h-12 min-w-0 flex-1 rounded-l-[22px] bg-transparent px-4 text-base font-light leading-6 text-[#282621] outline-none placeholder:text-[#91887D] disabled:cursor-not-allowed sm:px-5"
            style={{ opacity: greetingDone ? 1 : 0.55 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim() || !greetingDone}
            aria-label={copy.send}
            className="mr-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#A34F3D] bg-[#A34F3D] text-[#FFFDF8] transition duration-200 hover:-translate-y-px hover:bg-[#893F31] hover:shadow-[0_5px_16px_rgba(163,79,61,0.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-[#A34F3D] disabled:hover:shadow-none disabled:active:scale-100 motion-reduce:transform-none"
            style={{ opacity: loading || !input.trim() || !greetingDone ? 0.4 : 1 }}
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className="mx-auto mt-2 w-full max-w-[720px] text-center text-[11px] font-light" style={{ color: "#817A70", letterSpacing: 0.3, lineHeight: 1.5 }}>
          {copy.aiDisclosure} · {copy.replyLanguage}
        </p>
      </div>

      {/* 付费墙 */}
      {showPaywall && <Paywall onClose={() => { setShowPaywall(false); loadQuota(); }} />}

      {/* "我的" 抽屉 */}
      {showMyDrawer && (
        <MyDrawer
          quota={quota}
          companion={companion}
          onNicknameSaved={(nick) => setCompanion((prev) => (prev ? { ...prev, user_nickname: nick } : prev))}
          onClose={() => setShowMyDrawer(false)}
          onShowPaywall={() => { setShowMyDrawer(false); setShowPaywall(true); }}
        />
      )}
    </div>
  );
}

/* ── "我的" 抽屉 ── */
function MyDrawer({ quota, companion, onNicknameSaved, onClose, onShowPaywall }: {
  quota: Quota | null;
  companion: Companion | null;
  onNicknameSaved: (nick: string) => void;
  onClose: () => void;
  onShowPaywall: () => void;
}) {
  const { supabaseClient } = useSessionContext();
  const { locale } = useLocale();
  const copy = chatCopy[locale];
  const accent = "#A34F3D";
  const accentRgb = "163, 79, 61";
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const [nickError, setNickError] = useState("");

  const startEditNick = () => {
    setNickInput(companion?.user_nickname || "");
    setNickError("");
    setEditingNick(true);
  };

  const saveNick = async () => {
    const nick = nickInput.trim();
    if (!companion || savingNick) return;
    if (nick.length < 1 || nick.length > 12) {
      setNickError(copy.nicknameLength);
      return;
    }
    setSavingNick(true);
    setNickError("");
    try {
      const res = await fetch("/api/companion/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companion.id, user_nickname: nick }),
      });
      if (!res.ok) throw new Error();
      onNicknameSaved(nick);
      setEditingNick(false);
    } catch {
      setNickError(copy.saveFailed);
    } finally {
      setSavingNick(false);
    }
  };

  const handleLogout = async () => {
    // 清理 amara_* sessionStorage：现在里面存的是真实 session 指针（用户作用域数据），
    // 换号登录后残留会指向别人的会话。封板该清干净，不靠后端 404 兜底。
    try {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("amara_"));
      keys.forEach((k) => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
    await supabaseClient.auth.signOut();
    // 跳 /?logged_out=1：首页 useEffect 检测到此 query 直接 return，跳过自动跳 /chat 逻辑。
    // 不赌 onAuthStateChange 异步清 session 的窗口期，用显式标志一刀切死弹回链路。
    window.location.href = "/?logged_out=1";
  };

  const membershipLabel = () => {
    if (!quota) return copy.memberLoading;
    if (!quota.isMember) return copy.free;
    const typeMap: Record<string, string> = copy.planNames;
    const typeName = typeMap[quota.membershipType || ""] || quota.membershipType || copy.active;
    if (quota.expiresAt) {
      const d = new Date(quota.expiresAt);
      const date = locale === "zh" ? `${d.getMonth() + 1}/${d.getDate()}` : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d);
      return `${typeName} · ${fillCopy(copy.until, { date })}`;
    }
    return typeName;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(40,38,33,0.25)", backdropFilter: "blur(4px)" }} onClick={onClose} role="dialog" aria-modal="true" aria-label={copy.myAccount}>
      <div
        className="flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto overflow-x-hidden motion-reduce:!animate-none"
        style={{ background: "#F8F5EF", borderLeft: "1px solid #DED7CC", animation: "drawerIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #DED7CC" }}>
          <div className="text-sm font-normal" style={{ letterSpacing: 3, color: "#282621" }}>{copy.myAccount}</div>
          <button type="button" onClick={onClose} aria-label={copy.closeAccount} className="flex h-11 w-11 items-center justify-center rounded-full text-[#6E685F] transition duration-200 hover:bg-[#F1ECE4] hover:text-[#A34F3D] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/15 active:scale-[0.98] motion-reduce:transform-none">
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* 会员状态卡片 */}
        <div className="m-4 rounded-2xl p-4" style={{ background: "#FFFDF8", border: "1px solid #E0D7CB" }}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `rgba(${accentRgb}, 0.10)`, border: `1px solid rgba(${accentRgb}, 0.22)` }}>
              <Crown style={{ width: 18, height: 18, color: accent }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: "#282621" }}>{copy.membership}</div>
              <div className="mt-0.5 text-xs" style={{ color: quota?.isMember ? accent : "#756F66" }}>
                {membershipLabel()}
              </div>
            </div>
          </div>
          {!quota?.isMember && (
            <button
              type="button"
              onClick={onShowPaywall}
              className="min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition duration-200 hover:-translate-y-px hover:bg-[#893F31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/20 active:scale-[0.98] motion-reduce:transform-none"
              style={{ background: accent, letterSpacing: 1 }}
            >
              {copy.loverMemberCta}
            </button>
          )}
        </div>

        {/* 昵称卡片 */}
        <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: "#FFFDF8", border: "1px solid #E0D7CB" }}>
          <div className="mb-2 text-xs" style={{ letterSpacing: 2, color: "#817A70" }}>{copy.nicknameLabel}</div>
          {editingNick ? (
            <div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNick(); }}
                  maxLength={12}
                  autoFocus
                  placeholder={copy.nicknamePlaceholder}
                  className="h-11 w-full min-w-0 flex-1 rounded-xl border border-[#D8CFC2] bg-[#F8F5EF] px-3 text-base font-light text-[#282621] outline-none transition focus:border-[#B87964] focus:ring-4 focus:ring-[#A34F3D]/10 placeholder:text-[#91887D]"
                />
                <button
                  type="button"
                  onClick={saveNick}
                  disabled={savingNick}
                  className="min-h-11 flex-1 rounded-xl px-4 text-sm text-white transition hover:bg-[#893F31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/20 active:scale-[0.98] disabled:cursor-wait motion-reduce:transform-none"
                  style={{ background: accent, opacity: savingNick ? 0.6 : 1, letterSpacing: 1 }}
                >
                  {savingNick ? "..." : copy.save}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNick(false)}
                  className="min-h-11 flex-1 rounded-xl border border-[#D8CFC2] px-3 text-sm text-[#6E685F] transition hover:bg-[#F1ECE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/10 active:scale-[0.98] motion-reduce:transform-none"
                >
                  {copy.cancel}
                </button>
              </div>
              {nickError && <div className="mt-2 text-xs" style={{ color: "#A34F3D" }}>{nickError}</div>}
            </div>
          ) : (
            <button type="button" onClick={startEditNick} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/10">
              <span className="min-w-0 break-words text-sm font-light" style={{ letterSpacing: 1, color: "#37332D" }}>
                {companion?.user_nickname || copy.notSet}
              </span>
              <span className="shrink-0 text-xs" style={{ color: accent, letterSpacing: 1 }}>{copy.edit}</span>
            </button>
          )}
        </div>

        {/* 菜单项 */}
        <div className="space-y-1 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {!quota?.isMember && (
            <button type="button" onClick={onShowPaywall} className="flex min-h-11 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-[#49453E] transition hover:bg-[#F1ECE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/10 active:scale-[0.98] motion-reduce:transform-none" style={{ letterSpacing: 1 }}>
              {copy.viewPlans}
              <ChevronRight style={{ width: 16, height: 16, opacity: 0.55 }} />
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#5F5951] transition hover:bg-[#F1ECE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/10 active:scale-[0.98] motion-reduce:transform-none"
            style={{ letterSpacing: 1 }}
          >
            <LogOut style={{ width: 16, height: 16 }} />
            {copy.logout}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ── 付费墙 ── */
function Paywall({ onClose }: { onClose: () => void }) {
  const { locale } = useLocale();
  const copy = chatCopy[locale];
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const accent = "#A34F3D";
  const accentRgb = "163, 79, 61";
  const planNames: Record<string, string> = copy.planNames;
  const planPeriods: Record<string, string> = locale === "en"
    ? { plus_trial: "/ one week", plus_monthly: "/ month", plus_yearly: "/ year" }
    : { plus_trial: "/ 一周", plus_monthly: "/ 月", plus_yearly: "/ 年" };

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const available = ((data.plans || []) as Plan[]).filter((plan) => plan.tier === "plus" && plan.available);
        setPlans(available);
        if (available.length > 0) {
          const popular = available.find((plan) => plan.id === "plus_monthly");
          setSelected((popular || available[0]).id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const selectedPlan = plans.find((p) => p.id === selected);
  const handleCheckout = async () => {
    if (!selectedPlan || isPaying) return;
    setIsPaying(true);
    setPaymentError("");
    void trackProductEvent("checkout_started", { locale, details: { planId: selectedPlan.id } });
    try {
      await openWaffoCheckout(selectedPlan.id, locale);
    } catch (error) {
      void trackProductEvent("checkout_failed", { locale, details: { planId: selectedPlan.id, reason: "checkout_request_failed" } });
      setPaymentError(error instanceof Error ? error.message : copy.paymentError);
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-3 sm:p-4" style={{ background: "rgba(40,38,33,0.35)", backdropFilter: "blur(12px)" }} onClick={onClose} role="dialog" aria-modal="true" aria-label={copy.paywallLoverTitle}>
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-3xl p-5 motion-reduce:!animate-none sm:p-7" style={{ background: "#FFFDF8", border: "1px solid #E0D7CB", boxShadow: "0 24px 80px rgba(40,38,33,0.16)", animation: "paywallIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label={copy.cancel} className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg text-[#756F66] transition hover:bg-[#F1ECE4] hover:text-[#A34F3D] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/15 active:scale-[0.98] motion-reduce:transform-none">&times;</button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `rgba(${accentRgb}, 0.1)`, border: `1px solid rgba(${accentRgb}, 0.22)`, color: accent }}>
            <span className="text-lg">{"\u2665"}</span>
          </div>
          <h3 className="px-6 text-lg font-medium leading-relaxed" style={{ color: "#282621" }}>
            {copy.paywallLoverTitle}
          </h3>
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: "#6E685F" }}>
            {copy.paywallLoverBody}
          </p>
        </div>

        {loadingPlans ? (
          <div className="flex justify-center gap-2 py-8" role="status" aria-label={copy.memberLoading}>
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="h-2 w-2 rounded-full bg-[#B87964] opacity-40 animate-pulse motion-reduce:!animate-none" style={{ animationDelay: `${dot * 0.24}s`, animationDuration: "1.8s" }} />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-5 space-y-2">
              {plans.map((p) => (
                <button type="button" key={p.id} onClick={() => setSelected(p.id)} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/15 active:scale-[0.98] motion-reduce:transform-none" style={{
                  border: selected === p.id ? `1px solid rgba(${accentRgb}, 0.4)` : "1px solid #DED7CC",
                  background: selected === p.id ? `rgba(${accentRgb}, 0.08)` : "#F8F5EF",
                }}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-medium" style={{ color: "#282621" }}>{planNames[p.id] || p.name}</span>
                    {p.popular && <span className="rounded-full px-1.5 py-0.5 text-xs" style={{ background: accent, color: "#FFFDF8" }}>{copy.recommended}</span>}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "#282621" }}>
                    {formatUsd(p.price)}<span className="text-xs font-normal" style={{ color: "#756F66" }}>{planPeriods[p.id] || p.period}</span>
                    {p.regularPrice && <span className="ml-2 text-xs font-normal line-through" style={{ color: "#817A70" }}>{formatUsd(p.regularPrice)}</span>}
                  </span>
                  {p.offer === "new_user_plus_trial" && <span className="w-full text-xs leading-relaxed" style={{ color: accent }}>{copy.newUserOffer}</span>}
                </button>
              ))}
            </div>

            {selectedPlan ? (
              <div>
                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={isPaying}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white transition duration-200 hover:-translate-y-px hover:bg-[#893F31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/20 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transform-none"
                  style={{ background: accent, letterSpacing: 1 }}
                >
                  {isPaying ? "…" : fillCopy(copy.emailPurchase, { price: formatUsd(selectedPlan.price) })}
                </button>
                {paymentError && <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: accent }} role="alert">{paymentError}</p>}
                <p className="mt-3 break-words text-center text-xs leading-relaxed" style={{ color: "#817A70" }}>
                  {copy.paymentNote}
                  <br /><a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center justify-center underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A34F3D]/30">{copy.support}</a>
                </p>
                <Link href="/cancellation" className="mt-1 flex min-h-11 items-center justify-center rounded-lg text-xs font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/15" style={{ color: accent }}>
                  {copy.cancelMembership}
                </Link>
              </div>
            ) : (
              <button type="button" onClick={() => setSelected(plans[0]?.id || "")} className="min-h-11 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#893F31] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A34F3D]/20 active:scale-[0.98] motion-reduce:transform-none" style={{ background: accent }}>
                {copy.choosePlan}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChatLoading() {
  const { locale } = useLocale();
  return (
    <div className="relative flex h-screen h-[100dvh] min-w-0 flex-col overflow-hidden" style={{ background: "#F8F5EF" }} aria-busy="true">
      <p className="sr-only" role="status">{chatCopy[locale].approaching}</p>
      <div className="flex h-full min-h-0 flex-col animate-pulse motion-reduce:!animate-none" aria-hidden="true">
        <header className="shrink-0 border-b border-[#DED7CC]/80 px-3 pb-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-5 sm:pt-3" style={{ background: "rgba(248,245,239,0.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          <div className="mx-auto grid w-full max-w-[720px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1 sm:gap-3">
            <div className="h-11 w-11 rounded-full bg-[#ECE8E1]" />
            <div className="flex items-center justify-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-[#E4DED5]" />
              <div className="space-y-2">
                <div className="h-3 w-16 rounded-full bg-[#E4DED5]" />
                <div className="h-2 w-10 rounded-full bg-[#ECE8E1]" />
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2">
              <div className="h-11 w-11 rounded-full bg-[#ECE8E1]" />
              <div className="h-11 w-11 rounded-full bg-[#ECE8E1]" />
            </div>
          </div>
          <div className="mx-auto mt-2 h-8 w-48 max-w-full rounded-full bg-[#ECE8E1]" />
        </header>

        <main className="flex-1 overflow-hidden px-4 pb-8 pt-7 sm:px-6">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="mx-auto mb-9 h-2.5 w-12 rounded-full bg-[#E4DED5]" />
            <div className="space-y-9">
              <div>
                <div className="mb-3 h-2.5 w-20 rounded-full bg-[#E4DED5]" />
                <div className="space-y-3">
                  <div className="h-3.5 w-[88%] rounded-full bg-[#E4DED5]" />
                  <div className="h-3.5 w-[72%] rounded-full bg-[#E4DED5]" />
                  <div className="h-3.5 w-[46%] rounded-full bg-[#E4DED5]" />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="mb-3 h-2.5 w-16 rounded-full bg-[#E4DED5]" />
                <div className="h-24 w-[78%] max-w-[560px] rounded-[14px] bg-[#ECE8E1]" />
              </div>
              <div>
                <div className="mb-3 h-2.5 w-20 rounded-full bg-[#E4DED5]" />
                <div className="space-y-3">
                  <div className="h-3.5 w-[82%] rounded-full bg-[#E4DED5]" />
                  <div className="h-3.5 w-[58%] rounded-full bg-[#E4DED5]" />
                </div>
              </div>
            </div>
            <p className="mt-10 text-center text-xs font-light" style={{ color: "#817A70", letterSpacing: 1 }}>{chatCopy[locale].approaching}</p>
          </div>
        </main>

        <div className="shrink-0 border-t border-[#DED7CC]/70 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-[max(18px,env(safe-area-inset-bottom))] sm:pt-4" style={{ background: "rgba(241,236,228,0.88)" }}>
          <div className="mx-auto flex h-14 w-full max-w-[720px] items-center rounded-[22px] border border-[#DED7CC] bg-[#FFFDF8] px-4">
            <div className="h-3.5 flex-1 rounded-full bg-[#ECE8E1]" />
            <div className="ml-5 h-11 w-11 shrink-0 rounded-full bg-[#E4DED5]" />
          </div>
          <div className="mx-auto mt-3 h-2 w-56 max-w-[80%] rounded-full bg-[#E4DED5]" />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatInner />
    </Suspense>
  );
}
