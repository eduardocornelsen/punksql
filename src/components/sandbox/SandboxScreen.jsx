"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSandboxStore from "@/stores/useSandboxStore";
import { getSandboxDB, execSQL, saveToIndexedDB, resetSandboxDB } from "@/lib/sqlEngine";

// ── Visual tokens ─────────────────────────────────────────────
const C = {
  void: "#000000", black: "#000000", panel: "#0D0D0D", surface: "#111111",
  border: "#222222", borderBright: "#333333",
  cyan: "#00FFFF", cyanDim: "#00CCCC", cyanGhost: "rgba(0,255,255,0.08)",
  green: "#00FF88", greenDim: "#00CC66", greenGhost: "rgba(0,255,136,0.10)",
  amber: "#FFBB00", amberDim: "#CC9900", amberGhost: "rgba(255,187,0,0.10)",
  red: "#FF3333", redDim: "#CC2222", redGhost: "rgba(255,51,51,0.10)",
  white: "#FFFFFF", dim: "#9a9a9a", muted: "#7a7a7a", purple: "#CC88FF",
  text: "#CCCCCC",
};
const F = { mono: "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace" };

// ── Dataset (same as challenge DB) ────────────────────────────
const DB_SCHEMA = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT, city TEXT, country TEXT, signup_date TEXT);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL, stock INTEGER);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, order_date TEXT, total_amount REAL, status TEXT);
CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, quantity INTEGER, unit_price REAL);
CREATE TABLE reviews (id INTEGER PRIMARY KEY, product_id INTEGER, customer_id INTEGER, rating INTEGER, review_date TEXT);
INSERT INTO customers VALUES (1,'Ana Silva','ana@mail.com','São Paulo','Brazil','2023-01-15'),(2,'John Smith','john@mail.com','New York','USA','2023-02-20'),(3,'Maria Garcia','maria@mail.com','Madrid','Spain','2023-03-10'),(4,'Pedro Santos','pedro@mail.com','Lisbon','Portugal','2023-04-05'),(5,'Emma Wilson','emma@mail.com','London','UK','2023-05-12'),(6,'Lucas Oliveira','lucas@mail.com','Rio de Janeiro','Brazil','2023-06-18'),(7,'Sophie Martin','sophie@mail.com','Paris','France','2023-07-22'),(8,'Carlos Ruiz','carlos@mail.com','Mexico City','Mexico','2023-08-30'),(9,'Yuki Tanaka','yuki@mail.com','Tokyo','Japan','2023-09-14'),(10,'Hans Mueller','hans@mail.com','Berlin','Germany','2023-10-01');
INSERT INTO products VALUES (1,'Laptop Pro','Electronics',1299.99,45),(2,'Wireless Mouse','Electronics',29.99,200),(3,'Coffee Beans','Food',18.50,500),(4,'Running Shoes','Sports',89.99,120),(5,'Python Book','Books',45.00,80),(6,'Headphones','Electronics',199.99,60),(7,'Yoga Mat','Sports',35.00,150),(8,'Green Tea','Food',12.99,300),(9,'SQL Guide','Books',39.99,95),(10,'Backpack','Sports',65.00,110);
INSERT INTO orders VALUES (1,1,'2024-01-05',1329.98,'completed'),(2,2,'2024-01-12',89.99,'completed'),(3,3,'2024-01-20',64.49,'completed'),(4,1,'2024-02-03',199.99,'completed'),(5,4,'2024-02-14',45.00,'completed'),(6,5,'2024-02-28',329.98,'completed'),(7,6,'2024-03-05',18.50,'completed'),(8,2,'2024-03-15',1299.99,'completed'),(9,7,'2024-03-22',124.99,'completed'),(10,3,'2024-04-01',29.99,'shipped'),(11,8,'2024-04-10',154.99,'shipped'),(12,9,'2024-04-18',89.99,'shipped'),(13,1,'2024-05-02',269.98,'shipped'),(14,10,'2024-05-15',45.00,'pending'),(15,5,'2024-05-28',235.98,'pending'),(16,4,'2024-06-05',65.00,'pending');
INSERT INTO order_items VALUES (1,1,1,1,1299.99),(2,1,2,1,29.99),(3,2,4,1,89.99),(4,3,3,1,18.50),(5,3,5,1,45.00),(6,4,6,1,199.99),(7,5,5,1,45.00),(8,6,2,1,29.99),(9,6,6,1,199.99),(10,6,7,1,35.00),(11,7,3,1,18.50),(12,8,1,1,1299.99),(13,9,4,1,89.99),(14,9,7,1,35.00),(15,10,2,1,29.99),(16,11,4,1,89.99),(17,11,10,1,65.00),(18,12,4,1,89.99),(19,13,6,1,199.99),(20,13,10,1,65.00),(21,14,5,1,45.00),(22,15,6,1,199.99),(23,15,7,1,35.00),(24,16,10,1,65.00);
INSERT INTO reviews VALUES (1,1,1,5,'2024-01-20'),(2,1,2,4,'2024-02-01'),(3,4,2,5,'2024-01-25'),(4,3,3,3,'2024-02-10'),(5,5,4,5,'2024-03-01'),(6,6,5,4,'2024-03-15'),(7,2,1,4,'2024-02-20'),(8,6,1,5,'2024-05-10'),(9,4,6,4,'2024-03-20'),(10,1,8,5,'2024-04-25'),(11,9,7,4,'2024-04-10'),(12,5,9,5,'2024-05-01');
CREATE TABLE raw_sales (id INTEGER PRIMARY KEY, product_id INTEGER, quantity INTEGER, unit_price REAL, discount REAL, sale_date TEXT, customer_name TEXT);
CREATE TABLE employee_salaries (id INTEGER PRIMARY KEY, name TEXT, department TEXT, salary REAL, hire_date TEXT);
INSERT INTO raw_sales VALUES (1,1,2,49.99,0.10,'2024-01-10','Alice'),(2,2,-3,15.00,0.00,'2024-01-11','Bob'),(3,3,1,NULL,0.05,'2024-01-12','Carol'),(4,1,2,49.99,0.10,'2024-01-10','Alice'),(5,4,0,89.99,0.00,'2024-01-13',NULL),(6,5,1,250.00,1.50,'2024-01-14','Dave'),(7,2,3,15.00,0.00,'2024-01-15','Eve'),(8,6,1,-20.00,0.00,'2024-01-16','Frank'),(9,3,2,29.99,0.20,'2024-01-17','Grace'),(10,1,2,49.99,0.10,'2024-01-10','Alice');
INSERT INTO employee_salaries VALUES (1,'Alice Santos','Engineering',5500.00,'2022-03-01'),(2,'Bob Martins','Marketing',-3200.00,'2022-06-15'),(3,'Carol Lima','Engineering',6200.00,'2021-11-20'),(4,NULL,'Sales',2800.00,'2023-01-10'),(5,'Dave Costa','Marketing',0.00,'2023-05-22'),(6,'Eve Pereira','Engineering',5800.00,'2022-09-01'),(7,'Frank Sousa',NULL,4100.00,'2023-03-15'),(8,'Grace Dias','Sales',-1800.00,'2022-12-10'),(9,'Henry Ramos','Engineering',7200.00,'2021-07-05'),(10,'Iris Neves','Marketing',3900.00,'2023-08-20');
`;

// ── Autocomplete word pools ────────────────────────────────────
const SQL_KEYWORDS = [
  "SELECT","DISTINCT","FROM","WHERE","JOIN","ON","LEFT JOIN","RIGHT JOIN",
  "INNER JOIN","FULL JOIN","CROSS JOIN","GROUP BY","ORDER BY","HAVING",
  "LIMIT","OFFSET","AS","WITH","UNION","UNION ALL","EXCEPT","INTERSECT",
  "AND","OR","NOT","IN","NOT IN","LIKE","NOT LIKE","ILIKE","BETWEEN",
  "IS NULL","IS NOT NULL","EXISTS","NOT EXISTS","CASE","WHEN","THEN","ELSE","END",
  "ASC","DESC","PARTITION BY","OVER","ROWS BETWEEN","PRECEDING","CURRENT ROW",
];
const SQL_DDL = [
  "CREATE TABLE","CREATE TABLE IF NOT EXISTS","CREATE TABLE AS SELECT",
  "CREATE VIEW","CREATE VIEW IF NOT EXISTS","CREATE INDEX","CREATE UNIQUE INDEX",
  "DROP TABLE","DROP TABLE IF EXISTS","DROP VIEW","DROP INDEX",
  "ALTER TABLE","ADD COLUMN","RENAME TO",
  "INSERT INTO","VALUES","UPDATE","SET","DELETE FROM",
];
const SQL_FUNCS = [
  "COUNT(*)","COUNT()","SUM()","AVG()","MIN()","MAX()",
  "ROUND()","COALESCE()","NULLIF()","CAST()","TYPEOF()",
  "LENGTH()","UPPER()","LOWER()","SUBSTR()","TRIM()","REPLACE()","INSTR()",
  "DATE()","STRFTIME()","JULIANDAY()",
  "ROW_NUMBER()","RANK()","DENSE_RANK()","LAG()","LEAD()",
  "FIRST_VALUE()","LAST_VALUE()","NTILE()","PERCENT_RANK()",
  "ABS()","RANDOM()","IFNULL()",
];
const SQL_TYPES = [
  "INTEGER","TEXT","REAL","BLOB","NULL",
  "PRIMARY KEY","NOT NULL","UNIQUE","DEFAULT","REFERENCES","AUTOINCREMENT",
];
const SQL_PRAGMA = [
  "PRAGMA table_info","PRAGMA database_list","PRAGMA foreign_keys",
  "SAVEPOINT","RELEASE","ROLLBACK TO","ATTACH DATABASE","DETACH",
];
const META_CMDS = [
  "\\dt","\\dv","\\d","\\l","\\history","\\clear","\\save","\\reset","\\h","\\?",
];
const ALL_SQL = [...SQL_KEYWORDS, ...SQL_DDL, ...SQL_FUNCS, ...SQL_TYPES, ...SQL_PRAGMA];

// ── Autocomplete helpers ──────────────────────────────────────
function getWordAtCursor(text, pos) {
  const before = text.slice(0, pos);
  const m = before.match(/[\\][\w]*$|[\w]+$/);
  return m ? m[0] : "";
}

function replaceWordAtCursor(text, pos, replacement) {
  const before = text.slice(0, pos);
  const m = before.match(/[\\][\w]*$|[\w]+$/);
  if (!m) return { text: text.slice(0, pos) + replacement + text.slice(pos), newPos: pos + replacement.length };
  const wordStart = pos - m[0].length;
  return { text: text.slice(0, wordStart) + replacement + text.slice(pos), newPos: wordStart + replacement.length };
}

function computeSuggestions(word, tableNames, columnNames) {
  if (!word) return [];
  const lower = word.toLowerCase();
  const isMeta = lower.startsWith("\\");
  const pool = isMeta ? META_CMDS : [...tableNames, ...columnNames, ...ALL_SQL];
  return pool
    .filter((s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower)
    .slice(0, 10);
}

// ── Lineage helpers ───────────────────────────────────────────
const LAYER_ORDER = ["source", "staging", "intermediate", "mart"];
const LAYER_META = {
  source:       { label: "SOURCE",       hint: "raw tables",         color: C.dim,   badge: "SRC" },
  staging:      { label: "STAGING",      hint: "stg_*",              color: C.cyan,  badge: "STG" },
  intermediate: { label: "INTERMEDIATE", hint: "int_*",              color: C.amber, badge: "INT" },
  mart:         { label: "MART",         hint: "fct_* / dim_*",      color: C.green, badge: "MRT" },
};

function detectLayer(name) {
  const n = name.toLowerCase();
  if (n.startsWith("stg_") || n.startsWith("staging_")) return "staging";
  if (n.startsWith("int_") || n.startsWith("intermediate_")) return "intermediate";
  if (n.startsWith("fct_") || n.startsWith("fact_") || n.startsWith("dim_") || n.startsWith("mart_")) return "mart";
  return "source";
}

function parseUpstreams(ddl) {
  if (!ddl) return [];
  const seen = new Set();
  const re = /\b(?:FROM|JOIN)\s+["'`]?([\w]+)["'`]?/gi;
  for (const m of ddl.matchAll(re)) seen.add(m[1].toLowerCase());
  return [...seen];
}

