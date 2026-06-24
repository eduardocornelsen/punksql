"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSandboxStore from "@/stores/useSandboxStore";
import { getSandboxDB, execSQL, saveToIndexedDB, resetSandboxDB } from "@/lib/sqlEngine";

// ── Visual tokens ──────────────────────────────────────────────
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

// ── Dataset ────────────────────────────────────────────────────
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
const SQL_SYMBOLS = [
  "(",")",",",";","*","=","!=","<",">","<=",">=","'","\"","--","/*","*/","%","_",
];
const DBT_TOKENS = [
  "{{ ref('') }}",
  "{{ source('', '') }}",
  "{{ config(materialized='view') }}",
  "{{ config(materialized='table') }}",
  "{{ config(materialized='incremental') }}",
  "{{ var('') }}",
  "{{ this }}",
  "{% if is_incremental() %}",
  "{% endif %}",
  "{% set x = ... %}",
  "{% for item in ... %}",
  "{% endfor %}",
  "unique_key=''",
  "stg_","int_","fct_","dim_","mart_",
];
const ALL_SQL = [...SQL_KEYWORDS, ...SQL_DDL, ...SQL_FUNCS, ...SQL_TYPES, ...SQL_PRAGMA];

const DBT_PROJECT_YML = `name: punksql_project
version: '1.0.0'
config-version: 2

model-paths: ["models"]
seed-paths:  ["seeds"]

models:
  punksql_project:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: view
      +schema: intermediate
    mart:
      +materialized: table
      +schema: mart`;

// ── Bottom tabs ───────────────────────────────────────────────
const BOTTOM_TABS = [
  { id: "repl",    label: "SHELL",  color: C.cyan,   icon: ">" },
  { id: "editor",  label: "EDITOR", color: C.amber,  icon: "≡" },
  { id: "files",   label: "VAULT",  color: C.green,  icon: "◈" },
  { id: "lineage", label: "DAG",    color: C.purple, icon: "⬡" },
];

// ── Smart-newline helpers (SQL + YAML) ───────────────────────
function sqlLineContext(text, pos) {
  const before = text.slice(0, pos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = before.slice(lineStart);
  const indent = (currentLine.match(/^(\s*)/) || ["", ""])[1];
  return { before, lineStart, currentLine, indent };
}
function sqlSmartNewline(text, pos) {
  const { currentLine, indent } = sqlLineContext(text, pos);
  const endsWithParen  = /\(\s*$/.test(currentLine);
  const isSelectClause = /^\s*SELECT\b/i.test(currentLine);
  const isStandalone   =
    /^\s*(WITH|FROM|WHERE|HAVING|ON|SET|VALUES)\s*$/i.test(currentLine) ||
    /^\s*(GROUP\s+BY|ORDER\s+BY|UNION(\s+ALL)?|EXCEPT(\s+ALL)?|INTERSECT(\s+ALL)?)\s*$/i.test(currentLine) ||
    /^\s*((LEFT|RIGHT|FULL)(\s+OUTER)?\s+JOIN|INNER\s+JOIN|CROSS\s+JOIN|JOIN)\s*$/i.test(currentLine);
  const extra = (endsWithParen || isSelectClause || isStandalone) ? "  " : "";
  return "\n" + indent + extra;
}
function yamlLint(text) {
  const issues = [];
  const lines = text.split("\n");
  let prevIndent = 0;
  lines.forEach((line, idx) => {
    if (!line.trim() || line.trimStart().startsWith("#")) return;
    const indent = line.match(/^( *)/)[1].length;
    if (indent % 2 !== 0) issues.push({ type: "warn", msg: `Line ${idx + 1}: odd indentation (${indent} spaces)` });
    if (indent - prevIndent > 2) issues.push({ type: "warn", msg: `Line ${idx + 1}: indent jumped by ${indent - prevIndent}` });
    if (/:$/.test(line.trimEnd()) && /:\s+/.test(line)) {
      // both key: and key: value — fine
    }
    prevIndent = indent;
  });
  const tabLine = lines.findIndex((l) => /\t/.test(l));
  if (tabLine >= 0) issues.push({ type: "error", msg: `Line ${tabLine + 1}: tab character (use spaces in YAML)` });
  return issues;
}

// ── File-system storage ───────────────────────────────────────
const FILES_KEY = "punksql-sandbox-files-v1";
const DEFAULT_FILES = {
  "queries/main.sql": "-- Write your SQL here\nSELECT *\nFROM customers\nLIMIT 10;",
  "queries/analytics.sql": "-- Revenue by country\nSELECT\n  c.country,\n  COUNT(DISTINCT o.id)    AS orders,\n  ROUND(SUM(o.total_amount), 2) AS revenue\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nGROUP BY c.country\nORDER BY revenue DESC;",
  "models/staging/stg_orders.sql": "CREATE VIEW stg_orders AS\nSELECT\n  id,\n  customer_id,\n  CAST(total_amount AS REAL) AS amount,\n  status,\n  order_date\nFROM orders;",
  "models/mart/fct_revenue.sql": "CREATE VIEW fct_revenue AS\nSELECT\n  o.order_date,\n  c.country,\n  SUM(o.total_amount) AS revenue\nFROM stg_orders o\nJOIN customers c ON c.id = o.customer_id\nGROUP BY o.order_date, c.country;",
  "dbt_project.yml": DBT_PROJECT_YML,
};
function loadFileSystem() {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...DEFAULT_FILES };
}
function saveFileSystem(fs) {
  try { localStorage.setItem(FILES_KEY, JSON.stringify(fs)); } catch {}
}
function fileExt(name) {
  const m = name.match(/\.(\w+)$/);
  return m ? m[1].toLowerCase() : "sql";
}
function isYaml(name) { const e = fileExt(name); return e === "yaml" || e === "yml"; }

// ── Autocomplete helpers ───────────────────────────────────────
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
  return pool.filter((s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower).slice(0, 10);
}

// ── Lineage helpers ────────────────────────────────────────────
const LAYER_ORDER = ["source", "staging", "intermediate", "mart"];
const LAYER_META = {
  source:       { label: "SOURCE",       hint: "raw tables",    color: C.dim,   badge: "SRC", folder: "seeds" },
  staging:      { label: "STAGING",      hint: "stg_*",         color: C.cyan,  badge: "STG", folder: "models/staging" },
  intermediate: { label: "INTERMEDIATE", hint: "int_*",         color: C.amber, badge: "INT", folder: "models/intermediate" },
  mart:         { label: "MART",         hint: "fct_* / dim_*", color: C.green, badge: "MRT", folder: "models/mart" },
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
    name, type, layer: detectLayer(name), upstreams: type === "view" ? parseUpstreams(ddl) : [], ddl,
  }));
}

// ── Help text ─────────────────────────────────────────────────
const HELP_TEXT = `AVAILABLE COMMANDS
══════════════════

SCHEMA / INSPECTION
  \\dt              list all tables
  \\dv              list all views
  \\d               list all objects (tables + views)
  \\d <name>        describe columns of a table or view
  \\l               list attached databases

USEFUL SQL PATTERNS
  SELECT * FROM <table> LIMIT 10;
  SELECT COUNT(*) FROM <table>;
  PRAGMA table_info('<table>');        -- column details
  SELECT name FROM sqlite_master
    WHERE type='table';               -- same as \\dt
  SELECT * FROM sqlite_master;        -- full schema dump

AGGREGATIONS
  SELECT col, COUNT(*) FROM t GROUP BY col;
  SELECT col, SUM(val) FROM t GROUP BY col ORDER BY 2 DESC;
  SELECT AVG(val), MIN(val), MAX(val) FROM t;

JOINS
  SELECT a.*, b.col
  FROM table_a a
  JOIN table_b b ON a.id = b.a_id;

CTEs (WITH clause)
  WITH cte AS (SELECT ...)
  SELECT * FROM cte;

WORKSPACE
  \\history         show command history (last 200)
  \\clear  (\\cls)   clear terminal output (DB unchanged)
  \\save            persist DB to IndexedDB (survives refresh)
  \\reset           restore original dataset (clears DB)

HELP
  \\h, \\?           show this help

KEYBOARD SHORTCUTS
  Enter            execute query
  Shift+Enter      new line (multi-line query)
  Tab              accept first autocomplete suggestion
  Escape           clear autocomplete suggestions
  ↑ / ↓            navigate command history

SQL KEYBOARD
  Swipe UP on chip bar   open floating SQL keyboard
  Swipe DOWN on handle   close keyboard
  [⌨] button             toggle keyboard

DBT LAYER NAMING
  stg_*   Staging — clean raw sources
  int_*   Intermediate — joins / aggregations
  fct_*   Fact table (Mart layer)
  dim_*   Dimension table (Mart layer)

TABS (bottom bar)
  >  SHELL   — interactive terminal (this tab)
  ≡  EDITOR  — .sql / .yaml file editor
  ◈  VAULT   — dbt project file tree + ☰ file manager
  ⬡  DAG     — data lineage (SRC→STG→INT→MRT)

TIP: Tap [?] in the header to reopen the onboarding tour.
TIP: ☰ in the EDITOR toolbar opens the file browser with
     all your .sql / .yaml files AND a full schema explorer.`;

