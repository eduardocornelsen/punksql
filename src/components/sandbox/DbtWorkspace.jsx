"use client";
// DbtWorkspace — Phase 2 minimal dbt lab (TDD §6 Phase 2):
// VFS tree + plain editor + command bar + raw streaming log list.
// Compile/run/test/build/seed execute for real against the sandbox DB.
// Jinja highlighting, staggered stdout and the DAG view are Phase 3.
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import useDbtStore from "@/stores/useDbtStore";
import { execSQL } from "@/lib/sqlEngine";
import { runDbtCommand, compileProject } from "@/lib/dbtEngine";

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

export default function DbtWorkspace({ db, lang = "en", onModelsChanged }) {
  const {
    vfs, activeFile, dirty, logs, runStatus, artifacts,
    writeFile, newFile, deleteFile, setActive, appendLog, clearLogs,
    setRunStatus, setArtifacts, resetProject,
  } = useDbtStore();

  const [treeOpen, setTreeOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [cliInput, setCliInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("models/staging/");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const logRef = useRef(null);
  const taRef = useRef(null);
  const ispt = lang === "pt";

  const isCompiledFile = activeFile?.startsWith("target/compiled/");
  const compiledName = isCompiledFile ? activeFile.slice("target/compiled/".length).replace(/\.sql$/, "") : null;
  const content = isCompiledFile
    ? (artifacts?.compiled?.[compiledName]?.sql ?? "-- run `dbt compile` first")
    : (vfs[activeFile] ?? "");

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Group VFS into folders for the tree
  const tree = useMemo(() => {
    const byFolder = {};
    for (const path of Object.keys(vfs).sort()) {
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "(project)";
      (byFolder[folder] = byFolder[folder] || []).push(path);
    }
    if (artifacts?.compiled) {
      byFolder["target/compiled"] = Object.keys(artifacts.compiled)
        .filter((n) => artifacts.compiled[n].materialized !== undefined)
        .sort()
        .map((n) => `target/compiled/${n}.sql`);
    }
    return byFolder;
  }, [vfs, artifacts]);

  const runCommand = useCallback((cmdline) => {
    if (!db || runStatus === "running") return;
    setRunStatus("running");
    appendLog({ level: "info", text: `$ ${cmdline}` });
    // defer so the "running" state paints before the synchronous engine work
    setTimeout(() => {
      try {
        const exec = (sql) => execSQL(db, sql);
        const r = runDbtCommand(cmdline, vfs, exec, appendLog);
        if (r.project && !r.project.errors.length) {
          setArtifacts({ compiled: r.project.compiled, dag: r.project.dag, order: r.project.order });
        }
        setRunStatus(r.ok ? "success" : "error");
        const verb = cmdline.replace(/^dbt\s+/, "").split(/\s+/)[0];
        if (["run", "build", "seed"].includes(verb) && onModelsChanged) onModelsChanged();
      } catch (e) {
        appendLog({ level: "error", text: `Internal error: ${e.message}` });
        setRunStatus("error");
      }
    }, 30);
  }, [db, vfs, runStatus, appendLog, setArtifacts, setRunStatus, onModelsChanged]);

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

  const modelCount = useMemo(() => {
    try { return Object.keys(compileProject(vfs).compiled).length; } catch { return 0; }
  }, [vfs]);

  const fileLabel = activeFile ? activeFile.slice(activeFile.lastIndexOf("/") + 1) : "—";
  const statusColor = runStatus === "success" ? C.green : runStatus === "error" ? C.red : runStatus === "running" ? C.amber : C.muted;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", position: "relative", fontFamily: F.mono }}>

      {/* ── Workspace header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${C.border}`, background: C.black, flexShrink: 0 }}>
        <button onClick={() => setTreeOpen(true)} title="Project files"
          style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.orange, padding: "3px 8px", flexShrink: 0 }}>☰</button>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: isCompiledFile ? C.muted : C.orange, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {fileLabel}{!isCompiledFile && dirty[activeFile] ? " *" : ""}{isCompiledFile ? "  (compiled, read-only)" : ""}
        </span>
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

      {/* ── Editor ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <textarea
          ref={taRef}
          value={content}
          readOnly={isCompiledFile}
          onChange={(e) => { if (!isCompiledFile) writeFile(activeFile, e.target.value); }}
          spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
          placeholder={"-- models/*.sql · schema.yml · tests/*.sql\nselect * from {{ ref('stg_orders') }}"}
          style={{
            flex: 1, background: C.surface, color: isCompiledFile ? C.dim : C.text,
            border: "none", outline: "none", resize: "none",
            fontFamily: F.mono, fontSize: 12, lineHeight: 1.6, padding: "10px 12px",
            whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto",
          }}
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

      {/* ── Log pane ── */}
      <div style={{ flex: "0 0 34%", display: "flex", flexDirection: "column", borderTop: `1px solid ${C.borderBright}`, background: C.black, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "3px 10px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, letterSpacing: 1.5 }}>STDOUT</span>
          <div style={{ flex: 1 }} />
          {confirmReset ? (
            <>
              <button onClick={() => { resetProject(); clearLogs(); setConfirmReset(false); }}
                style={{ fontFamily: F.mono, fontSize: 9, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}40`, cursor: "pointer", padding: "2px 8px", marginRight: 6 }}>
                {ispt ? "restaurar projeto?" : "restore project?"}</button>
              <button onClick={() => setConfirmReset(false)}
                style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "2px 8px", marginRight: 6 }}>✕</button>
            </>
          ) : (
            <button onClick={() => setConfirmReset(true)} title={ispt ? "Restaurar arquivos do projeto original" : "Restore the original project files"}
              style={{ fontFamily: F.mono, fontSize: 9, color: C.amber, background: "none", border: "none", cursor: "pointer", padding: "2px 8px" }}>reset</button>
          )}
          <button onClick={clearLogs}
            style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>clear</button>
        </div>
        <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
          {logs.length === 0 && (
            <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.9 }}>
{ispt
? `dbt lab — projeto virtual compilado e executado no navegador.
  run    → materializa os models (views/tables de verdade)
  test   → executa os testes do schema.yml (pass/fail reais)
  build  → run + test
Depois do run, consulte os models na aba SHELL.`
: `dbt lab — a virtual dbt project compiled & executed in your browser.
  run    → materialize the models (real views/tables)
  test   → run schema.yml tests (genuine pass/fail)
  build  → run + test
After a run, query your models in the SHELL tab.`}
            </pre>
          )}
          {logs.map((l) => (
            <pre key={l.id} style={{ fontFamily: F.mono, fontSize: 10, color: LEVEL_COLOR[l.level] || C.text, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{l.text}</pre>
          ))}
        </div>
      </div>

      {/* ── File tree drawer ── */}
      {treeOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex" }}>
          <div style={{ width: "78%", maxWidth: 340, background: C.panel, borderRight: `1px solid ${C.borderBright}`, display: "flex", flexDirection: "column" }}>
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
                    return (
                      <div key={path} style={{ display: "flex", alignItems: "center", background: isActive ? `${C.orange}12` : "none" }}>
                        <button onClick={() => { setActive(path); setTreeOpen(false); }}
                          style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 6px 4px 22px", textAlign: "left", minWidth: 0 }}>
                          <span style={{ fontFamily: F.mono, fontSize: 11, color: isActive ? C.orange : readonly ? C.muted : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {name}{!readonly && dirty[path] ? " *" : ""}
                          </span>
                        </button>
                        {!readonly && (confirmDelete === path ? (
                          <button onClick={() => { deleteFile(path); setConfirmDelete(null); }}
                            style={{ fontFamily: F.mono, fontSize: 9, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}40`, cursor: "pointer", padding: "2px 6px", margin: "0 8px 0 0", flexShrink: 0 }}>del?</button>
                        ) : (
                          <button onClick={() => setConfirmDelete(path)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 10, color: C.border, padding: "2px 10px", flexShrink: 0 }}>✕</button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, padding: "8px 12px", borderTop: `1px solid ${C.border}`, lineHeight: 1.8, flexShrink: 0 }}>
              models/**/*.sql → dbt models<br />
              *.yml → sources · tests · config<br />
              tests/*.sql → singular tests · seeds/*.csv → seeds
            </div>
          </div>
          <div onClick={() => { setTreeOpen(false); setCreating(false); }} style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
        </div>
      )}
    </div>
  );
}
