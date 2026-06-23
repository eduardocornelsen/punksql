"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import useSandboxStore from "@/stores/useSandboxStore";
import { getSandboxDB, execSQL, saveToIndexedDB, resetSandboxDB } from "@/lib/sqlEngine";

// ── Visual tokens (mirrors PunkSQL.jsx) ──────────────────────
const C = {
  void: "#000000", black: "#000000", panel: "#0D0D0D", surface: "#111111",
  border: "#222222", borderBright: "#333333",
  cyan: "#00FFFF", cyanDim: "#00CCCC", cyanGhost: "rgba(0,255,255,0.08)",
  green: "#00FF88", greenDim: "#00CC66", greenGhost: "rgba(0,255,136,0.10)",
  amber: "#FFBB00", amberGhost: "rgba(255,187,0,0.10)",
  red: "#FF3333", redDim: "#CC2222", redGhost: "rgba(255,51,51,0.10)",
  white: "#FFFFFF", dim: "#9a9a9a", muted: "#7a7a7a", purple: "#CC88FF",
  text: "#CCCCCC",
};
const F = { mono: "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace" };

// ── DB_SCHEMA for sandbox — same dataset as challenges ────────
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

const HELP_TEXT = `
\\dt            list tables
\\dv            list views
\\d <name>      describe table or view columns
\\l             list attached databases
\\history       show command history
\\clear         clear screen
\\save          save workspace to IndexedDB
\\reset         reset to initial dataset (clears saved workspace)
\\h, \\?         show this help
`;