function loadObjects(db) {
  const r = execSQL(db, "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') ORDER BY type DESC, name ASC");
  if (!r.ok) return [];
  return r.rows.map(([name, type, ddl]) => ({
    name, type, layer: detectLayer(name), upstreams: type === "view" ? parseUpstreams(ddl) : [],
  }));
}

// ── Help text ─────────────────────────────────────────────────
const HELP_TEXT = `\\dt              list tables
\\dv              list views
\\d <name>        describe columns of a table or view
\\l               list attached databases
\\history         show command history
\\clear (or cls)  clear terminal output
\\save            save workspace to IndexedDB (persists across refreshes)
\\reset           reset database to initial dataset
\\h, \\?           show this help

Naming conventions for LINEAGE view:
  stg_*   Staging — clean/rename raw sources
  int_*   Intermediate — joins and aggregations
  fct_*   Fact table (Mart layer)
  dim_*   Dimension table (Mart layer)`;

// ── Result Table (ASCII box-drawing) ─────────────────────────
function ResultTable({ columns, rows }) {
  if (!columns.length) return null;
  const widths = columns.map((c, i) =>
    Math.min(40, Math.max(String(c).length, ...rows.map((r) => String(r[i] ?? "NULL").length), 4))
  );
  const trunc = (v, w) => { const s = String(v ?? "NULL"); return s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w); };
  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const hdr = "| " + columns.map((c, i) => trunc(c, widths[i])).join(" | ") + " |";
  return (
    <div style={{ overflowX: "auto" }}>
      <pre style={{ fontFamily: F.mono, fontSize: 11, color: C.text, margin: 0, lineHeight: 1.6, whiteSpace: "pre" }}>
        {sep}{"\n"}{hdr}{"\n"}{sep}
        {rows.map((row) => "\n| " + row.map((v, ci) => trunc(v, widths[ci])).join(" | ") + " |")}
        {"\n"}{sep}
      </pre>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginTop: 2 }}>
        {rows.length} {rows.length === 1 ? "row" : "rows"}
      </div>
    </div>
  );
}

