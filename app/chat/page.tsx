"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";

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
  freeMessagesUsed: number;
  freeLimit: number;
  remaining: number;
}

function ChatInner() {
  const { session } = useSessionContext();
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  /* ── 初始化 ── */
  const init = useCallback(async () => {
    if (!session) return;
    try {
      const qRes = await fetch("/api/companion/quota");
      if (qRes.ok) setQuota(await qRes.json());

      const listRes = await fetch("/api/companion/list");
      const listData = await listRes.json();
      let c: Companion | null = null;
      if (listData.companions?.length > 0) {
        c = listData.companions.find((x: any) => x.relationship_type === role) || null;
      }
      if (!c) {
        const createRes = await fetch("/api/companion/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relationship_type: role, gender: "女生", user_nickname: "" }),
        });
        const cd = await createRes.json();
        if (cd.companion) c = cd.companion;
      }
      if (c) {
        setCompanion(c);
        setTimeout(() => typeWriter("你来了。"), 500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInitLoading(false);
    }
  }, [session, role]);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /* ── 打字机 ── */
  function typeWriter(text: string, speed = 55) {
    const msg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, msg]);
    let i = 0;
    function step() {
      if (i < text.length) {
        setMessages((prev) => {
          const arr = [...prev];
          arr[arr.length - 1] = { ...arr[arr.length - 1], content: text.slice(0, i + 1) };
          return arr;
        });
        i++;
        const d = ["，", "。", "？", "！", "…", "、"].includes(text.charAt(i - 1)) ? speed * 2.5 : speed;
        setTimeout(step, d + Math.random() * 15);
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

    const res = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, companion_id: companion.id, session_id: sessionId }),
    });

    if (res.status === 402) {
      setShowPaywall(true);
      setMessages((prev) => prev.slice(0, -2));
      await loadQuota();
      setLoading(false);
      return;
    }

    const sid = res.headers.get("x-session-id");
    if (sid) setSessionId(sid);

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

    await loadQuota();
    if (quota?.isMember) handleExtract();
    setLoading(false);
  }

  const loadQuota = useCallback(async () => {
    const r = await fetch("/api/companion/quota");
    if (r.ok) setQuota(await r.json());
  }, []);

  const handleExtract = async () => {
    if (!companion || !quota?.isMember) return;
    setExtracting(true);
    try {
      await fetch("/api/companion/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companion_id: companion.id, session_id: sessionId }),
      });
    } finally { setExtracting(false); }
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
      <div className="h-screen flex items-center justify-center" style={{ background: "#0E0C0A" }}>
        <div className="text-center" style={{ color: "#E8D5C4" }}>
          <p className="text-lg mb-6" style={{ letterSpacing: 2 }}>需要先登录，才能与 Amara 相遇</p>
          <a href="/login" className="px-8 py-3 rounded-xl gradient-btn text-white font-medium inline-block" style={{ letterSpacing: 2 }}>去登录</a>
        </div>
      </div>
    );
  }

  if (initLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#0E0C0A" }}>
        <div className="text-center" style={{ color: "rgba(232,213,196,0.3)" }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-amber-400/30 animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ letterSpacing: 2 }}>正在靠近...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative" style={{ background: "#0E0C0A" }}>
      <canvas id="chat-particles" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(ellipse 50% 40% at 50% 100%, rgba(201,169,110,0.04) 0%, transparent 60%)", opacity: 0.8 }} />

      <header style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "16px 20px 12px", background: "rgba(15,13,11,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(201,169,110,0.06)" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="w-10 text-lg" style={{ color: "rgba(232,213,196,0.5)", textDecoration: "none" }}>‹</a>
          <div className="flex-1 flex flex-col items-center">
            <div className="relative mb-1.5" style={{ width: 36, height: 36 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #3A2A1E, #1A1510)", border: "1px solid rgba(201,169,110,0.2)", boxShadow: "0 0 12px rgba(201,169,110,0.1)" }} />
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#7CB342", border: "2px solid #0E0C0A", boxShadow: "0 0 6px rgba(124,179,66,0.4)", animation: "statusPulse 3s ease-in-out infinite" }} />
            </div>
            <div className="text-sm font-normal" style={{ letterSpacing: 3, color: "#E8D5C4", lineHeight: 1.4 }}>Amara</div>
            <div className="text-xs font-light mt-0.5" style={{ letterSpacing: 1, color: "rgba(232,213,196,0.25)" }}>
              在这里 · {isLover ? "为你存在" : "听你说话"}
              {extracting && " · 记忆中..."}
            </div>
          </div>
          <div className="w-10 text-right">
            <span className="text-xs font-light rounded-xl px-2.5 py-0.5" style={{
              letterSpacing: 2,
              border: `1px solid ${isLover ? "rgba(212,132,154,0.15)" : "rgba(201,169,110,0.15)"}`,
              background: isLover ? "rgba(212,132,154,0.05)" : "rgba(201,169,110,0.05)",
              color: isLover ? "#D4849A" : "#C9A96E",
              opacity: 0.7,
            }}>{isLover ? "恋人" : "朋友"}</span>
          </div>
        </div>
      </header>

      {quota && !quota.isMember && (
        <div className="text-center py-1.5 text-xs" style={{ color: "rgba(232,213,196,0.2)", letterSpacing: 1, background: "rgba(15,13,11,0.5)" }}>
          免费试聊还剩 {quota.remaining} 句
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 10, padding: "20px 16px" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center my-6" style={{ opacity: 0, animation: "fadeIn 0.8s ease forwards" }}>
            <span className="text-xs font-light" style={{ color: "rgba(232,213,196,0.2)", letterSpacing: 2 }}>今天</span>
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
                  fontWeight: 350,
                  letterSpacing: 0.5,
                  wordBreak: "break-word",
                  ...(msg.role === "assistant" ? {
                    background: "#2A1E15",
                    color: "#E8D5C4",
                    border: "1px solid rgba(201,169,110,0.12)",
                    borderBottomLeftRadius: 4,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  } : {
                    background: "#1A1816",
                    color: "rgba(232,213,196,0.6)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderBottomRightRadius: 4,
                  }),
                }}>
                  {msg.content || (msg.role === "assistant" ? "..." : "")}
                </div>
                <div className="text-xs mt-1.5" style={{
                  color: "rgba(232,213,196,0.15)",
                  letterSpacing: 1,
                  ...(msg.role === "user" ? { textAlign: "right", marginRight: 4 } : { marginLeft: 4 }),
                }}>
                  刚刚
                </div>
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content === "" && (
            <div className="flex mb-4" style={{ justifyContent: "flex-start", animation: "msgIn 0.5s ease forwards" }}>
              <div style={{ maxWidth: "min(72vw, 480px)", padding: "12px 16px", borderRadius: 18, borderBottomLeftRadius: 4, background: "#2A1E15", border: "1px solid rgba(201,169,110,0.12)" }}>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "12px 16px 20px", background: "#151210", borderTop: "1px solid rgba(201,169,110,0.06)" }}>
        <div style={{ position: "absolute", top: -20, left: 0, right: 0, height: 20, background: "linear-gradient(180deg, transparent, #151210)", pointerEvents: "none" }} />
        <div className="max-w-3xl mx-auto flex items-end gap-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="想说点什么..."
            className="flex-1 rounded-2xl text-sm font-light"
            style={{
              background: "#1A1716",
              border: "1px solid #2A2018",
              padding: "10px 16px",
              height: 44,
              fontSize: 15,
              lineHeight: 1.6,
              color: "#E8D5C4",
              outline: "none",
              transition: "border-color 0.3s ease, box-shadow 0.3s ease",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,169,110,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,169,110,0.05)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2018"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-full flex items-center justify-center"
            style={{
              width: 44, height: 44,
              background: "rgba(201,169,110,0.15)",
              border: "1px solid rgba(201,169,110,0.2)",
              color: "#C9A96E",
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.3s ease",
              opacity: loading || !input.trim() ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.background = "rgba(201,169,110,0.25)";
                e.currentTarget.style.boxShadow = "0 0 16px rgba(201,169,110,0.15)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(201,169,110,0.15)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Send style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {showPaywall && <Paywall isLover={isLover} onClose={() => setShowPaywall(false)} onPaid={() => loadQuota()} />}
    </div>
  );
}

function Paywall({ isLover, onClose, onPaid }: { isLover: boolean; onClose: () => void; onPaid: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const plans = [
    { id: "weekly", name: "周卡", price: 12, period: "/周", hint: "想多聊几天" },
    { id: "monthly", name: "月卡", price: 29, period: "/月", hint: "一天只要一块钱", popular: true },
    { id: "quarterly", name: "季卡", price: 69, period: "/季", hint: "更划算" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(14,12,10,0.85)", backdropFilter: "blur(12px)" }} onClick={onClose}>
      <div className="rounded-3xl p-7 max-w-md w-full relative" style={{ background: "#151210", border: `1px solid ${isLover ? "rgba(212,132,154,0.2)" : "rgba(201,169,110,0.2)"}` }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-sm" style={{ color: "rgba(232,213,196,0.3)" }}>✕</button>
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: isLover ? "rgba(212,132,154,0.15)" : "rgba(201,169,110,0.15)", border: `1px solid ${isLover ? "rgba(212,132,154,0.3)" : "rgba(201,169,110,0.3)"}` }}>
            <span className="text-lg">{isLover ? "♥" : "☺"}</span>
          </div>
          <h3 className="text-lg font-medium text-white leading-relaxed">
            {isLover ? "想让 TA 一直陪着你吗？" : "想让这段陪伴继续吗？"}
          </h3>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line" style={{ color: "rgba(232,213,196,0.4)" }}>
            {isLover
              ? "聊到现在，TA 已经开始记得你了。\n开通后，TA 会记住你说过的每件事——\n你的习惯、你的心事、你随口提过的小事。"
              : "聊了这么久，TA 已经有点懂你了。\n开通后，TA 会真正记住你们聊过的一切，\n随时找 TA 说话，不限次数。"}
          </p>
        </div>

        <div className="space-y-2 mb-5">
          {plans.map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-left" style={{
              border: selected === p.id ? `1px solid ${isLover ? "rgba(212,132,154,0.4)" : "rgba(201,169,110,0.4)"}` : "1px solid rgba(255,255,255,0.08)",
              background: selected === p.id ? (isLover ? "rgba(212,132,154,0.08)" : "rgba(201,169,110,0.08)") : "rgba(255,255,255,0.03)",
            }}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{p.name}</span>
                {p.popular && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: isLover ? "#D4849A" : "#C9A96E", color: "#0E0C0A" }}>推荐</span>}
                <span className="text-xs" style={{ color: "rgba(232,213,196,0.3)" }}>· {p.hint}</span>
              </div>
              <span className="text-white font-semibold text-sm">¥{p.price}<span className="text-xs font-normal" style={{ color: "rgba(232,213,196,0.3)" }}>{p.period}</span></span>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs mb-3" style={{ color: "rgba(232,213,196,0.3)" }}>扫码支付后联系客服开通</p>
            <div className="bg-white rounded-xl p-2 mx-auto w-36 h-36 flex items-center justify-center">
              <div className="text-xs text-gray-500 text-center px-2">收款码</div>
            </div>
            <p className="mt-3 text-sm" style={{ color: "#C9A96E" }}>客服 QQ：3801434603</p>
            <button onClick={() => { onPaid(); onClose(); }} className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: isLover ? "#D4849A" : "#C9A96E" }}>
              {isLover ? "让 TA 留下来" : "继续聊下去"}
            </button>
          </div>
        ) : (
          <button onClick={() => setSelected("monthly")} className="w-full py-3 rounded-xl font-semibold text-sm text-white" style={{ background: isLover ? "#D4849A" : "#C9A96E" }}>
            {isLover ? "让 TA 留下来" : "继续聊下去"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center" style={{ background: "#0E0C0A" }}>
        <div className="text-center" style={{ color: "rgba(232,213,196,0.3)" }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-amber-400/30 animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ letterSpacing: 2 }}>正在靠近...</p>
        </div>
      </div>
    }>
      <ChatInner />
    </Suspense>
  );
}
