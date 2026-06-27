"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function HomePage() {
  const { session, isLoading: authLoading } = useSessionContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [transitioning, setTransitioning] = useState<"friend" | "lover" | null>(null);

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

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const handleChoice = (mode: "friend" | "lover") => {
    setTransitioning(mode);
    setTimeout(() => {
      if (!session) {
        window.location.href = "/login?redirect=/chat?role=" + mode;
        return;
      }
      window.location.href = "/chat?role=" + mode;
    }, 900);
  };

  /* ── 认证加载中 ── */
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#08080F" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-amber-400/30 animate-spin" />
      </div>
    );
  }

  /* ── 老用户首页 ── */
  if (session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center relative" style={{ background: "#08080F", overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

        {/* 顶部 */}
        <div
          className="absolute text-center"
          style={{
            top: "12vh", zIndex: 10,
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(20px)",
            transition: "all 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="text-xs uppercase mb-6" style={{ letterSpacing: 10, color: "rgba(232, 213, 196, 0.25)" }}>Amara</div>
          <div className="text-lg md:text-xl font-light leading-relaxed" style={{ letterSpacing: 4, color: "rgba(232, 213, 196, 0.6)" }}>
            欢迎回来
          </div>
          <div className="text-sm font-light mt-3" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.3)" }}>
            你想以什么身份继续？
          </div>
        </div>

        {/* 双径 */}
        <div className="flex items-center justify-center relative z-10" style={{ gap: "8vw" }}>
          {/* 朋友 */}
          <div
            onClick={() => handleChoice("friend")}
            className="relative cursor-pointer flex flex-col items-center justify-center text-center"
            style={{
              width: 260, height: 300, borderRadius: 24,
              opacity: ready ? 1 : 0, transform: ready ? "scale(1)" : "scale(0.9)",
              transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: "0.6s",
            }}
          >
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                opacity: 0.15,
                background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201, 169, 110, 0.5), transparent 70%)",
                boxShadow: "0 0 60px rgba(201, 169, 110, 0.15), 0 0 120px rgba(201, 169, 110, 0.08), inset 0 0 40px rgba(201, 169, 110, 0.05)",
                animation: "breatheFriend 4s ease-in-out infinite",
              }}
            />
            <div className="relative z-10">
              <div className="mx-auto mb-5 relative" style={{ width: 48, height: 48, borderRadius: "50%", border: "1.5px solid rgba(201, 169, 110, 0.5)", boxShadow: "0 0 20px rgba(201, 169, 110, 0.2)" }}>
                <div className="absolute" style={{ inset: 8, borderRadius: "50%", border: "1px solid rgba(201, 169, 110, 0.3)" }} />
              </div>
              <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#C9A96E" }}>朋友</div>
              <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "rgba(201, 169, 110, 0.6)", opacity: 0.6 }}>继续陪伴 · 倾听 · 理解</div>
            </div>
          </div>

          {/* 分隔 */}
          <div className="hidden md:block" style={{ width: 1, height: 40, background: "linear-gradient(180deg, transparent, rgba(232, 213, 196, 0.1), transparent)" }} />

          {/* 恋人 */}
          <div
            onClick={() => handleChoice("lover")}
            className="relative cursor-pointer flex flex-col items-center justify-center text-center"
            style={{
              width: 260, height: 300, borderRadius: 24,
              opacity: ready ? 1 : 0, transform: ready ? "scale(1)" : "scale(0.9)",
              transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: "0.9s",
            }}
          >
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                opacity: 0.15,
                background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(212, 132, 154, 0.5), transparent 70%)",
                boxShadow: "0 0 60px rgba(212, 132, 154, 0.15), 0 0 120px rgba(212, 132, 154, 0.08), inset 0 0 40px rgba(212, 132, 154, 0.05)",
                animation: "breatheLover 4s ease-in-out infinite",
                animationDelay: "-2s",
              }}
            />
            <div className="relative z-10">
              <div className="mx-auto mb-5" style={{ width: 48, height: 48, borderRadius: "50%", background: "radial-gradient(circle, rgba(212, 132, 154, 0.4) 0%, transparent 70%)", boxShadow: "0 0 24px rgba(212, 132, 154, 0.3)" }} />
              <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#D4849A" }}>恋人</div>
              <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "rgba(212, 132, 154, 0.6)", opacity: 0.6 }}>继续亲密 · 共鸣 · 专属</div>
            </div>
          </div>
        </div>

        {/* 底部占位 */}
        <div
          className="absolute text-center"
          style={{
            bottom: "8vh", zIndex: 10,
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(10px)",
            transition: "all 1s ease",
            transitionDelay: "1.4s",
          }}
        >
          <p className="text-xs font-light" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.2)" }}>更多功能即将开放</p>
        </div>

        {/* 过渡动画 */}
        {transitioning && <TransitionOverlay mode={transitioning} />}
      </div>
    );
  }

  /* ── 新用户选择页 ── */
  return (
    <div className="h-screen flex flex-col items-center justify-center relative" style={{ background: "#08080F", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

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
        <div className="text-xs uppercase mb-6" style={{ letterSpacing: 10, color: "rgba(232, 213, 196, 0.25)" }}>Amara</div>
        <div className="text-lg md:text-xl font-light leading-relaxed" style={{ letterSpacing: 4, color: "rgba(232, 213, 196, 0.7)" }}>
          你想以什么样的身份<br />
          与 <span style={{ color: "#F4C2C2", textShadow: "0 0 20px rgba(244, 194, 194, 0.3)", fontStyle: "normal" }}>Amara</span> 相遇？
        </div>
      </div>

      {/* 双径 */}
      <div className="flex items-center justify-center relative z-10" style={{ gap: "8vw" }}>
        {/* 朋友 */}
        <div
          onClick={() => handleChoice("friend")}
          className="relative cursor-pointer flex flex-col items-center justify-center text-center"
          style={{
            width: 260, height: 320, borderRadius: 24,
            opacity: ready ? 1 : 0, transform: ready ? "scale(1)" : "scale(0.9)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            transitionDelay: "0.6s",
          }}
        >
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              opacity: 0.15,
              background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201, 169, 110, 0.5), transparent 70%)",
              boxShadow: "0 0 60px rgba(201, 169, 110, 0.15), 0 0 120px rgba(201, 169, 110, 0.08), inset 0 0 40px rgba(201, 169, 110, 0.05)",
              animation: "breatheFriend 4s ease-in-out infinite",
            }}
          />
          <div className="relative z-10">
            <div className="mx-auto mb-5 relative" style={{ width: 48, height: 48, borderRadius: "50%", border: "1.5px solid rgba(201, 169, 110, 0.5)", boxShadow: "0 0 20px rgba(201, 169, 110, 0.2)" }}>
              <div className="absolute" style={{ inset: 8, borderRadius: "50%", border: "1px solid rgba(201, 169, 110, 0.3)" }} />
            </div>
            <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#C9A96E" }}>朋友</div>
            <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "rgba(201, 169, 110, 0.8)", opacity: 0.5 }}>陪伴 · 倾听 · 理解</div>
            <div className="text-xs font-light mt-4" style={{ letterSpacing: 1, color: "rgba(201, 169, 110, 0.6)", opacity: 0, transition: "opacity 0.6s ease", transitionDelay: "0.2s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}>
              我在这里，听你说话
            </div>
          </div>
        </div>

        <div className="hidden md:block" style={{ width: 1, height: 40, background: "linear-gradient(180deg, transparent, rgba(232, 213, 196, 0.1), transparent)" }} />

        {/* 恋人 */}
        <div
          onClick={() => handleChoice("lover")}
          className="relative cursor-pointer flex flex-col items-center justify-center text-center"
          style={{
            width: 260, height: 320, borderRadius: 24,
            opacity: ready ? 1 : 0, transform: ready ? "scale(1)" : "scale(0.9)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            transitionDelay: "0.9s",
          }}
        >
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              opacity: 0.15,
              background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(212, 132, 154, 0.5), transparent 70%)",
              boxShadow: "0 0 60px rgba(212, 132, 154, 0.15), 0 0 120px rgba(212, 132, 154, 0.08), inset 0 0 40px rgba(212, 132, 154, 0.05)",
              animation: "breatheLover 4s ease-in-out infinite",
              animationDelay: "-2s",
            }}
          />
          <div className="relative z-10">
            <div className="mx-auto mb-5" style={{ width: 48, height: 48, borderRadius: "50%", background: "radial-gradient(circle, rgba(212, 132, 154, 0.4) 0%, transparent 70%)", boxShadow: "0 0 24px rgba(212, 132, 154, 0.3)" }} />
            <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#D4849A" }}>恋人</div>
            <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "rgba(212, 132, 154, 0.8)", opacity: 0.5 }}>亲密 · 共鸣 · 专属</div>
            <div className="text-xs font-light mt-4" style={{ letterSpacing: 1, color: "rgba(212, 132, 154, 0.6)", opacity: 0, transition: "opacity 0.6s ease", transitionDelay: "0.2s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}>
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
        <p className="text-xs font-light" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.3)" }}>这不是永久的决定，你随时可以回到这里</p>
        <p className="text-xs font-light mt-2" style={{ letterSpacing: 2, color: "rgba(232, 213, 196, 0.22)" }}>先让我们说说话。没有门槛，也没有承诺</p>
      </div>

      {/* 过渡动画 */}
      {transitioning && <TransitionOverlay mode={transitioning} />}
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
      {/* 光晕 */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${color}, 0.4) 0%, transparent 70%)`,
          animation: "transitionGlow 0.6s ease-out forwards",
          position: "absolute",
        }}
      />
      {/* 文字 */}
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
