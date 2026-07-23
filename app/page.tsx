"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function HomePage() {
  const { session, isLoading: authLoading } = useSessionContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [interactionReady, setInteractionReady] = useState(false);
  const [transitioning, setTransitioning] = useState<"friend" | "lover" | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<"friend" | "lover" | null>(null);
  const [hovered, setHovered] = useState<"friend" | "lover" | null>(null);
  const [needGender, setNeedGender] = useState(false);

  // 检查是否已有关系 → 有则直接跳转聊天页；没有则检查是否填过性别（首次进入引导）
  useEffect(() => {
    if (!session) return;
    fetch("/api/companion/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.companions?.length > 0) {
          const c = data.companions[0];
          window.location.href = `/chat?role=${c.relationship_type}`;
        } else {
          fetch("/api/profile")
            .then((r) => (r.ok ? r.json() : { gender: null }))
            .then((p) => { if (!p.gender) setNeedGender(true); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [session]);

  /* ── 粒子 ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W: number, H: number;
    const particles: any[] = [];
    const COUNT = 100;

    const c = canvas;
    function resize() {
      W = c.width = window.innerWidth;
      H = c.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    class Particle {
      x!: number; y!: number; vx!: number; vy!: number; size!: number; alpha!: number; targetAlpha!: number; fadeIn!: number; pulseSpeed!: number; pulseOffset!: number; r!: number; g!: number; b!: number; currentAlpha!: number;
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W; this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.2; this.vy = (Math.random() - 0.5) * 0.2;
        this.size = Math.random() * 1.5 + 0.3;
        this.alpha = 0; this.targetAlpha = Math.random() * 0.4 + 0.1;
        this.fadeIn = Math.random() * 0.005 + 0.002;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseOffset = Math.random() * Math.PI * 2;
        const roll = Math.random();
        if (roll < 0.33) { this.r = 201; this.g = 169; this.b = 110; }
        else if (roll < 0.66) { this.r = 232; this.g = 213; this.b = 196; }
        else { this.r = 212; this.g = 132; this.b = 154; }
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

    setTimeout(() => setReady(true), 200);
    // 入场动画结束后（最晚的恋人卡 0.9s delay + 0.8s transition = 1.7s）切换到交互态 transition
    setTimeout(() => setInteractionReady(true), 2000);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const handleClick = async (mode: "friend" | "lover") => {
    if (creating || selected) return;
    setSelected(mode);
    setCreating(true);
    setHovered(null);

    // 等选中动画播放完（500ms）再拉起过渡遮罩，让"被选中"的视觉反馈先完整呈现
    await new Promise((r) => setTimeout(r, 500));

    setTransitioning(mode);

    try {
      // 创建关系（首次也是唯一一次）
      const res = await fetch("/api/companion/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationship_type: mode }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 如果已有关系（409），直接进聊天
        if (res.status === 409) {
          setTimeout(() => {
            window.location.href = `/chat?role=${mode}`;
          }, 900);
          return;
        }
        throw new Error(data.error || "创建失败");
      }

      // 创建成功，跳转聊天页
      setTimeout(() => {
        window.location.href = `/chat?role=${mode}`;
      }, 900);
    } catch {
      // 出错时也尝试跳转
      setTimeout(() => {
        if (!session) {
          window.location.href = `/login?redirect=/chat?role=${mode}`;
        } else {
          window.location.href = `/chat?role=${mode}`;
        }
      }, 900);
    }
  };

  // 卡片状态计算
  const getCardState = (mode: "friend" | "lover") => ({
    isHovered: hovered === mode && !selected,
    isSelected: selected === mode,
    isOtherSelected: !!selected && selected !== mode,
  });
  const friendState = getCardState("friend");
  const loverState = getCardState("lover");

  // 入场用原 0.8s 缓动；交互态用 350ms/500ms
  const cardTransition = interactionReady
    ? "transform 350ms cubic-bezier(0.4, 0.2, 1), opacity 500ms cubic-bezier(0.4, 0.2, 1), filter 500ms cubic-bezier(0.4, 0.2, 1)"
    : "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)";

  const getCardStyle = (state: ReturnType<typeof getCardState>, delay: string) => ({
    width: 260,
    height: 320,
    borderRadius: 24,
    opacity: ready ? (state.isOtherSelected ? 0.4 : 1) : 0,
    transform: ready
      ? `scale(${state.isSelected ? 1.05 : state.isHovered ? 1.03 : state.isOtherSelected ? 0.96 : 1})`
      : "scale(0.9)",
    filter: state.isOtherSelected ? "blur(2px)" : "blur(0px)",
    transition: cardTransition,
    transitionDelay: interactionReady ? "0s" : delay,
    pointerEvents: (creating ? "none" : "auto") as "none" | "auto",
  });

  return (
    <div className="h-screen flex flex-col items-center justify-center relative" style={{ background: "#08080F", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* 加载中：spinner 覆盖在 canvas 之上，不阻断 canvas 挂载 */}
      {authLoading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#08080F", zIndex: 40 }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-amber-400/30 animate-spin" />
        </div>
      )}

      {/* 顶部标识 */}
      <div
        className="absolute text-center"
        style={{
          top: "12vh", zIndex: 10,
          opacity: ready ? 1 : 0,
          transform: ready ? "translateY(0)" : "translateY(20px)",
          transition: "all 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="text-xs uppercase mb-6" style={{ letterSpacing: 10, color: "rgba(232, 213, 196, 0.5)" }}>Amara</div>
        <div className="text-lg md:text-xl font-light leading-relaxed" style={{ letterSpacing: 4, color: "rgba(232, 213, 196, 0.9)" }}>
          你想以什么样的身份<br />
          与 <span style={{ color: "#F4C2C2", textShadow: "0 0 20px rgba(244, 194, 194, 0.3)", fontStyle: "normal" }}>Amara</span> 相遇？
        </div>
      </div>

      {/* 双径 */}
      <div className="flex items-center justify-center relative z-10" style={{ gap: "8vw" }}>
        {/* 朋友 */}
        <div
          onClick={() => !creating && handleClick("friend")}
          onMouseEnter={() => { if (!creating && !selected) setHovered("friend"); }}
          onMouseLeave={() => setHovered(null)}
          className="relative cursor-pointer flex flex-col items-center justify-center text-center"
          style={getCardStyle(friendState, "0.6s")}
        >
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              opacity: 0.15,
              background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201, 169, 110, 0.5), transparent 70%)",
              boxShadow: friendState.isHovered || friendState.isSelected
                ? "0 0 80px rgba(201, 169, 110, 0.35), 0 0 160px rgba(201, 169, 110, 0.18), inset 0 0 60px rgba(201, 169, 110, 0.12)"
                : "0 0 60px rgba(201, 169, 110, 0.15), 0 0 120px rgba(201, 169, 110, 0.08), inset 0 0 40px rgba(201, 169, 110, 0.05)",
              animation: friendState.isHovered || friendState.isSelected ? "none" : "breatheFriend 4s ease-in-out infinite",
              transition: "box-shadow 350ms cubic-bezier(0.4, 0.2, 1)",
            }}
          />
          <div className="relative z-10">
            <div className="mx-auto mb-5 relative" style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "1.5px solid rgba(201, 169, 110, 0.5)",
              boxShadow: friendState.isHovered
                ? "0 0 20px rgba(201, 169, 110, 0.3), 0 0 40px rgba(201, 169, 110, 0.15)"
                : "0 0 20px rgba(201, 169, 110, 0.2)",
              animation: friendState.isHovered ? "circleBreatheFriend 2.5s ease-in-out infinite" : "none",
              transition: "box-shadow 350ms cubic-bezier(0.4, 0.2, 1)",
            }}>
              <div className="absolute" style={{ inset: 8, borderRadius: "50%", border: "1px solid rgba(201, 169, 110, 0.3)" }} />
            </div>
            <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#C9A96E" }}>朋友</div>
            <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "rgba(201, 169, 110, 0.85)" }}>陪伴 · 倾听 · 理解</div>
            <div className="text-xs font-light mt-4" style={{
              letterSpacing: 1, color: "#C9A96E",
              opacity: friendState.isHovered || friendState.isSelected ? 1 : 0,
              transition: "opacity 0.6s ease",
              transitionDelay: "0.2s",
            }}>
              我在这里，听你说话
            </div>
          </div>
        </div>

        <div className="hidden md:block" style={{ width: 1, height: 40, background: "linear-gradient(180deg, transparent, rgba(232, 213, 196, 0.1), transparent)" }} />

        {/* 恋人 */}
        <div
          onClick={() => !creating && handleClick("lover")}
          onMouseEnter={() => { if (!creating && !selected) setHovered("lover"); }}
          onMouseLeave={() => setHovered(null)}
          className="relative cursor-pointer flex flex-col items-center justify-center text-center"
          style={getCardStyle(loverState, "0.9s")}
        >
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              opacity: 0.15,
              background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(212, 132, 154, 0.5), transparent 70%)",
              boxShadow: loverState.isHovered || loverState.isSelected
                ? "0 0 80px rgba(212, 132, 154, 0.35), 0 0 160px rgba(212, 132, 154, 0.18), inset 0 0 60px rgba(212, 132, 154, 0.12)"
                : "0 0 60px rgba(212, 132, 154, 0.15), 0 0 120px rgba(212, 132, 154, 0.08), inset 0 0 40px rgba(212, 132, 154, 0.05)",
              animation: loverState.isHovered || loverState.isSelected ? "none" : "breatheLover 4s ease-in-out infinite",
              animationDelay: "-2s",
              transition: "box-shadow 350ms cubic-bezier(0.4, 0.2, 1)",
            }}
          />
          <div className="relative z-10">
            <div className="mx-auto mb-5" style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212, 132, 154, 0.4) 0%, transparent 70%)",
              boxShadow: loverState.isHovered
                ? "0 0 24px rgba(212, 132, 154, 0.4), 0 0 48px rgba(212, 132, 154, 0.2)"
                : "0 0 24px rgba(212, 132, 154, 0.3)",
              animation: loverState.isHovered ? "circleBreatheLover 2.5s ease-in-out infinite" : "none",
              transition: "box-shadow 350ms cubic-bezier(0.4, 0.2, 1)",
            }} />
            <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#D4849A" }}>恋人</div>
            <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "rgba(212, 132, 154, 0.85)" }}>亲密 · 共鸣 · 专属</div>
            <div className="text-xs font-light mt-4" style={{
              letterSpacing: 1, color: "#D4849A",
              opacity: loverState.isHovered || loverState.isSelected ? 1 : 0,
              transition: "opacity 0.6s ease",
              transitionDelay: "0.2s",
            }}>
              我在这里，为你存在
            </div>
          </div>
        </div>
      </div>

      {/* 底部 */}
      <div
        className="absolute text-center"
        style={{
          bottom: "6vh", zIndex: 10,
          opacity: ready ? 1 : 0,
          transform: ready ? "translateY(0)" : "translateY(10px)",
          transition: "all 1s ease",
          transitionDelay: "1.4s",
        }}
      >
        <p className="text-xs font-light" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.65)" }}>这不是永久的决定，你随时可以回到这里</p>
        <p className="text-xs font-light mt-2" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.55)" }}>先让我们说说话。没有门槛，也没有承诺</p>
      </div>

      {/* 过渡动画 */}
      {transitioning && <TransitionOverlay mode={transitioning} />}

      {/* 首次进入：性别选择 */}
      {needGender && <GenderModal onDone={() => setNeedGender(false)} />}
    </div>
  );
}