// ── Onboarding ────────────────────────────────────────────────
const ONBOARD_KEY = "punksql-sandbox-onboard-v2";
const ONBOARDING_STEPS = [
  {
    title: "FREE EXPLORE // SANDBOX",
    icon: "⬡", color: C.cyan,
    body: "A fully in-browser SQLite REPL.\nNo server. No signup. Works offline.\n\nYour schema and data are saved in\nyour browser via IndexedDB and\npersist across refreshes.",
  },
  {
    title: "FOUR MODES — BOTTOM TABS",
    icon: "≡", color: C.cyan,
    body: "Four tabs at the bottom of the screen:\n\n  >  REPL    — interactive terminal\n  ≡  EDITOR  — .sql file editor\n  ◈  FILES   — dbt project structure\n  ⬡  LINEAGE — data lineage graph\n\nSwitch freely between them.",
  },
  {
    title: "REPL — TERMINAL MODE",
    icon: ">", color: C.cyan,
    body: "Type SQL and press ENTER to run.\nShift+Enter adds a new line.\n\nExample:\n  SELECT * FROM customers LIMIT 5;\n\nMeta-commands start with backslash:\n  \\dt       list tables\n  \\d name   describe table\n  \\?        show all commands",
  },
  {
    title: "EDITOR — .SQL FILE MODE",
    icon: "≡", color: C.amber,
    body: "Write multi-line SQL like a .sql file.\nEnter = new line (no auto-execute).\n\nTo run:\n  Ctrl+Enter  (or Cmd+Enter)\n  ▶ RUN button\n\nResults appear below the editor.\nGreat for complex queries and CTEs.",
  },
  {
    title: "FILES — DBT PROJECT",
    icon: "◈", color: C.green,
    body: "A virtual dbt project tree showing\nyour models organized by layer:\n\n  models/\n    staging/      stg_* views\n    intermediate/ int_* views\n    mart/         fct_*/dim_*\n  seeds/          raw tables\n\nTap any file → see DDL\n\"Open in Editor\" → load into editor",
  },
  {
    title: "LINEAGE — DATA FLOW",
    icon: "⬡", color: C.purple,
    body: "The LINEAGE tab shows your data\npipeline as a layer stack:\n\n  SRC → STG → INT → MRT\n\nObjects are grouped by naming:\n  stg_*  → STAGING\n  int_*  → INTERMEDIATE\n  fct_*  → MART fact tables\n  dim_*  → MART dimensions\n\nViews show upstream deps.",
  },
  {
    title: "SQL KEYBOARD",
    icon: "⌨", color: C.purple,
    body: "Swipe UP from the chip bar to open\na floating SQL keyword keyboard.\nSwipe DOWN on the handle to close it.\nOr tap [⌨] in the input area.\n\nTabs: SQL · DDL · FUNC · DBT\n      TABLES · COLS · {}",
  },
  {
    title: "SAVING YOUR WORK",
    icon: "▪", color: C.green,
    body: "Query history auto-saves locally.\n\nTo save the database:\n  Tap [save] in the header\n  or type: \\save\n\nTo restore original dataset:\n  Type: \\reset\n\nTap [?] anytime to reopen this guide.",
  },
];

// ── Onboarding Modal ──────────────────────────────────────────
function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const cur = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div style={{ background: C.panel, border: `1px solid ${cur.color}40`, maxWidth: 380, width: "100%", padding: "20px 18px", position: "relative", boxShadow: `0 0 40px ${cur.color}18` }}>
        <button onClick={onClose} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.muted, lineHeight: 1 }}>✕</button>
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 18 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} style={{ width: i === step ? 22 : 6, height: 6, background: i === step ? cur.color : C.border, border: "none", cursor: "pointer", padding: 0, transition: "width 0.2s, background 0.2s", flexShrink: 0 }} />
          ))}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 28, color: cur.color, textAlign: "center", marginBottom: 6, lineHeight: 1 }}>{cur.icon}</div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: cur.color, textAlign: "center", letterSpacing: 2.5, marginBottom: 16 }}>{cur.title}</div>
        <pre style={{ fontFamily: F.mono, fontSize: 11, color: C.text, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.75 }}>{cur.body}</pre>
        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{ fontFamily: F.mono, fontSize: 11, padding: "7px 14px", background: "none", border: `1px solid ${step === 0 ? C.border : C.borderBright}`, color: step === 0 ? C.border : C.dim, cursor: step === 0 ? "default" : "pointer" }}>← prev</button>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{step + 1} / {ONBOARDING_STEPS.length}</span>
          {!isLast
            ? <button onClick={() => setStep((s) => s + 1)} style={{ fontFamily: F.mono, fontSize: 11, padding: "7px 14px", background: `${cur.color}14`, border: `1px solid ${cur.color}`, color: cur.color, cursor: "pointer" }}>next →</button>
            : <button onClick={onClose} style={{ fontFamily: F.mono, fontSize: 11, padding: "7px 16px", background: `${C.green}14`, border: `1px solid ${C.green}`, color: C.green, cursor: "pointer", letterSpacing: 1 }}>▶ START</button>
          }
        </div>
      </div>
    </div>
  );
}

// ── SQL Aux Keyboard ──────────────────────────────────────────
function SandboxAuxKeyboard({ onInsert, tableNames, columnNames, onSwipeDown }) {
  const [activeTab, setActiveTab] = useState("sql");
  const dragRef = useRef(null);
  const chipScrolling = useRef(false);
  const chipTouchX = useRef(0);

  const tabDefs = [
    { id: "sql",    label: "SQL",    color: C.cyan,   tokens: SQL_KEYWORDS, onTap: (k) => onInsert(k + " ") },
    { id: "ddl",    label: "DDL",    color: C.amber,  tokens: SQL_DDL,      onTap: (k) => onInsert(k + " ") },
    { id: "func",   label: "FUNC",   color: C.purple, tokens: SQL_FUNCS,    onTap: (k) => onInsert(k) },
    { id: "dbt",    label: "DBT",    color: C.green,  tokens: DBT_TOKENS,   onTap: (t) => onInsert(t) },
    { id: "tables", label: "TABLES", color: C.dim,    tokens: tableNames,   onTap: (t) => onInsert(t) },
    { id: "cols",   label: "COLS",   color: C.dim,    tokens: columnNames,  onTap: (c) => onInsert(c) },
    { id: "sym",    label: "{}",     color: C.dim,    tokens: SQL_SYMBOLS,  onTap: (s) => onInsert(s) },
  ];
  const active = tabDefs.find((t) => t.id === activeTab) || tabDefs[0];

  const onDragStart = (e) => { dragRef.current = e.touches[0].clientY; };
  const onDragMove  = (e) => { if (dragRef.current !== null && e.touches[0].clientY - dragRef.current > 40) { dragRef.current = null; onSwipeDown(); } };
  const onDragEnd   = () => { dragRef.current = null; };
  const onChipsStart = (e) => { chipScrolling.current = false; chipTouchX.current = e.touches[0].clientX; };
  const onChipsMove  = (e) => { if (Math.abs(e.touches[0].clientX - chipTouchX.current) > 8) chipScrolling.current = true; };

  return (
    <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
        style={{ width: "100%", padding: "6px 0 4px", display: "flex", justifyContent: "center", alignItems: "center", touchAction: "none", cursor: "row-resize", background: C.black, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 40, height: 3, background: C.borderBright, borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", overflowX: "auto", background: C.black, borderBottom: `1px solid ${C.border}` }}>
        {tabDefs.map((tab) => (
          <button key={tab.id}
            onMouseDown={(e) => { e.preventDefault(); setActiveTab(tab.id); }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab(tab.id); }}
            style={{ fontFamily: F.mono, fontSize: 10, padding: "8px 11px", flexShrink: 0, background: activeTab === tab.id ? `${tab.color}15` : "none", color: activeTab === tab.id ? tab.color : C.muted, border: "none", borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : "2px solid transparent", cursor: "pointer", letterSpacing: 1, fontWeight: activeTab === tab.id ? "bold" : "normal" }}
          >{tab.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", overflowX: "auto", padding: "6px 8px", gap: 5, minHeight: 48 }}
        onTouchStart={onChipsStart} onTouchMove={onChipsMove}>
        {active.tokens.length === 0
          ? <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, alignSelf: "center" }}>{activeTab === "tables" ? "no tables yet" : activeTab === "cols" ? "no columns yet" : "empty"}</span>
          : active.tokens.map((tok) => (
            <button key={tok}
              onMouseDown={(e) => { e.preventDefault(); active.onTap(tok); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); if (!chipScrolling.current) active.onTap(tok); }}
              style={{ fontFamily: F.mono, fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap", background: "none", border: `1px solid ${C.border}`, color: active.color, cursor: "pointer", flexShrink: 0 }}
            >{tok}</button>
          ))
        }
      </div>
    </div>
  );
}

// ── Result Table ──────────────────────────────────────────────
function ResultTable({ columns, rows }) {
  if (!columns.length) return null;
  const widths = columns.map((c, i) => Math.min(36, Math.max(String(c).length, ...rows.map((r) => String(r[i] ?? "NULL").length), 4)));
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
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginTop: 2 }}>{rows.length} {rows.length === 1 ? "row" : "rows"}</div>
    </div>
  );
}

// ── Scrollback block ──────────────────────────────────────────
function ReplBlock({ block }) {
  const { type, cmd, result, text } = block;
  if (type === "info") return <div style={{ padding: "2px 0" }}><pre style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, margin: 0, whiteSpace: "pre-wrap" }}>{text}</pre></div>;
  if (type === "error") return (
    <div style={{ padding: "4px 0" }}>
      {cmd && <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginBottom: 2 }}><span style={{ color: C.green }}>punksql=#</span>{" "}<span style={{ color: C.text }}>{cmd}</span></div>}
      <div style={{ fontFamily: F.mono, fontSize: 12, color: C.red }}>ERROR: {text}</div>
    </div>
  );
  if (type === "sql") return (
    <div style={{ padding: "4px 0", borderBottom: `1px solid ${C.border}20` }}>
      <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginBottom: 4 }}><span style={{ color: C.green }}>punksql=#</span>{" "}<span style={{ color: C.text }}>{cmd}</span></div>
      {result.ok ? result.columns.length > 0 ? <ResultTable columns={result.columns} rows={result.rows} /> : <div style={{ fontFamily: F.mono, fontSize: 11, color: C.greenDim }}>OK — {result.msg}</div>
        : <div style={{ fontFamily: F.mono, fontSize: 12, color: C.red }}>ERROR: {result.msg}</div>}
    </div>
  );
  return null;
}

