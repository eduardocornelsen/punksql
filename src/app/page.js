"use client";
import dynamic from "next/dynamic";

const ASCII_LOGO = [
  "██████╗ ██╗   ██╗███╗   ██╗██╗  ██╗███████╗ ██████╗ ██╗     ",
  "██╔══██╗██║   ██║████╗  ██║██║ ██╔╝██╔════╝██╔═══██╗██║     ",
  "██████╔╝██║   ██║██╔██╗ ██║█████╔╝ ███████╗██║   ██║██║     ",
  "██╔═══╝ ██║   ██║██║╚██╗██║██╔═██╗ ╚════██║██║▄▄ ██║██║     ",
  "██║     ╚██████╔╝██║ ╚████║██║  ██╗███████║╚██████╔╝███████╗",
  "╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝ ╚══▀▀═╝ ╚══════╝",
].join("\n");

const PunkSQL = dynamic(() => import("@/components/PunkSQL"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "100vh",
      width: "100%",
      background: "#000000",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      padding: "0 12px",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Courier New', monospace",
    }}>
      <pre style={{
        margin: 0,
        fontSize: "clamp(4px, 1.55vw, 9px)",
        color: "#E0E0E0",
        lineHeight: 1.15,
        letterSpacing: 0,
        textAlign: "left",
        fontFamily: "inherit",
        userSelect: "none",
        whiteSpace: "pre",
      }}>{ASCII_LOGO}</pre>
      <div style={{
        fontSize: 10,
        color: "#555555",
        letterSpacing: 4,
        marginTop: 14,
        marginBottom: 30,
        fontFamily: "inherit",
      }}>learn sql by doing</div>
      <div style={{ fontSize: 12, color: "#00FFFF", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#555555" }}>$</span>
        <span style={{ color: "#888888" }}>booting engine</span>
        <span style={{ animation: "blinkLoad 1s step-end infinite", color: "#00FFFF" }}>█</span>
      </div>
      <style>{`
        @keyframes blinkLoad{0%,49%{opacity:1}50%,100%{opacity:0}}
      `}</style>
    </div>
  ),
});

export default function Home() {
  return <PunkSQL />;
}