// ── Scrollback block ──────────────────────────────────────────
function ReplBlock({ block }) {
  const { type, cmd, result, text } = block;
  if (type === "info") return (
    <div style={{ padding: "2px 0" }}>
      <pre style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, margin: 0, whiteSpace: "pre-wrap" }}>{text}</pre>
    </div>
  );
  if (type === "error") return (
    <div style={{ padding: "4px 0" }}>
      {cmd && <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginBottom: 2 }}>
        <span style={{ color: C.green }}>punksql=#</span>{" "}<span style={{ color: C.text }}>{cmd}</span>
      </div>}
      <div style={{ fontFamily: F.mono, fontSize: 12, color: C.red }}>ERROR: {text}</div>
    </div>
  );
  if (type === "sql") return (
    <div style={{ padding: "4px 0", borderBottom: `1px solid ${C.border}20` }}>
      <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginBottom: 4 }}>
        <span style={{ color: C.green }}>punksql=#</span>{" "}<span style={{ color: C.text }}>{cmd}</span>
      </div>
      {result.ok
        ? result.columns.length > 0
          ? <ResultTable columns={result.columns} rows={result.rows} />
          : <div style={{ fontFamily: F.mono, fontSize: 11, color: C.greenDim }}>OK — {result.msg}</div>
        : <div style={{ fontFamily: F.mono, fontSize: 12, color: C.red }}>ERROR: {result.msg}</div>
      }
    </div>
  );
  return null;
}