// ── Meta-command handler ──────────────────────────────────────
function handleMeta(cmd, db, pushBlock, clearScrollback, replHistory) {
  const parts = cmd.trim().split(/\s+/);
  const verb = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ");
  if (verb === "\\clear" || verb === "\\cls") { clearScrollback(); return; }
  if (verb === "\\h" || verb === "\\?") { pushBlock({ type: "info", text: HELP_TEXT }); return; }
  if (verb === "\\history") {
    const lines = replHistory.length ? replHistory.map((h, i) => `  ${String(replHistory.length - i).padStart(3)}  ${h}`).join("\n") : "  (empty)";
    pushBlock({ type: "info", text: lines }); return;
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

// ── FileTree view ─────────────────────────────────────────────
function FileTree({ db, lang, onOpenInEditor }) {
  const [objects, setObjects] = useState([]);
  const [expanded, setExpanded] = useState({ models: true, seeds: true, staging: false, intermediate: false, mart: false });
  const [selected, setSelected] = useState(null);
  const [showYml, setShowYml] = useState(false);
  const ispt = lang === "pt";

  useEffect(() => { if (db) setObjects(loadObjects(db)); }, [db]);

  const byLayer = useMemo(() => {
    const m = { source: [], staging: [], intermediate: [], mart: [] };
    objects.forEach((o) => m[o.layer].push(o));
    return m;
  }, [objects]);

  const toggle = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }));
  const select = (obj) => setSelected((s) => s?.name === obj.name ? null : obj);

  const FolderRow = ({ label, expKey, color = C.dim, depth = 0, badge }) => (
    <button onClick={() => toggle(expKey)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: `3px 0 3px ${depth * 14}px`, textAlign: "left" }}>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, width: 10 }}>{expanded[expKey] ? "▼" : "▶"}</span>
      <span style={{ fontFamily: F.mono, fontSize: 11, color }}>📁 {label}</span>
      {badge && <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>{badge}</span>}
    </button>
  );

  const FileRow = ({ obj, depth = 0 }) => {
    const isSelected = selected?.name === obj.name;
    const col = obj.type === "view" ? C.purple : LAYER_META[obj.layer].color;
    return (
      <div>
        <button onClick={() => select(obj)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: isSelected ? `${col}12` : "none", border: "none", cursor: "pointer", padding: `3px 0 3px ${depth * 14}px`, textAlign: "left" }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, width: 10 }}>📄</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: isSelected ? col : C.text }}>{obj.name}.{obj.type === "view" ? "sql" : "csv"}</span>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>{obj.type}</span>
        </button>
        {isSelected && (
          <div style={{ marginLeft: depth * 14 + 16, borderLeft: `1px solid ${C.border}`, paddingLeft: 10, marginBottom: 4 }}>
            {obj.upstreams.length > 0 && (
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 4 }}>
                depends on: {obj.upstreams.join(", ")}
              </div>
            )}
            {obj.ddl && (
              <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, margin: "0 0 6px", whiteSpace: "pre-wrap", overflowX: "auto" }}>{obj.ddl}</pre>
            )}
            {obj.type === "view" && (
              <button
                onClick={() => { onOpenInEditor(obj.ddl || `-- ${obj.name}\n`); }}
                style={{ fontFamily: F.mono, fontSize: 10, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}40`, cursor: "pointer", padding: "3px 10px" }}
              >{ispt ? "Abrir no editor" : "Open in Editor"} →</button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
      {/* dbt_project.yml */}
      <div style={{ marginBottom: 4 }}>
        <button onClick={() => setShowYml((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "3px 0", textAlign: "left" }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, width: 10 }}>📄</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.amber }}>dbt_project.yml</span>
        </button>
        {showYml && (
          <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginLeft: 16, padding: "6px 10px", borderLeft: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{DBT_PROJECT_YML}</pre>
        )}
      </div>

      {/* models/ */}
      <FolderRow label="models" expKey="models" color={C.cyan} />
      {expanded.models && (
        <>
          <FolderRow label="staging" expKey="staging" color={C.cyan} depth={1} badge="stg_*" />
          {expanded.staging && byLayer.staging.map((o) => <FileRow key={o.name} obj={o} depth={2} />)}
          {expanded.staging && byLayer.staging.length === 0 && (
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 42 }}>
              {ispt ? "Crie: CREATE VIEW stg_orders AS ..." : "Create: CREATE VIEW stg_orders AS ..."}
            </div>
          )}

          <FolderRow label="intermediate" expKey="intermediate" color={C.amber} depth={1} badge="int_*" />
          {expanded.intermediate && byLayer.intermediate.map((o) => <FileRow key={o.name} obj={o} depth={2} />)}
          {expanded.intermediate && byLayer.intermediate.length === 0 && (
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 42 }}>
              {ispt ? "Crie: CREATE VIEW int_revenue AS ..." : "Create: CREATE VIEW int_revenue AS ..."}
            </div>
          )}

          <FolderRow label="mart" expKey="mart" color={C.green} depth={1} badge="fct_*/dim_*" />
          {expanded.mart && byLayer.mart.map((o) => <FileRow key={o.name} obj={o} depth={2} />)}
          {expanded.mart && byLayer.mart.length === 0 && (
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 42 }}>
              {ispt ? "Crie: CREATE VIEW fct_revenue AS ..." : "Create: CREATE VIEW fct_revenue AS ..."}
            </div>
          )}
        </>
      )}

      {/* seeds/ */}
      <FolderRow label="seeds" expKey="seeds" color={C.dim} badge="raw tables" />
      {expanded.seeds && byLayer.source.map((o) => <FileRow key={o.name} obj={o} depth={1} />)}

      {/* hint */}
      <div style={{ fontFamily: F.mono, fontSize: 9, color: C.border, marginTop: 16, lineHeight: 1.8 }}>
        {ispt ? "Crie views com prefixos de camada\npara populer a árvore de modelos:" : "Create views with layer prefixes\nto populate the model tree:"}
        <br />{"  stg_orders → int_revenue → fct_kpi"}
      </div>
    </div>
  );
}

// ── SQL / YAML Editor view ────────────────────────────────────
function SqlEditor({ db, lang, initialSql, fileName, onSqlChange: notifySqlChange, onFileNameChange, onOpenFileManager, tableNames, columnNames, onRefreshCatalog, onLintIssuesChange, insertRef }) {
  const [sql, setSql] = useState(initialSql || "-- Write your SQL here\nSELECT *\nFROM customers\nLIMIT 10;");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [lintIssues, setLintIssues] = useState([]);
  const [renamingFile, setRenamingFile] = useState(false);
  const [renameVal, setRenameVal] = useState(fileName || "query.sql");
  const taRef = useRef(null);
  const hlRef = useRef(null);
  const renameRef = useRef(null);
  const ispt = lang === "pt";
  const fileIsYaml = isYaml(fileName || "");

  const tableSet = useMemo(() => new Set(tableNames.map((t) => t.toLowerCase())), [tableNames]);
  const colSet   = useMemo(() => new Set(columnNames.map((c) => c.toLowerCase())), [columnNames]);

  // Keep highlight layer scrolled in sync with textarea
  const syncScroll = useCallback(() => {
    if (taRef.current && hlRef.current) {
      hlRef.current.scrollTop  = taRef.current.scrollTop;
      hlRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => { if (initialSql !== undefined && initialSql !== sql) { setSql(initialSql); setResult(null); } }, [initialSql]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRenameVal(fileName || "query.sql"); }, [fileName]);

  const runQuery = useCallback(() => {
    const trimmed = sql.trim();
    if (!db || !trimmed) return;
    setRunning(true);
    const r = execSQL(db, trimmed);
    setResult(r);
    setRunning(false);
    if (/^\s*(CREATE|DROP|ALTER)\b/i.test(trimmed)) onRefreshCatalog();
  }, [sql, db, onRefreshCatalog]);

  const updateSuggestions = (text, pos) => {
    const word = getWordAtCursor(text, pos ?? text.length);
    setSuggestions(word.length < 1 ? [] : computeSuggestions(word, tableNames, columnNames));
  };

  const insertAtCursorEditor = (text) => {
    if (!taRef.current) return;
    const start = taRef.current.selectionStart; const end = taRef.current.selectionEnd;
    const next = sql.slice(0, start) + text + sql.slice(end);
    setSql(next); if (notifySqlChange) notifySqlChange(next);
    const newPos2 = start + text.length;
    setSuggestions(computeSuggestions(getWordAtCursor(next, newPos2), tableNames, columnNames));
    requestAnimationFrame(() => { if (taRef.current) { taRef.current.selectionStart = taRef.current.selectionEnd = newPos2; taRef.current.focus(); } });
  };

  const acceptSuggestionEditor = (suggestion) => {
    if (!taRef.current) return;
    const pos = taRef.current.selectionStart;
    const { text: newText, newPos } = replaceWordAtCursor(sql, pos, suggestion);
    setSql(newText); if (notifySqlChange) notifySqlChange(newText);
    setSuggestions([]);
    requestAnimationFrame(() => { if (taRef.current) { taRef.current.selectionStart = taRef.current.selectionEnd = newPos; taRef.current.focus(); } });
  };

  // Populate insertRef on every render so SandboxAuxKeyboard always has fresh closure
  if (insertRef) insertRef.current = insertAtCursorEditor;

  // Smart linter — debounced, handles SQL and YAML
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sql.trim()) { setLintIssues([]); onLintIssuesChange?.([]); return; }
      let issues = [];
      if (fileIsYaml) {
        issues = yamlLint(sql);
      } else {
        const trimmed = sql.trim();
        let depth = 0, inStr = false, strCh = '';
        for (let ci = 0; ci < trimmed.length; ci++) {
          const c = trimmed[ci];
          if (inStr) { if (c === strCh) inStr = false; continue; }
          if (c === "'" || c === '"') { inStr = true; strCh = c; continue; }
          if (c === '(') depth++;
          else if (c === ')') depth--;
        }
        if (depth > 0) issues.push({ type: 'warn', msg: `${depth} unclosed paren${depth > 1 ? 's' : ''}` });
        if (depth < 0) issues.push({ type: 'error', msg: `${-depth} extra ')'` });
        if (/^\s*SELECT\b/i.test(trimmed) && !/\bFROM\b/i.test(trimmed) && !/^\s*SELECT\s+(\d|'|\w+\s*\()/i.test(trimmed)) {
          issues.push({ type: 'warn', msg: 'SELECT missing FROM' });
        }
        if (db && issues.filter(i => i.type === 'error').length === 0) {
          const clean = trimmed.replace(/;\s*$/, '');
          if (/^\s*(SELECT|WITH)\b/i.test(clean) && clean.length > 6) {
            try { const r = execSQL(db, `EXPLAIN QUERY PLAN ${clean}`); if (!r.ok) issues.push({ type: 'error', msg: r.msg.split('\n')[0].replace(/^.*?:\s*/, '') }); } catch(e) {}
          }
        }
      }
      setLintIssues(issues);
      onLintIssuesChange?.(issues);
    }, 400);
    return () => clearTimeout(timer);
  }, [sql, db, fileIsYaml]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runQuery(); return; }
    if (e.key === "Escape") { setSuggestions([]); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length > 0) { acceptSuggestionEditor(suggestions[0]); }
      else { const t = taRef.current; const s = t.selectionStart; const next = sql.slice(0, s) + "  " + sql.slice(s); setSql(next); if (notifySqlChange) notifySqlChange(next); requestAnimationFrame(() => { if (taRef.current) { taRef.current.selectionStart = taRef.current.selectionEnd = s + 2; } }); }
      return;
    }
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const ta = taRef.current;
      if (!ta) return;
      const pos = ta.selectionStart;
      const ins = fileIsYaml ? (() => {
        // YAML: match current line indent
        const { indent } = sqlLineContext(sql, pos);
        return "\n" + indent;
      })() : sqlSmartNewline(sql, pos);
      const next = sql.slice(0, pos) + ins + sql.slice(ta.selectionEnd);
      setSql(next);
      if (notifySqlChange) notifySqlChange(next);
      const newPos = pos + ins.length;
      requestAnimationFrame(() => { if (taRef.current) { taRef.current.selectionStart = taRef.current.selectionEnd = newPos; } });
    }
  };

  const lineCount = sql.split("\n").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Editor toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
        {/* Hamburger ☰ — opens file manager */}
        <button
          onMouseDown={(e) => { e.preventDefault(); onOpenFileManager?.(); }}
          title="Files"
          style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.dim, padding: "3px 7px", flexShrink: 0, lineHeight: 1 }}
        >☰</button>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, flexShrink: 0 }}>{fileIsYaml ? "⚙" : "📄"}</span>
        {renamingFile ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => { const v = renameVal.trim() || fileName; setRenameVal(v); onFileNameChange?.(v); setRenamingFile(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = renameVal.trim() || fileName; setRenameVal(v); onFileNameChange?.(v); setRenamingFile(false); } if (e.key === "Escape") { setRenameVal(fileName); setRenamingFile(false); } }}
            style={{ flex: 1, fontFamily: F.mono, fontSize: 11, color: C.amber, background: `${C.amber}10`, border: `1px solid ${C.amber}`, outline: "none", padding: "1px 6px" }}
            autoFocus
          />
        ) : (
          <button
            onDoubleClick={() => { setRenameVal(fileName || "query.sql"); setRenamingFile(true); setTimeout(() => renameRef.current?.select(), 50); }}
            title="Double-click to rename"
            style={{ fontFamily: F.mono, fontSize: 11, color: fileIsYaml ? C.green : C.amber, flex: 1, background: "none", border: "none", cursor: "text", textAlign: "left", padding: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >{fileName || "query.sql"}</button>
        )}
        {fileIsYaml
          ? <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green, flexShrink: 0, letterSpacing: 1 }}>YAML</span>
          : <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, flexShrink: 0 }}>Ctrl+↵</span>
        }
        {!fileIsYaml && (
          <button onClick={runQuery} disabled={!db || !sql.trim() || running} style={{ fontFamily: F.mono, fontSize: 11, padding: "4px 12px", background: sql.trim() ? C.cyanGhost : "none", border: `1px solid ${sql.trim() ? C.cyan : C.border}`, color: sql.trim() ? C.cyan : C.dim, cursor: sql.trim() ? "pointer" : "default", letterSpacing: 1, flexShrink: 0 }}>
            {running ? "…" : "▶ RUN"}
          </button>
        )}
      </div>

      {/* Tab prediction chip bar — sits between toolbar and editor so it stays visible when keyboard opens */}
      <div style={{ display: "flex", gap: 4, padding: "3px 8px", flexShrink: 0, borderBottom: `1px solid ${C.border}20`, background: suggestions.length > 0 ? `${C.cyan}06` : "transparent", overflowX: "auto", touchAction: "pan-x" }}>
        {suggestions.length > 0 ? (
          <>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cyanDim, alignSelf: "center", flexShrink: 0, paddingRight: 2 }}>tab→</span>
            {suggestions.map((s, i) => (
              <button key={s}
                onMouseDown={(e) => { e.preventDefault(); acceptSuggestionEditor(s); }}
                style={{ background: i === 0 ? C.cyanGhost : "none", border: `1px solid ${i === 0 ? C.cyan : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: i === 0 ? C.cyan : C.dim, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}
              >{s}</button>
            ))}
          </>
        ) : (
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.border, alignSelf: "center", userSelect: "none", padding: "2px 0" }}>↑⌨ sql autocomplete</span>
        )}
      </div>

      {/* Editor + results split */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {/* Code editor area */}
        <div style={{ display: "flex", flex: result ? "0 0 50%" : 1, overflow: "hidden", borderBottom: result ? `1px solid ${C.border}` : "none" }}>
          {/* Line numbers */}
          <div style={{ background: C.panel, padding: "10px 8px 10px 10px", textAlign: "right", userSelect: "none", flexShrink: 0, overflowY: "hidden" }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} style={{ fontFamily: F.mono, fontSize: 12, color: C.border, lineHeight: "1.6em" }}>{i + 1}</div>
            ))}
          </div>
          {/* Highlight overlay + textarea stack */}
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            {/* Highlight layer — rendered HTML behind the textarea */}
            <pre
              ref={hlRef}
              aria-hidden="true"
              style={{
                position: "absolute", inset: 0,
                fontFamily: F.mono, fontSize: 12, lineHeight: "1.6em",
                padding: "10px 12px 10px 6px",
                margin: 0,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                overflowY: "auto", overflowX: "hidden",
                pointerEvents: "none",
                background: C.surface,
                color: "transparent",
              }}
              dangerouslySetInnerHTML={{ __html:
                tokensToHtml(
                  fileIsYaml ? tokenizeYAML(sql || "") : tokenizeSQL(sql || "", tableSet, colSet)
                ) + "<br/>"
              }}
            />
            {/* Transparent textarea on top — caret + selection only */}
            <textarea
              ref={taRef}
              value={sql}
              onChange={(e) => {
                setSql(e.target.value);
                if (notifySqlChange) notifySqlChange(e.target.value);
                updateSuggestions(e.target.value, e.target.selectionStart);
              }}
              onKeyDown={onKeyDown}
              onScroll={syncScroll}
              spellCheck={false}
              autoComplete="off"
              placeholder={fileIsYaml ? "# YAML config\n" : "-- Write SQL here\n-- Ctrl+Enter to run\n\nSELECT *\nFROM customers\nLIMIT 10;"}
              style={{
                position: "absolute", inset: 0,
                fontFamily: F.mono, fontSize: 12, lineHeight: "1.6em",
                padding: "10px 12px 10px 6px",
                margin: 0,
                color: "transparent",
                caretColor: C.green,
                background: "transparent",
                border: "none", outline: "none", resize: "none",
                overflowY: "auto", overflowX: "hidden",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}
            />
          </div>
        </div>

        {/* Results panel */}
        {result && (
          <div style={{ flex: "0 0 50%", overflow: "auto", padding: "8px 12px", background: C.panel }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: result.ok ? C.green : C.red }}>
                {result.ok ? `✓ ${result.msg}` : "✗ ERROR"}
              </span>
              <button onClick={() => setResult(null)} style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>✕ dismiss</button>
            </div>
            {result.ok && result.columns.length > 0 && <ResultTable columns={result.columns} rows={result.rows} />}
            {result.ok && result.columns.length === 0 && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.greenDim }}>OK — {result.msg}</div>}
            {!result.ok && <pre style={{ fontFamily: F.mono, fontSize: 11, color: C.red, margin: 0, whiteSpace: "pre-wrap" }}>{result.msg}</pre>}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Lineage Stack view ────────────────────────────────────────
