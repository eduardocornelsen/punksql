"use client";
import dynamic from "next/dynamic";

const ASCII_LOGO = `
 ██████╗ ██╗   ██╗███╗  ██╗██╗  ██╗
 ██╔══██╗██║   ██║████╗ ██║██║ ██╔╝
 ██████╔╝██║   ██║██╔██╗██║█████╔╝
 ██╔═══╝ ██║   ██║██║╚████║██╔═██╗
 ██║     ╚██████╔╝██║ ╚███║██║  ██╗
 ╚═╝      ╚═════╝ ╚═╝  ╚══╝╚═╝  ╚═╝
`.trim();

const PunkSQL = dynamic(() => import("@/components/PunkSQL"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "100vh",
      background: "#000000",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Courier New', monospace",
    }}>
      <pre style={{
        margin: "0 0 8px 0",
        fontSize: "clamp(6px, 1.8vw, 11px)",
        color: "#CCCCCC",
        lineHeight: 1.2,
        letterSpacing: 0,
        textAlign: "left",
        fontFamily: "inherit",
        userSelect: "none",
      }}>{ASCII_LOGO}</pre>
      <div style={{
        fontSize: 10,
        color: "#444444",
        letterSpacing: 3,
        marginBottom: 28,
        fontFamily: "inherit",
      }}>SQL ─── learn by doing</div>
      <div style={{ fontSize: 12, color: "#555555", animation: "pulse 1.5s ease infinite", fontFamily: "inherit" }}>
        loading sql engine...
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
      `}</style>
    </div>
  ),
});

export default function Home() {
  return <PunkSQL />;
}
