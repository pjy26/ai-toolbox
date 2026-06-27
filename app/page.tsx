"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";

function HomeInner() {
  const { session, isLoading: authLoading } = useSessionContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [creating, setCreating] = useState(false);

  /* ── 已登录且有关系 → 自动跳转 ── */
  useEffect(() => {
    if (!session || authLoading) return;
    fetch("/api/companion/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.companions?.length > 0) {
          const c = data.companions[0];
          window.location.href = `/chat?role=${c.relationship_type}`;
        }
      })
      .catch(() => {});
  }, [session, authLoading]);

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

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const handleChoice = async (mode: "friend" | "lover") => {
    setCreating(true);
    try {
      const res = await fetch("/api/companion/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationship_type: mode }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || "创建失败");
      setTimeout(() => { window.location.href = `/chat?role=${mode}`; }, 900);
    } catch {
      setTimeout(() => {
        window.location.href = session
          ? `/chat?role=${mode}`
          : `/login?redirect=/chat?role=${mode}`;
      }, 900);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center relative" style={{ background: "#08080F", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* 顶部标识 — 直接可见，无 opacity 控制 */}
      <div className="absolute text-center" style={{ top: "12vh", zIndex: 10 }}>
        <div className="text-xs uppercase mb-6" style={{ letterSpacing: 10, color: "#E8D5C4" }}>Amara</div>
        <div className="text-lg md:text-xl font-light leading-relaxed" style={{ letterSpacing: 4, color: "#E8D5C4" }}>
          你想以什么样的身份<br />
          与 <span style={{ color: "#FFB6C1", textShadow: "0 0 20px rgba(255, 182, 193, 0.4)", fontStyle: "normal" }}>Amara</span> 相遇？
        </div>
      </div>

      {/* 双径 — 直接可见 */}
      <div className="flex items-center justify-center relative z-10" style={{ gap: "8vw" }}>
        {/* 朋友 */}
        <div
          onClick={() => !creating && handleChoice("friend")}
          className="relative cursor-pointer flex flex-col items-center justify-center text-center"
          style={{ width: 260, height: 320, borderRadius: 24, pointerEvents: creating ? "none" : "auto" }}
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
            <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#D4B87A" }}>朋友</div>
            <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "#C9A96E" }}>陪伴 · 倾听 · 理解</div>
            <div className="text-xs font-light mt-4" style={{ letterSpacing: 1, color: "#D4B87A", opacity: 0.6, transition: "opacity 0.6s ease" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}>
              我在这里，听你说话
            </div>
          </div>
        </div>

        <div className="hidden md:block" style={{ width: 1, height: 40, background: "linear-gradient(180deg, transparent, rgba(232, 213, 196, 0.1), transparent)" }} />

        {/* 恋人 */}
        <div
          onClick={() => !creating && handleChoice("lover")}
          className="relative cursor-pointer flex flex-col items-center justify-center text-center"
          style={{ width: 260, height: 320, borderRadius: 24, pointerEvents: creating ? "none" : "auto" }}
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
            <div className="text-xl font-light mb-3" style={{ letterSpacing: 6, color: "#E8909F" }}>恋人</div>
            <div className="text-xs font-light leading-loose" style={{ letterSpacing: 2, color: "#D4849A" }}>亲密 · 共鸣 · 专属</div>
            <div className="text-xs font-light mt-4" style={{ letterSpacing: 1, color: "#E8909F", opacity: 0.6, transition: "opacity 0.6s ease" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}>
              我在这里，为你存在
            </div>
          </div>
        </div>
      </div>

      {/* 底部 — 直接可见 */}
      <div className="absolute text-center" style={{ bottom: "6vh", zIndex: 10 }}>
        <p className="text-xs font-light" style={{ letterSpacing: 2, color: "#C8BFB0" }}>这不是永久的决定，你随时可以回到这里</p>
        <p className="text-xs font-light mt-2" style={{ letterSpacing: 2, color: "#B5ACA0" }}>先让我们说说话。没有门槛，也没有承诺</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return <HomeInner />;
}
