"use client";
// Shared ASCII/box-drawing result grid for {columns, rows} (TDD §5.1).
const F_MONO = "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace";

export default function ResultTable({ columns, rows }) {
  if (!columns.length) return null;
  const widths = columns.map((c, i) => Math.min(36, Math.max(String(c).length, ...rows.map((r) => String(r[i] ?? "NULL").length), 4)));
  const trunc = (v, w) => { const s = String(v ?? "NULL"); return s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w); };
  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const hdr = "| " + columns.map((c, i) => trunc(c, widths[i])).join(" | ") + " |";
  return (
    <div style={{ overflowX: "auto" }}>
      <pre style={{ fontFamily: F_MONO, fontSize: 11, color: "#CCCCCC", margin: 0, lineHeight: 1.6, whiteSpace: "pre" }}>
        {sep}{"\n"}{hdr}{"\n"}{sep}
        {rows.map((row) => "\n| " + row.map((v, ci) => trunc(v, widths[ci])).join(" | ") + " |")}
        {"\n"}{sep}
      </pre>
      <div style={{ fontFamily: F_MONO, fontSize: 10, color: "#9a9a9a", marginTop: 2 }}>{rows.length} {rows.length === 1 ? "row" : "rows"}</div>
    </div>
  );
}