// ── Object Browser panel ──────────────────────────────────────
function ObjectBrowser({ db, onInsert, onRefresh, lang }) {
  const [tables, setTables] = useState([]);
  const [views, setViews] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [colCache, setColCache] = useState({});
  const ispt = lang === "pt";

  const refresh = useCallback(() => {
    if (!db) return;
    const tr = execSQL(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const vr = execSQL(db, "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name");
    setTables(tr.ok ? tr.rows.map((r) => r[0]) : []);
    setViews(vr.ok ? vr.rows.map((r) => r[0]) : []);
  }, [db]);

  useEffect(() => { refresh(); }, [refresh]);

  // expose refresh to parent so it can be called after exec
  useEffect(() => { if (onRefresh) onRefresh.current = refresh; }, [refresh, onRefresh]);

  const toggleExpand = (name) => {
    setExpanded((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      if (next[name] && !colCache[name]) {
        const r = execSQL(db, `PRAGMA table_info("${name}")`);
        if (r.ok) setColCache((c) => ({ ...c, [name]: r.rows }));
      }
      return next;
    });
  };

  const ObjRow = ({ name, type }) => {
    const isView = type === "view";
    const col = isView ? C.purple : C.cyan;
    return (
      <div>
        <button onClick={() => toggleExpand(name)} style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "3px 0",
          fontFamily: F.mono, fontSize: 12, color: C.text, textAlign: "left",
        }}>
          <span style={{ color: col, minWidth: 14, fontSize: 10 }}>{expanded[name] ? "▼" : "▶"}</span>
          <span style={{ color: col, fontSize: 10 }}>{isView ? "◻" : "▪"}</span>
          <span style={{ color: C.text }}>{name}</span>
          <span style={{ color: C.muted, fontSize: 9, marginLeft: "auto" }}>{isView ? "view" : "table"}</span>
        </button>
        {expanded[name] && colCache[name] && (
          <div style={{ paddingLeft: 20, borderLeft: `1px solid ${C.border}`, marginLeft: 7, marginBottom: 2 }}>
            {colCache[name].map((col) => (
              <button key={col[1]} onClick={() => onInsert(col[1])} style={{
                display: "flex", alignItems: "center", gap: 5, width: "100%",
                background: "none", border: "none", cursor: "pointer",
                padding: "2px 0", fontFamily: F.mono, fontSize: 11, color: C.dim, textAlign: "left",
              }}>
                <span style={{ color: C.muted }}>·</span>
                <span style={{ color: C.text }}>{col[1]}</span>
                <span style={{ color: C.muted, fontSize: 9 }}>{col[2]}</span>
                {col[5] ? <span style={{ color: C.amber, fontSize: 9, marginLeft: 2 }}>PK</span> : null}
                {col[3] ? <span style={{ color: C.red, fontSize: 9, marginLeft: 1 }}>NN</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "8px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, letterSpacing: 1.5 }}>
          OBJECTS ({tables.length}T · {views.length}V)
        </span>
        <button onClick={refresh} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.muted }}>
          ↻ {ispt ? "atualizar" : "refresh"}
        </button>
      </div>
      {tables.length === 0 && views.length === 0 && (
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{ispt ? "nenhum objeto" : "no objects"}</div>
      )}
      {tables.map((n) => <ObjRow key={n} name={n} type="table" />)}
      {views.length > 0 && <div style={{ height: 4 }} />}
      {views.map((n) => <ObjRow key={n} name={n} type="view" />)}
    </div>
  );
}

// ── Lineage / Layer Stack panel ───────────────────────────────
function LineageStack({ db, lang }) {
  const [objects, setObjects] = useState([]);
  const ispt = lang === "pt";

  useEffect(() => {
    if (!db) return;
    setObjects(loadObjects(db));
  }, [db]);

  const byLayer = useMemo(() => {
    const map = { source: [], staging: [], intermediate: [], mart: [] };
    objects.forEach((o) => map[o.layer].push(o));
    return map;
  }, [objects]);

  const hasLayers = byLayer.staging.length + byLayer.intermediate.length + byLayer.mart.length > 0;

  return (
    <div style={{ padding: "8px 12px" }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, letterSpacing: 1.5, marginBottom: 8 }}>
        DATA LINEAGE
      </div>

      {/* Flow legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, overflowX: "auto" }}>
        {LAYER_ORDER.map((l, i) => {
          const m = LAYER_META[l];
          const count = byLayer[l].length;
          return (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{
                fontFamily: F.mono, fontSize: 10, color: count ? m.color : C.muted,
                border: `1px solid ${count ? m.color : C.border}`,
                padding: "2px 6px", letterSpacing: 1,
                background: count ? `${m.color}12` : "none",
              }}>
                {m.badge} {count > 0 ? `(${count})` : ""}
              </div>
              {i < LAYER_ORDER.length - 1 && (
                <span style={{ color: C.border, fontSize: 12 }}>→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer sections */}
      {LAYER_ORDER.map((layerKey) => {
        const m = LAYER_META[layerKey];
        const items = byLayer[layerKey];
        if (!items.length && hasLayers) return null; // hide empty non-source layers if others exist
        return (
          <div key={layerKey} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: m.color, letterSpacing: 2, marginBottom: 4 }}>
              ┤ {m.label} <span style={{ color: C.muted, letterSpacing: 0 }}>// {m.hint}</span> ├
            </div>
            {items.length === 0 ? (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 8 }}>
                {layerKey === "staging" && (ispt ? "crie views com prefixo stg_" : "create views with stg_ prefix")}
                {layerKey === "intermediate" && (ispt ? "crie views com prefixo int_" : "create views with int_ prefix")}
                {layerKey === "mart" && (ispt ? "crie views com prefixo fct_ ou dim_" : "create views with fct_ or dim_ prefix")}
              </div>
            ) : (
              items.map((obj) => (
                <div key={obj.name} style={{ paddingLeft: 8, marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: obj.type === "view" ? C.purple : m.color }}>
                      {obj.type === "view" ? "◻" : "▪"} {obj.name}
                    </span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>
                      {obj.type}
                    </span>
                  </div>
                  {obj.upstreams.length > 0 && (
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 10 }}>
                      ← {obj.upstreams.join(", ")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}

      {/* Tip when no layers yet */}
      {!hasLayers && (
        <div style={{
          fontFamily: F.mono, fontSize: 10, color: C.muted,
          borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, lineHeight: 1.8,
        }}>
          {ispt
            ? "Crie views com prefixos de camada para ver a linhagem:\n  stg_orders → int_daily_revenue → fct_revenue"
            : "Create views with layer prefixes to see lineage:\n  stg_orders → int_daily_revenue → fct_revenue"}
          <pre style={{ margin: "6px 0 0", color: C.border, fontSize: 9 }}>{`CREATE VIEW stg_orders AS
  SELECT id, customer_id,
         CAST(total_amount AS REAL) AS amount
  FROM orders;`}</pre>
        </div>
      )}
    </div>
  );
}

// ── Meta-command handler ──────────────────────────────────────
function handleMeta(cmd, db, pushBlock, clearScrollback, replHistory) {
  const parts = cmd.trim().split(/\s+/);
  const verb = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ");

  if (verb === "\\clear" || verb === "\\cls") { clearScrollback(); return; }
  if (verb === "\\h" || verb === "\\?") { pushBlock({ type: "info", text: HELP_TEXT }); return; }
  if (verb === "\\history") {
    const lines = replHistory.length
      ? replHistory.map((h, i) => `  ${String(replHistory.length - i).padStart(3)}  ${h}`).join("\n")
      : "  (empty)";
    pushBlock({ type: "info", text: lines });
    return;
  }
  if (verb === "\\dt") { pushBlock({ type: "sql", cmd, result: execSQL(db, "SELECT name, 'table' AS type FROM sqlite_master WHERE type='table' ORDER BY name") }); return; }
  if (verb === "\\dv") { pushBlock({ type: "sql", cmd, result: execSQL(db, "SELECT name, 'view' AS type FROM sqlite_master WHERE type='view' ORDER BY name") }); return; }
  if (verb === "\\d") {
    if (!arg) { pushBlock({ type: "sql", cmd, result: execSQL(db, "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name") }); return; }
    const r = execSQL(db, `PRAGMA table_info("${arg}")`);
    if (r.ok && r.rows.length === 0) pushBlock({ type: "error", text: `relation "${arg}" does not exist` });
    else pushBlock({ type: "sql", cmd, result: r });
    return;
  }
  if (verb === "\\l") { pushBlock({ type: "sql", cmd, result: execSQL(db, "PRAGMA database_list") }); return; }
  pushBlock({ type: "error", text: `unrecognized command: ${verb}  (try \\? for help)` });
}

// ── SandboxScreen ─────────────────────────────────────────────
export default function SandboxScreen({ onBack, lang = "en" }) {
  const { scrollback, replHistory, pushBlock, clearScrollback, pushHistory, navigateHistory, resetHistoryIndex } = useSandboxStore();

  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sql, setSql] = useState("");
  const [panel, setPanel] = useState("none"); // "none" | "objects" | "lineage"
  const [saveStatus, setSaveStatus] = useState("idle");
  const [suggestions, setSuggestions] = useState([]);
  const [tableNames, setTableNames] = useState([]);
  const [columnNames, setColumnNames] = useState([]);

  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const browserRefreshRef = useRef(null);
  const ispt = lang === "pt";

  // Load table + column names for autocomplete
  const refreshCatalog = useCallback((dbInst) => {
    const d = dbInst || db;
    if (!d) return;
    const tr = execSQL(d, "SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name");
    const tNames = tr.ok ? tr.rows.map((r) => r[0]) : [];
    setTableNames(tNames);
    // Load all columns for all tables
    const cols = new Set();
    tNames.forEach((t) => {
      const pr = execSQL(d, `PRAGMA table_info("${t}")`);
      if (pr.ok) pr.rows.forEach((r) => cols.add(r[1]));
    });
    setColumnNames([...cols]);
    // also refresh the object browser if open
    if (browserRefreshRef.current) browserRefreshRef.current();
  }, [db]);

  // Boot
  useEffect(() => {
    getSandboxDB(DB_SCHEMA)
      .then((d) => {
        setDb(d);
        refreshCatalog(d);
        if (scrollback.length === 0) {
          pushBlock({ type: "info", text: ispt
            ? `PunkSQL FREE EXPLORE — sql.js ${new Date().toLocaleTimeString()}\nDigite SQL ou \\? para ajuda. Use \\dt para listar tabelas.`
            : `PunkSQL FREE EXPLORE — sql.js ${new Date().toLocaleTimeString()}\nType SQL or \\? for help. \\dt to list tables, \\? for all commands.`
          });
        }
      })
      .catch(() => pushBlock({ type: "error", text: "Failed to load sql.js engine" }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [scrollback]);

  // Compute autocomplete suggestions on sql change
  const updateSuggestions = useCallback((value, pos) => {
    const word = getWordAtCursor(value, pos ?? value.length);
    if (word.length < 1) { setSuggestions([]); return; }
    setSuggestions(computeSuggestions(word, tableNames, columnNames));
  }, [tableNames, columnNames]);

  const onSqlChange = useCallback((e) => {
    const v = e.target.value;
    setSql(v);
    updateSuggestions(v, e.target.selectionStart);
  }, [updateSuggestions]);

  const acceptSuggestion = useCallback((suggestion) => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const { text: newText, newPos } = replaceWordAtCursor(sql, pos, suggestion);
    setSql(newText);
    setSuggestions([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    });
  }, [sql]);

  const execute = useCallback(async () => {
    const trimmed = sql.trim();
    if (!trimmed || !db) return;
    pushHistory(trimmed);
    setSql("");
    setSuggestions([]);
    resetHistoryIndex();

    if (trimmed.startsWith("\\")) {
      if (trimmed === "\\save") {
        setSaveStatus("saving");
        const ok = await saveToIndexedDB();
        setSaveStatus(ok ? "saved" : "error");
        pushBlock({ type: "info", text: ok ? (ispt ? "✓ Workspace salvo em IndexedDB" : "✓ Workspace saved to IndexedDB") : "✗ Save failed" });
        setTimeout(() => setSaveStatus("idle"), 2000);
        return;
      }
      if (trimmed === "\\reset") {
        const freshDb = await resetSandboxDB(DB_SCHEMA);
        setDb(freshDb);
        refreshCatalog(freshDb);
        clearScrollback();
        pushBlock({ type: "info", text: ispt ? "Banco reiniciado com dados originais" : "Database reset to initial dataset" });
        return;
      }
      handleMeta(trimmed, db, pushBlock, clearScrollback, replHistory);
      return;
    }

    const result = execSQL(db, trimmed);
    pushBlock({ type: "sql", cmd: trimmed, result });
    // Refresh catalog after DDL (CREATE/DROP/ALTER)
    if (/^\s*(CREATE|DROP|ALTER)\b/i.test(trimmed)) refreshCatalog();
  }, [sql, db, pushBlock, clearScrollback, pushHistory, replHistory, resetHistoryIndex, refreshCatalog, lang, ispt]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length > 0) acceptSuggestion(suggestions[0]);
      return;
    }
    if (e.key === "Escape") { setSuggestions([]); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); execute(); return; }
    if (e.key === "ArrowUp" && suggestions.length === 0) {
      e.preventDefault();
      const prev = navigateHistory(1);
      if (prev !== null) { setSql(prev); setSuggestions([]); }
      return;
    }
    if (e.key === "ArrowDown" && suggestions.length === 0) {
      e.preventDefault();
      const next = navigateHistory(-1);
      setSql(next ?? "");
    }
  }, [suggestions, acceptSuggestion, execute, navigateHistory]);

  const insertAtCursor = useCallback((text) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = sql.slice(0, start) + text + sql.slice(end);
    setSql(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
        textareaRef.current.focus();
      }
    });
  }, [sql]);

  // Save button state
  const saveBtnLabel = saveStatus === "saving" ? (ispt ? "salvando…" : "saving…")
    : saveStatus === "saved" ? "✓ ok"
    : saveStatus === "error" ? "✗ err"
    : (ispt ? "save" : "save");
  const saveBtnColor = saveStatus === "saved" ? C.green : saveStatus === "error" ? C.red : C.dim;

  // Panel toggle helper
  const togglePanel = (name) => setPanel((v) => v === name ? "none" : name);

  // Chip bar: autocomplete suggestions (when typing) or keyword shortcuts (idle)
  const SHORTCUTS = ["SELECT * FROM", "WHERE", "LEFT JOIN", "GROUP BY", "ORDER BY", "LIMIT 10", "\\dt", "\\d"];
  const showSuggestions = suggestions.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.void, fontFamily: F.mono }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 10px", borderBottom: `1px solid ${C.border}`,
        background: C.black, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
          fontFamily: F.mono, fontSize: 12, color: C.dim, padding: "4px 8px", minHeight: 28, flexShrink: 0,
        }}>←</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: C.text, letterSpacing: 1 }}>FREE_EXPLORE</span>
          <span style={{ fontSize: 9, color: C.muted, marginLeft: 6 }}>SQLite</span>
        </div>

        {/* Clear log button */}
        <button onClick={clearScrollback} title="Clear terminal output" style={{
          background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
          fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "4px 7px", minHeight: 28, flexShrink: 0,
        }}>cls</button>

        {/* Objects panel toggle */}
        <button onClick={() => togglePanel("objects")} style={{
          background: panel === "objects" ? C.cyanGhost : "none",
          border: `1px solid ${panel === "objects" ? C.cyan : C.border}`,
          cursor: "pointer", fontFamily: F.mono, fontSize: 11,
          color: panel === "objects" ? C.cyan : C.dim, padding: "4px 7px", minHeight: 28, flexShrink: 0,
        }}>obj</button>

        {/* Lineage panel toggle */}
        <button onClick={() => togglePanel("lineage")} style={{
          background: panel === "lineage" ? `${C.green}15` : "none",
          border: `1px solid ${panel === "lineage" ? C.green : C.border}`,
          cursor: "pointer", fontFamily: F.mono, fontSize: 11,
          color: panel === "lineage" ? C.green : C.dim, padding: "4px 7px", minHeight: 28, flexShrink: 0,
        }}>dag</button>

        {/* Save button */}
        <button
          onClick={async () => {
            setSaveStatus("saving");
            const ok = await saveToIndexedDB();
            setSaveStatus(ok ? "saved" : "error");
            setTimeout(() => setSaveStatus("idle"), 2000);
          }}
          disabled={!db || saveStatus === "saving"}
          style={{
            background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
            fontFamily: F.mono, fontSize: 11, color: saveBtnColor, padding: "4px 7px", minHeight: 28, flexShrink: 0,
          }}
        >{saveBtnLabel}</button>
      </div>

      {/* ── Explorer panel (objects or lineage) ── */}
      {panel !== "none" && db && (
        <div style={{
          borderBottom: `1px solid ${C.border}`, background: C.panel,
          maxHeight: 240, overflowY: "auto", flexShrink: 0,
        }}>
          {panel === "objects" && (
            <ObjectBrowser db={db} onInsert={insertAtCursor} onRefresh={browserRefreshRef} lang={lang} />
          )}
          {panel === "lineage" && (
            <LineageStack db={db} lang={lang} />
          )}
        </div>
      )}

      {/* ── Scrollback ── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {loading && <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>{ispt ? "carregando sql.js…" : "loading sql.js…"}</div>}
        {scrollback.map((block) => <ReplBlock key={block.id} block={block} />)}
        {!loading && scrollback.length === 0 && (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>{ispt ? "Digite SQL ou \\? para ajuda." : "Type SQL or \\? for help."}</div>
        )}
      </div>

      {/* ── Autocomplete / shortcut chip bar ── */}
      <div style={{
        display: "flex", gap: 4, padding: "4px 10px", flexShrink: 0,
        borderTop: `1px solid ${C.border}20`, overflowX: "auto",
        background: showSuggestions ? `${C.cyan}06` : "transparent",
        transition: "background 0.15s",
      }}>
        {showSuggestions ? (
          <>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cyanDim, alignSelf: "center", flexShrink: 0, paddingRight: 2 }}>
              tab→
            </span>
            {suggestions.map((s, i) => (
              <button key={s} onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(s); }} style={{
                background: i === 0 ? C.cyanGhost : "none",
                border: `1px solid ${i === 0 ? C.cyan : C.border}`,
                cursor: "pointer", fontFamily: F.mono, fontSize: 11,
                color: i === 0 ? C.cyan : C.dim, padding: "3px 8px",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>{s}</button>
            ))}
          </>
        ) : (
          SHORTCUTS.map((kw) => (
            <button key={kw} onMouseDown={(e) => { e.preventDefault(); insertAtCursor(sql.length && !sql.endsWith(" ") ? " " + kw : kw); }} style={{
              background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
              fontFamily: F.mono, fontSize: 11, color: C.muted, padding: "3px 7px",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>{kw}</button>
          ))
        )}
      </div>

      {/* ── Input area ── */}
      <div style={{
        borderTop: `1px solid ${C.border}`, background: C.panel,
        padding: "8px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 6,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.green, paddingTop: 6, flexShrink: 0, userSelect: "none" }}>
            {sql.includes("\n") ? "punksql-#" : "punksql=#"}
          </span>
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={onSqlChange}
            onKeyDown={onKeyDown}
            onClick={(e) => updateSuggestions(sql, e.target.selectionStart)}
            rows={Math.min(5, Math.max(1, sql.split("\n").length))}
            placeholder={ispt ? "SQL ou \\comando  ·  Tab=autocomplete  ·  Shift+Enter=nova linha" : "SQL or \\command  ·  Tab=autocomplete  ·  Shift+Enter=new line"}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontFamily: F.mono, fontSize: 13, color: C.white, caretColor: C.green,
              resize: "none", lineHeight: 1.6, paddingTop: 4,
            }}
            autoComplete="off"
            spellCheck={false}
            disabled={loading || !db}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button onClick={() => { setSql(""); setSuggestions([]); textareaRef.current?.focus(); }} style={{
            background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
            fontFamily: F.mono, fontSize: 11, color: C.muted, padding: "4px 10px",
          }}>{ispt ? "limpar" : "clear"}</button>
          <button onClick={execute} disabled={loading || !db || !sql.trim()} style={{
            background: sql.trim() ? C.cyanGhost : "none",
            border: `1px solid ${sql.trim() ? C.cyan : C.border}`,
            cursor: sql.trim() ? "pointer" : "default",
            fontFamily: F.mono, fontSize: 12,
            color: sql.trim() ? C.cyan : C.dim, padding: "4px 14px", letterSpacing: 1,
          }}>▶ {ispt ? "EXECUTAR" : "RUN"}</button>
        </div>
      </div>
    </div>
  );
}
