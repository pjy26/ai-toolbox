"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useSearchParams } from "next/navigation";
import { Send, User, Crown, LogOut, ChevronRight, X } from "lucide-react";

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
  period: string;
  popular: boolean;
  hint: string;
}

function ChatInner() {
  const { session, supabaseClient } = useSessionContext();
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
    // 治本：早 return 必须先放 initLoading，否则任何无 session 访问 /chat
    // 都会卡在 initLoading=true 的黑屏（登出弹回、直接访问 URL 等）
    if (!session) {
      setInitLoading(false);
      return;
    }
    try {
      // 配额
      const qRes = await fetch("/api/companion/quota");
      if (qRes.ok) setQuota(await qRes.json());

      // 获取已有关系
      const listRes = await fetch("/api/companion/list");
      const listData = await listRes.json();
      let c: Companion | null = null;
      if (listData.companions?.length > 0) {
        c = listData.companions[0];
      }

      // 没有关系 → 回首页选择
      if (!c) {
        window.location.href = "/";
        return;
      }

      setCompanion(c);

      // 去重锁：命中则跳过 greeting，但恢复历史对话（重挂载后 messages 已清空，必须回填）
      if (sessionStorage.getItem(GREETING_KEY(c.id))) {
        try {
          // 优先用本 tab 内持久化的 sessionId（避免取最近 session 串台）
          let lastSid = sessionStorage.getItem(SESSION_KEY(c.id));
          if (!lastSid) {
            // 退路：本 tab 从未发过消息，取最近 session
            const sRes = await fetch(`/api/companion/sessions?companion_id=${c.id}`);
            const sData = await sRes.json();
            lastSid = sData.sessions?.[0]?.id || null;
          }
          if (lastSid) {
            setSessionId(lastSid);
            const mRes = await fetch(`/api/companion/messages?session_id=${lastSid}`);
            if (mRes.ok) {
              const mData = await mRes.json();
              if (Array.isArray(mData.messages) && mData.messages.length > 0) {
                // 一次性铺出，不走打字机（历史是"已说过的话"，非"此刻在说"）
                setMessages(mData.messages.map((m: any) => ({ role: m.role, content: m.content })));
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
        setGreetingDone(true);
      } else {
        sessionStorage.setItem(GREETING_KEY(c.id), "1");
        // 获取开场白
        const greetRes = await fetch(`/api/companion/greeting?companion_id=${c.id}`);
        if (greetRes.ok) {
          const greetData = await greetRes.json();
          typeWriter(greetData.greeting, () => setGreetingDone(true));
        } else {
          setGreetingDone(true);
        }
      }
    } catch (e) {
      console.error(e);
      setGreetingDone(true);
    } finally {
      setInitLoading(false);
    }
  }, [session]);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /* ── 打字机 ── */
  function typeWriter(text: string, onDone?: () => void) {
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
        const d = ["，", "。", "？", "！", "…", "、"].includes(text.charAt(i - 1)) ? 75 : 45;
        setTimeout(step, d + Math.random() * 15);
      } else {
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
      res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, companion_id: companion.id, session_id: sessionId }),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      setMessages((prev) => prev.slice(0, -2));
      const errMsg: Message = { role: "assistant", content: "网络超时，请检查连接后重试" };
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
      let errText = "出了点问题，稍后再试";
      try {
        const errData = await res.json();
        if (errData.error) errText = errData.error;
      } catch {}
      setMessages((prev) => prev.slice(0, -2));
      const errMsg: Message = { role: "assistant", content: errText };
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
        <div className="text-center" style={{ color: "rgba(232,213,196,0.7)" }}>
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

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "16px 20px 12px", background: "rgba(15,13,11,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(201,169,110,0.06)" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="w-10 text-lg" style={{ color: "rgba(232,213,196,0.85)", textDecoration: "none" }}>&lsaquo;</a>
          <div className="flex-1 flex flex-col items-center">
            <div className="relative mb-1.5" style={{ width: 36, height: 36 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #3A2A1E, #1A1510)", border: "1px solid rgba(201,169,110,0.2)", boxShadow: "0 0 12px rgba(201,169,110,0.1)" }} />
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#7CB342", border: "2px solid #0E0C0A", boxShadow: "0 0 6px rgba(124,179,66,0.4)", animation: "statusPulse 3s ease-in-out infinite" }} />
            </div>
            <div className="text-sm font-normal" style={{ letterSpacing: 3, color: "#E8D5C4", lineHeight: 1.4 }}>Amara</div>
            <div className="text-xs font-light mt-0.5" style={{ letterSpacing: 1, color: "rgba(232,213,196,0.85)" }}>
              {isLover ? "为你存在" : "听你说话"}
              {extracting && " · 记忆中..."}
            </div>
          </div>
          {/* "我的" 按钮 */}
          <button
            onClick={() => setShowMyDrawer(true)}
            className="w-10 flex justify-end items-center"
            style={{ color: "rgba(232,213,196,0.7)", transition: "color 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(232,213,196,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(232,213,196,0.7)"; }}
          >
            <User style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </header>

      {/* 免费额度提示 */}
      {quota && !quota.isMember && (
        <div className="text-center py-1.5 text-xs" style={{ color: "rgba(232,213,196,0.75)", letterSpacing: 1, background: "rgba(15,13,11,0.5)", position: "relative", zIndex: 10 }}>
          免费试聊还剩 {quota.remaining} 句 ·{" "}
          <span
            onClick={() => setShowPaywall(true)}
            style={{ color: isLover ? "#D4849A" : "#C9A96E", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            让 TA 记住你
          </span>
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 10, padding: "20px 16px" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center my-6" style={{ opacity: 0, animation: "fadeIn 0.8s ease forwards" }}>
            <span className="text-xs font-light" style={{ color: "rgba(232,213,196,0.85)", letterSpacing: 2 }}>今天</span>
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
                    color: "rgba(232,213,196,0.85)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderBottomRightRadius: 4,
                  }),
                }}>
                  {msg.content || (msg.role === "assistant" ? "..." : "")}
                </div>
                <div className="text-xs mt-1.5" style={{
                  color: "rgba(232,213,196,0.8)",
                  letterSpacing: 1,
                  ...(msg.role === "user" ? { textAlign: "right", marginRight: 4 } : { marginLeft: 4 }),
                }}>
                  刚刚
                </div>
              </div>
            </div>
          ))}

          {/* 加载指示器 */}
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

      {/* 输入框 */}
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "12px 16px 20px", background: "#151210", borderTop: "1px solid rgba(201,169,110,0.06)" }}>
        <div style={{ position: "absolute", top: -20, left: 0, right: 0, height: 20, background: "linear-gradient(180deg, transparent, #151210)", pointerEvents: "none" }} />
        <div className="max-w-3xl mx-auto flex items-end gap-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="想说点什么..."
            disabled={!greetingDone}
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
              opacity: greetingDone ? 1 : 0.5,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,169,110,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,169,110,0.05)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2018"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !greetingDone}
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
              opacity: loading || !input.trim() || !greetingDone ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim() && greetingDone) {
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
  const accent = isLover ? "#D4849A" : "#C9A96E";
  const accentRgb = isLover ? "212, 132, 154" : "201, 169, 110";
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
      setNickError("昵称需要 1-12 个字符");
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
      setNickError("保存失败，请稍后重试");
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
    if (!quota) return "加载中...";
    if (!quota.isMember) return "未开通";
    const typeMap: Record<string, string> = { weekly: "周卡", monthly: "月卡", yearly: "年卡" };
    const typeName = typeMap[quota.membershipType || ""] || quota.membershipType || "已开通";
    if (quota.expiresAt) {
      const d = new Date(quota.expiresAt);
      return `${typeName} · 至 ${d.getMonth() + 1}/${d.getDate()}`;
    }
    return typeName;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(14,12,10,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        className="h-full w-80 max-w-[85vw] flex flex-col overflow-y-auto"
        style={{ background: "#151210", borderLeft: "1px solid rgba(201,169,110,0.06)", animation: "drawerIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid rgba(201,169,110,0.06)" }}>
          <div className="text-sm font-normal" style={{ letterSpacing: 3, color: "#E8D5C4" }}>我的</div>
          <button onClick={onClose} style={{ color: "rgba(232,213,196,0.7)", transition: "color 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(232,213,196,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(232,213,196,0.7)"; }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* 会员状态卡片 */}
        <div className="m-4 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `rgba(${accentRgb}, 0.15)`, border: `1px solid rgba(${accentRgb}, 0.2)` }}>
              <Crown style={{ width: 18, height: 18, color: accent }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "#E8D5C4" }}>会员状态</div>
              <div className="text-xs mt-0.5" style={{ color: quota?.isMember ? accent : "rgba(232,213,196,0.7)" }}>
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
              {isLover ? "让 TA 记住你" : "开通会员"}
            </button>
          )}
        </div>

        {/* 昵称卡片 */}
        <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-xs mb-2" style={{ letterSpacing: 2, color: "rgba(232,213,196,0.6)" }}>TA 怎么称呼你</div>
          {editingNick ? (
            <div>
              <div className="flex gap-2">
                <input
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNick(); }}
                  maxLength={12}
                  autoFocus
                  placeholder="输入昵称"
                  className="flex-1 rounded-xl text-sm font-light"
                  style={{
                    background: "#1A1716",
                    border: "1px solid #2A2018",
                    padding: "8px 12px",
                    color: "#E8D5C4",
                    outline: "none",
                  }}
                />
                <button
                  onClick={saveNick}
                  disabled={savingNick}
                  className="px-4 rounded-xl text-sm text-white"
                  style={{ background: accent, opacity: savingNick ? 0.6 : 1, letterSpacing: 1 }}
                >
                  {savingNick ? "..." : "保存"}
                </button>
                <button
                  onClick={() => setEditingNick(false)}
                  className="px-3 rounded-xl text-sm"
                  style={{ color: "rgba(232,213,196,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  取消
                </button>
              </div>
              {nickError && <div className="text-xs mt-2" style={{ color: "#D4849A" }}>{nickError}</div>}
            </div>
          ) : (
            <button onClick={startEditNick} className="w-full flex items-center justify-between text-left">
              <span className="text-sm font-light" style={{ letterSpacing: 1, color: "#E8D5C4" }}>
                {companion?.user_nickname || "未设置"}
              </span>
              <span className="text-xs" style={{ color: accent, letterSpacing: 1 }}>修改</span>
            </button>
          )}
        </div>

        {/* 菜单项 */}
        <div className="px-4 space-y-1">
          {!quota?.isMember && (
            <button onClick={onShowPaywall} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition" style={{ color: "rgba(232,213,196,0.85)", letterSpacing: 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              查看全部方案
              <ChevronRight style={{ width: 16, height: 16, opacity: 0.4 }} />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition"
            style={{ color: "rgba(232,213,196,0.8)", letterSpacing: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut style={{ width: 16, height: 16 }} />
            退出登录
          </button>
        </div>

        {/* 底部信息 */}
        <div className="mt-auto p-4 text-center">
          <p className="text-xs font-light" style={{ color: "rgba(232,213,196,0.8)", letterSpacing: 1 }}>
            更多功能即将开放
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── 付费墙 ── */
function Paywall({ isLover, onClose }: { isLover: boolean; onClose: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const accent = isLover ? "#D4849A" : "#C9A96E";
  const accentRgb = isLover ? "212, 132, 154" : "201, 169, 110";

  useEffect(() => {
    fetch("/api/pricing")
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(14,12,10,0.85)", backdropFilter: "blur(12px)" }} onClick={onClose}>
      <div className="rounded-3xl p-7 max-w-md w-full relative" style={{ background: "#151210", border: `1px solid rgba(${accentRgb}, 0.2)`, animation: "paywallIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-sm" style={{ color: "rgba(232,213,196,0.7)" }}>&times;</button>

        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `rgba(${accentRgb}, 0.15)`, border: `1px solid rgba(${accentRgb}, 0.3)` }}>
            <span className="text-lg">{isLover ? "\u2665" : "\u263A"}</span>
          </div>
          <h3 className="text-lg font-medium text-white leading-relaxed">
            {isLover ? "想让 TA 一直陪着你吗？" : "想让这段陪伴继续吗？"}
          </h3>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line" style={{ color: "rgba(232,213,196,0.8)" }}>
            {isLover
              ? "聊到现在，TA 已经开始记得你了。\n开通后，TA 会记住你说过的每件事——\n你的习惯、你的心事、你随口提过的小事。"
              : "聊了这么久，TA 已经有点懂你了。\n开通后，TA 会真正记住你们聊过的一切，\n随时找 TA 说话，不限次数。"}
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
                <button key={p.id} onClick={() => setSelected(p.id)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-left" style={{
                  border: selected === p.id ? `1px solid rgba(${accentRgb}, 0.4)` : "1px solid rgba(255,255,255,0.08)",
                  background: selected === p.id ? `rgba(${accentRgb}, 0.08)` : "rgba(255,255,255,0.03)",
                }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{p.name}</span>
                    {p.popular && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: accent, color: "#0E0C0A" }}>推荐</span>}
                    <span className="text-xs" style={{ color: "rgba(232,213,196,0.7)" }}>&middot; {p.hint}</span>
                  </div>
                  <span className="text-white font-semibold text-sm">&yen;{p.price}<span className="text-xs font-normal" style={{ color: "rgba(232,213,196,0.7)" }}>{p.period}</span></span>
                </button>
              ))}
            </div>

            {selectedPlan ? (
              <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs mb-3" style={{ color: "rgba(232,213,196,0.7)" }}>扫码支付后联系客服开通</p>
                <div className="bg-white rounded-xl p-2 mx-auto w-36 h-36 flex items-center justify-center">
                  <div className="text-xs text-gray-500 text-center px-2">收款码</div>
                </div>
                <p className="mt-3 text-sm" style={{ color: accent }}>客服 QQ：3801434603</p>
                <p className="mt-4 text-xs leading-relaxed" style={{ color: "rgba(232,213,196,0.85)" }}>
                  支付后，TA 就会真正记住你
                </p>
              </div>
            ) : (
              <button onClick={() => setSelected(plans[0]?.id || "")} className="w-full py-3 rounded-xl font-semibold text-sm text-white" style={{ background: accent }}>
                {isLover ? "让 TA 留下来" : "继续聊下去"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center" style={{ background: "#0E0C0A" }}>
        <div className="text-center" style={{ color: "rgba(232,213,196,0.7)" }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-amber-400/30 animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ letterSpacing: 2 }}>正在靠近...</p>
        </div>
      </div>
    }>
      <ChatInner />
    </Suspense>
  );
}
