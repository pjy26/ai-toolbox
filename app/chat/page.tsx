"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Send, User, Crown, LogOut, ChevronRight, X } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { chatCopy, fillCopy } from "@/lib/chat-copy";
import { formatUsd, SUPPORT_EMAIL } from "@/lib/membership-plans";
import { openWaffoCheckout } from "@/lib/waffo-browser";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Companion {
  id: string;
  relationship_type: "friend" | "lover";
  companion_name: string | null;
  user_nickname: string | null;
  persona?: string;
  memory_count: number;
}

interface Quota {
  isMember: boolean;
  membershipType: string | null;
  expiresAt: string | null;
  freeMessagesUsed: number;
  freeLimit: number;
  remaining: number;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  regularPrice?: number;
  period: string;
  popular: boolean;
  hint: string;
  offer?: "new_user_weekly";
}

function ChatInner() {
  const { session } = useSessionContext();
  const { locale, isReady: localeReady } = useLocale();
  const copy = chatCopy[locale];
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const userId = session?.user.id || null;
  const params = useSearchParams();
  const role = (params.get("role") as "friend" | "lover") || "lover";
  const isLover = role === "lover";

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
  const [extracting, setExtracting] = useState(false);
  const [greetingDone, setGreetingDone] = useState(false);
  const [showPaySuccess, setShowPaySuccess] = useState(false);
  const initRunRef = useRef(0);
  const typeWriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extractionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingExtractionsRef = useRef(0);

  // 支付成功回跳：刷新配额 + 显示成功提示（5 秒后自动消失）
  useEffect(() => {
    if (params.get("payment") === "success") {
      setShowPaySuccess(true);
      loadQuota();
      const t = setTimeout(() => setShowPaySuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

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
      // 配额和关系并行加载；Chat 使用轻量列表，不再扫描全部记忆计数。
      const [qRes, listRes] = await Promise.all([
        fetch("/api/companion/quota"),
        fetch("/api/companion/list?lightweight=1"),
      ]);
      if (!isCurrent()) return;
      const [qData, listData] = await Promise.all([
        qRes.ok ? qRes.json() : null,
        listRes.json(),
      ]);
      if (!isCurrent()) return;
      if (qData) setQuota(qData);
      const c: Companion | null = listData.companions?.length > 0 ? listData.companions[0] : null;

      if (!c) {
        if (isCurrent()) window.location.href = "/";
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
                setMessages(mData.messages.map((m: any) => ({ role: m.role, content: m.content })));
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
  }, [userId, localeReady]);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
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
    if (!input.trim() || !companion || loading) return;
    if (quota && !quota.isMember && quota.remaining <= 0) {
      setShowPaywall(true);
      return;
    }
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    let res: Response;
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, companion_id: companion.id, session_id: sessionId, locale: localeRef.current, timezone }),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      setMessages((prev) => prev.slice(0, -2));
      const errMsg: Message = { role: "assistant", content: copy.networkError };
      setMessages((prev) => [...prev, errMsg]);
      setLoading(false);
      return;
    }
    clearTimeout(timeout);

    if (res.status === 402) {
      setShowPaywall(true);
      setMessages((prev) => prev.slice(0, -2));
      await loadQuota();
      setLoading(false);
      return;
    }

    if (!res.ok || !res.body) {
      let serverError = copy.errorGeneric;
      try {
        const data = await res.json();
        if (typeof data.error === "string" && data.error.trim()) serverError = data.error;
      } catch { /* Keep the localized fallback when the response is not JSON. */ }
      setMessages((prev) => prev.slice(0, -2));
      const errMsg: Message = { role: "assistant", content: serverError };
      setMessages((prev) => [...prev, errMsg]);
      setLoading(false);
      return;
    }

    const sid = res.headers.get("x-session-id");
    if (sid) {
      setSessionId(sid);
      // 持久化到 sessionStorage，重挂载后从这里恢复，避免取最近 session 串台
      if (companion) sessionStorage.setItem(`amara_session:${companion.id}`, sid);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let content = "", buffer = "";
    if (!reader) { setLoading(false); return; }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data: ")) continue;
        const data = t.slice(6);
        if (data === "[DONE]") continue;
        try {
          const p = JSON.parse(data);
          if (p.error) {
            content = typeof p.error === "string" ? p.error : copy.errorGeneric;
            setMessages((prev) => {
              const arr = [...prev];
              arr[arr.length - 1] = { role: "assistant", content };
              return arr;
            });
            continue;
          }
          const delta = p.choices?.[0]?.delta?.content || "";
          if (delta) {
            content += delta;
            setMessages((prev) => {
              const arr = [...prev];
              arr[arr.length - 1] = { role: "assistant", content };
              return arr;
            });
          }
        } catch { /* ignore */ }
      }
    }

    // 回复结束后立即解锁输入。额度刷新和记忆抽取都在后台运行，
    // 记忆仍按同一队列依次执行，避免并发抽取同一批消息造成重复写入。
    setLoading(false);
    void loadQuota().then((latestQuota) => {
      if (latestQuota?.isMember) queueExtract(sid || sessionId);
    });
  }

  const loadQuota = useCallback(async (): Promise<Quota | null> => {
    try {
      const r = await fetch("/api/companion/quota");
      if (!r.ok) return null;
      const data = await r.json() as Quota;
      setQuota(data);
      return data;
    } catch (error) {
      console.error("额度刷新失败:", error);
      return null;
    }
  }, []);

  const runExtract = async (targetSessionId: string) => {
    if (!companion) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const extractRes = await fetch("/api/companion/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companion.id, session_id: targetSessionId, locale }),
        signal: controller.signal,
      });
      if (!extractRes.ok) console.error("记忆抽取失败:", extractRes.status);
    } catch (error) {
      console.error("记忆抽取请求失败:", error);
    } finally {
      clearTimeout(timeout);
    }
  };

  const queueExtract = (targetSessionId: string | null) => {
    if (!companion || !targetSessionId) return;
    pendingExtractionsRef.current += 1;
    setExtracting(true);
    extractionQueueRef.current = extractionQueueRef.current
      .then(() => runExtract(targetSessionId))
      .catch((error) => console.error("记忆抽取队列失败:", error))
      .finally(() => {
        pendingExtractionsRef.current = Math.max(0, pendingExtractionsRef.current - 1);
        setExtracting(pendingExtractionsRef.current > 0);
      });
  };

  /* ── 粒子背景 ── */
  useEffect(() => {
    const canvas = document.getElementById("chat-particles") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W: number, H: number;
    const particles: any[] = [];
    const COUNT = 60;

    const c = canvas;
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize(); window.addEventListener("resize", resize);

    class Particle {
      x!: number; y!: number; vx!: number; vy!: number; size!: number; alpha!: number; targetAlpha!: number; fadeIn!: number; pulseSpeed!: number; pulseOffset!: number; r!: number; g!: number; b!: number; currentAlpha!: number;
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W; this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.12; this.vy = (Math.random() - 0.5) * 0.12;
        this.size = Math.random() * 1.5 + 0.3;
        this.alpha = 0; this.targetAlpha = Math.random() * 0.3 + 0.05;
        this.fadeIn = Math.random() * 0.003 + 0.001;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseOffset = Math.random() * Math.PI * 2;
        const roll = Math.random();
        if (roll < 0.35) { this.r = 201; this.g = 169; this.b = 110; }
        else if (roll < 0.7) { this.r = 232; this.g = 213; this.b = 196; }
        else { this.r = 180; this.g = 150; this.b = 130; }
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0) this.x = W; if (this.x > W) this.x = 0;
        if (this.y < 0) this.y = H; if (this.y > H) this.y = 0;
        if (this.alpha < this.targetAlpha) this.alpha += this.fadeIn;
        const pulse = Math.sin(Date.now() * this.pulseSpeed + this.pulseOffset) * 0.3 + 0.7;
        this.currentAlpha = this.alpha * pulse;
      }
      draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${this.currentAlpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < COUNT; i++) particles.push(new Particle());
    let raf: number;
    function animate() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => { p.update(); p.draw(); });
      raf = requestAnimationFrame(animate);
    }
    animate();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#F8F5EF" }}>
        <div className="text-center" style={{ color: "#282621" }}>
          <p className="text-lg mb-6" style={{ letterSpacing: 2 }}>{copy.loginRequired}</p>
          <a href="/login" className="px-8 py-3 rounded-xl text-white font-medium inline-block" style={{ letterSpacing: 2, background: "#A34F3D" }}>{copy.login}</a>
        </div>
      </div>
    );
  }

  if (initLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#F8F5EF" }}>
        <div className="text-center" style={{ color: "#756F66" }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#c9a894] animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ letterSpacing: 2 }}>{copy.approaching}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative" style={{ background: "#F8F5EF" }}>
      <canvas id="chat-particles" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.45 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 50% 100%, rgba(163,79,61,0.07) 0%, transparent 65%)" }} />

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "16px 20px 12px", background: "rgba(248,245,239,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid #DED7CC" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/app" aria-label={copy.back} className="w-10 text-lg" style={{ color: "#6E685F", textDecoration: "none" }}>&lsaquo;</a>
          <div className="flex-1 flex flex-col items-center">
            <div className="relative mb-1.5" style={{ width: 36, height: 36 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #FFFDF8, #E7D6C7)", border: "1px solid #D8C7B7", boxShadow: "0 3px 12px rgba(91,65,47,0.10)" }} />
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#6F8B5E", border: "2px solid #F8F5EF", boxShadow: "0 0 5px rgba(111,139,94,0.3)", animation: "statusPulse 3s ease-in-out infinite" }} />
            </div>
            <div className="text-sm font-normal" style={{ letterSpacing: 3, color: "#282621", lineHeight: 1.4 }}>Amara</div>
            <div className="text-xs font-light mt-0.5" style={{ letterSpacing: 1, color: "#756F66" }}>
              {isLover ? copy.loverTagline : copy.friendTagline}
              {extracting && ` · ${copy.remembering}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <button
              onClick={() => setShowMyDrawer(true)}
              aria-label={copy.myAccount}
              className="flex w-8 items-center justify-end"
              style={{ color: "#6E685F", transition: "color 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#A34F3D"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6E685F"; }}
            >
              <User style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>
      </header>

      {/* 支付成功提示 */}
      {showPaySuccess && (
        <div className="text-center py-1.5 text-xs" style={{ color: "#805A25", letterSpacing: 1, background: "#FFF1D6", position: "relative", zIndex: 10 }}>
          {copy.paymentSuccess}
        </div>
      )}

      {/* 免费额度提示 */}
      {quota && !quota.isMember && (
        <div className="text-center py-1.5 text-xs" style={{ color: "#6E685F", letterSpacing: 1, background: "#F1ECE4", position: "relative", zIndex: 10 }}>
          {fillCopy(copy.freeRemaining, { count: quota.remaining })} ·{" "}
          <span
            onClick={() => setShowPaywall(true)}
            style={{ color: "#A34F3D", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            {copy.rememberCta}
          </span>
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 10, padding: "20px 16px" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center my-6" style={{ opacity: 0, animation: "fadeIn 0.8s ease forwards" }}>
            <span className="text-xs font-light" style={{ color: "#817A70", letterSpacing: 2 }}>{copy.today}</span>
          </div>

          {messages.map((msg, i) => (
            <div key={i} className="flex mb-4" style={{
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "msgIn 0.5s ease forwards",
              opacity: 0,
              animationDelay: `${i * 0.02}s`,
            }}>
              <div>
                <div style={{
                  maxWidth: "min(72vw, 480px)",
                  padding: "12px 16px",
                  borderRadius: 18,
                  fontSize: 15,
                  lineHeight: 1.7,
                  fontWeight: 400,
                  letterSpacing: 0.3,
                  wordBreak: "break-word",
                  ...(msg.role === "assistant" ? {
                    background: "#FFFDF8",
                    color: "#37332D",
                    border: "1px solid #E0D5C8",
                    borderBottomLeftRadius: 4,
                    boxShadow: "0 3px 14px rgba(91,65,47,0.07)",
                  } : {
                    background: "#EEE2D5",
                    color: "#41352F",
                    border: "1px solid #DCCFC0",
                    borderBottomRightRadius: 4,
                  }),
                }}>
                  {msg.content || (msg.role === "assistant" ? "..." : "")}
                </div>
                <div className="text-xs mt-1.5" style={{
                  color: "#817A70",
                  letterSpacing: 1,
                  ...(msg.role === "user" ? { textAlign: "right", marginRight: 4 } : { marginLeft: 4 }),
                }}>
                  {copy.justNow}
                </div>
              </div>
            </div>
          ))}

          {/* 加载指示器 */}
          {loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content === "" && (
            <div className="flex mb-4" style={{ justifyContent: "flex-start", animation: "msgIn 0.5s ease forwards" }}>
              <div style={{ maxWidth: "min(72vw, 480px)", padding: "12px 16px", borderRadius: 18, borderBottomLeftRadius: 4, background: "#FFFDF8", border: "1px solid #E0D5C8" }}>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b87964] animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b87964] animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b87964] animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入框 */}
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "12px 16px 20px", background: "#F1ECE4", borderTop: "1px solid #DED7CC" }}>
        <div style={{ position: "absolute", top: -20, left: 0, right: 0, height: 20, background: "linear-gradient(180deg, transparent, #F1ECE4)", pointerEvents: "none" }} />
        <div className="max-w-3xl mx-auto flex items-end gap-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={copy.inputPlaceholder}
            disabled={!greetingDone}
            className="flex-1 rounded-2xl text-sm font-light placeholder:text-[#9a9186]"
            style={{
              background: "#FFFDF8",
              border: "1px solid #D8CFC2",
              padding: "10px 16px",
              height: 44,
              fontSize: 15,
              lineHeight: 1.6,
              color: "#282621",
              outline: "none",
              transition: "border-color 0.3s ease, box-shadow 0.3s ease",
              opacity: greetingDone ? 1 : 0.55,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#B87964"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(163,79,61,0.10)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#D8CFC2"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !greetingDone}
            aria-label={copy.send}
            className="rounded-full flex items-center justify-center"
            style={{
              width: 44, height: 44,
              background: "#A34F3D",
              border: "1px solid #A34F3D",
              color: "#FFFDF8",
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.3s ease",
              opacity: loading || !input.trim() || !greetingDone ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim() && greetingDone) {
                e.currentTarget.style.background = "#893F31";
                e.currentTarget.style.boxShadow = "0 5px 16px rgba(163,79,61,0.18)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#A34F3D";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Send style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-center text-[11px] font-light" style={{ color: "#817A70", letterSpacing: 0.4, lineHeight: 1.5 }}>
          {copy.aiDisclosure} · {copy.replyLanguage}
        </p>
      </div>

      {/* 付费墙 */}
      {showPaywall && <Paywall isLover={isLover} onClose={() => { setShowPaywall(false); loadQuota(); }} />}

      {/* "我的" 抽屉 */}
      {showMyDrawer && (
        <MyDrawer
          isLover={isLover}
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
function MyDrawer({ isLover, quota, companion, onNicknameSaved, onClose, onShowPaywall }: {
  isLover: boolean;
  quota: Quota | null;
  companion: Companion | null;
  onNicknameSaved: (nick: string) => void;
  onClose: () => void;
  onShowPaywall: () => void;
}) {
  const { supabaseClient } = useSessionContext();
  const { locale } = useLocale();
  const copy = chatCopy[locale];
  const accent = isLover ? "#A34F3D" : "#8A6438";
  const accentRgb = isLover ? "163, 79, 61" : "138, 100, 56";
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
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(40,38,33,0.25)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        className="h-full w-80 max-w-[85vw] flex flex-col overflow-y-auto"
        style={{ background: "#F8F5EF", borderLeft: "1px solid #DED7CC", animation: "drawerIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #DED7CC" }}>
          <div className="text-sm font-normal" style={{ letterSpacing: 3, color: "#282621" }}>{copy.myAccount}</div>
          <button onClick={onClose} aria-label={copy.closeAccount} style={{ color: "#6E685F", transition: "color 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#A34F3D"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#6E685F"; }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* 会员状态卡片 */}
        <div className="m-4 p-4 rounded-2xl" style={{ background: "#FFFDF8", border: "1px solid #E0D7CB" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `rgba(${accentRgb}, 0.10)`, border: `1px solid rgba(${accentRgb}, 0.22)` }}>
              <Crown style={{ width: 18, height: 18, color: accent }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "#282621" }}>{copy.membership}</div>
              <div className="text-xs mt-0.5" style={{ color: quota?.isMember ? accent : "#756F66" }}>
                {membershipLabel()}
              </div>
            </div>
          </div>
          {!quota?.isMember && (
            <button
              onClick={onShowPaywall}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition"
              style={{ background: accent, letterSpacing: 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {isLover ? copy.loverMemberCta : copy.friendMemberCta}
            </button>
          )}
        </div>

        {/* 昵称卡片 */}
        <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: "#FFFDF8", border: "1px solid #E0D7CB" }}>
          <div className="text-xs mb-2" style={{ letterSpacing: 2, color: "#817A70" }}>{copy.nicknameLabel}</div>
          {editingNick ? (
            <div>
              <div className="flex gap-2">
                <input
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNick(); }}
                  maxLength={12}
                  autoFocus
                  placeholder={copy.nicknamePlaceholder}
                  className="flex-1 rounded-xl text-sm font-light placeholder:text-[#9a9186]"
                  style={{
                    background: "#F8F5EF",
                    border: "1px solid #D8CFC2",
                    padding: "8px 12px",
                    color: "#282621",
                    outline: "none",
                  }}
                />
                <button
                  onClick={saveNick}
                  disabled={savingNick}
                  className="px-4 rounded-xl text-sm text-white"
                  style={{ background: accent, opacity: savingNick ? 0.6 : 1, letterSpacing: 1 }}
                >
                  {savingNick ? "..." : copy.save}
                </button>
                <button
                  onClick={() => setEditingNick(false)}
                  className="px-3 rounded-xl text-sm"
                  style={{ color: "#6E685F", border: "1px solid #D8CFC2" }}
                >
                  {copy.cancel}
                </button>
              </div>
              {nickError && <div className="text-xs mt-2" style={{ color: "#A34F3D" }}>{nickError}</div>}
            </div>
          ) : (
            <button onClick={startEditNick} className="w-full flex items-center justify-between text-left">
              <span className="text-sm font-light" style={{ letterSpacing: 1, color: "#37332D" }}>
                {companion?.user_nickname || copy.notSet}
              </span>
              <span className="text-xs" style={{ color: accent, letterSpacing: 1 }}>{copy.edit}</span>
            </button>
          )}
        </div>

        {/* 菜单项 */}
        <div className="px-4 space-y-1">
          {!quota?.isMember && (
            <button onClick={onShowPaywall} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition" style={{ color: "#49453E", letterSpacing: 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F1ECE4"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {copy.viewPlans}
              <ChevronRight style={{ width: 16, height: 16, opacity: 0.55 }} />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition"
            style={{ color: "#5F5951", letterSpacing: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F1ECE4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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
function Paywall({ isLover, onClose }: { isLover: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const copy = chatCopy[locale];
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const accent = isLover ? "#A34F3D" : "#8A6438";
  const accentRgb = isLover ? "163, 79, 61" : "138, 100, 56";
  const planNames: Record<string, string> = copy.planNames;
  const planPeriods: Record<string, string> = locale === "en"
    ? { weekly: "/ week", monthly: "/ month", yearly: "/ year" }
    : { weekly: "/ 周", monthly: "/ 月", yearly: "/ 年" };

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.plans || []);
        if (data.plans?.length > 0) {
          const popular = data.plans.find((p: Plan) => p.popular);
          setSelected(popular ? popular.id : data.plans[0].id);
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
    try {
      await openWaffoCheckout(selectedPlan.id, locale);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : copy.paymentError);
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(40,38,33,0.35)", backdropFilter: "blur(12px)" }} onClick={onClose} role="dialog" aria-modal="true">
      <div className="rounded-3xl p-6 sm:p-7 max-w-md max-h-[90vh] overflow-y-auto w-full relative" style={{ background: "#FFFDF8", border: "1px solid #E0D7CB", boxShadow: "0 24px 80px rgba(40,38,33,0.16)", animation: "paywallIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label={copy.cancel} className="absolute top-4 right-4 min-h-11 min-w-11 text-sm" style={{ color: "#756F66" }}>&times;</button>

        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `rgba(${accentRgb}, 0.1)`, border: `1px solid rgba(${accentRgb}, 0.22)`, color: accent }}>
            <span className="text-lg">{isLover ? "\u2665" : "\u263A"}</span>
          </div>
          <h3 className="text-lg font-medium leading-relaxed" style={{ color: "#282621" }}>
            {isLover ? copy.paywallLoverTitle : copy.paywallFriendTitle}
          </h3>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line" style={{ color: "#6E685F" }}>
            {isLover ? copy.paywallLoverBody : copy.paywallFriendBody}
          </p>
        </div>

        {loadingPlans ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `rgba(${accentRgb}, 0.3)`, borderTopColor: "transparent" }} />
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {plans.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)} className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl transition text-left" style={{
                  border: selected === p.id ? `1px solid rgba(${accentRgb}, 0.4)` : "1px solid #DED7CC",
                  background: selected === p.id ? `rgba(${accentRgb}, 0.08)` : "#F8F5EF",
                }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: "#282621" }}>{planNames[p.id] || p.name}</span>
                    {p.popular && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: accent, color: "#FFFDF8" }}>{copy.recommended}</span>}
                  </div>
                  <span className="font-semibold text-sm" style={{ color: "#282621" }}>
                    {formatUsd(p.price)}<span className="text-xs font-normal" style={{ color: "#756F66" }}>{planPeriods[p.id] || p.period}</span>
                    {p.regularPrice && <span className="ml-2 text-xs font-normal line-through" style={{ color: "#817A70" }}>{formatUsd(p.regularPrice)}</span>}
                  </span>
                  {p.offer === "new_user_weekly" && <span className="w-full text-xs" style={{ color: accent }}>{copy.newUserOffer}</span>}
                </button>
              ))}
            </div>

            {selectedPlan ? (
              <div>
                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={isPaying}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-center font-semibold text-sm text-white transition disabled:cursor-wait disabled:opacity-60"
                  style={{ background: accent, letterSpacing: 1 }}
                >
                  {isPaying ? "…" : fillCopy(copy.emailPurchase, { price: formatUsd(selectedPlan.price) })}
                </button>
                {paymentError && <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: accent }} role="alert">{paymentError}</p>}
                <p className="mt-3 text-xs text-center leading-relaxed" style={{ color: "#817A70" }}>
                  {copy.paymentNote}
                  <br /><a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{copy.support}</a>
                </p>
                <Link href="/cancellation" className="mt-2 flex min-h-11 items-center justify-center text-xs font-medium underline underline-offset-4" style={{ color: accent }}>
                  {copy.cancelMembership}
                </Link>
              </div>
            ) : (
              <button onClick={() => setSelected(plans[0]?.id || "")} className="w-full py-3 rounded-xl font-semibold text-sm text-white" style={{ background: accent }}>
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
    <div className="h-screen flex items-center justify-center" style={{ background: "#F8F5EF" }}>
      <div className="text-center" style={{ color: "#756F66" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4" style={{ borderColor: "rgba(163,79,61,0.3)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ letterSpacing: 2 }}>{chatCopy[locale].approaching}</p>
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
