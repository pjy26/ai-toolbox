import { ImageResponse } from "next/og";

export const alt = "Amara — Not just remembered. Truly understood.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px 76px",
        background: "#f8f5ef",
        color: "#282621",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 42 }}>
        <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #a34f3d", borderRadius: 34 }}>
          <div style={{ width: 12, height: 12, background: "#a34f3d", borderRadius: 12 }} />
        </div>
        Amara
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", color: "#a34f3d", fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: 5 }}>AMARA GROWS WITH YOU</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 940, marginTop: 24, fontSize: 72, lineHeight: 1.12, letterSpacing: -2 }}>
          <span>Not just remembered.</span>
          <span>Truly understood.</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #d8cfc2", paddingTop: 24, color: "#6e685f", fontFamily: "Arial, sans-serif", fontSize: 22 }}>
        <span>A relationship that grows with you.</span>
        <span>amarapjy.xyz</span>
      </div>
    </div>,
    size,
  );
}