// ── Object Browser ────────────────────────────────────────────
function ObjectBrowser({ db, onInsert, lang }) {
  const [tables, setTables] = useState([]);
  const [views, setViews] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [colCache, setColCache] = useState({});

  const refresh = useCallback(() => {
    if (!db) return;
    const tr = execSQL(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const vr = execSQL(db, "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name");
    setTables(tr.ok ? tr.rows.map((r) => r[0]) : []);
    setViews(vr.ok ? vr.rows.map((r) => r[0]) : []);
  }, [db]);

  useEffect(() => { refresh(); }, [refresh]);

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

  const ispt = lang === "pt";

  const Row = ({ name, type, icon }) => (
    <div>
      <button
        onClick={() => toggleExpand(name)}
        style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "3px 0",
          fontFamily: F.mono, fontSize: 12, color: C.text, textAlign: "left",
        }}
      >
        <span style={{ color: type === "view" ? C.purple : C.cyan, minWidth: 14 }}>
          {expanded[name] ? "▼" : "▶"}
        </span>
        <span style={{ color: type === "view" ? C.purple : C.cyan }}>{icon}</span>
        <span>{name}</span>
      </button>
      {expanded[name] && colCache[name] && (
        <div style={{ paddingLeft: 22, borderLeft: `1px solid ${C.border}`, marginLeft: 7 }}>
          {colCache[name].map((col) => (
            <button
              key={col[1]}
              onClick={() => onInsert(col[1])}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%",
                background: "none", border: "none", cursor: "pointer",
                padding: "2px 0", fontFamily: F.mono, fontSize: 11,
                color: C.dim, textAlign: "left",
              }}
            >
              <span style={{ color: C.muted }}>·</span>
              <span style={{ color: C.text }}>{col[1]}</span>
              <span style={{ color: C.muted, fontSize: 10 }}>{col[2]}</span>
              {col[5] ? <span style={{ color: C.amber, fontSize: 9 }}>PK</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`, background: C.panel,
      padding: "8px 12px", maxHeight: 220, overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, letterSpacing: 1.5 }}>
          ┤ {ispt ? "OBJETOS" : "OBJECTS"} ├
        </span>
        <button onClick={refresh} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.muted, padding: "1px 4px" }}>
          ↻ {ispt ? "atualizar" : "refresh"}
        </button>
      </div>
      {tables.length === 0 && views.length === 0 && (
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{ispt ? "nenhum objeto" : "no objects"}</div>
      )}
      {tables.map((n) => <Row key={n} name={n} type="table" icon="⬛" />)}
      {views.map((n) => <Row key={n} name={n} type="view" icon="◻" />)}
    </div>
  );
}

// ── Result Table ───────────────────────────────────────────────
function ResultTable({ columns, rows }) {
  if (!columns.length) return null;
  const widths = columns.map((c, i) =>
    Math.max(String(c).length, ...rows.map((r) => String(r[i] ?? "NULL").length), 4)
  );
  const pad = (v, w) => String(v ?? "NULL").padEnd(w);
  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const hdr = "| " + columns.map((c, i) => pad(c, widths[i])).join(" | ") + " |";

  return (
    <div style={{ overflowX: "auto" }}>
      <pre style={{
        fontFamily: F.mono, fontSize: 11, color: C.text, margin: 0,
        lineHeight: 1.6, whiteSpace: "pre",
      }}>
        {sep}{"\n"}{hdr}{"\n"}{sep}
        {rows.map((row, ri) => (
          "\n| " + row.map((v, ci) => pad(v, widths[ci])).join(" | ") + " |"
        ))}
        {"\n"}{sep}
      </pre>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginTop: 2 }}>
        {rows.length} {rows.length === 1 ? "row" : "rows"}
      </div>
    </div>
  );
}

// ── Scrollback Block ───────────────────────────────────────────
function ReplBlock({ block }) {
  const { type, cmd, result, text } = block;

  if (type === "info") {
    return (
      <div style={{ padding: "2px 0" }}>
        <pre style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, margin: 0, whiteSpace: "pre-wrap" }}>{text}</pre>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div style={{ padding: "4px 0" }}>
        {cmd && (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginBottom: 2 }}>
            <span style={{ color: C.green }}>punksql=#</span>{" "}
            <span style={{ color: C.text }}>{cmd}</span>
          </div>
        )}
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.red, paddingLeft: 2 }}>
          ERROR: {text}
        </div>
      </div>
    );
  }

  if (type === "sql") {
    return (
      <div style={{ padding: "4px 0", borderBottom: `1px solid ${C.border}20` }}>
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginBottom: 4 }}>
          <span style={{ color: C.green }}>punksql=#</span>{" "}
          <span style={{ color: C.text }}>{cmd}</span>
        </div>
        {result.ok ? (
          result.columns.length > 0 ? (
            <ResultTable columns={result.columns} rows={result.rows} />
          ) : (
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.greenDim }}>
              OK — {result.msg}
            </div>
          )
        ) : (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.red }}>
            ERROR: {result.msg}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Meta-command handler ───────────────────────────────────────
function handleMeta(cmd, db, pushBlock, clearScrollback, replHistory, lang) {
  const parts = cmd.trim().split(/\s+/);
  const verb = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ");

  if (verb === "\\clear") {
    clearScrollback();
    return;
  }

  if (verb === "\\h" || verb === "\\?") {
    pushBlock({ type: "info", text: HELP_TEXT.trim() });
    return;
  }

  if (verb === "\\history") {
    const lines = replHistory.length
      ? replHistory.map((h, i) => `  ${String(replHistory.length - i).padStart(3)}  ${h}`).join("\n")
      : "  (empty)";
    pushBlock({ type: "info", text: lines });
    return;
  }

  if (verb === "\\dt") {
    const r = execSQL(db, "SELECT name, 'table' AS type FROM sqlite_master WHERE type='table' ORDER BY name");
    pushBlock({ type: "sql", cmd, result: r });
    return;
  }

  if (verb === "\\dv") {
    const r = execSQL(db, "SELECT name, 'view' AS type FROM sqlite_master WHERE type='view' ORDER BY name");
    pushBlock({ type: "sql", cmd, result: r });
    return;
  }

  if (verb === "\\d") {
    if (!arg) {
      const r = execSQL(db, "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name");
      pushBlock({ type: "sql", cmd, result: r });
      return;
    }
    const r = execSQL(db, `PRAGMA table_info("${arg}")`);
    if (r.ok && r.rows.length === 0) {
      pushBlock({ type: "error", text: `relation "${arg}" does not exist` });
    } else {
      pushBlock({ type: "sql", cmd, result: r });
    }
    return;
  }

  if (verb === "\\l") {
    const r = execSQL(db, "PRAGMA database_list");
    pushBlock({ type: "sql", cmd, result: r });
    return;
  }

  pushBlock({ type: "error", text: `unrecognized command: ${verb}  (try \\? for help)` });
}

// ── SandboxScreen ─────────────────────────────────────────────
export default function SandboxScreen({ onBack, lang = "en" }) {
  const { scrollback, replHistory, pushBlock, clearScrollback, pushHistory, navigateHistory, resetHistoryIndex } = useSandboxStore();

  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sql, setSql] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const ispt = lang === "pt";

  // Boot: load engine + sandbox DB
  useEffect(() => {
    getSandboxDB(DB_SCHEMA)
      .then((d) => {
        setDb(d);
        if (scrollback.length === 0) {
          pushBlock({ type: "info", text: ispt ? `PunkSQL FREE EXPLORE — sql.js ${new Date().toLocaleTimeString()}\nDigite SQL ou \\? para ajuda.` : `PunkSQL FREE EXPLORE — sql.js ${new Date().toLocaleTimeString()}\nType SQL or \\? for help.` });
        }
      })
      .catch(() =>
        pushBlock({ type: "error", text: "Failed to load sql.js engine" })
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when scrollback grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollback]);

  const execute = useCallback(async () => {
    const trimmed = sql.trim();
    if (!trimmed || !db) return;
    pushHistory(trimmed);
    setSql("");
    resetHistoryIndex();

    if (trimmed.startsWith("\\")) {
      if (trimmed === "\\save") {
        setSaveStatus("saving");
        const ok = await saveToIndexedDB();
        setSaveStatus(ok ? "saved" : "error");
        pushBlock({ type: "info", text: ok ? (ispt ? "Workspace salvo (IndexedDB)" : "Workspace saved (IndexedDB)") : "Save failed" });
        setTimeout(() => setSaveStatus("idle"), 2000);
        return;
      }
      if (trimmed === "\\reset") {
        const freshDb = await resetSandboxDB(DB_SCHEMA);
        setDb(freshDb);
        clearScrollback();
        pushBlock({ type: "info", text: ispt ? "Banco reiniciado com dados originais" : "Database reset to initial dataset" });
        return;
      }
      handleMeta(trimmed, db, pushBlock, clearScrollback, replHistory, lang);
      return;
    }

    const result = execSQL(db, trimmed);
    pushBlock({ type: "sql", cmd: trimmed, result });
  }, [sql, db, pushBlock, clearScrollback, pushHistory, replHistory, resetHistoryIndex, lang, ispt]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      execute();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = navigateHistory(1);
      if (prev !== null) setSql(prev);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = navigateHistory(-1);
      setSql(next ?? "");
    }
  }, [execute, navigateHistory]);

  const insertAtCursor = useCallback((text) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = sql.slice(0, start) + text + sql.slice(end);
    setSql(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
    });
  }, [sql]);

  const saveBtnLabel = saveStatus === "saving"
    ? (ispt ? "salvando..." : "saving...")
    : saveStatus === "saved"
      ? (ispt ? "✓ salvo" : "✓ saved")
      : saveStatus === "error"
        ? "✗ error"
        : (ispt ? "salvar" : "save");

  const saveBtnColor = saveStatus === "saved" ? C.green : saveStatus === "error" ? C.red : C.dim;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.void, fontFamily: F.mono }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderBottom: `1px solid ${C.border}`,
        background: C.black, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
          fontFamily: F.mono, fontSize: 12, color: C.dim, padding: "4px 10px", minHeight: 28,
        }}>←</button>
        <div style={{ flex: 1, fontSize: 13, color: C.text, letterSpacing: 1.5 }}>
          FREE_EXPLORE
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>// sql.js · SQLite</span>
        </div>
        <button
          onClick={() => setBrowserOpen((v) => !v)}
          style={{
            background: browserOpen ? C.cyanGhost : "none",
            border: `1px solid ${browserOpen ? C.cyan : C.border}`,
            cursor: "pointer", fontFamily: F.mono, fontSize: 11,
            color: browserOpen ? C.cyan : C.dim, padding: "4px 8px", minHeight: 28,
          }}
        >
          {ispt ? "objetos" : "objects"}
        </button>
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
            fontFamily: F.mono, fontSize: 11, color: saveBtnColor, padding: "4px 8px", minHeight: 28,
          }}
        >
          {saveBtnLabel}
        </button>
      </div>

      {/* ── Object Browser (collapsible) ── */}
      {browserOpen && db && (
        <ObjectBrowser db={db} onInsert={insertAtCursor} lang={lang} />
      )}

      {/* ── Scrollback ── */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}
      >
        {loading && (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>
            {ispt ? "carregando sql.js..." : "loading sql.js..."}
          </div>
        )}
        {scrollback.map((block) => <ReplBlock key={block.id} block={block} />)}
        {!loading && scrollback.length === 0 && (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>
            {ispt ? "Digite SQL ou \\? para ajuda." : "Type SQL or \\? for help."}
          </div>
        )}
      </div>

      {/* ── Keyword shortcut bar ── */}
      <div style={{
        display: "flex", gap: 4, padding: "4px 12px", flexShrink: 0,
        borderTop: `1px solid ${C.border}20`, overflowX: "auto",
      }}>
        {["SELECT *", "FROM", "WHERE", "JOIN ON", "GROUP BY", "\\dt", "\\dv", "\\save"].map((kw) => (
          <button
            key={kw}
            onClick={() => {
              const ins = kw.startsWith("\\") ? kw : (sql.length && !sql.endsWith(" ") ? " " + kw : kw);
              setSql((s) => s + ins);
              textareaRef.current?.focus();
            }}
            style={{
              background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
              fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "3px 7px",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {kw}
          </button>
        ))}
      </div>

      {/* ── Input area ── */}
      <div style={{
        borderTop: `1px solid ${C.border}`, background: C.panel,
        padding: "8px 12px", flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.green, paddingTop: 6, flexShrink: 0, userSelect: "none" }}>
            {sql.includes("\n") ? "punksql-#" : "punksql=#"}
          </span>
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(6, Math.max(1, sql.split("\n").length))}
            placeholder={ispt ? "SQL ou \\comando  (Shift+Enter = nova linha)" : "SQL or \\command  (Shift+Enter = new line)"}
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
          <button
            onClick={() => setSql("")}
            style={{
              background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
              fontFamily: F.mono, fontSize: 11, color: C.muted, padding: "4px 10px",
            }}
          >
            {ispt ? "limpar" : "clear"}
          </button>
          <button
            onClick={execute}
            disabled={loading || !db || !sql.trim()}
            style={{
              background: sql.trim() ? C.cyanGhost : "none",
              border: `1px solid ${sql.trim() ? C.cyan : C.border}`,
              cursor: "pointer", fontFamily: F.mono, fontSize: 12,
              color: sql.trim() ? C.cyan : C.dim, padding: "4px 14px", letterSpacing: 1,
            }}
          >
            ▶ {ispt ? "EXECUTAR" : "RUN"}
          </button>
        </div>
      </div>
    </div>
  );
}
