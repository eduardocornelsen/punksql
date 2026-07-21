"use client";
// DbtWorkspace — dbt lab (TDD Phase 2 core + Phase 3 polish, dbt-Power-User
// style): Jinja-highlighted editor, per-model actions in the project tree,
// and a tabbed panel — LOG (streaming stdout) · DATA (preview) · SQL
// (compiled) · GRAPH (model lineage) · TESTS (pass/fail) · DOCS (schema.yml).
// Everything compiles and executes for real against the sandbox SQLite DB.
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import useDbtStore from "@/stores/useDbtStore";
import { execSQL } from "@/lib/sqlEngine";
import { runDbtCommand, compileProject, withEphemeralCtes, compileGenericTest } from "@/lib/dbtEngine";
import { tokenizeJinjaSQL, tokenizeYAML, tokenizeSQL, tokensToHtml } from "./highlight";
import ResultTable from "./ResultTable";
import LineageGraph from "./LineageGraph";

const C = {
  black: "#000000", panel: "#0D0D0D", surface: "#111111",
  border: "#222222", borderBright: "#333333",
  cyan: "#00FFFF", green: "#00FF88", amber: "#FFBB00", red: "#FF3333",
  orange: "#FF9944", purple: "#CC88FF", white: "#FFFFFF",
  dim: "#9a9a9a", muted: "#7a7a7a", text: "#CCCCCC",
};
const F = { mono: "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace" };

const DBT_SNIPPETS = [
  "{{ ref('') }}",
  "{{ source('raw', '') }}",
  "{{ config(materialized='view') }}",
  "{{ config(materialized='table') }}",
  "{{ config(materialized='ephemeral') }}",
  "{{ config(materialized='incremental') }}",
  "{% if is_incremental() %}",
  "{% endif %}",
  "{{ var('') }}",
  "{{ this }}",
  "{% for x in [] %}", "{% endfor %}",
  "- not_null", "- unique",
  "select", "from", "where", "join", "on", "group by",
];

const SIM_SUPPORTED = [
  ["✓", "ref() / source() / config() / var() / this"],
  ["✓", "materialized: view · table · ephemeral · incremental"],
  ["✓", "{% if %} · {% for %} · {% set %} · loop.last"],
  ["✓", "tests: not_null · unique · accepted_values · relationships"],
  ["✓", "singular tests (tests/*.sql) · seeds (seeds/*.csv)"],
  ["✓", "--select model · +model · model+"],
  ["✗", "macros · packages · snapshots · hooks · full Jinja"],
];

const LEVEL_COLOR = { info: C.dim, ok: C.green, warn: C.amber, error: C.red };

const PANEL_TABS = [
  { id: "log",   label: "LOG",   color: C.dim },
  { id: "data",  label: "DATA",  color: C.cyan },
  { id: "sql",   label: "SQL",   color: C.amber },
  { id: "graph", label: "GRAPH", color: C.purple },
  { id: "tests", label: "TESTS", color: C.green },
  { id: "docs",  label: "DOCS",  color: C.orange },
];

const FOLDER_COLORS = [
  ["models/staging", C.cyan],
  ["models/intermediate", C.amber],
  ["models/mart", C.green],
  ["models", C.cyan],
  ["tests", C.purple],
  ["seeds", C.dim],
  ["target", C.muted],
];
function folderColor(folder) {
  const hit = FOLDER_COLORS.find(([p]) => folder === p || folder.startsWith(p + "/"));
  return hit ? hit[1] : C.muted;
}
function matColor(mat) {
  return mat === "table" ? C.green : mat === "incremental" ? C.orange : mat === "ephemeral" ? C.muted : C.cyan;
}
function baseName(path) {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.(sql|csv|yml|yaml)$/i, "");
}
const isYamlPath = (p) => /\.(yml|yaml)$/i.test(p || "");