function LineageStack({ db, lang }) {
  const [objects, setObjects] = useState([]);
  const ispt = lang === "pt";

  useEffect(() => { if (db) setObjects(loadObjects(db)); }, [db]);

  const byLayer = useMemo(() => {
    const map = { source: [], staging: [], intermediate: [], mart: [] };
    objects.forEach((o) => map[o.layer].push(o));
    return map;
  }, [objects]);

  const hasLayers = byLayer.staging.length + byLayer.intermediate.length + byLayer.mart.length > 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, letterSpacing: 1.5, marginBottom: 10 }}>DATA LINEAGE</div>

      {/* Flow legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14, overflowX: "auto" }}>
        {LAYER_ORDER.map((l, i) => {
          const m = LAYER_META[l]; const count = byLayer[l].length;
          return (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: count ? m.color : C.muted, border: `1px solid ${count ? m.color : C.border}`, padding: "2px 6px", letterSpacing: 1, background: count ? `${m.color}12` : "none" }}>
                {m.badge} {count > 0 ? `(${count})` : ""}
              </div>
              {i < LAYER_ORDER.length - 1 && <span style={{ color: C.border, fontSize: 12 }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* Layer sections */}
      {LAYER_ORDER.map((layerKey) => {
        const m = LAYER_META[layerKey];
        const items = byLayer[layerKey];
        if (!items.length && hasLayers) return null;
        return (
          <div key={layerKey} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: m.color, letterSpacing: 2, marginBottom: 6 }}>
              ┤ {m.label} <span style={{ color: C.muted, letterSpacing: 0, fontSize: 9 }}>// {m.hint} · {m.folder}</span> ├
            </div>
            {items.length === 0 ? (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 8 }}>
                {layerKey === "staging" && "create views with stg_ prefix"}
                {layerKey === "intermediate" && "create views with int_ prefix"}
                {layerKey === "mart" && "create views with fct_ or dim_ prefix"}
              </div>
            ) : (
              items.map((obj) => (
                <div key={obj.name} style={{ paddingLeft: 8, marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: obj.type === "view" ? C.purple : m.color }}>{obj.type === "view" ? "◻" : "▪"} {obj.name}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{obj.type}</span>
                  </div>
                  {obj.upstreams.length > 0 && (
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, paddingLeft: 10 }}>← {obj.upstreams.join(", ")}</div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}

      {!hasLayers && (
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, lineHeight: 1.8 }}>
          {ispt ? "Crie views com prefixos de camada para ver a linhagem:" : "Create views with layer prefixes to see lineage:"}
          {"  stg_orders → int_daily_revenue → fct_revenue"}
          <pre style={{ margin: "6px 0 0", color: C.border, fontSize: 9 }}>{`CREATE VIEW stg_orders AS
  SELECT id, customer_id,
         CAST(total_amount AS REAL) AS amount
  FROM orders;`}</pre>
        </div>
      )}
    </div>
  );
}

