"use client";

import { useEffect, useRef } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function HomePage() {
  const { session } = useSessionContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* 已登录跳转 */
  useEffect(() => {
    if (!session) return;
    fetch("/api/companion/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.companions?.length > 0) {
          window.location.href = `/chat?role=${data.companions[0].relationship_type}`;
        }
      })
      .catch(() => {});
  }, [session]);

  /* 粒子背景 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const particles: any[] = [];
    for (let i = 0; i < 60; i++) {
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
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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

      {/* 内容层 — 绝对不用 className，全部内联样式 */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* 顶部标识 */}
        <div
          style={{
            position: "absolute",
            top: "12vh",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 10,
              color: "#E8D5C4",
              textTransform: "uppercase" as const,
              marginBottom: 24,
            }}
          >
            Amara
          </div>
          <div
            style={{
              fontSize: 18,
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
        </div>

        {/* 双径 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8vw",
          }}
        >
          {/* 朋友 */}
          <a
            href="/login?redirect=/chat?role=friend"
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                position: "relative",
                width: 260,
                height: 320,
                borderRadius: 24,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 24,
                  opacity: 0.15,
                  background:
                    "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201, 169, 110, 0.5), transparent 70%)",
                  boxShadow:
                    "0 0 60px rgba(201, 169, 110, 0.15), 0 0 120px rgba(201, 169, 110, 0.08), inset 0 0 40px rgba(201, 169, 110, 0.05)",
                }}
              />
              <div style={{ position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: "1.5px solid rgba(201, 169, 110, 0.5)",
                    boxShadow: "0 0 20px rgba(201, 169, 110, 0.2)",
                    margin: "0 auto 20px",
                  }}
                />
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 300,
                    letterSpacing: 6,
                    color: "#D4B87A",
                    marginBottom: 12,
                  }}
                >
                  朋友
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 300,
                    letterSpacing: 2,
                    color: "#C9A96E",
                  }}
                >
                  陪伴 · 倾听 · 理解
                </div>
              </div>
            </div>
          </a>

          <div
            style={{
              width: 1,
              height: 40,
              background:
                "linear-gradient(180deg, transparent, rgba(232, 213, 196, 0.1), transparent)",
            }}
          />

          {/* 恋人 */}
          <a
            href="/login?redirect=/chat?role=lover"
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                position: "relative",
                width: 260,
                height: 320,
                borderRadius: 24,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 24,
                  opacity: 0.15,
                  background:
                    "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(212, 132, 154, 0.5), transparent 70%)",
                  boxShadow:
                    "0 0 60px rgba(212, 132, 154, 0.15), 0 0 120px rgba(212, 132, 154, 0.08), inset 0 0 40px rgba(212, 132, 154, 0.05)",
                }}
              />
              <div style={{ position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, rgba(212, 132, 154, 0.4) 0%, transparent 70%)",
                    boxShadow: "0 0 24px rgba(212, 132, 154, 0.3)",
                    margin: "0 auto 20px",
                  }}
                />
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 300,
                    letterSpacing: 6,
                    color: "#E8909F",
                    marginBottom: 12,
                  }}
                >
                  恋人
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 300,
                    letterSpacing: 2,
                    color: "#D4849A",
                  }}
                >
                  亲密 · 共鸣 · 专属
                </div>
              </div>
            </div>
          </a>
        </div>

        {/* 底部 */}
        <div
          style={{
            position: "absolute",
            bottom: "6vh",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 300,
              letterSpacing: 2,
              color: "#C8BFB0",
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
    </div>
  );
}
