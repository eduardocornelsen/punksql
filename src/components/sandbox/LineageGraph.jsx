"use client";
// LineageGraph — one SVG DAG renderer, used twice (TDD §5.1/§2.3):
// the dbt DAG (ref() edges) and Free-Explore object lineage (parsed DDL).
// Nodes flow left→right by dependency depth; tap a node to select it.
import { useMemo } from "react";

const F_MONO = "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace";
const COLORS = {
  border: "#222222", dim: "#9a9a9a", muted: "#7a7a7a",
  cyan: "#00FFFF", green: "#00FF88", amber: "#FFBB00", purple: "#CC88FF", orange: "#FF9944",
};

function defaultColor(name) {
  const n = name.toLowerCase();
  if (n.startsWith("stg_")) return COLORS.cyan;
  if (n.startsWith("int_")) return COLORS.amber;
  if (n.startsWith("fct_") || n.startsWith("dim_") || n.startsWith("mart_")) return COLORS.green;
  return COLORS.dim;
}

const NODE_W = 128, NODE_H = 30, COL_GAP = 56, ROW_GAP = 14, PAD = 14;

/**
 * adjacency: { node: [upstream, ...] } — every key is a node; upstream names
 *   not present as keys are added as leaf (source) nodes.
 * nodeMeta:  optional { name: { color, badge } }
 * focus:     optional node name to highlight (its up/downstream stay bright,
 *            everything else dims)
 * onSelect:  optional (name) => void
 */
export default function LineageGraph({ adjacency, nodeMeta = {}, focus = null, onSelect }) {
  const layout = useMemo(() => {
    const nodes = new Set(Object.keys(adjacency));
    for (const ups of Object.values(adjacency)) for (const u of ups) nodes.add(u);
    const names = [...nodes];
    if (!names.length) return null;

    // depth = longest path from a root (memoized DFS, cycle-guarded)
    const depth = {};
    const visiting = new Set();
    const getDepth = (n) => {
      if (n in depth) return depth[n];
      if (visiting.has(n)) return 0;
      visiting.add(n);
      const ups = adjacency[n] || [];
      depth[n] = ups.length ? 1 + Math.max(...ups.map(getDepth)) : 0;
      visiting.delete(n);
      return depth[n];
    };
    names.forEach(getDepth);

    const maxDepth = Math.max(...names.map((n) => depth[n]));
    const cols = Array.from({ length: maxDepth + 1 }, () => []);
    names.sort().forEach((n) => cols[depth[n]].push(n));

    const pos = {};
    cols.forEach((col, ci) => {
      col.forEach((n, ri) => {
        pos[n] = { x: PAD + ci * (NODE_W + COL_GAP), y: PAD + ri * (NODE_H + ROW_GAP) };
      });
    });
    const width = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * COL_GAP;
    const height = PAD * 2 + Math.max(...cols.map((c) => c.length)) * (NODE_H + ROW_GAP) - ROW_GAP;

    const edges = [];
    for (const [n, ups] of Object.entries(adjacency)) {
      for (const u of ups) if (pos[u] && pos[n]) edges.push([u, n]);
    }

    // focus neighborhood: focus + all transitive up/downstream
    let lit = null;
    if (focus && pos[focus]) {
      lit = new Set([focus]);
      const addUp = (n) => (adjacency[n] || []).forEach((u) => { if (!lit.has(u)) { lit.add(u); addUp(u); } });
      const addDown = (n) => {
        for (const [m, ups] of Object.entries(adjacency)) {
          if (ups.includes(n) && !lit.has(m)) { lit.add(m); addDown(m); }
        }
      };
      addUp(focus); addDown(focus);
    }
    return { pos, edges, width, height, names, lit };
  }, [adjacency, focus]);

  if (!layout) {
    return (
      <div style={{ fontFamily: F_MONO, fontSize: 10, color: COLORS.muted, padding: 12 }}>
        no nodes yet — run models or create views to see lineage
      </div>
    );
  }
  const { pos, edges, width, height, names, lit } = layout;
  const alpha = (n) => (lit && !lit.has(n) ? 0.22 : 1);

  return (
    <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "100%" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {edges.map(([from, to], i) => {
          const a = pos[from], b = pos[to];
          const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
          const x2 = b.x, y2 = b.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const bright = !lit || (lit.has(from) && lit.has(to));
          return (
            <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none" stroke={bright ? "#3a6a6a" : "#1c2a2a"} strokeWidth="1.4" />
          );
        })}
        {names.map((n) => {
          const p = pos[n];
          const meta = nodeMeta[n] || {};
          const color = meta.color || defaultColor(n);
          const isFocus = n === focus;
          return (
            <g key={n} opacity={alpha(n)} onClick={() => onSelect?.(n)} style={{ cursor: onSelect ? "pointer" : "default" }}>
              <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H}
                fill={isFocus ? `${color}22` : "#0D0D0D"}
                stroke={color} strokeWidth={isFocus ? 1.8 : 1} />
              <text x={p.x + 8} y={p.y + 13} fontFamily={F_MONO} fontSize="10" fill={color}>
                {n.length > 17 ? n.slice(0, 16) + "…" : n}
              </text>
              <text x={p.x + 8} y={p.y + 24} fontFamily={F_MONO} fontSize="7.5" fill={COLORS.muted} letterSpacing="1">
                {meta.badge || ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