// ── Syntax tokenizers ─────────────────────────────────────────
const SQL_KW_SET = new Set([
  "SELECT","DISTINCT","FROM","WHERE","JOIN","ON","LEFT","RIGHT","INNER","FULL","CROSS",
  "GROUP","ORDER","HAVING","LIMIT","OFFSET","AS","WITH","UNION","ALL","EXCEPT","INTERSECT",
  "AND","OR","NOT","IN","LIKE","ILIKE","BETWEEN","IS","NULL","EXISTS","CASE","WHEN","THEN",
  "ELSE","END","ASC","DESC","PARTITION","OVER","ROWS","PRECEDING","CURRENT","ROW","BY",
  "CREATE","DROP","ALTER","INSERT","INTO","VALUES","UPDATE","SET","DELETE","TABLE","VIEW",
  "INDEX","UNIQUE","IF","ADD","COLUMN","RENAME","PRIMARY","KEY","REFERENCES","DEFAULT",
  "AUTOINCREMENT","SAVEPOINT","RELEASE","ROLLBACK","ATTACH","DETACH","PRAGMA",
  "OUTER","NATURAL","USING","RETURNING","EXPLAIN","QUERY","PLAN",
]);
const SQL_FUNC_SET = new Set([
  "COUNT","SUM","AVG","MIN","MAX","ROUND","COALESCE","NULLIF","CAST","TYPEOF",
  "LENGTH","UPPER","LOWER","SUBSTR","TRIM","REPLACE","INSTR","DATE","STRFTIME",
  "JULIANDAY","ROW_NUMBER","RANK","DENSE_RANK","LAG","LEAD","FIRST_VALUE",
  "LAST_VALUE","NTILE","PERCENT_RANK","ABS","RANDOM","IFNULL","PRINTF","IIF",
]);
const SQL_TYPE_SET = new Set(["INTEGER","TEXT","REAL","BLOB","NUMERIC","BOOLEAN"]);

