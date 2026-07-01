"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";

type Role = "friend" | "lover";

export default function HomePage() {
  const { session } = useSessionContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<Role | null>(null);

  /* 已登录：只用于"继续上次"的提示气泡，不再强制跳转，让用户随时重选 */
  const [hasCompanion, setHasCompanion] = useState(false);
  const [lastRole, setLastRole] = useState<Role | null>(null);
  useEffect(() => {
    if (!session) return;
    fetch("/api/companion/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.companions?.length > 0) {
          setHasCompanion(true);
          setLastRole(data.companions[0].relationship_type as Role);
        }
      })
      .catch(() => {});
  }, [session]);

  /* 粒子背景 — 数量按屏幕宽度自适应，省电 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = window.innerWidth;
    let H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    const isMobile = W < 640;
    const count = isMobile ? 30 : 60;
    const particles: any[] = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      const color =
        roll < 0.33
          ? [201, 169, 110]
          : roll < 0.66
          ? [232, 213, 196]
          : [212, 132, 154];
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.4 + 0.1,
        color,
      });
    }

    let raf: number;
    function animate() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(animate);
    }
    animate();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.scale(dpr, dpr);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* 选择 → 过渡动画 → 跳转 */
  const handleSelect = (role: Role) => {
    if (selected) return; // 防止连点
    setSelected(role);
    const target = session
      ? `/chat?role=${role}`
      : `/login?redirect=/chat?role=${role}`;
    setTimeout(() => {
      window.location.href = target;
    }, 480);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#08080F",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* 内容层 — flex 流式布局，移动端纵向堆叠 */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "5vh 16px",
          boxSizing: "border-box" as const,
          gap: "4vh",
        }}
      >
        {/* 顶部标识 */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 10,
              color: "#E8D5C4",
              textTransform: "uppercase" as const,
              marginBottom: 20,
            }}
          >
            Amara
          </div>
          <div
            style={{
              fontSize: "clamp(16px, 4.5vw, 18px)",
              fontWeight: 300,
              letterSpacing: 4,
              color: "#E8D5C4",
              lineHeight: 1.8,
            }}
          >
            你想以什么样的身份
            <br />
            与{" "}
            <span
              style={{
                color: "#FFB6C1",
                textShadow: "0 0 20px rgba(255, 182, 193, 0.4)",
              }}
            >
              Amara
            </span>{" "}
            相遇？
          </div>
          {hasCompanion && lastRole && (
            <button
              onClick={() => handleSelect(lastRole)}
              style={{
                marginTop: 14,
                background: "transparent",
                border: "1px solid rgba(232, 213, 196, 0.2)",
                borderRadius: 999,
                padding: "6px 16px",
                color: "#B5ACA0",
                fontSize: 11,
                letterSpacing: 2,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              继续上次的相遇 →
            </button>
          )}
        </div>

        {/* 双径 — 移动端纵向，桌面横向 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: "min(8vw, 60px)",
            flexWrap: "wrap" as const,
            maxWidth: "100%",
          }}
        >
          <RoleCard
            role="friend"
            selected={selected}
            onSelect={handleSelect}
            accent={[201, 169, 110]}
            title="朋友"
            subtitle="陪伴 · 倾听 · 理解"
          />
          {/* 分隔线 — 桌面显示，手机隐藏 */}
          <div
            style={{
              width: 1,
              height: 40,
              background:
                "linear-gradient(180deg, transparent, rgba(232, 213, 196, 0.1), transparent)",
              display: "none",
            }}
            className="amara-divider"
          />
          <RoleCard
            role="lover"
            selected={selected}
            onSelect={handleSelect}
            accent={[212, 132, 154]}
            title="恋人"
            subtitle="亲密 · 共鸣 · 专属"
            filled
          />
        </div>

        {/* 底部 */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 300,
              letterSpacing: 2,
              color: "#C8BFB0",
              margin: 0,
            }}
          >
            这不是永久的决定，你随时可以回到这里
          </p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 300,
              letterSpacing: 2,
              color: "#B5ACA0",
              marginTop: 8,
            }}
          >
            先让我们说说话。没有门槛，也没有承诺
          </p>
        </div>
      </div>

      {/* 桌面端分隔线显示 */}
      <style>{`
        @media (min-width: 641px) {
          .amara-divider { display: block !important; }
        }
      `}</style>
    </div>
  );
}

/* ===== 角色卡片：自带 hover / active / 选中过渡 ===== */
function RoleCard({
  role,
  selected,
  onSelect,
  accent,
  title,
  subtitle,
  filled,
}: {
  role: Role;
  selected: Role | null;
  onSelect: (r: Role) => void;
  accent: [number, number, number];
  title: string;
  subtitle: string;
  filled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isSelected = selected === role;
  const isOther = selected && selected !== role;

  // 选中态：放大 + 淡出；其他卡片：淡出更彻底
  const scale = isSelected ? 1.08 : pressed ? 0.97 : hovered ? 1.03 : 1;
  const opacity = selected
    ? isSelected
      ? 1
      : 0.2
    : 1;
  const glowStrength = hovered || isSelected ? 0.32 : 0.15;
  const lift = hovered || isSelected ? -6 : 0;

  const accentRgb = `${accent[0]},${accent[1]},${accent[2]}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => onSelect(role)}
      style={{
        position: "relative",
        width: "min(260px, 78vw)",
        height: "min(320px, 48vh)",
        borderRadius: 24,
        cursor: selected ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        transform: `translateY(${lift}px) scale(${scale})`,
        opacity,
        transition: "transform 420ms cubic-bezier(0.2,0.8,0.2,1), opacity 420ms ease, box-shadow 320ms ease",
        flexShrink: 0,
      }}
    >
      {/* 光晕背景层 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          opacity: hovered || isSelected ? 0.28 : 0.15,
          background: `radial-gradient(ellipse 60% 60% at 50% 50%, rgba(${accentRgb}, 0.5), transparent 70%)`,
          boxShadow: `0 0 60px rgba(${accentRgb}, ${glowStrength}), 0 0 120px rgba(${accentRgb}, ${glowStrength / 2}), inset 0 0 40px rgba(${accentRgb}, 0.05)`,
          transition: "opacity 320ms ease, box-shadow 320ms ease",
        }}
      />
      {/* 边框层 — hover/选中时浮现 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          border: `1px solid rgba(${accentRgb}, ${hovered || isSelected ? 0.45 : 0.15})`,
          transition: "border-color 320ms ease",
        }}
      />
      <div style={{ position: "relative", zIndex: 2 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: filled ? "none" : `1.5px solid rgba(${accentRgb}, 0.5)`,
            background: filled
              ? `radial-gradient(circle, rgba(${accentRgb}, 0.4) 0%, transparent 70%)`
              : "transparent",
            boxShadow: `0 0 ${hovered || isSelected ? 32 : 20}px rgba(${accentRgb}, ${hovered || isSelected ? 0.4 : 0.2})`,
            margin: "0 auto 20px",
            transition: "box-shadow 320ms ease",
          }}
        />
        <div
          style={{
            fontSize: "clamp(20px, 5vw, 22px)",
            fontWeight: 300,
            letterSpacing: 6,
            color: `rgb(${accent[0] + 30},${accent[1] + 30},${accent[2] + 30})`,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 300,
            letterSpacing: 2,
            color: `rgb(${accent[0]},${accent[1]},${accent[2]})`,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
