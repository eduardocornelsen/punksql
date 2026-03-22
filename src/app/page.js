"use client";
import dynamic from "next/dynamic";

const QueryQuest = dynamic(() => import("@/components/QueryQuest"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "100vh",
      background: "#020410",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <div style={{ fontSize: 24, color: "#00F0FF", marginBottom: 16, letterSpacing: 4 }}>
        QUERYQUEST
      </div>
      <div style={{ fontSize: 14, color: "#5A7E98", animation: "pulse 1.5s ease infinite" }}>
        loading sql engine...
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
      `}</style>
    </div>
  ),
});

export default function Home() {
  return <QueryQuest />;
}