function tokenizeSQL(code, tableSet, colSet) {
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // line comment
    if (code[i] === "-" && code[i+1] === "-") {
      let j = i; while (j < code.length && code[j] !== "\n") j++;
      tokens.push({ color: "#3d5a45", text: code.slice(i, j) }); // dim green
      i = j; continue;
    }
    // block comment
    if (code[i] === "/" && code[i+1] === "*") {
      let j = i + 2; while (j < code.length - 1 && !(code[j] === "*" && code[j+1] === "/")) j++;
      tokens.push({ color: "#3d5a45", text: code.slice(i, j + 2) });
      i = j + 2; continue;
    }
    // string literal
    if (code[i] === "'" || code[i] === '"') {
      const q = code[i]; let j = i + 1;
      while (j < code.length && code[j] !== q) { if (code[j] === "\\") j++; j++; }
      tokens.push({ color: "#b5946a", text: code.slice(i, j + 1) }); // amber-ish
      i = j + 1; continue;
    }
    // number
    if (/[0-9]/.test(code[i])) {
      let j = i; while (j < code.length && /[0-9.]/.test(code[j])) j++;
      tokens.push({ color: "#7ec8a0", text: code.slice(i, j) }); // soft green
      i = j; continue;
    }
    // word
    if (/[A-Za-z_]/.test(code[i])) {
      let j = i; while (j < code.length && /[A-Za-z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const up = word.toUpperCase();
      let color = C.text;
      if (SQL_KW_SET.has(up))              color = "#00FFFF"; // cyan
      else if (SQL_FUNC_SET.has(up))       color = "#CC88FF"; // purple
      else if (SQL_TYPE_SET.has(up))       color = "#FF9944"; // orange
      else if (tableSet.has(word.toLowerCase())) color = "#00FF88"; // green
      else if (colSet.has(word.toLowerCase()))   color = "#AADDFF"; // light blue
      tokens.push({ color, text: word });
      i = j; continue;
    }
    // punctuation: (, ), ,, ;
    if ("(),;".includes(code[i])) {
      tokens.push({ color: "#777777", text: code[i] }); i++; continue;
    }
    // operators
    if ("=<>!".includes(code[i])) {
      let j = i; while (j < code.length && "=<>!".includes(code[j])) j++;
      tokens.push({ color: "#88BBDD", text: code.slice(i, j) }); // pale blue
      i = j; continue;
    }
    // everything else (whitespace, symbols)
    tokens.push({ color: C.dim, text: code[i] }); i++;
  }
  return tokens;
}

function tokenizeYAML(code) {
  const tokens = [];
  for (const rawLine of code.split("\n")) {
    const line = rawLine;
    // comment
    if (/^\s*#/.test(line)) {
      tokens.push({ color: "#3d5a45", text: line }); tokens.push({ color: C.dim, text: "\n" }); continue;
    }
    // key: value
    const kv = line.match(/^(\s*)([\w-]+)(\s*:\s*)(.*)$/);
    if (kv) {
      const [, indent, key, colon, val] = kv;
      tokens.push({ color: C.dim, text: indent });
      tokens.push({ color: "#00FFFF", text: key });     // key = cyan
      tokens.push({ color: "#555555", text: colon });   // colon = dim
      // value
      if (/^["']/.test(val.trim())) {
        tokens.push({ color: "#b5946a", text: val });   // string = amber
      } else if (/^(true|false|null|~)$/i.test(val.trim())) {
        tokens.push({ color: "#CC88FF", text: val });   // special = purple
      } else if (/^-?\d/.test(val.trim())) {
        tokens.push({ color: "#7ec8a0", text: val });   // number = green
      } else {
        tokens.push({ color: C.text, text: val });
      }
      tokens.push({ color: C.dim, text: "\n" }); continue;
    }
    // list item
    const li = line.match(/^(\s*-\s+)(.*)$/);
    if (li) {
      tokens.push({ color: "#555555", text: li[1] });
      tokens.push({ color: C.text, text: li[2] });
      tokens.push({ color: C.dim, text: "\n" }); continue;
    }
    // section header (word ending with :)
    if (/^\s*[\w-]+:\s*$/.test(line)) {
      const m = line.match(/^(\s*)([\w-]+)(:\s*)$/);
      if (m) {
        tokens.push({ color: C.dim, text: m[1] });
        tokens.push({ color: "#FFBB00", text: m[2] }); // amber for section keys
        tokens.push({ color: "#555555", text: m[3] });
        tokens.push({ color: C.dim, text: "\n" }); continue;
      }
    }
    tokens.push({ color: C.text, text: line });
    tokens.push({ color: C.dim, text: "\n" });
  }
  return tokens;
}

// Build HTML string from token array for use as innerHTML
function tokensToHtml(tokens) {
  return tokens.map(({ color, text }) => {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<span style="color:${color}">${escaped}</span>`;
  }).join("");
}

// ── Schema explorer (tables + columns) for file manager ───────
function SchemaExplorer({ db }) {
  const [tables, setTables] = useState([]);
  const [openTable, setOpenTable] = useState(null);
  const [columns, setColumns] = useState({});

  useEffect(() => {
    if (!db) return;
    const r = execSQL(db, "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name");
    if (r.ok) setTables(r.rows.map(([name, type]) => ({ name, type })));
  }, [db]);

  const loadColumns = (tableName) => {
    if (columns[tableName]) { setOpenTable((t) => t === tableName ? null : tableName); return; }
    const r = execSQL(db, `PRAGMA table_info("${tableName}")`);
    if (r.ok) {
      setColumns((prev) => ({ ...prev, [tableName]: r.rows.map((row) => ({ cid: row[0], name: row[1], type: row[2], notnull: row[3], pk: row[5] })) }));
    }
    setOpenTable((t) => t === tableName ? null : tableName);
  };

  if (!tables.length) return (
    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.border, padding: "6px 12px" }}>no tables yet</div>
  );

  return (
    <div>
      {tables.map(({ name, type }) => {
        const isOpen = openTable === name;
        const cols = columns[name] || [];
        const isView = type === "view";
        const col = isView ? C.purple : C.cyan;
        return (
          <div key={name}>
            <button
              onClick={() => loadColumns(name)}
              style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", background: isOpen ? `${col}0a` : "none", border: "none", cursor: "pointer", padding: "5px 12px" }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, width: 10, flexShrink: 0, display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>›</span>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: isView ? C.purple : C.cyan }}>{isView ? "◻" : "▪"}</span>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.text }}>{name}</span>
              <span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginLeft: "auto" }}>{type}</span>
            </button>
            {isOpen && (
              <div style={{ borderLeft: `1px solid ${col}30`, marginLeft: 22, paddingLeft: 8, marginBottom: 2 }}>
                {cols.length === 0 && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.border, padding: "2px 0" }}>loading…</div>}
                {cols.map((c) => (
                  <div key={c.cid} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "2px 4px" }}>
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: c.pk ? C.amber : "#AADDFF" }}>{c.name}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 8, color: C.muted }}>{c.type || "??"}</span>
                    {c.pk ? <span style={{ fontFamily: F.mono, fontSize: 7, color: C.amber }}>PK</span> : null}
                    {c.notnull ? <span style={{ fontFamily: F.mono, fontSize: 7, color: C.dim }}>NOT NULL</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared file row used in FileManagerPanel ──────────────────
function FileRow({ path, name, isCurrent, yaml, col, indent, onOpen, onClose, confirmDelete, setConfirmDelete, onDeleteFile }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: isCurrent ? `${col}12` : "none", borderLeft: isCurrent ? `2px solid ${col}` : "2px solid transparent" }}>
      <button
        onClick={() => { onOpen(path); onClose(); }}
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: `4px 10px 4px ${10 + indent}px`, textAlign: "left", minWidth: 0 }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, flexShrink: 0 }}>{yaml ? "⚙" : "📄"}</span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: isCurrent ? col : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {yaml && <span style={{ fontFamily: F.mono, fontSize: 8, color: C.green, marginLeft: "auto", flexShrink: 0, paddingLeft: 4 }}>yml</span>}
      </button>
      {confirmDelete === path ? (
        <button onClick={() => { onDeleteFile(path); setConfirmDelete(null); }}
          style={{ fontFamily: F.mono, fontSize: 9, color: C.red, background: `${C.red}14`, border: `1px solid ${C.red}`, cursor: "pointer", padding: "2px 6px", margin: "0 8px 0 0", flexShrink: 0 }}>del?</button>
      ) : (
        <button onClick={() => setConfirmDelete(path)}
          style={{ fontFamily: F.mono, fontSize: 10, color: C.border, background: "none", border: "none", cursor: "pointer", padding: "2px 8px", flexShrink: 0 }}>✕</button>
      )}
    </div>
  );
}

// ── File Manager Panel (hamburger sidebar) ────────────────────
function FileManagerPanel({ files, currentFile, db, onOpen, onNewFile, onDeleteFile, onClose }) {
  const [panel, setPanel] = useState("files"); // "files" | "schema"
  const [newName, setNewName] = useState("");
  const [newFolder, setNewFolder] = useState("queries");
  const [creatingFile, setCreatingFile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const toggleFolder = (f) => setCollapsed((s) => ({ ...s, [f]: !s[f] }));

  const folders = useMemo(() => {
    const s = new Set(Object.keys(files).map((p) => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""));
    s.add("queries"); s.add("models/staging"); s.add("models/intermediate"); s.add("models/mart");
    return [...s].filter(Boolean).sort();
  }, [files]);

  const byFolder = useMemo(() => {
    const m = {};
    Object.keys(files).forEach((path) => {
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "(root)";
      if (!m[folder]) m[folder] = [];
      m[folder].push(path);
    });
    return m;
  }, [files]);

  // Build top-level tree: group subfolders under their parent
  const allFolders = useMemo(() => {
    const s = new Set(Object.keys(byFolder));
    ["queries", "models/staging", "models/intermediate", "models/mart"].forEach((f) => s.add(f));
    return [...s].sort();
  }, [byFolder]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const hasExt = /\.(sql|yaml|yml)$/i.test(name);
    const fullName = hasExt ? name : name + ".sql";
    const path = newFolder ? `${newFolder}/${fullName}` : fullName;
    onNewFile(path);
    setNewName("");
    setCreatingFile(false);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, display: "flex" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />

      {/* Panel */}
      <div style={{ position: "relative", zIndex: 1, width: "80%", maxWidth: 320, height: "100%", background: C.panel, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
          <button onClick={() => setPanel("files")} style={{ fontFamily: F.mono, fontSize: 10, padding: "9px 12px", background: "none", border: "none", borderBottom: panel === "files" ? `2px solid ${C.amber}` : "2px solid transparent", color: panel === "files" ? C.amber : C.muted, cursor: "pointer", letterSpacing: 1 }}>FILES</button>
          <button onClick={() => setPanel("schema")} style={{ fontFamily: F.mono, fontSize: 10, padding: "9px 12px", background: "none", border: "none", borderBottom: panel === "schema" ? `2px solid ${C.cyan}` : "2px solid transparent", color: panel === "schema" ? C.cyan : C.muted, cursor: "pointer", letterSpacing: 1 }}>SCHEMA</button>
          <div style={{ flex: 1 }} />
          {panel === "files" && (
            <button
              onClick={() => setCreatingFile((v) => !v)}
              style={{ fontFamily: F.mono, fontSize: 11, color: C.green, background: creatingFile ? `${C.green}14` : "none", border: `1px solid ${creatingFile ? C.green : C.border}`, cursor: "pointer", padding: "3px 8px", margin: "0 4px" }}
              title="New file"
            >+ new</button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.muted, padding: "4px 10px" }}>✕</button>
        </div>

        {/* New file form */}
        {panel === "files" && creatingFile && (
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 4 }}>FOLDER</div>
            <select
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              style={{ width: "100%", fontFamily: F.mono, fontSize: 11, background: C.black, color: C.text, border: `1px solid ${C.border}`, padding: "4px 6px", marginBottom: 8 }}
            >
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 4 }}>FILENAME (.sql or .yml)</div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreatingFile(false); }}
              placeholder="my_query.sql"
              style={{ width: "100%", fontFamily: F.mono, fontSize: 11, background: C.black, color: C.white, border: `1px solid ${C.amber}`, outline: "none", padding: "4px 6px", boxSizing: "border-box", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleCreate} style={{ fontFamily: F.mono, fontSize: 10, color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}`, cursor: "pointer", padding: "4px 10px", flex: 1 }}>✓ create</button>
              <button onClick={() => setCreatingFile(false)} style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "4px 10px" }}>cancel</button>
            </div>
          </div>
        )}

        {/* Schema panel */}
        {panel === "schema" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, padding: "6px 12px 4px", letterSpacing: 1 }}>TABLES &amp; VIEWS — click to expand columns</div>
            <SchemaExplorer db={db} />
          </div>
        )}

        {/* File tree */}
        {panel === "files" && <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {/* Root-level files (e.g. dbt_project.yml) */}
          {(byFolder["(root)"] || []).map((path) => {
            const isCurrent = path === currentFile;
            const yaml = isYaml(path);
            const col = yaml ? C.green : C.amber;
            return (
              <FileRow key={path} path={path} name={path} isCurrent={isCurrent} yaml={yaml} col={col}
                indent={0} onOpen={onOpen} onClose={onClose} confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete} onDeleteFile={onDeleteFile} />
            );
          })}

          {/* Folders */}
          {allFolders.map((folder) => {
            const folderFiles = (byFolder[folder] || []).sort();
            const isOpen = !collapsed[folder];
            // folder label color by type
            const fc = folder.startsWith("models/mart") ? C.green
              : folder.startsWith("models/intermediate") ? C.amber
              : folder.startsWith("models") ? C.cyan
              : C.dim;
            return (
              <div key={folder}>
                {/* Folder header */}
                <button
                  onClick={() => toggleFolder(folder)}
                  style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "5px 10px", textAlign: "left" }}
                >
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, width: 10, flexShrink: 0, transition: "transform 0.15s", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: fc }}>
                    {folder.includes("/") ? folder.slice(folder.lastIndexOf("/") + 1) : folder}
                    <span style={{ color: C.border }}>/</span>
                  </span>
                  {!isOpen && folderFiles.length > 0 && (
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.border, marginLeft: "auto" }}>{folderFiles.length}</span>
                  )}
                </button>

                {/* Files inside folder */}
                {isOpen && (
                  <div>
                    {folderFiles.length === 0 && (
                      <div style={{ fontFamily: F.mono, fontSize: 9, color: C.border, paddingLeft: 30, paddingBottom: 3 }}>empty</div>
                    )}
                    {folderFiles.map((path) => {
                      const name = path.slice(path.lastIndexOf("/") + 1);
                      const isCurrent = path === currentFile;
                      const yaml = isYaml(name);
                      const col = yaml ? C.green : C.amber;
                      return (
                        <FileRow key={path} path={path} name={name} isCurrent={isCurrent} yaml={yaml} col={col}
                          indent={16} onOpen={onOpen} onClose={onClose} confirmDelete={confirmDelete}
                          setConfirmDelete={setConfirmDelete} onDeleteFile={onDeleteFile} />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>}

        {panel === "files" && (
          <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.border, lineHeight: 1.8 }}>
              Double-click filename in editor to rename.<br />
              .sql runs against SQLite · .yaml gets YAML linting.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SandboxScreen ─────────────────────────────────────────────
export default function SandboxScreen({ onBack, lang = "en" }) {
  const { scrollback, replHistory, pushBlock, clearScrollback, pushHistory, navigateHistory, resetHistoryIndex } = useSandboxStore();

  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replSql, setReplSql] = useState("");
  const [activeView, setActiveView] = useState("repl"); // "repl"|"editor"|"files"|"lineage"
  const [editorInitialSql, setEditorInitialSql] = useState(undefined);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [suggestions, setSuggestions] = useState([]);
  const [tableNames, setTableNames] = useState([]);
  const [columnNames, setColumnNames] = useState([]);
  const [kbdOpen, setKbdOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [editorLintIssues, setEditorLintIssues] = useState([]);
  const [editorKbdOpen, setEditorKbdOpen] = useState(true);
  const [files, setFiles] = useState(() => loadFileSystem());
  const [currentFile, setCurrentFile] = useState("queries/main.sql");
  const [showFileManager, setShowFileManager] = useState(false);

  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const chipBarSwipeRef = useRef(null);
  const editorInsertRef = useRef(null);
  const ispt = lang === "pt";

  // Persist files whenever they change
  useEffect(() => { saveFileSystem(files); }, [files]);

  const openFile = useCallback((path) => {
    setCurrentFile(path);
    setEditorInitialSql(files[path] ?? "");
    setActiveView("editor");
  }, [files]);

  const handleFileSave = useCallback((path, content) => {
    setFiles((prev) => ({ ...prev, [path]: content }));
  }, []);

  const handleFileNameChange = useCallback((newPath) => {
    if (!newPath || newPath === currentFile) return;
    setFiles((prev) => {
      const next = { ...prev };
      next[newPath] = next[currentFile] ?? "";
      delete next[currentFile];
      return next;
    });
    setCurrentFile(newPath);
  }, [currentFile]);

  const handleNewFile = useCallback((path) => {
    const defaultContent = isYaml(path) ? "# YAML configuration\n" : "-- New query\nSELECT 1;";
    setFiles((prev) => ({ ...prev, [path]: prev[path] ?? defaultContent }));
    setCurrentFile(path);
    setEditorInitialSql(undefined);
    setActiveView("editor");
  }, []);

  const handleDeleteFile = useCallback((path) => {
    setFiles((prev) => { const next = { ...prev }; delete next[path]; return next; });
    if (path === currentFile) {
      const remaining = Object.keys(files).filter((p) => p !== path);
      const next = remaining[0] || "queries/main.sql";
      setCurrentFile(next);
      setEditorInitialSql(files[next] ?? "");
    }
  }, [currentFile, files]);

  const refreshCatalog = useCallback((dbInst) => {
    const d = dbInst || db;
    if (!d) return;
    const tr = execSQL(d, "SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name");
    const tNames = tr.ok ? tr.rows.map((r) => r[0]) : [];
    setTableNames(tNames);
    const cols = new Set();
    tNames.forEach((t) => { const pr = execSQL(d, `PRAGMA table_info("${t}")`); if (pr.ok) pr.rows.forEach((r) => cols.add(r[1])); });
    setColumnNames([...cols]);
  }, [db]);

  useEffect(() => {
    getSandboxDB(DB_SCHEMA)
      .then((d) => {
        setDb(d);
        refreshCatalog(d);
        if (scrollback.length === 0) {
          pushBlock({ type: "info", text: ispt
            ? `PunkSQL FREE EXPLORE — sql.js ${new Date().toLocaleTimeString()}\nDigite SQL ou \\? para ajuda.\nAbas: SHELL · EDITOR · VAULT · DAG`
            : `PunkSQL FREE EXPLORE — sql.js ${new Date().toLocaleTimeString()}\nType SQL or \\? for help.  Tabs: SHELL · EDITOR · VAULT · DAG`
          });
          // Show available tables on first open
          const dtResult = execSQL(d, "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name");
          pushBlock({ type: "sql", cmd: "\\dt", result: dtResult });
        }
        if (!localStorage.getItem(ONBOARD_KEY)) setShowOnboard(true);
      })
      .catch(() => pushBlock({ type: "error", text: "Failed to load sql.js engine" }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [scrollback]);

  const updateSuggestions = useCallback((value, pos) => {
    const word = getWordAtCursor(value, pos ?? value.length);
    if (word.length < 1) { setSuggestions([]); return; }
    setSuggestions(computeSuggestions(word, tableNames, columnNames));
  }, [tableNames, columnNames]);

  const onSqlChange = useCallback((e) => {
    const v = e.target.value;
    setReplSql(v);
    updateSuggestions(v, e.target.selectionStart);
  }, [updateSuggestions]);

  const acceptSuggestion = useCallback((suggestion) => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const { text: newText, newPos } = replaceWordAtCursor(replSql, pos, suggestion);
    setReplSql(newText);
    setSuggestions([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) { textareaRef.current.selectionStart = newPos; textareaRef.current.selectionEnd = newPos; textareaRef.current.focus(); }
    });
  }, [replSql]);

  const insertAtCursor = useCallback((text) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const next = replSql.slice(0, start) + text + replSql.slice(ta.selectionEnd);
    setReplSql(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) { textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length; textareaRef.current.focus(); }
    });
  }, [replSql]);

  const execute = useCallback(async () => {
    const trimmed = replSql.trim();
    if (!trimmed || !db) return;
    pushHistory(trimmed);
    setReplSql("");
    setSuggestions([]);
    resetHistoryIndex();

    if (trimmed.startsWith("\\")) {
      if (trimmed === "\\save") {
        setSaveStatus("saving");
        const ok = await saveToIndexedDB();
        setSaveStatus(ok ? "saved" : "error");
        pushBlock({ type: "info", text: ok ? "✓ Workspace saved to IndexedDB" : "✗ Save failed" });
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
    if (/^\s*(CREATE|DROP|ALTER)\b/i.test(trimmed)) refreshCatalog();
  }, [replSql, db, pushBlock, clearScrollback, pushHistory, replHistory, resetHistoryIndex, refreshCatalog, ispt]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Tab") { e.preventDefault(); if (suggestions.length > 0) acceptSuggestion(suggestions[0]); return; }
    if (e.key === "Escape") { setSuggestions([]); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); execute(); return; }
    if (e.key === "ArrowUp" && suggestions.length === 0) { e.preventDefault(); const prev = navigateHistory(1); if (prev !== null) { setReplSql(prev); setSuggestions([]); } return; }
    if (e.key === "ArrowDown" && suggestions.length === 0) { e.preventDefault(); const next = navigateHistory(-1); setReplSql(next ?? ""); }
  }, [suggestions, acceptSuggestion, execute, navigateHistory]);

  const closeOnboard = useCallback(() => { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {} setShowOnboard(false); }, []);

  const onChipBarTouchStart = (e) => { chipBarSwipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onChipBarTouchMove = (e) => {
    if (!chipBarSwipeRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - chipBarSwipeRef.current.x);
    const dy = e.touches[0].clientY - chipBarSwipeRef.current.y;
    if (dy < -35 && dx < 20) { chipBarSwipeRef.current = null; setKbdOpen(true); }
  };
  const onChipBarTouchEnd = () => { chipBarSwipeRef.current = null; };

  const saveBtnLabel = saveStatus === "saving" ? "saving…" : saveStatus === "saved" ? "✓ ok" : saveStatus === "error" ? "✗ err" : "save";
  const saveBtnColor = saveStatus === "saved" ? C.green : saveStatus === "error" ? C.red : C.dim;

  const SHORTCUTS = ["SELECT * FROM", "WHERE", "LEFT JOIN", "GROUP BY", "ORDER BY", "LIMIT 10", "\\dt", "\\?"];
  const showSuggestions = suggestions.length > 0;
  const showReplInput = activeView === "repl";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.void, fontFamily: F.mono, position: "relative" }}>

      {showOnboard && <OnboardingModal onClose={closeOnboard} />}
      {showFileManager && (
        <FileManagerPanel
          files={files}
          currentFile={currentFile}
          db={db}
          onOpen={openFile}
          onNewFile={handleNewFile}
          onDeleteFile={handleDeleteFile}
          onClose={() => setShowFileManager(false)}
        />
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", borderBottom: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: C.dim, padding: "4px 8px", minHeight: 28, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: C.text, letterSpacing: 1 }}>FREE_EXPLORE</span>
          <span style={{ fontSize: 9, color: C.muted, marginLeft: 6 }}>SQLite</span>
        </div>
        <button onClick={() => setShowOnboard(true)} title="Open guide" style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: C.amber, padding: "4px 7px", minHeight: 28, flexShrink: 0 }}>?</button>
        <button onClick={clearScrollback} title="Clear terminal output" style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "4px 7px", minHeight: 28, flexShrink: 0 }}>cls</button>
        <button
          onClick={() => {
            const original = DEFAULT_FILES[currentFile];
            if (original !== undefined) {
              setFiles((prev) => ({ ...prev, [currentFile]: original }));
              setEditorInitialSql(original);
            }
          }}
          title={`Reset ${currentFile} to original`}
          style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: DEFAULT_FILES[currentFile] !== undefined ? C.amber : C.border, padding: "4px 7px", minHeight: 28, flexShrink: 0 }}
        >reset</button>
        <button
          onClick={async () => { setSaveStatus("saving"); const ok = await saveToIndexedDB(); setSaveStatus(ok ? "saved" : "error"); setTimeout(() => setSaveStatus("idle"), 2000); }}
          disabled={!db || saveStatus === "saving"}
          style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: saveBtnColor, padding: "4px 7px", minHeight: 28, flexShrink: 0 }}
        >{saveBtnLabel}</button>
      </div>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* REPL view */}
        {activeView === "repl" && (
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {loading && <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>loading sql.js…</div>}
            {scrollback.map((block) => <ReplBlock key={block.id} block={block} />)}
            {!loading && scrollback.length === 0 && <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>Type SQL or \? for help.</div>}
          </div>
        )}

        {/* EDITOR view */}
        {activeView === "editor" && (
          <>
            <SqlEditor
              db={db}
              lang={lang}
              initialSql={editorInitialSql ?? files[currentFile]}
              fileName={currentFile}
              onFileNameChange={handleFileNameChange}
              onOpenFileManager={() => setShowFileManager(true)}
              tableNames={tableNames}
              columnNames={columnNames}
              onRefreshCatalog={refreshCatalog}
              onSqlChange={(content) => handleFileSave(currentFile, content)}
              onLintIssuesChange={setEditorLintIssues}
              insertRef={editorInsertRef}
            />

            {/* Linter status bar */}
            {editorLintIssues.length > 0 && (
              <div style={{ display: "flex", gap: 10, padding: "3px 10px", borderTop: `1px solid ${C.border}`, background: C.panel, overflowX: "auto", flexShrink: 0 }}>
                {editorLintIssues.map((issue, i) => (
                  <span key={i} style={{ fontFamily: F.mono, fontSize: 10, color: issue.type === "error" ? C.red : issue.type === "warn" ? C.amber : C.dim, whiteSpace: "nowrap" }}>
                    {issue.type === "error" ? "✗" : issue.type === "warn" ? "⚠" : "ℹ"} {issue.msg}
                  </span>
                ))}
              </div>
            )}

            {/* SQL Keyboard — always starts expanded */}
            {editorKbdOpen && (
              <SandboxAuxKeyboard
                onInsert={(text) => editorInsertRef.current?.(text)}
                tableNames={tableNames}
                columnNames={columnNames}
                onSwipeDown={() => setEditorKbdOpen(false)}
              />
            )}

            {/* Control row */}
            <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "6px 10px", flexShrink: 0, display: "flex", gap: 6 }}>
              <button
                onMouseDown={(e) => { e.preventDefault(); setEditorKbdOpen(v => !v); }}
                style={{ background: editorKbdOpen ? `${C.purple}14` : "none", border: `1px solid ${editorKbdOpen ? C.purple : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: editorKbdOpen ? C.purple : C.muted, padding: "4px 10px" }}
              >⌨</button>
            </div>
          </>
        )}

        {/* FILES view */}
        {activeView === "files" && (
          <FileTree
            db={db}
            lang={lang}
            onOpenInEditor={(sql) => { setEditorInitialSql(sql); setCurrentFile("queries/main.sql"); setActiveView("editor"); }}
          />
        )}

        {/* LINEAGE view */}
        {activeView === "lineage" && (
          <LineageStack db={db} lang={lang} />
        )}

        {/* ── Chip bar + keyboard + input: only for REPL tab ── */}
        {showReplInput && (
          <>
            {/* Autocomplete / shortcut chip bar */}
            <div
              onTouchStart={onChipBarTouchStart}
              onTouchMove={onChipBarTouchMove}
              onTouchEnd={onChipBarTouchEnd}
              style={{ display: "flex", gap: 4, padding: "4px 10px", flexShrink: 0, borderTop: `1px solid ${C.border}20`, overflowX: "auto", background: showSuggestions ? `${C.cyan}06` : "transparent", transition: "background 0.15s", touchAction: "pan-x" }}
            >
              {!kbdOpen && !showSuggestions && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.border, alignSelf: "center", flexShrink: 0, paddingRight: 4, userSelect: "none" }}>↑⌨</span>
              )}
              {showSuggestions ? (
                <>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cyanDim, alignSelf: "center", flexShrink: 0, paddingRight: 2 }}>tab→</span>
                  {suggestions.map((s, i) => (
                    <button key={s} onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(s); }} style={{ background: i === 0 ? C.cyanGhost : "none", border: `1px solid ${i === 0 ? C.cyan : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: i === 0 ? C.cyan : C.dim, padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>{s}</button>
                  ))}
                </>
              ) : (
                SHORTCUTS.map((kw) => (
                  <button key={kw} onMouseDown={(e) => { e.preventDefault(); insertAtCursor(replSql.length && !replSql.endsWith(" ") ? " " + kw : kw); }} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.muted, padding: "3px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{kw}</button>
                ))
              )}
            </div>

            {/* SQL Keyboard */}
            {kbdOpen && (
              <SandboxAuxKeyboard
                onInsert={insertAtCursor}
                tableNames={tableNames}
                columnNames={columnNames}
                onSwipeDown={() => setKbdOpen(false)}
              />
            )}

            {/* Input area */}
            <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "8px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: C.green, paddingTop: 6, flexShrink: 0, userSelect: "none" }}>{replSql.includes("\n") ? "punksql-#" : "punksql=#"}</span>
                <textarea
                  ref={textareaRef}
                  value={replSql}
                  onChange={onSqlChange}
                  onKeyDown={onKeyDown}
                  onClick={(e) => updateSuggestions(replSql, e.target.selectionStart)}
                  rows={Math.min(5, Math.max(1, replSql.split("\n").length))}
                  placeholder={ispt ? "SQL ou \\comando  ·  Tab=autocomplete  ·  Shift+Enter=nova linha" : "SQL or \\command  ·  Tab=autocomplete  ·  Shift+Enter=new line"}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: F.mono, fontSize: 13, color: C.white, caretColor: C.green, resize: "none", lineHeight: 1.6, paddingTop: 4 }}
                  autoComplete="off" spellCheck={false} disabled={loading || !db}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setKbdOpen((v) => !v); requestAnimationFrame(() => textareaRef.current?.focus()); }}
                    style={{ background: kbdOpen ? `${C.purple}14` : "none", border: `1px solid ${kbdOpen ? C.purple : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: kbdOpen ? C.purple : C.muted, padding: "4px 10px" }}
                  >⌨</button>
                  <button onClick={() => { setReplSql(""); setSuggestions([]); textareaRef.current?.focus(); }} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.muted, padding: "4px 10px" }}>{ispt ? "limpar" : "clear"}</button>
                </div>
                <button onClick={execute} disabled={loading || !db || !replSql.trim()} style={{ background: replSql.trim() ? C.cyanGhost : "none", border: `1px solid ${replSql.trim() ? C.cyan : C.border}`, cursor: replSql.trim() ? "pointer" : "default", fontFamily: F.mono, fontSize: 12, color: replSql.trim() ? C.cyan : C.dim, padding: "4px 14px", letterSpacing: 1 }}>▶ {ispt ? "EXECUTAR" : "RUN"}</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
        {BOTTOM_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "8px 4px 6px",
              background: activeView === tab.id ? `${tab.color}10` : "none",
              border: "none",
              borderTop: activeView === tab.id ? `2px solid ${tab.color}` : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ fontFamily: F.mono, fontSize: 13, color: activeView === tab.id ? tab.color : C.muted, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: activeView === tab.id ? tab.color : C.muted, letterSpacing: 1 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