export default function DbtWorkspace({ db, lang = "en", onModelsChanged }) {
  const {
    vfs, activeFile, dirty, logs, runStatus, artifacts, runResults, testResults,
    writeFile, newFile, deleteFile, setActive, appendLog, clearLogs,
    setRunStatus, setArtifacts, setRunResults, setTestResults, resetProject,
  } = useDbtStore();

  const [panelTab, setPanelTab] = useState("log");
  const [treeOpen, setTreeOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [cliInput, setCliInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("models/staging/");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [preview, setPreview] = useState(null);        // { name, result }
  const [expandedTest, setExpandedTest] = useState(null);
  const [shownCount, setShownCount] = useState(0);     // staggered stdout cursor
  const logRef = useRef(null);
  const taRef = useRef(null);
  const hlRef = useRef(null);
  const ispt = lang === "pt";

  const isCompiledFile = activeFile?.startsWith("target/compiled/");
  const compiledName = isCompiledFile ? baseName(activeFile) : null;
  const content = isCompiledFile
    ? (artifacts?.compiled?.[compiledName]?.sql ?? "-- run `dbt compile` first")
    : (vfs[activeFile] ?? "");

  // Live-compiled project — powers SQL/GRAPH/TESTS/DOCS panels + tree badges
  const project = useMemo(() => {
    try { return compileProject(vfs); } catch { return null; }
  }, [vfs]);
  const activeModel = useMemo(() => {
    if (!activeFile) return null;
    const name = baseName(activeFile);
    return project?.compiled?.[name] ? name : null;
  }, [activeFile, project]);

  // ── staggered stdout (Phase 3 <StdoutLog>) ──
  useEffect(() => {
    if (shownCount > logs.length) { setShownCount(logs.length); return; }
    if (shownCount < logs.length) {
      const behind = logs.length - shownCount;
      const t = setTimeout(() => setShownCount((c) => Math.min(logs.length, c + (behind > 40 ? 8 : 1))), behind > 40 ? 8 : 26);
      return () => clearTimeout(t);
    }
  }, [logs.length, shownCount]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [shownCount, panelTab]);

  const syncScroll = useCallback(() => {
    if (taRef.current && hlRef.current) {
      hlRef.current.scrollTop = taRef.current.scrollTop;
      hlRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  }, []);

  // Group VFS into folders for the tree
  const tree = useMemo(() => {
    const byFolder = {};
    for (const path of Object.keys(vfs).sort()) {
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "(project)";
      (byFolder[folder] = byFolder[folder] || []).push(path);
    }
    if (artifacts?.compiled) {
      byFolder["target/compiled"] = Object.keys(artifacts.compiled).sort().map((n) => `target/compiled/${n}.sql`);
    }
    return byFolder;
  }, [vfs, artifacts]);

  const runCommand = useCallback((cmdline) => {
    if (!db || runStatus === "running") return;
    setRunStatus("running");
    setPanelTab("log");
    appendLog({ level: "info", text: `$ ${cmdline}` });
    // defer so the "running" state paints before the synchronous engine work
    setTimeout(() => {
      try {
        const exec = (sql) => execSQL(db, sql);
        const r = runDbtCommand(cmdline, vfs, exec, appendLog);
        if (r.project && !r.project.errors.length) {
          setArtifacts({ compiled: r.project.compiled, dag: r.project.dag, order: r.project.order });
        }
        if (r.results) {
          const tests = r.results.filter((x) => x.status === "pass" || x.status === "fail" || "failures" in x);
          const runs = r.results.filter((x) => !tests.includes(x));
          if (runs.length) setRunResults(runs);
          if (tests.length) setTestResults(tests);
          const verb = cmdline.replace(/^dbt\s+/, "").split(/\s+/)[0];
          if (tests.length && (verb === "test" || verb === "build")) setPanelTab("tests");
        }
        setRunStatus(r.ok ? "success" : "error");
        const verb = cmdline.replace(/^dbt\s+/, "").split(/\s+/)[0];
        if (["run", "build", "seed"].includes(verb) && onModelsChanged) onModelsChanged();
      } catch (e) {
        appendLog({ level: "error", text: `Internal error: ${e.message}` });
        setRunStatus("error");
      }
    }, 30);
  }, [db, vfs, runStatus, appendLog, setArtifacts, setRunStatus, setRunResults, setTestResults, onModelsChanged]);

  const previewModel = useCallback((name) => {
    if (!db) return;
    const result = execSQL(db, `SELECT * FROM ${name} LIMIT 50`);
    setPreview({ name, result });
    setPanelTab("data");
  }, [db]);

  const onCliKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = cliInput.trim();
      if (!cmd) return;
      runCommand(/^dbt\s/.test(cmd) ? cmd : `dbt ${cmd}`);
      setCliInput("");
    }
  };

  const insertAtCursor = (text) => {
    if (isCompiledFile || !taRef.current) return;
    const ta = taRef.current;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    writeFile(activeFile, next);
    requestAnimationFrame(() => {
      if (taRef.current) {
        taRef.current.selectionStart = taRef.current.selectionEnd = start + text.length;
        taRef.current.focus();
      }
    });
  };

  const handleCreate = () => {
    const p = newPath.trim();
    if (!p || p.endsWith("/")) return;
    const path = /\.(sql|yml|yaml|csv)$/i.test(p) ? p : `${p}.sql`;
    newFile(path, path.endsWith(".yml") || path.endsWith(".yaml") ? "version: 2\n" : "select 1\n");
    setCreating(false);
    setTreeOpen(false);
  };

  const openModel = useCallback((name) => {
    const m = project?.manifest?.models?.[name];
    if (m?.path) setActive(m.path);
  }, [project, setActive]);

  const fileLabel = activeFile ? activeFile.slice(activeFile.lastIndexOf("/") + 1) : "—";
  const statusColor = runStatus === "success" ? C.green : runStatus === "error" ? C.red : runStatus === "running" ? C.amber : C.muted;
  const modelCount = project ? Object.keys(project.compiled).length : 0;
  const compileErrors = project?.errors || [];

  // Highlight overlay for the editor
  const editorHtml = useMemo(() => {
    const tokens = isYamlPath(activeFile) ? tokenizeYAML(content || "") : tokenizeJinjaSQL(content || "");
    return tokensToHtml(tokens) + "<br/>";
  }, [content, activeFile]);

  const compiledSql = useMemo(() => {
    if (!project || !activeModel) return null;
    try { return withEphemeralCtes(activeModel, project); } catch { return null; }
  }, [project, activeModel]);

  const docs = useMemo(() => {
    if (!project || !activeModel) return null;
    const m = project.manifest.models[activeModel];
    const tests = project.manifest.genericTests.filter((t) => t.model === activeModel);
    return { description: m?.docs?.description || "", columns: m?.docs?.columns || [], tests, node: project.compiled[activeModel] };
  }, [project, activeModel]);

  const testStatusByName = useMemo(() => Object.fromEntries(testResults.map((t) => [t.name, t])), [testResults]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", position: "relative", fontFamily: F.mono }}>

      {/* ── Workspace header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
        <button onClick={() => setTreeOpen(true)} title="Project files"
          style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.orange, padding: "3px 8px", flexShrink: 0 }}>☰</button>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: isCompiledFile ? C.muted : C.orange, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {fileLabel}{!isCompiledFile && dirty[activeFile] ? " *" : ""}{isCompiledFile ? "  (compiled)" : ""}
        </span>
        {activeModel && (
          <span style={{ fontFamily: F.mono, fontSize: 8, color: matColor(project.compiled[activeModel].materialized), border: `1px solid ${matColor(project.compiled[activeModel].materialized)}40`, padding: "1px 5px", flexShrink: 0, letterSpacing: 1 }}>
            {project.compiled[activeModel].materialized.toUpperCase()}
          </span>
        )}
        <span style={{ fontFamily: F.mono, fontSize: 9, color: statusColor, flexShrink: 0, letterSpacing: 1 }}>
          {runStatus === "running" ? "RUNNING…" : runStatus === "success" ? "OK" : runStatus === "error" ? "FAIL" : `${modelCount} models`}
        </span>
        <button onClick={() => setSimOpen((v) => !v)} title="What the simulator supports"
          style={{ background: simOpen ? `${C.purple}14` : "none", border: `1px solid ${simOpen ? C.purple : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 9, color: C.purple, padding: "3px 6px", flexShrink: 0, letterSpacing: 1 }}>[ sim ]</button>
      </div>

      {/* ── [sim] honesty panel ── */}
      {simOpen && (
        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.purple, letterSpacing: 1.5, marginBottom: 6 }}>DBT SIMULATOR — WHAT'S SUPPORTED</div>
          {SIM_SUPPORTED.map(([mark, txt], i) => (
            <div key={i} style={{ fontFamily: F.mono, fontSize: 10, color: mark === "✓" ? C.text : C.muted, lineHeight: 1.8 }}>
              <span style={{ color: mark === "✓" ? C.green : C.red }}>{mark}</span> {txt}
            </div>
          ))}
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.dim, marginTop: 4 }}>
            {ispt ? "Compila Jinja → SQL e executa de verdade no SQLite do sandbox." : "Compiles Jinja → SQL and really executes it on the sandbox SQLite."}
          </div>
        </div>
      )}

      {/* ── Jinja editor (highlight overlay + transparent textarea) ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0, background: C.surface }}>
        <pre ref={hlRef} aria-hidden="true"
          style={{ position: "absolute", inset: 0, fontFamily: F.mono, fontSize: 12, lineHeight: "1.6em", padding: "10px 12px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto", overflowX: "hidden", pointerEvents: "none", background: C.surface, color: "transparent" }}
          dangerouslySetInnerHTML={{ __html: editorHtml }}
        />
        <textarea
          ref={taRef}
          value={content}
          readOnly={isCompiledFile}
          onChange={(e) => { if (!isCompiledFile) writeFile(activeFile, e.target.value); }}
          onScroll={syncScroll}
          spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
          placeholder={"-- models/*.sql · schema.yml · tests/*.sql\nselect * from {{ ref('stg_orders') }}"}
          style={{ position: "absolute", inset: 0, fontFamily: F.mono, fontSize: 12, lineHeight: "1.6em", padding: "10px 12px", margin: 0, color: "transparent", caretColor: C.orange, background: "transparent", border: "none", outline: "none", resize: "none", overflowY: "auto", overflowX: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        />
      </div>

      {/* ── dbt snippet strip ── */}
      <div style={{ display: "flex", overflowX: "auto", gap: 5, padding: "5px 8px", borderTop: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
        {DBT_SNIPPETS.map((tok) => (
          <button key={tok}
            onMouseDown={(e) => { e.preventDefault(); insertAtCursor(tok); }}
            onTouchEnd={(e) => { e.preventDefault(); insertAtCursor(tok); }}
            style={{ fontFamily: F.mono, fontSize: 10, padding: "4px 8px", whiteSpace: "nowrap", background: "none", border: `1px solid ${C.border}`, color: tok.startsWith("{") ? C.orange : tok.startsWith("-") ? C.purple : C.cyan, cursor: "pointer", flexShrink: 0 }}
          >{tok}</button>
        ))}
      </div>

      {/* ── Command bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", borderTop: `1px solid ${C.border}`, background: C.black, flexShrink: 0, overflowX: "auto" }}>
        {["run", "test", "build", "compile", "ls"].map((verb) => (
          <button key={verb}
            onClick={() => runCommand(`dbt ${verb}`)}
            disabled={!db || runStatus === "running"}
            style={{ fontFamily: F.mono, fontSize: 11, padding: "5px 11px", flexShrink: 0, letterSpacing: 1, cursor: "pointer",
              background: verb === "run" ? `${C.orange}14` : verb === "test" ? `${C.green}10` : "none",
              border: `1px solid ${verb === "run" ? C.orange : verb === "test" ? C.green : C.border}`,
              color: verb === "run" ? C.orange : verb === "test" ? C.green : C.dim }}
          >{verb}</button>
        ))}
        <input
          value={cliInput}
          onChange={(e) => setCliInput(e.target.value)}
          onKeyDown={onCliKeyDown}
          placeholder="dbt run --select stg_orders+"
          spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
          style={{ flex: 1, minWidth: 130, fontFamily: F.mono, fontSize: 11, background: C.surface, color: C.white, border: `1px solid ${C.border}`, outline: "none", padding: "5px 8px" }}
        />
      </div>

      {/* ── Bottom panel (dbt-Power-User style) ── */}
      <div style={{ flex: "0 0 38%", display: "flex", flexDirection: "column", borderTop: `1px solid ${C.borderBright}`, background: C.black, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: "auto" }}>
          {PANEL_TABS.map((t) => {
            const active = panelTab === t.id;
            const badge = t.id === "tests" && testResults.some((x) => x.status === "fail" || x.status === "error");
            return (
              <button key={t.id} onClick={() => setPanelTab(t.id)}
                style={{ fontFamily: F.mono, fontSize: 9, padding: "7px 10px", letterSpacing: 1.5, flexShrink: 0, cursor: "pointer", background: active ? `${t.color}10` : "none", color: active ? t.color : C.muted, border: "none", borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent", position: "relative" }}>
                {t.label}{badge && <span style={{ color: C.red }}> ●</span>}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {panelTab === "log" && (confirmReset ? (
            <>
              <button onClick={() => { resetProject(); clearLogs(); setConfirmReset(false); setPreview(null); }}
                style={{ fontFamily: F.mono, fontSize: 9, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}40`, cursor: "pointer", padding: "2px 8px", marginRight: 6, flexShrink: 0 }}>
                {ispt ? "restaurar projeto?" : "restore project?"}</button>
              <button onClick={() => setConfirmReset(false)}
                style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "2px 8px", marginRight: 6, flexShrink: 0 }}>✕</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmReset(true)} title={ispt ? "Restaurar arquivos do projeto original" : "Restore the original project files"}
                style={{ fontFamily: F.mono, fontSize: 9, color: C.amber, background: "none", border: "none", cursor: "pointer", padding: "2px 8px", flexShrink: 0 }}>reset</button>
              <button onClick={() => { clearLogs(); setShownCount(0); }}
                style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "2px 8px", flexShrink: 0 }}>clear</button>
            </>
          ))}
          {panelTab === "data" && activeModel && (
            <button onClick={() => previewModel(activeModel)}
              style={{ fontFamily: F.mono, fontSize: 9, color: C.cyan, background: `${C.cyan}10`, border: `1px solid ${C.cyan}40`, cursor: "pointer", padding: "2px 8px", marginRight: 6, flexShrink: 0 }}>
              ▶ preview {activeModel}</button>
          )}
          {panelTab === "tests" && (
            <button onClick={() => runCommand(activeModel ? `dbt test --select ${activeModel}` : "dbt test")}
              style={{ fontFamily: F.mono, fontSize: 9, color: C.green, background: `${C.green}10`, border: `1px solid ${C.green}40`, cursor: "pointer", padding: "2px 8px", marginRight: 6, flexShrink: 0 }}>
              ▶ test {activeModel || "all"}</button>
          )}
        </div>

        <div ref={panelTab === "log" ? logRef : null} style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>

          {/* LOG — staggered stdout */}
          {panelTab === "log" && (
            <>
              {logs.length === 0 && (
                <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.9 }}>
{ispt
? `dbt lab — projeto virtual compilado e executado no navegador.
  run    → materializa os models (views/tables de verdade)
  test   → executa os testes do schema.yml (pass/fail reais)
  build  → run + test
Depois do run, consulte os models na aba SHELL,
ou use os painéis DATA · SQL · GRAPH · TESTS · DOCS.`
: `dbt lab — a virtual dbt project compiled & executed in your browser.
  run    → materialize the models (real views/tables)
  test   → run schema.yml tests (genuine pass/fail)
  build  → run + test
After a run, query models in the SHELL tab, or use the
DATA · SQL · GRAPH · TESTS · DOCS panels below.`}
                </pre>
              )}
              {logs.slice(0, shownCount).map((l) => (
                <pre key={l.id} style={{ fontFamily: F.mono, fontSize: 10, color: LEVEL_COLOR[l.level] || C.text, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{l.text}</pre>
              ))}
              {shownCount < logs.length && <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, margin: 0 }}>▍</pre>}
            </>
          )}

          {/* DATA — model preview */}
          {panelTab === "data" && (
            preview?.result?.ok && preview.result.columns.length ? (
              <>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cyan, letterSpacing: 1, marginBottom: 6 }}>SELECT * FROM {preview.name} LIMIT 50</div>
                <ResultTable columns={preview.result.columns} rows={preview.result.rows} />
              </>
            ) : preview?.result && !preview.result.ok ? (
              <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.red, margin: 0, whiteSpace: "pre-wrap" }}>
                {preview.result.msg}{"\n\n"}{ispt ? "O model já foi materializado? Rode `dbt run` primeiro." : "Has the model been materialized? Run `dbt run` first."}
              </pre>
            ) : (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.9 }}>
                {activeModel
                  ? (ispt ? `Toque em ▶ preview para ver os dados de ${activeModel}.` : `Tap ▶ preview to see ${activeModel}'s data.`)
                  : (ispt ? "Abra um model (.sql em models/) para visualizar dados." : "Open a model (.sql under models/) to preview data.")}
              </div>
            )
          )}

          {/* SQL — compiled preview */}
          {panelTab === "sql" && (
            activeModel && compiledSql ? (
              <>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.amber, letterSpacing: 1, marginBottom: 6 }}>
                  COMPILED — {activeModel} ({project.compiled[activeModel].materialized})
                </div>
                <pre style={{ fontFamily: F.mono, fontSize: 11, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: tokensToHtml(tokenizeSQL(compiledSql)) }} />
              </>
            ) : compileErrors.length ? (
              <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.red, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {compileErrors.map((e) => `Compilation Error: ${e}`).join("\n")}
              </pre>
            ) : (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.9 }}>
                {ispt ? "Abra um model para ver o SQL compilado (Jinja → SQL puro)." : "Open a model to see its compiled SQL (Jinja → plain SQL)."}
              </div>
            )
          )}

          {/* GRAPH — model-focused lineage */}
          {panelTab === "graph" && (
            project && Object.keys(project.dag).length ? (
              <>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.purple, letterSpacing: 1, marginBottom: 6 }}>
                  DAG{activeModel ? ` — focused on ${activeModel}` : ""} · {ispt ? "toque em um nó para abrir" : "tap a node to open it"}
                </div>
                <LineageGraph
                  adjacency={project.dag}
                  nodeMeta={Object.fromEntries(Object.entries(project.compiled).map(([n, c]) => [n, { color: matColor(c.materialized), badge: c.materialized }]))}
                  focus={activeModel}
                  onSelect={openModel}
                />
              </>
            ) : (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{ispt ? "Sem models compilados ainda." : "No compiled models yet."}</div>
            )
          )}

          {/* TESTS — compact pass/fail panel */}
          {panelTab === "tests" && (
            testResults.length ? (
              <>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.dim, letterSpacing: 1, marginBottom: 6 }}>
                  PASS={testResults.filter((t) => t.status === "pass").length}{" "}
                  FAIL={testResults.filter((t) => t.status === "fail").length}{" "}
                  ERROR={testResults.filter((t) => t.status === "error").length}
                </div>
                {testResults.map((t) => {
                  const col = t.status === "pass" ? C.green : C.red;
                  const gt = project?.manifest?.genericTests?.find((g) => g.name === t.name);
                  const testSql = gt ? compileGenericTest(gt) : project?.manifest?.singularTests?.find((s) => s.name === t.name)?.raw;
                  const open = expandedTest === t.name;
                  return (
                    <div key={t.name} style={{ marginBottom: 2 }}>
                      <button onClick={() => setExpandedTest(open ? null : t.name)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: open ? `${col}0A` : "none", border: "none", cursor: "pointer", padding: "3px 2px", textAlign: "left" }}>
                        <span style={{ fontFamily: F.mono, fontSize: 10, color: col, flexShrink: 0 }}>{t.status === "pass" ? "●" : "●"}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 10, color: t.status === "pass" ? C.text : col, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.name}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 9, color: col, flexShrink: 0 }}>
                          {t.status === "pass" ? "PASS" : t.status === "error" ? "ERROR" : `FAIL ${t.failures}`}
                        </span>
                      </button>
                      {open && testSql && (
                        <pre style={{ fontFamily: F.mono, fontSize: 9.5, color: C.dim, margin: "2px 0 6px 18px", padding: "4px 8px", borderLeft: `1px solid ${col}40`, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{testSql}</pre>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.9 }}>
                {ispt ? "Nenhum teste executado ainda — rode `dbt test`." : "No tests run yet — run `dbt test`."}
              </div>
            )
          )}

          {/* DOCS — schema.yml documentation */}
          {panelTab === "docs" && (
            activeModel && docs ? (
              <>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.orange, marginBottom: 2 }}>{activeModel}</div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 8 }}>
                  {docs.node.materialized} · {docs.node.refs.length ? `refs: ${docs.node.refs.join(", ")}` : ""}{docs.node.sources.length ? ` · sources: ${docs.node.sources.join(", ")}` : ""}
                </div>
                {docs.description
                  ? <div style={{ fontFamily: F.mono, fontSize: 10, color: C.text, marginBottom: 10, lineHeight: 1.7 }}>{docs.description}</div>
                  : <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 10 }}>{ispt ? "Sem description no schema.yml" : "No description in schema.yml"}</div>}
                {docs.columns.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {docs.columns.map((c) => {
                      const colTests = docs.tests.filter((t) => t.column === c.name);
                      return (
                        <div key={c.name} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0", borderBottom: `1px solid ${C.border}30` }}>
                          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.cyan, flexShrink: 0 }}>{c.name}</span>
                          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.dim, flex: 1 }}>{c.description}</span>
                          {colTests.map((t) => {
                            const res = testStatusByName[t.name];
                            const col = !res ? C.muted : res.status === "pass" ? C.green : C.red;
                            return <span key={t.name} title={t.name} style={{ fontFamily: F.mono, fontSize: 8, color: col, border: `1px solid ${col}40`, padding: "0 4px", flexShrink: 0 }}>{t.type}</span>;
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!docs.columns.length && (
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{ispt ? "Documente colunas em um schema.yml para vê-las aqui." : "Document columns in a schema.yml to see them here."}</div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, lineHeight: 1.9 }}>
                {ispt ? "Abra um model para ver a documentação do schema.yml." : "Open a model to see its schema.yml documentation."}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── File tree drawer with per-model actions ── */}
      {treeOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex" }}>
          <div style={{ width: "82%", maxWidth: 360, background: C.panel, borderRight: `1px solid ${C.borderBright}`, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, padding: "9px 12px", color: C.orange, letterSpacing: 1 }}>DBT PROJECT</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setCreating((v) => !v)}
                style={{ fontFamily: F.mono, fontSize: 11, color: C.green, background: creating ? `${C.green}14` : "none", border: `1px solid ${creating ? C.green : C.border}`, cursor: "pointer", padding: "3px 8px", margin: "0 4px" }}>+ new</button>
              <button onClick={() => { setTreeOpen(false); setCreating(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.muted, padding: "4px 10px" }}>✕</button>
            </div>
            {creating && (
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
                <input autoFocus value={newPath} onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                  placeholder="models/staging/stg_products.sql"
                  spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
                  style={{ width: "100%", boxSizing: "border-box", fontFamily: F.mono, fontSize: 11, background: C.black, color: C.white, border: `1px solid ${C.orange}`, outline: "none", padding: "5px 8px", marginBottom: 6 }} />
                <button onClick={handleCreate}
                  style={{ fontFamily: F.mono, fontSize: 10, color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}`, cursor: "pointer", padding: "4px 12px" }}>✓ create</button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {Object.entries(tree).map(([folder, paths]) => (
                <div key={folder} style={{ marginBottom: 2 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: folderColor(folder), padding: "4px 12px 2px", letterSpacing: 1 }}>
                    {folder === "(project)" ? "·" : `${folder}/`}
                  </div>
                  {paths.map((path) => {
                    const name = path.slice(path.lastIndexOf("/") + 1);
                    const isActive = path === activeFile;
                    const readonly = path.startsWith("target/");
                    const model = !readonly && project?.compiled?.[baseName(path)] && path.startsWith("models/") ? baseName(path) : null;
                    return (
                      <div key={path} style={{ display: "flex", alignItems: "center", background: isActive ? `${C.orange}12` : "none" }}>
                        <button onClick={() => { setActive(path); setTreeOpen(false); }}
                          style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "5px 6px 5px 22px", textAlign: "left", minWidth: 0 }}>
                          <span style={{ fontFamily: F.mono, fontSize: 11, color: isActive ? C.orange : readonly ? C.muted : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {name}{!readonly && dirty[path] ? " *" : ""}
                          </span>
                          {model && (
                            <span style={{ fontFamily: F.mono, fontSize: 7.5, color: matColor(project.compiled[model].materialized), flexShrink: 0, letterSpacing: 0.5 }}>
                              {project.compiled[model].materialized.slice(0, 4)}
                            </span>
                          )}
                        </button>
                        {/* per-model actions — dbt-Power-User style */}
                        {model && (
                          <>
                            <button title={`dbt run --select ${model}`}
                              onClick={() => { setTreeOpen(false); runCommand(`dbt run --select ${model}`); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.orange, padding: "2px 5px", flexShrink: 0 }}>▶</button>
                            <button title={`dbt run --select ${model}+ (with descendants)`}
                              onClick={() => { setTreeOpen(false); runCommand(`dbt run --select ${model}+`); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.amber, padding: "2px 5px", flexShrink: 0 }}>▶+</button>
                            <button title={`dbt test --select ${model}`}
                              onClick={() => { setTreeOpen(false); runCommand(`dbt test --select ${model}`); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.green, padding: "2px 5px", flexShrink: 0 }}>✓</button>
                            <button title={`preview ${model} data`}
                              onClick={() => { setTreeOpen(false); setActive(path); previewModel(model); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.cyan, padding: "2px 5px", flexShrink: 0 }}>⊞</button>
                          </>
                        )}
                        {!readonly && (confirmDelete === path ? (
                          <button onClick={() => { deleteFile(path); setConfirmDelete(null); }}
                            style={{ fontFamily: F.mono, fontSize: 9, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}40`, cursor: "pointer", padding: "2px 6px", margin: "0 8px 0 0", flexShrink: 0 }}>del?</button>
                        ) : (
                          <button onClick={() => setConfirmDelete(path)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.border, padding: "2px 8px", flexShrink: 0 }}>✕</button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, padding: "8px 12px", borderTop: `1px solid ${C.border}`, lineHeight: 1.8, flexShrink: 0 }}>
              ▶ run · ▶+ run+descendants · ✓ test · ⊞ preview<br />
              models/**/*.sql → dbt models · *.yml → sources/tests<br />
              tests/*.sql → singular tests · seeds/*.csv → seeds
            </div>
          </div>
          <div onClick={() => { setTreeOpen(false); setCreating(false); }} style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
        </div>
      )}
    </div>
  );
}