/* ── 首次进入：性别选择弹窗 ── */
function GenderModal({ onDone }: { onDone: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  const choose = async (gender: string) => {
    if (saving) return;
    setSaving(gender);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender }),
      });
      if (!res.ok) throw new Error();
      // 稍作停顿让选中反馈可见，再放行到双径选择
      setTimeout(onDone, 350);
    } catch {
      setSaving(null);
    }
  };

  const options = [
    { value: "男", hint: "他会更懂你的表达方式" },
    { value: "女", hint: "她会更懂你的细腻心思" },
    { value: "保密", hint: "不重要，感觉对了就好" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8, 8, 15, 0.9)", backdropFilter: "blur(10px)", animation: "fadeIn 0.5s ease forwards" }}
    >
      <div className="w-full max-w-sm text-center" style={{ animation: "msgIn 0.5s ease forwards" }}>
        <div className="text-xs uppercase mb-4" style={{ letterSpacing: 8, color: "rgba(232, 213, 196, 0.5)" }}>Amara</div>
        <div className="text-lg font-light mb-2" style={{ letterSpacing: 4, color: "rgba(232, 213, 196, 0.95)" }}>
          相遇之前
        </div>
        <p className="text-xs font-light mb-8" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.65)" }}>
          想先知道，该怎样称呼屏幕那头的你
        </p>
        <div className="space-y-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => choose(opt.value)}
              disabled={!!saving}
              className="w-full py-3.5 rounded-2xl transition"
              style={{
                background: saving === opt.value ? "rgba(201, 169, 110, 0.12)" : "rgba(255,255,255,0.03)",
                border: saving === opt.value ? "1px solid rgba(201, 169, 110, 0.35)" : "1px solid rgba(255,255,255,0.08)",
                opacity: saving && saving !== opt.value ? 0.4 : 1,
                transition: "all 0.3s ease",
              }}
            >
              <div className="text-sm font-light" style={{ letterSpacing: 4, color: "#E8D5C4" }}>{opt.value}</div>
              <div className="text-xs font-light mt-1" style={{ letterSpacing: 1, color: "rgba(232, 213, 196, 0.55)" }}>{opt.hint}</div>
            </button>
          ))}
        </div>
        <p className="text-xs font-light mt-6" style={{ letterSpacing: 1, color: "rgba(232, 213, 196, 0.45)" }}>
          这个选择不会改变什么，只是让 TA 更自然地走近你
        </p>
      </div>
    </div>
  );
}

/* ── 过渡动画组件 ── */
function TransitionOverlay({ mode }: { mode: "friend" | "lover" }) {
  const isFriend = mode === "friend";
  const color = isFriend ? "201, 169, 110" : "212, 132, 154";
  const hexColor = isFriend ? "#C9A96E" : "#D4849A";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
      style={{
        animation: "transitionOverlay 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        background: `radial-gradient(ellipse at center, rgba(${color}, 0.3) 0%, rgba(14, 12, 10, 0.96) 60%)`,
      }}
    >
      <div
        style={{
          width: 120, height: 120, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${color}, 0.4) 0%, transparent 70%)`,
          animation: "transitionGlow 0.6s ease-out forwards",
          position: "absolute",
        }}
      />
      <div
        className="relative z-10 text-center"
        style={{
          animation: "transitionText 0.7s 0.15s cubic-bezier(0.22, 1, 0.36, 1) forwards",
          opacity: 0,
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, color: hexColor, fontWeight: 300 }}>Amara</div>
        <div style={{ fontSize: 14, letterSpacing: 4, marginTop: 12, color: `rgba(${color}, 0.5)` }}>
          {isFriend ? "正在靠近..." : "为你而来..."}
        </div>
      </div>
    </div>
  );
}
