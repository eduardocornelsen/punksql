import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useProgress } from "@/hooks/useProgress";
import useGameStore from "@/stores/useGameStore";
import { useShallow } from "zustand/react/shallow";

// ═══════════════════════════════════════════════════════════
//  PUNKSQL // CYBERPUNK CLI — XL MOBILE
// ═══════════════════════════════════════════════════════════

// ── Persistent Storage Helpers ────────────────────────────
const STORAGE_KEY = "qq-save";
const SQL_DRAFT_PREFIX = "qq-draft-";
const CODE_ONBOARDING_KEY = "punksql-code-tour-v1";

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}
function saveProgress(xp, solved, lang, lastCodeId, lastLearnId, lastContext) {
  try {
    const data = JSON.stringify({ xp, solved: [...solved], lang, lastCodeId, lastLearnId, lastContext, ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, data);
  } catch(e) {}
}
function loadSQLDraft(challengeId) {
  try { return localStorage.getItem(SQL_DRAFT_PREFIX + challengeId) || ""; } catch(e) { return ""; }
}
function saveSQLDraft(challengeId, sql) {
  try { localStorage.setItem(SQL_DRAFT_PREFIX + challengeId, sql); } catch(e) {}
}

// ── Sound Effects (Tone.js) ──────────────────────────────
const SFX = {
  _ready: false,
  async init() {
    if (this._ready) return;
    try {
      const Tone = await import("tone");
      this.synth = new Tone.default.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.05, release: 0.3 }, volume: -12 }).toDestination();
      this._ready = true;
    } catch(e) { this._ready = false; }
  },
  async play(type) {
    await this.init();
    if (!this.synth) return;
    try {
      const Tone = await import("tone");
      await Tone.default.start();
      if (type === "correct") { this.synth.triggerAttackRelease("C5", "8n"); setTimeout(() => this.synth.triggerAttackRelease("E5", "8n"), 120); setTimeout(() => this.synth.triggerAttackRelease("G5", "8n"), 240); }
      else if (type === "wrong") { this.synth.triggerAttackRelease("E3", "4n"); }
      else if (type === "levelup") { ["C5","E5","G5","C6"].forEach((n,i) => setTimeout(() => this.synth.triggerAttackRelease(n, "8n"), i * 150)); }
      else if (type === "badge") { ["G4","B4","D5","G5"].forEach((n,i) => setTimeout(() => this.synth.triggerAttackRelease(n, "8n"), i * 180)); }
      else if (type === "click") { this.synth.triggerAttackRelease("A4", "32n"); }
    } catch(e) {}
  }
};

const C = {
  void: "#000000", black: "#000000", panel: "#0D0D0D", surface: "#111111",
  border: "#222222", borderBright: "#333333",
  cyan: "#00FFFF", cyanDim: "#00CCCC", cyanGhost: "rgba(0,255,255,0.08)",
  cyanGlow: "rgba(0,255,255,0.18)", cyanHot: "#80FFFF",
  green: "#00FF88", greenDim: "#00CC66", greenGhost: "rgba(0,255,136,0.10)",
  amber: "#FFBB00", amberDim: "#CC9900", amberGhost: "rgba(255,187,0,0.10)",
  orange: "#FF8800", orangeGhost: "rgba(255,136,0,0.10)",
  red: "#FF3333", redDim: "#CC2222", redGhost: "rgba(255,51,51,0.10)",
  white: "#FFFFFF", dim: "#888888", muted: "#555555", purple: "#CC88FF",
  text: "#CCCCCC",
};

const F = { mono: "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace" };

// ── ASCII wordmark (figlet "ANSI Shadow" — PUNKSQL) ───────────
const ASCII_LOGO = [
  "██████╗ ██╗   ██╗███╗   ██╗██╗  ██╗███████╗ ██████╗ ██╗     ",
  "██╔══██╗██║   ██║████╗  ██║██║ ██╔╝██╔════╝██╔═══██╗██║     ",
  "██████╔╝██║   ██║██╔██╗ ██║█████╔╝ ███████╗██║   ██║██║     ",
  "██╔═══╝ ██║   ██║██║╚██╗██║██╔═██╗ ╚════██║██║▄▄ ██║██║     ",
  "██║     ╚██████╔╝██║ ╚████║██║  ██╗███████║╚██████╔╝███████╗",
  "╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝ ╚══▀▀═╝ ╚══════╝",
].join("\n");

const AsciiLogo = ({ color = C.text, accent = C.dim }) => (
  <div style={{ width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
    <pre style={{
      margin: 0, fontFamily: F.mono, fontSize: "clamp(4px, 1.55vw, 9px)",
      lineHeight: 1.15, letterSpacing: 0, color, whiteSpace: "pre",
      userSelect: "none", textAlign: "left",
    }}>{ASCII_LOGO}</pre>
    <div style={{ fontFamily: F.mono, fontSize: 10, color: accent, letterSpacing: 4, marginTop: 12 }}>learn sql by doing</div>
  </div>
);

// ── i18n ──────────────────────────────────────────────────
const i18n = {
  en: {
    tab_home: "HOME", tab_learn: "LEARN", tab_code: "CODE", tab_cards: "CARDS", tab_user: "USER",
    boot_1: "[SYS] PunkSQL v1.0 // init",
    boot_2: "[NET] sandbox:5432 ok",
    boot_3: "[USR] eduardo // lvl 12",
    daily_challenge: "daily_challenge", challenge_name: "revenue_by_quarter",
    challenge_desc: "Calculate total revenue per quarter. Find the highest growth rate.",
    execute: "[ EXECUTE ]", resume: "RESUME", daily_quests: "DAILY_QUESTS",
    quest_1_cmd: "solve --count 2", quest_2_cmd: "review --cards 10", quest_3_cmd: "earn --xp 100",
    stat_today: "TODAY", stat_week: "WEEK", stat_acc: "ACC", stat_solved: "solved", stat_correct: "correct",
    learn_cmd: "ls -la", learn_title: "SQL_FUNDAMENTALS",
    learn_sub: "// zero to interview // 10 modules",
    lessons: "lessons", challenges: "challenges", locked: "[LOCKED]",
    mod_4: "Aggregations",
    hint: "HINT",
    problem_line1: "Finance team needs a quarterly report.",
    problem_line2: "Calculate", problem_field1: "total_revenue",
    problem_line3: "per quarter and the", problem_field2: "growth_rate", problem_line4: "vs prev quarter.",
    show_schema: "SCHEMA", hide_schema: "HIDE",
    schema_rows: "// 14,832 rows",
    hint_1: "DATE_TRUNC('quarter', order_date) + SUM(total_amount).",
    hint_2: "LAG() references previous quarter revenue.",
    hint_3: "DATE_TRUNC, SUM, then LAG() OVER(ORDER BY).",
    vim_cmd: "vim challenge.sql",
    query_ok: "OK — 4 rows (23ms)", query_meta: "duckdb_v0.10",
    cols_label: "cols:", sql_label: "sql:", run: "▶ RUN", submit: "⬆ SUBMIT",
    practice_cmd: "ls --sort=diff", practice_title: "CHALLENGES",
    practice_showing: "// {n} of 112",
    ch_1: "top_spending", ch_2: "revenue_trend", ch_3: "category_rank",
    ch_4: "avg_order_region", ch_5: "retention_cohorts",
    review_title: "SPACED_REVIEW",
    answer: "[ ANSWER ]", tap_reveal: "[ tap to reveal ]",
    again: "AGAIN", hard: "HARD", good: "GOOD", easy: "EASY",
    session_stats: "session", due: "DUE", done: "DONE",
    flash_1_front: "What does GROUP BY do?",
    flash_1_back: "Groups rows by column values so aggregate functions (COUNT, SUM, AVG) operate per group.",
    flash_2_front: "WHERE vs HAVING?",
    flash_2_back: "WHERE → filters rows before grouping\nHAVING → filters groups after aggregation",
    flash_3_front: "Count orders per customer",
    flash_3_back: "SELECT customer_id,\n  COUNT(*) AS cnt\nFROM orders\nGROUP BY customer_id;",
    profile_title: "QUERY_APPRENTICE // LVL 12",
    total_xp: "TOTAL_XP", solved_label: "SOLVED", streak_label: "STREAK", accuracy_label: "ACCURACY",
    skill_radar: "SKILL_RADAR", archetype: "ARCHETYPE",
    league_title: "league_silver", league_sub: "// resets 4d | top 10 → GOLD",
    achievements: "ACHIEVEMENTS",
    badge_1: "1st_SELECT", badge_2: "JOIN_MASTER", badge_3: "7D_STREAK",
    badge_4: "SPEED", badge_5: "OWL", badge_6: "PERFECT",
    footer_1: "PunkSQL v1.0", footer_2: "duckdb // 23ms",
    settings: "[ settings ]", logout: "[ logout ]", login_google: "[ login with google ]",
    syncing: "syncing...", synced: "cloud sync ok",
    continue_lesson: "CONTINUE LESSON",
    continue_mod: "mod_04 // aggregations",
  },
  pt: {
    tab_home: "INÍCIO", tab_learn: "TRILHA", tab_code: "CÓDIGO", tab_cards: "CARDS", tab_user: "PERFIL",
    boot_1: "[SIS] PunkSQL v1.0 // init",
    boot_2: "[NET] sandbox:5432 ok",
    boot_3: "[USR] eduardo // nvl 12",
    daily_challenge: "desafio_diário", challenge_name: "receita_trimestre",
    challenge_desc: "Calcule a receita total por trimestre. Ache a maior taxa de crescimento.",
    execute: "[ EXECUTAR ]", resume: "CONTINUAR", daily_quests: "MISSÕES_DIÁRIAS",
    quest_1_cmd: "resolver --total 2", quest_2_cmd: "revisar --cards 10", quest_3_cmd: "ganhar --xp 100",
    stat_today: "HOJE", stat_week: "SEMANA", stat_acc: "PREC", stat_solved: "resolvidos", stat_correct: "corretos",
    learn_cmd: "ls -la", learn_title: "FUNDAMENTOS_SQL",
    learn_sub: "// do zero à entrevista // 10 módulos",
    lessons: "lições", challenges: "desafios", locked: "[BLOQUEADO]",
    mod_4: "Agregações",
    hint: "DICA",
    problem_line1: "Time financeiro precisa de relatório trimestral.",
    problem_line2: "Calcule", problem_field1: "receita_total",
    problem_line3: "por trimestre e a", problem_field2: "taxa_crescimento", problem_line4: "vs anterior.",
    show_schema: "SCHEMA", hide_schema: "OCULTAR",
    schema_rows: "// 14.832 linhas",
    hint_1: "DATE_TRUNC('quarter', order_date) + SUM(total_amount).",
    hint_2: "LAG() referencia receita anterior.",
    hint_3: "DATE_TRUNC, SUM, depois LAG() OVER(ORDER BY).",
    vim_cmd: "vim desafio.sql",
    query_ok: "OK — 4 linhas (23ms)", query_meta: "duckdb_v0.10",
    cols_label: "cols:", sql_label: "sql:", run: "▶ RODAR", submit: "⬆ ENVIAR",
    practice_cmd: "ls --ordenar=dific", practice_title: "DESAFIOS",
    practice_showing: "// {n} de 112",
    ch_1: "top_gastos", ch_2: "receita_mensal", ch_3: "rank_categorias",
    ch_4: "ticket_regiao", ch_5: "coortes_retencao",
    review_title: "REVISÃO_ESPAÇADA",
    answer: "[ RESPOSTA ]", tap_reveal: "[ toque p/ revelar ]",
    again: "DENOVO", hard: "DIFÍCIL", good: "BOM", easy: "FÁCIL",
    session_stats: "sessão", due: "PEND", done: "FEITO",
    flash_1_front: "O que faz o GROUP BY?",
    flash_1_back: "Agrupa linhas por valores de coluna para funções de agregação operarem por grupo.",
    flash_2_front: "WHERE vs HAVING?",
    flash_2_back: "WHERE → filtra linhas antes do grupo\nHAVING → filtra grupos após agregação",
    flash_3_front: "Contar pedidos por cliente",
    flash_3_back: "SELECT customer_id,\n  COUNT(*) AS cnt\nFROM orders\nGROUP BY customer_id;",
    profile_title: "APRENDIZ // NVL 12",
    total_xp: "XP_TOTAL", solved_label: "RESOLVIDOS", streak_label: "SEQUÊNCIA", accuracy_label: "PRECISÃO",
    skill_radar: "RADAR", archetype: "ARQUÉTIPO",
    league_title: "liga_prata", league_sub: "// reseta 4d | top 10 → OURO",
    achievements: "CONQUISTAS",
    badge_1: "1º_SELECT", badge_2: "JOIN", badge_3: "SÉRIE_7D",
    badge_4: "VELOZ", badge_5: "CORUJA", badge_6: "PERFEITO",
    footer_1: "PunkSQL v1.0", footer_2: "duckdb // 23ms",
    settings: "[ config ]", logout: "[ sair ]", login_google: "[ entrar com google ]",
    syncing: "sincronizando...", synced: "nuvem ok",
    continue_lesson: "CONTINUAR LIÇÃO",
    continue_mod: "mod_04 // agregações",
  },
};

const LangContext = createContext({ lang: "en", t: (k) => k });
function useLang() { return useContext(LangContext); }

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&display=swap');
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes fadeSlide{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes cardIn{from{opacity:0;transform:translateY(10px) scale(0.96)}to{opacity:1;transform:none}}
@keyframes flipCard{0%{transform:perspective(600px) rotateY(0)}50%{transform:perspective(600px) rotateY(90deg)}100%{transform:perspective(600px) rotateY(0)}}
@keyframes bootLine{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
@keyframes langSwitch{from{opacity:0.85}to{opacity:1}}
@keyframes levelUp{0%{transform:scale(0.5);opacity:0}20%{transform:scale(1.2);opacity:1}40%{transform:scale(0.95)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes badgeUnlock{0%{transform:scale(0) rotate(-180deg);opacity:0}50%{transform:scale(1.3) rotate(10deg);opacity:1}75%{transform:scale(0.9) rotate(-5deg)}100%{transform:scale(1) rotate(0)}}
@keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes xpLineIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes xpFlyUp{0%{opacity:1;transform:translateY(0) scale(1)}80%{opacity:1;transform:translateY(-60px) scale(1.1)}100%{opacity:0;transform:translateY(-90px) scale(0.8)}}
@keyframes xpTotalReveal{0%{opacity:0;transform:scale(0.7)}60%{opacity:1;transform:scale(1.18)}100%{opacity:1;transform:scale(1)}}
@keyframes timerPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.06)}}
@keyframes rankReveal{from{opacity:0;letter-spacing:8px}to{opacity:1;letter-spacing:3px}}
@keyframes tapRippleSingle{0%{transform:scale(0.1);opacity:0.9}30%{transform:scale(1.5);opacity:0.5}42%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}
@keyframes tapDouble1{0%{transform:scale(0.1);opacity:0.9}22%{transform:scale(1.5);opacity:0.5}32%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}
@keyframes tapDouble2{0%,17%{transform:scale(0.1);opacity:0}18%{transform:scale(0.1);opacity:0.9}40%{transform:scale(1.5);opacity:0.5}50%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}
@keyframes dotSingle{0%{transform:scale(2);opacity:0.9}18%{transform:scale(1);opacity:0.35}100%{transform:scale(1);opacity:0.35}}
@keyframes dotDouble{0%{transform:scale(2);opacity:0.9}14%{transform:scale(1);opacity:0.35}17%{transform:scale(1);opacity:0.35}18%{transform:scale(2);opacity:0.9}32%{transform:scale(1);opacity:0.35}100%{transform:scale(1);opacity:0.35}}
@keyframes swipeFingerLR{0%,5%{transform:translateX(-44px);opacity:0}12%{opacity:1}82%{opacity:1}92%,100%{transform:translateX(44px);opacity:0}}
@keyframes swipeCursorLR{0%,5%{transform:translateX(-36px);opacity:0}12%{opacity:1}82%{opacity:1}92%,100%{transform:translateX(36px);opacity:0}}
*,*::before,*::after{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#333 #000;-webkit-tap-highlight-color:transparent}
html{height:100%;height:-webkit-fill-available;background:#000;font-family:'JetBrains Mono','Fira Code','SF Mono','Courier New',monospace}
body{height:100%;min-height:-webkit-fill-available;background:#000;font-family:'JetBrains Mono','Fira Code','SF Mono','Courier New',monospace}
*{font-family:inherit}
textarea:focus{outline:none}textarea::placeholder{color:transparent}
button,input,select,textarea{font-family:'JetBrains Mono','Fira Code','SF Mono','Courier New',monospace;-webkit-tap-highlight-color:transparent}
:root{--app-h:100dvh}@supports not (height:100dvh){:root{--app-h:100vh}}
.landscape-warn{display:none;position:fixed;inset:0;background:#000;z-index:9999;align-items:center;justify-content:center;flex-direction:column;gap:16px;font-family:monospace;color:#00FF88;font-size:18px;text-align:center}
@media screen and (orientation:landscape) and (max-height:500px){.landscape-warn{display:flex}}
`;

// ── SQL Syntax Tokenizer ──────────────────────────────────
const SQL_KW_SET = new Set([
  "SELECT","FROM","WHERE","JOIN","ON","LEFT","RIGHT","INNER","OUTER","FULL","CROSS",
  "GROUP","ORDER","BY","HAVING","LIMIT","OFFSET","AS","AND","OR","NOT","IN",
  "LIKE","ILIKE","BETWEEN","IS","NULL","DISTINCT","COUNT","SUM","AVG","MIN","MAX",
  "ROUND","SUBSTR","UPPER","LOWER","LENGTH","COALESCE","IFNULL","NULLIF","CAST","TYPEOF",
  "DESC","ASC","WITH","OVER","PARTITION","ROW_NUMBER","RANK","LAG","LEAD",
  "NTILE","DENSE_RANK","FIRST_VALUE","LAST_VALUE","PERCENT_RANK","CUME_DIST",
  "CREATE","TABLE","INSERT","UPDATE","DELETE","DROP","ALTER","INDEX","VIEW",
  "CASE","WHEN","THEN","ELSE","END","EXISTS","UNION","ALL","EXCEPT","INTERSECT",
  "INTO","VALUES","SET","PRIMARY","KEY","FOREIGN","REFERENCES","UNIQUE","DEFAULT",
  "TRUE","FALSE","RETURNING","EXPLAIN","PRAGMA","ATTACH","DETACH",
]);

// ── SQL smart-indentation helpers (shared by keyboard and UI buttons) ─────────
function sqlLineContext(text, pos) {
  const before = text.substring(0, pos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = before.substring(lineStart);
  const indent = (currentLine.match(/^(\s*)/) || ["", ""])[1];
  return { before, lineStart, currentLine, indent };
}

function sqlSmartNewline(text, pos) {
  const { currentLine, indent } = sqlLineContext(text, pos);
  const endsWithParen    = /\(\s*$/.test(currentLine);
  const isSelectClause   = /^\s*SELECT\b/i.test(currentLine);
  const isStandalone     =
    /^\s*(WITH|FROM|WHERE|HAVING|ON|SET|VALUES)\s*$/i.test(currentLine) ||
    /^\s*(GROUP\s+BY|ORDER\s+BY|UNION(\s+ALL)?|EXCEPT(\s+ALL)?|INTERSECT(\s+ALL)?)\s*$/i.test(currentLine) ||
    /^\s*((LEFT|RIGHT|FULL)(\s+OUTER)?\s+JOIN|INNER\s+JOIN|CROSS\s+JOIN|JOIN)\s*$/i.test(currentLine);
  const extra = (endsWithParen || isSelectClause || isStandalone) ? "  " : "";
  return "\n" + indent + extra;
}

function sqlSmartCloseParen(text, pos) {
  const { lineStart, currentLine, indent } = sqlLineContext(text, pos);
  if (!/^\s*$/.test(currentLine)) return null; // only act on blank/whitespace lines
  let depth = 1, i = pos - 1, matchPos = -1;
  while (i >= 0 && depth > 0) {
    if (text[i] === ")") depth++;
    else if (text[i] === "(") { if (--depth === 0) matchPos = i; }
    i--;
  }
  const targetIndent = matchPos >= 0
    ? (text.substring(text.lastIndexOf("\n", matchPos) + 1, matchPos).match(/^(\s*)/) || ["", ""])[1]
    : indent.slice(0, Math.max(0, indent.length - 2));
  return { lineStart, ins: targetIndent + ")" };
}

const TOKEN_COLORS = {
  keyword: "#00FFFF",   // cyan — accent, kept
  table:   "#CCCCCC",   // off-white
  column:  "#AAAAAA",   // light gray
  string:  "#888888",   // muted
  comment: "#444444",
  number:  "#888888",   // muted
  text:    "#CCCCCC",
  punct:   "#555555",
};

function tokenizeSQL(sql, tables = [], columns = []) {
  const tableSet  = new Set(tables.map(t => t.toLowerCase()));
  const colSet    = new Set(columns.map(c => c.toLowerCase()));
  const out = [];
  let i = 0;
  while (i < sql.length) {
    // Line comment — include the newline so line offsets stay in sync
    if (sql[i] === "-" && sql[i + 1] === "-") {
      let j = i;
      while (j < sql.length && sql[j] !== "\n") j++;
      out.push({ type: "comment", value: sql.slice(i, j) });
      if (j < sql.length) { out.push({ type: "punct", value: "\n" }); j++; }
      i = j;
    }
    // String literal
    else if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i]; let j = i + 1;
      while (j < sql.length && sql[j] !== q) { if (sql[j] === "\\") j++; j++; }
      out.push({ type: "string", value: sql.slice(i, j + 1) });
      i = j + 1;
    }
    // Word (keyword / table / column / identifier)
    else if (/[A-Za-z_]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      let type = "text";
      if (SQL_KW_SET.has(word.toUpperCase()))       type = "keyword";
      else if (tableSet.has(word.toLowerCase()))     type = "table";
      else if (colSet.has(word.toLowerCase()))       type = "column";
      out.push({ type, value: word });
      i = j;
    }
    // Number
    else if (/[0-9]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      out.push({ type: "number", value: sql.slice(i, j) });
      i = j;
    }
    // Whitespace / punctuation (single char to preserve newlines etc.)
    else {
      out.push({ type: "punct", value: sql[i] });
      i++;
    }
  }
  return out;
}

// ── Utilities ─────────────────────────────────────────────
const Cursor = () => <span style={{ display: "inline-block", width: 9, height: "1em", background: C.green, marginLeft: 2, animation: "blink 600ms step-end infinite", verticalAlign: "text-bottom" }} />;

const Prompt = ({ path = "~" }) => (
  <span style={{ fontFamily: F.mono, fontSize: 14 }}>
    <span style={{ color: C.green }}>punksql</span><span style={{ color: C.dim }}>@</span><span style={{ color: C.green }}>android</span>
    <span style={{ color: C.dim }}>:</span><span style={{ color: C.cyan }}>{path}</span><span style={{ color: C.green }}>$</span>
  </span>
);

const Divider = ({ char = "─", color = C.border }) => (
  <div style={{ fontFamily: F.mono, fontSize: 12, color, overflow: "hidden", whiteSpace: "nowrap", letterSpacing: 1, userSelect: "none", opacity: 0.7 }}>{char.repeat(40)}</div>
);

const Tag = ({ children, color = C.cyan }) => (
  <span style={{ fontFamily: F.mono, fontSize: 14, color, letterSpacing: 1.5, padding: "6px 14px", background: `${color}18`, border: `1px solid ${color}40` }}>{children}</span>
);

const CLIBox = ({ children, title, color = C.border, style: s = {} }) => (
  <div style={{ border: `1px solid ${color}`, background: C.panel, position: "relative", ...s }}>
    {title && <div style={{ position: "absolute", top: -10, left: 12, background: C.panel, padding: "0 8px", fontFamily: F.mono, fontSize: 13, color: C.cyanDim, letterSpacing: 1 }}>[ {title} ]</div>}
    <div style={{ padding: "20px 16px" }}>{children}</div>
  </div>
);

const Scanlines = () => null; // Removed — Termux UI uses no CRT effects

// ── Level & Achievement System ────────────────────────────
const LEVELS = [0,25,75,150,250,400,600,850,1150,1500,1900,2400,3000,3700,4500,5500,6700,8000,9500,11200];
const LEVEL_RANKS = [
  "Script Kiddie","SELECT Novice","WHERE Warrior","JOIN Journeyman",
  "GROUP BY Grunt","Subquery Scout","CTE Cadet","Window Wizard",
  "DML Defector","DDL Destroyer","Index Infiltrator","Schema Shaman",
  "Query Ranger","Data Desperado","SQL Enforcer","Query Punk",
  "Schema Rebel","Data Oracle","SQL Anarchist","PUNK GOD",
];
function getLevel(xp) {
  let lvl = 1;
  for (let i = 1; i < LEVELS.length; i++) { if (xp >= LEVELS[i]) lvl = i + 1; else break; }
  const cur = LEVELS[lvl - 1] || 0;
  const nxt = LEVELS[lvl] || LEVELS[LEVELS.length - 1] + 2000;
  return { level: lvl, cur, nxt, progress: (xp - cur) / (nxt - cur), rank: LEVEL_RANKS[lvl - 1] || "PUNK GOD" };
}

const ACHIEVEMENTS = [
  { id: "first_query", i: "►", n_en: "First Query", n_pt: "Primeira Query", d_en: "Solve your first challenge", d_pt: "Resolva seu primeiro desafio", c: C.cyan, check: (s) => s.size >= 1 },
  { id: "mod1_done", i: "⋈", n_en: "SQL Rookie", n_pt: "SQL Novato", d_en: "Complete module 1", d_pt: "Complete o módulo 1", c: C.green, check: (s) => CHALLENGES_DB.filter(c => c.mod === 1).every(c => s.has(c.id)) },
  { id: "ten_solved", i: "▲", n_en: "10 Down", n_pt: "10 Resolvidos", d_en: "Solve 10 challenges", d_pt: "Resolva 10 desafios", c: C.amber, check: (s) => s.size >= 10 },
  { id: "lvl5", i: "⚡", n_en: "Level 5", n_pt: "Nível 5", d_en: "Reach level 5", d_pt: "Alcance o nível 5", c: C.red, check: (s, xp) => getLevel(xp).level >= 5 },
  { id: "twenty_solved", i: "◕", n_en: "Halfway", n_pt: "Metade", d_en: "Solve 20 challenges", d_pt: "Resolva 20 desafios", c: C.purple, check: (s) => s.size >= 20 },
  { id: "all_easy", i: "◆", n_en: "Easy Sweep", n_pt: "Easy Varrido", d_en: "Solve all EASY challenges", d_pt: "Resolva todos os EASY", c: C.green, check: (s) => CHALLENGES_DB.filter(c => c.diff === "EASY").every(c => s.has(c.id)) },
  { id: "mod3_done", i: "⊞", n_en: "Sorter", n_pt: "Ordenador", d_en: "Complete modules 1-3", d_pt: "Complete módulos 1-3", c: C.cyan, check: (s) => [1,2,3].every(m => CHALLENGES_DB.filter(c => c.mod === m).every(c => s.has(c.id))) },
  { id: "lvl10", i: "★", n_en: "Level 10", n_pt: "Nível 10", d_en: "Reach level 10", d_pt: "Alcance o nível 10", c: C.amber, check: (s, xp) => getLevel(xp).level >= 10 },
  { id: "forty_solved", i: "⬡", n_en: "40 Down", n_pt: "40 Resolvidos", d_en: "Solve 40 challenges", d_pt: "Resolva 40 desafios", c: C.red, check: (s) => s.size >= 40 },
  { id: "all_done", i: "◈", n_en: "SQL Master", n_pt: "SQL Mestre", d_en: "Solve all 112 challenges", d_pt: "Resolva todos os 112 desafios", c: C.cyanHot, check: (s) => s.size >= 112 },
  { id: "dml_done", i: "✎", n_en: "Data Surgeon", n_pt: "Cirurgião de Dados", d_en: "Complete the DML module", d_pt: "Complete o módulo DML", c: C.amber, check: (s) => CHALLENGES_DB.filter(c => c.mod === 9).every(c => s.has(c.id)) },
  { id: "ddl_done", i: "⬢", n_en: "Schema Architect", n_pt: "Arquiteto de Esquema", d_en: "Complete the DDL module", d_pt: "Complete o módulo DDL", c: C.purple, check: (s) => CHALLENGES_DB.filter(c => c.mod === 10).every(c => s.has(c.id)) },
  // ── Skill badges ──
  { id: "no_help", i: "◉", n_en: "No Help Needed", n_pt: "Sem Ajuda", d_en: "Solve 10 challenges without any hints", d_pt: "Resolva 10 desafios sem dicas", c: C.cyan, check: (s, xp, meta) => (meta?.noHintSolves || 0) >= 10 },
  { id: "join_master", i: "⋈", n_en: "JOIN Master", n_pt: "Mestre do JOIN", d_en: "Solve all JOIN challenges (module 5)", d_pt: "Resolva todos os desafios JOIN", c: C.green, check: (s) => CHALLENGES_DB.filter(c => c.mod === 5).every(c => s.has(c.id)) },
  { id: "window_wizard_badge", i: "▦", n_en: "Window Wizard", n_pt: "Feiticeiro de Janela", d_en: "Solve all window function challenges (module 7)", d_pt: "Resolva todos os desafios de window functions", c: C.purple, check: (s) => CHALLENGES_DB.filter(c => c.mod === 7).every(c => s.has(c.id)) },
  // ── Level badges ──
  { id: "lvl15", i: "◆", n_en: "SQL Enforcer", n_pt: "SQL Enforcer", d_en: "Reach level 15", d_pt: "Alcance o nível 15", c: C.orange, check: (s, xp) => getLevel(xp).level >= 15 },
  { id: "punk_god", i: "◈", n_en: "PUNK GOD", n_pt: "PUNK GOD", d_en: "Reach level 20 — the pinnacle", d_pt: "Alcance o nível 20 — o topo", c: C.cyanHot, check: (s, xp) => getLevel(xp).level >= 20 },
  // ── Daily badges ──
  { id: "daily_x7", i: "◈", n_en: "Daily Grinder", n_pt: "Grindador Diário", d_en: "Complete 7 daily challenges", d_pt: "Complete 7 desafios diários", c: C.amber, check: (s, xp, meta) => (meta?.dailySolves || 0) >= 7 },
  // ── Secret badges ──
  { id: "persistent", i: "◕", n_en: "Persistent", n_pt: "Persistente", d_en: "Fail 5 times then solve the same challenge", d_pt: "Falhe 5 vezes e então resolva o mesmo desafio", c: C.red, check: (s, xp, meta) => (meta?.persistentSolves || 0) >= 1 },
  { id: "legend", i: "★", n_en: "Legend", n_pt: "Lenda", d_en: "Solve 80 challenges", d_pt: "Resolva 80 desafios", c: C.cyanHot, check: (s) => s.size >= 80 },
];

function LevelUpOverlay({ level, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const rank = LEVEL_RANKS[level - 1] || "PUNK GOD";
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 9999, background: `${C.void}E8`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
      <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, letterSpacing: 3, marginBottom: 12, animation: "fadeSlide 0.3s ease" }}>LEVEL UP</div>
      <div style={{ fontFamily: F.mono, fontSize: 80, color: C.cyan, animation: "levelUp 0.8s ease", lineHeight: 1 }}>{level}</div>
      <div style={{ fontFamily: F.mono, fontSize: 18, color: C.dim, letterSpacing: 3, marginTop: 14, animation: "rankReveal 0.6s ease 0.5s both", opacity: 0 }}>{rank}</div>
      <div style={{ width: 160, height: 1, background: C.border, margin: "16px 0", animation: "fadeSlide 0.5s ease 0.4s both" }} />
      <div style={{ fontFamily: F.mono, fontSize: 12, color: C.cyanDim, letterSpacing: 2, animation: "fadeSlide 0.5s ease 0.7s both" }}>+{LEVELS[level - 1] && LEVELS[level] ? LEVELS[level] - LEVELS[level - 1] : "???"} XP to next level</div>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, marginTop: 10, animation: "fadeSlide 0.4s ease 1s both" }}>tap to dismiss</div>
    </div>
  );
}

function BadgeUnlockOverlay({ badge, lang, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 9998, background: `${C.void}E0`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, letterSpacing: 3, marginBottom: 16, animation: "fadeSlide 0.3s ease" }}>ACHIEVEMENT UNLOCKED</div>
      <div style={{ fontSize: 64, animation: "badgeUnlock 0.8s ease", color: C.cyan, marginBottom: 12 }}>{badge.i}</div>
      <div style={{ fontFamily: F.mono, fontSize: 20, color: C.cyan, letterSpacing: 2, animation: "fadeSlide 0.4s ease 0.3s both" }}>{lang === "pt" ? badge.n_pt : badge.n_en}</div>
      <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, marginTop: 8, animation: "fadeSlide 0.4s ease 0.5s both" }}>{lang === "pt" ? badge.d_pt : badge.d_en}</div>
    </div>
  );
}

// ── XP Breakdown Overlay ─────────────────────────────────
function XPBreakdownOverlay({ breakdown, lang, onDone }) {
  const [visible, setVisible] = useState(0);
  const ispt = lang === "pt";

  const lines = [];
  if (breakdown.base > 0) lines.push({ label: `BASE XP (${breakdown.diff})`, value: `+${breakdown.base}`, color: C.white });
  if (breakdown.isFirstSolve) lines.push({ label: ispt ? "PRIMEIRO SOLVE" : "FIRST SOLVE", value: "✓", color: C.green });
  if (breakdown.noHintBonus > 0) lines.push({ label: ispt ? "SEM DICAS" : "NO HINTS", value: `+${breakdown.noHintBonus}`, color: C.green });
  if (breakdown.firstTryBonus) lines.push({ label: ispt ? "PRIMEIRA TENTATIVA +10%" : "FIRST TRY +10%", value: "✓", color: C.green });
  if (breakdown.hintPenalty > 0) lines.push({ label: ispt ? "PENALIDADE DICA" : "HINT PENALTY", value: `−${breakdown.hintPenalty}`, color: C.red });
  if (breakdown.perseveranceBonus > 0) lines.push({ label: ispt ? "PERSEVERANÇA" : "PERSEVERANCE", value: `+${breakdown.perseveranceBonus}`, color: C.cyan });
  if (breakdown.timeMultiplier !== 1.0) lines.push({ label: ispt ? "BÔNUS TEMPO" : "TIME BONUS", value: `×${breakdown.timeMultiplier.toFixed(1)}`, color: C.cyan });
  if (breakdown.dailyBonus > 0) lines.push({ label: ispt ? "BÔNUS DIÁRIO" : "DAILY BONUS", value: `+${breakdown.dailyBonus}`, color: C.cyan });

  useEffect(() => {
    const timers = lines.map((_, i) => setTimeout(() => setVisible(i + 1), i * 200 + 150));
    const done = setTimeout(onDone, lines.length * 200 + 3000);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  const showTotal = visible >= lines.length;

  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 9997, background: `${C.void}EE`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer", padding: "0 32px" }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.green, letterSpacing: 3, marginBottom: 24, animation: "fadeSlide 0.3s ease" }}>// XP_BREAKDOWN</div>
      <div style={{ width: "100%", maxWidth: 300 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 14, marginBottom: 10, opacity: visible > i ? 1 : 0, animation: visible > i ? "xpLineIn 0.2s ease" : "none" }}>
            <span style={{ color: C.dim }}>{line.label}</span>
            <span style={{ color: line.color, fontWeight: 700 }}>{line.value}</span>
          </div>
        ))}
        {showTotal && (
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: F.mono }}>
            <span style={{ fontSize: 14, color: C.dim, letterSpacing: 2 }}>{ispt ? "TOTAL" : "TOTAL"}</span>
            <span style={{ fontSize: 28, color: C.cyan, fontWeight: 700, animation: "xpTotalReveal 0.5s ease" }}>+{breakdown.total} XP</span>
          </div>
        )}
      </div>
      {showTotal && (
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, marginTop: 28, animation: "fadeSlide 0.4s ease 0.3s both", opacity: 0 }}>tap to dismiss</div>
      )}
    </div>
  );
}

// ── Language Switcher ─────────────────────────────────────
function TopBar({ lang, setLang, startCollapsed = false, showContinue = false, onContinue, continueLabel = "", continueCtx = "", exercises = null, currentExId = null, onExNav = null, focusTitle = null }) {
  const [collapsed, setCollapsed] = useState(startCollapsed);

  // Auto-collapse when entering focus mode
  useEffect(() => {
    if (focusTitle) setCollapsed(true);
  }, [focusTitle]);

  // Exercise dots renderer (reused in both collapsed and expanded)
  const ExDots = ({ compact = false }) => {
    if (!exercises) return null;
    const curIdx = exercises.findIndex(e => e.id === currentExId);
    const prev = curIdx > 0 ? exercises[curIdx - 1] : null;
    const next = curIdx < exercises.length - 1 ? exercises[curIdx + 1] : null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 5, flex: 1, justifyContent: "center", minWidth: 0 }}>
        <button onClick={() => prev && onExNav(prev.id)} disabled={!prev} style={{ background: "none", border: "none", cursor: prev ? "pointer" : "default", fontFamily: F.mono, fontSize: 14, color: prev ? C.cyan : C.border, padding: "2px 4px", flexShrink: 0 }}>◂</button>
        <div style={{ display: "flex", gap: compact ? 3 : 4, alignItems: "center", overflowX: "auto" }}>
          {exercises.map((ex, i) => {
            const isCur = ex.id === currentExId;
            const sz = compact ? 16 : 18;
            return (
              <button key={ex.id} onClick={() => onExNav(ex.id)} style={{
                width: sz, height: sz, minWidth: sz,
                background: isCur ? C.cyan : "none",
                border: `1px solid ${isCur ? C.cyan : C.border}`,
                cursor: "pointer", fontFamily: F.mono, fontSize: compact ? 8 : 9, fontWeight: 700,
                color: isCur ? C.black : C.dim,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0, flexShrink: 0,
              }}>
                <span>{i + 1}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => next && onExNav(next.id)} disabled={!next} style={{ background: "none", border: "none", cursor: next ? "pointer" : "default", fontFamily: F.mono, fontSize: 14, color: next ? C.cyan : C.border, padding: "2px 4px", flexShrink: 0 }}>▸</button>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, flexShrink: 0 }}>{curIdx + 1}/{exercises.length}</span>
      </div>
    );
  };

  if (collapsed) {
    return (
      <div style={{ display: "flex", alignItems: "center", padding: "6px 14px 5px", background: C.black, borderBottom: `1px solid ${C.border}`, position: "relative", zIndex: 10, gap: 6 }}>
        {focusTitle ? (
          <div style={{ flex: 1, fontFamily: F.mono, fontSize: 15, color: C.cyan, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{focusTitle}</div>
        ) : exercises ? (
          <ExDots compact />
        ) : showContinue ? (
          <button onClick={onContinue} style={{ background: "none", border: `1px solid ${C.cyan}50`, cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: C.cyan, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, overflow: "hidden", flex: 1, minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}>▶</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{continueCtx}: {continueLabel}</span>
          </button>
        ) : <div style={{ flex: 1 }} />}
        <button onClick={() => setCollapsed(false)} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: C.cyanDim, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {lang.toUpperCase()} ▼
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 14px 7px", background: C.black, borderBottom: `1px solid ${C.border}`, position: "relative", zIndex: 10, gap: 8 }}>
      {/* Left: Exercise dots or Continue button */}
      {exercises ? (
        <ExDots />
      ) : showContinue ? (
        <button onClick={onContinue} style={{
          background: "none", border: `1px solid ${C.cyan}60`, cursor: "pointer",
          fontFamily: F.mono, fontSize: 12, color: C.cyan, fontWeight: 700,
          padding: "7px 10px", display: "flex", alignItems: "center", gap: 6,
          letterSpacing: 0.5,
          overflow: "hidden", flexShrink: 1, minWidth: 0,
        }}>
          <span style={{ flexShrink: 0 }}>▶</span>
          <div style={{ textAlign: "left", overflow: "hidden", minWidth: 0 }}>
            <div style={{ fontSize: 13, lineHeight: 1.2, whiteSpace: "nowrap" }}>{continueCtx}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{continueLabel}</div>
          </div>
        </button>
      ) : <div style={{ flex: 1 }} />}
      {/* Spacer */}
      {!exercises && <div style={{ flex: 1 }} />}
      {/* Right: Lang switcher + collapse */}
      <div style={{ display: "flex", position: "relative", border: `1px solid ${C.cyan}50`, background: C.void, overflow: "hidden", width: 110, flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 1, bottom: 1, left: lang === "en" ? 1 : "50%", width: "calc(50% - 1px)", background: C.cyan, transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)", zIndex: 0 }} />
        {["en", "pt"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ flex: 1, padding: "6px 0", background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: lang === l ? C.black : C.cyanDim, fontWeight: 700, position: "relative", zIndex: 1 }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button onClick={() => setCollapsed(true)} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "4px 8px", flexShrink: 0 }}>▲</button>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────
function ProgressBar({ progress, color = C.cyan }) {
  const f = Math.round(progress * 14);
  return (
    <div style={{ fontFamily: F.mono, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: C.dim }}>│</span>
      <span style={{ color }}>{"█".repeat(f)}</span>
      <span style={{ color: C.muted }}>{"░".repeat(14 - f)}</span>
      <span style={{ color: C.dim }}>│</span>
      <span style={{ color: C.dim, fontSize: 17 }}>{Math.round(progress * 100)}%</span>
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────
function TabBar({ active, onTabChange }) {
  const { t } = useLang();
  const tabs = [
    { id: "home", label: "~", icon: "~" },
    { id: "learn", label: "learn", icon: "learn" },
    { id: "practice", label: "code", icon: "code" },
    { id: "quiz", label: "quiz", icon: "quiz" },
    { id: "review", label: "cards", icon: "cards" },
    { id: "profile", label: "user", icon: "user" },
  ];
  return (
    <>
      <div style={{ height: "calc(44px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }} />
      <div style={{
        display: "flex", borderTop: `1px solid ${C.border}`, background: C.black,
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        paddingBottom: "env(safe-area-inset-bottom, 0px)", maxWidth: 480, margin: "0 auto",
      }}>
        {tabs.map(tab => {
          const on = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
              flex: 1, background: "none", border: "none", borderRight: `1px solid ${C.border}`,
              cursor: "pointer", padding: "10px 4px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
              minHeight: 44, minWidth: 0, position: "relative",
            }}>
              {on && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />}
              <span style={{
                fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5,
                color: on ? C.green : C.dim,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "100%", padding: "0 2px", lineHeight: 1.6,
              }}>{on ? `[${tab.label}]` : tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Status Bar ────────────────────────────────────────────
function StatusBar({ xp = 0, solved = new Set() }) {
  const [time, setTime] = useState("");
  useEffect(() => { const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  const lv = getLevel(xp);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: C.black }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 14px", fontFamily: F.mono, fontSize: 12, color: C.dim,
      }}>
        <span>
          <span style={{ color: C.text }}>punksql</span>
          <span style={{ color: C.dim }}>@</span>
          <span style={{ color: C.dim, fontSize: 11 }}>{lv.rank}</span>
          <span style={{ color: C.muted }}> · </span>
          <span style={{ color: C.dim }}>{xp.toLocaleString()} XP</span>
        </span>
        <span>
          <span style={{ color: C.dim }}>{solved.size}/{CHALLENGES_DB.length}</span>
          <span style={{ color: C.muted }}> {time}</span>
        </span>
      </div>
      <div style={{ padding: "0 14px 6px" }}>
        <div style={{ height: 2, background: C.border, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, lv.progress * 100)}%`, background: C.green, transition: "width 0.5s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HOME — Termux-style CLI menu
// ═══════════════════════════════════════════════════════════
function HomeScreen({ onNavigate, solved = new Set(), xp = 0 }) {
  const { t, lang } = useLang();
  const [cmd, setCmd] = useState("");
  const cmdRef = useRef(null);
  const lv = getLevel(xp);

  const menuItems = [
    { num: "1", id: "SYSTEM_STORY",  desc: lang === "pt" ? "// trilha de aprendizado SQL" : "// SQL learning campaign",   action: () => onNavigate("learn") },
    { num: "2", id: "BOUNTY_BOARD",  desc: lang === "pt" ? "// desafio diário rotativo"   : "// daily rotating challenge", action: () => onNavigate("daily") },
    { num: "3", id: "PRACTICE",      desc: lang === "pt" ? "// todos os 80 desafios SQL"  : "// all 80 SQL challenges",    action: () => onNavigate("practice") },
    { num: "4", id: "QUIZ",          desc: lang === "pt" ? "// múltipla escolha"           : "// multiple-choice questions", action: () => onNavigate("quiz") },
    { num: "5", id: "REVIEW_CARDS",  desc: lang === "pt" ? "// flashcards com repetição"  : "// spaced repetition cards",  action: () => onNavigate("review") },
    { num: "6", id: "PROFILE",       desc: lang === "pt" ? "// stats e conquistas"        : "// stats & achievements",     action: () => onNavigate("profile") },
  ];

  const handleCmd = (e) => {
    if (e.key === "Enter") {
      const val = cmd.trim();
      const item = menuItems.find(m => m.num === val || m.id.toLowerCase() === val.toLowerCase());
      if (item) item.action();
      setCmd("");
    }
  };

  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const dc = CHALLENGES_DB[dayOfYear % CHALLENGES_DB.length];

  return (
    <div style={{ padding: "12px 16px 20px", fontFamily: F.mono, animation: "langSwitch 0.2s ease" }}>
      {/* Boot lines */}
      {[t("boot_1"), t("boot_2"), t("boot_3")].map((line, i) => (
        <div key={i} style={{ fontSize: 12, color: C.dim, lineHeight: 1.9, animation: `bootLine 0.25s ease ${i * 0.1}s both` }}>
          {line}
        </div>
      ))}

      {/* Daily challenge banner */}
      <div style={{ margin: "14px 0 16px", padding: "10px 12px", border: `1px solid ${C.border}`, background: C.panel }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
          {lang === "pt" ? "desafio_diário" : "daily_challenge"} · {dc.diff}
        </div>
        <button onClick={() => onNavigate("daily")} style={{
          display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
          cursor: "pointer", padding: 0, width: "100%", textAlign: "left",
        }}>
          <span style={{ color: C.green, fontSize: 13 }}>$ </span>
          <span style={{ color: C.cyan, fontSize: 14 }}>{dc.title}</span>
          <span style={{ color: C.dim, fontSize: 12, marginLeft: "auto" }}>→ ENTER</span>
        </button>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 6, paddingLeft: 18, lineHeight: 1.5 }}>
          {lang === "pt" ? dc.desc_pt : dc.desc_en}
        </div>
      </div>

      {/* Menu */}
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
        <span style={{ color: C.green }}>$ </span>ls modules/
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 16 }}>
        {menuItems.map((item) => (
          <button key={item.num} onClick={item.action} style={{
            display: "flex", alignItems: "center", gap: 0,
            background: "none", border: "none", cursor: "pointer",
            fontFamily: F.mono, fontSize: 13, textAlign: "left",
            padding: "6px 0", color: C.text, width: "100%",
          }}>
            <span style={{ color: C.cyan, minWidth: 28 }}>[{item.num}]</span>
            <span style={{ color: C.white, minWidth: 140 }}>{item.id}</span>
            <span style={{ color: C.dim, fontSize: 12 }}>{item.desc}</span>
          </button>
        ))}
      </div>

      {/* Stats summary */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        LVL {lv.level} · {xp.toLocaleString()} XP · {solved.size}/{CHALLENGES_DB.length} solved
      </div>

      {/* CLI input */}
      <div style={{ display: "flex", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <Prompt path="~" />
        <span style={{ color: C.text }}> </span>
        <input
          ref={cmdRef}
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          onKeyDown={handleCmd}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontFamily: F.mono, fontSize: 13, color: C.white, caretColor: C.green,
          }}
          placeholder={lang === "pt" ? "digite número ou comando..." : "type number or command..."}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  LEARN
// ═══════════════════════════════════════════════════════════
function LearnScreen({ onNavigate, solved = new Set() }) {
  const { t } = useLang();
  const modDefs = [
    { id: 1, n: "first_query", tp: "SELECT, FROM, DISTINCT, LIMIT" },
    { id: 2, n: "filtering", tp: "WHERE, AND/OR, IN, LIKE" },
    { id: 3, n: "sorting", tp: "ORDER BY, ASC/DESC, LIMIT" },
    { id: 4, n: "aggregations", tp: "COUNT, SUM, AVG, GROUP BY" },
    { id: 5, n: "joins", tp: "INNER JOIN, LEFT JOIN, ON" },
    { id: 6, n: "subqueries", tp: "IN, NOT IN, EXISTS, Scalar" },
    { id: 7, n: "window_fn", tp: "ROW_NUMBER, RANK, LAG, OVER" },
    { id: 8, n: "ctes", tp: "WITH, chained CTEs, recursive" },
    { id: 9, n: "dml", tp: "INSERT, UPDATE, DELETE, NULL, duplicates" },
    { id: 10, n: "ddl", tp: "CREATE TABLE, CREATE VIEW, BEGIN/COMMIT" },
  ];
  // Compute status from solved challenges
  const mods = modDefs.map((m, i) => {
    const modChallenges = CHALLENGES_DB.filter(c => c.mod === m.id);
    const solvedCount = modChallenges.filter(c => solved.has(c.id)).length;
    const total = modChallenges.length;
    const allDone = total > 0 && solvedCount === total;
    const prevDone = i === 0 || (() => {
      const prevCh = CHALLENGES_DB.filter(c => c.mod === modDefs[i - 1].id);
      return prevCh.length > 0 && prevCh.every(c => solved.has(c.id));
    })();
    const s = allDone ? "done" : "active";
    const p = total > 0 ? solvedCount / total : 0;
    const xpEarned = modChallenges.filter(c => solved.has(c.id)).reduce((sum, c) => {
      return sum + (c.diff === "EASY" ? 25 : c.diff === "MED" ? 50 : c.diff === "HARD" ? 75 : 100);
    }, 0);
    return { ...m, s, p, l: total, c: total, xp: xpEarned, solvedCount };
  });
  return (
    <div style={{ padding: "12px 16px 20px", fontFamily: F.mono, animation: "langSwitch 0.2s ease" }}>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>
        <Prompt path="/learn" /><span style={{ color: C.text }}> ls -la modules/</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
        {t("learn_title")} {t("learn_sub")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mods.map((m, i) => {
          const done = m.s === "done", act = m.s === "active", lock = m.s === "lock";
          const clickable = !lock;
          const nc = done ? C.green : act ? C.cyan : C.muted;
          return (
            <button
              key={m.id}
              onClick={clickable ? () => onNavigate("lesson", m.id) : undefined}
              disabled={lock}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                background: act ? C.panel : "none", border: `1px solid ${act ? C.border : "transparent"}`,
                cursor: clickable ? "pointer" : "default",
                textAlign: "left", width: "100%",
                animation: `fadeSlide 0.25s ease ${i * 0.03}s both`,
                opacity: lock ? 0.35 : 1,
              }}
            >
              <span style={{ color: nc, fontSize: 13, minWidth: 20, lineHeight: 1.6 }}>
                {done ? "✓" : act ? "▶" : "·"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>mod_{String(m.id).padStart(2,"0")}/</span>
                  <span style={{ fontSize: 13, color: nc }}>{m.n}</span>
                  {done && <span style={{ fontSize: 11, color: C.green, marginLeft: "auto" }}>+{m.xp}xp</span>}
                  {lock && <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>[LOCKED]</span>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.tp}</div>
                {(act || done) && (
                  <div style={{ marginTop: 6, height: 2, background: C.border, overflow: "hidden", maxWidth: 120 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, m.p * 100)}%`, background: done ? C.green : C.cyan }} />
                  </div>
                )}
                {act && <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{m.solvedCount}/{m.c} challenges</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  SQL ENGINE — Real SQLite via sql.js WASM in browser
// ═══════════════════════════════════════════════════════════
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

const CHALLENGES_DB = [
  // ── MODULE 1: first_query (5 challenges) ──
  { id:1, mod:1, title:"select_all_customers", diff:"EASY", desc_en:"Select all columns from the customers table.", desc_pt:"Selecione todas as colunas da tabela customers.", hint:"SELECT * FROM ...", validate:"SELECT * FROM customers", schema:"customers: id, name, email, city, country, signup_date" },
  { id:2, mod:1, title:"select_names_only", diff:"EASY", desc_en:"Select only the name and email columns from customers.", desc_pt:"Selecione apenas nome e email dos clientes.", hint:"SELECT col1, col2 FROM ...", validate:"SELECT name, email FROM customers", schema:"customers: id, name, email, city, country, signup_date" },
  { id:3, mod:1, title:"first_5_products", diff:"EASY", desc_en:"Show the first 5 products.", desc_pt:"Mostre os 5 primeiros produtos.", hint:"SELECT * FROM ... LIMIT ...", validate:"SELECT * FROM products LIMIT 5", schema:"products: id, name, category, price, stock" },
  { id:4, mod:1, title:"distinct_categories", diff:"EASY", desc_en:"List all unique product categories.", desc_pt:"Liste todas as categorias únicas de produtos.", hint:"SELECT DISTINCT ... FROM ...", validate:"SELECT DISTINCT category FROM products", schema:"products: id, name, category, price, stock" },
  { id:5, mod:1, title:"count_customers", diff:"EASY", desc_en:"Count total number of customers.", desc_pt:"Conte o total de clientes.", hint:"SELECT COUNT(*) ...", validate:"SELECT COUNT(*) AS total FROM customers", schema:"customers: id, name, email, city, country, signup_date" },
  // ── MODULE 2: filtering (5 challenges) ──
  { id:6, mod:2, title:"filter_brazil", diff:"EASY", desc_en:"Find all customers from Brazil.", desc_pt:"Encontre clientes do Brasil.", hint:"WHERE country = '...'", validate:"SELECT * FROM customers WHERE country = 'Brazil'", schema:"customers: id, name, email, city, country, signup_date" },
  { id:7, mod:2, title:"expensive_products", diff:"EASY", desc_en:"Find products with price above $50.", desc_pt:"Produtos com preço acima de $50.", hint:"WHERE price > 50", validate:"SELECT * FROM products WHERE price > 50", schema:"products: id, name, category, price, stock" },
  { id:8, mod:2, title:"electronics_in_stock", diff:"EASY", desc_en:"Find electronics products with stock > 50.", desc_pt:"Produtos eletrônicos com estoque > 50.", hint:"WHERE category = '...' AND stock > ...", validate:"SELECT * FROM products WHERE category = 'Electronics' AND stock > 50", schema:"products: id, name, category, price, stock" },
  { id:9, mod:2, title:"pending_or_shipped", diff:"MED", desc_en:"Find orders that are pending or shipped.", desc_pt:"Pedidos com status pending ou shipped.", hint:"WHERE status IN ('...', '...')", validate:"SELECT * FROM orders WHERE status IN ('pending', 'shipped')", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:10, mod:2, title:"name_search", diff:"MED", desc_en:"Find customers whose name contains 'a' (case-insensitive).", desc_pt:"Clientes com 'a' no nome (sem distinção de maiúsculas).", hint:"WHERE LOWER(name) LIKE '%a%'", validate:"SELECT * FROM customers WHERE LOWER(name) LIKE '%a%'", schema:"customers: id, name, email, city, country, signup_date" },
  // ── MODULE 3: sorting (5 challenges) ──
  { id:11, mod:3, title:"order_by_price", diff:"EASY", desc_en:"List products sorted by price, highest first.", desc_pt:"Produtos por preço, do maior ao menor.", hint:"ORDER BY price DESC", validate:"SELECT * FROM products ORDER BY price DESC", schema:"products: id, name, category, price, stock" },
  { id:12, mod:3, title:"newest_orders", diff:"EASY", desc_en:"Show orders sorted by date, newest first.", desc_pt:"Pedidos por data, mais recentes primeiro.", hint:"ORDER BY order_date DESC", validate:"SELECT * FROM orders ORDER BY order_date DESC", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:13, mod:3, title:"cheapest_3", diff:"EASY", desc_en:"Find the 3 cheapest products.", desc_pt:"Os 3 produtos mais baratos.", hint:"ORDER BY price ASC LIMIT 3", validate:"SELECT * FROM products ORDER BY price ASC LIMIT 3", schema:"products: id, name, category, price, stock" },
  { id:14, mod:3, title:"sort_multi_col", diff:"MED", desc_en:"Sort products by category (A-Z), then by price (high to low).", desc_pt:"Ordene produtos por categoria (A-Z), depois preço (decrescente).", hint:"ORDER BY category ASC, price DESC", validate:"SELECT * FROM products ORDER BY category ASC, price DESC", schema:"products: id, name, category, price, stock" },
  { id:15, mod:3, title:"top_5_orders", diff:"MED", desc_en:"Find the 5 highest-value orders. Show id, total, status.", desc_pt:"Os 5 pedidos de maior valor. Mostre id, total, status.", hint:"ORDER BY total_amount DESC LIMIT 5", validate:"SELECT id, total_amount, status FROM orders ORDER BY total_amount DESC LIMIT 5", schema:"orders: id, customer_id, order_date, total_amount, status" },
  // ── MODULE 4: aggregations (5 challenges) ──
  { id:16, mod:4, title:"count_products", diff:"EASY", desc_en:"Count total number of products.", desc_pt:"Conte o total de produtos.", hint:"SELECT COUNT(*) ...", validate:"SELECT COUNT(*) AS total FROM products", schema:"products: id, name, category, price, stock" },
  { id:17, mod:4, title:"total_revenue", diff:"MED", desc_en:"Total revenue from completed orders.", desc_pt:"Receita total de pedidos completos.", hint:"SUM(total_amount) WHERE status='completed'", validate:"SELECT SUM(total_amount) AS revenue FROM orders WHERE status = 'completed'", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:18, mod:4, title:"avg_price", diff:"MED", desc_en:"Average product price, rounded to 2 decimals.", desc_pt:"Preço médio dos produtos, arredondado para 2 decimais.", hint:"ROUND(AVG(price), 2)", validate:"SELECT ROUND(AVG(price), 2) AS avg_price FROM products", schema:"products: id, name, category, price, stock" },
  { id:19, mod:4, title:"products_per_category", diff:"MED", desc_en:"Count products in each category. Show category and count.", desc_pt:"Conte produtos por categoria. Mostre categoria e contagem.", hint:"GROUP BY category", validate:"SELECT category, COUNT(*) AS cnt FROM products GROUP BY category ORDER BY cnt DESC", schema:"products: id, name, category, price, stock" },
  { id:20, mod:4, title:"category_min_max", diff:"MED", desc_en:"Show min and max price for each category.", desc_pt:"Mostre preço mínimo e máximo por categoria.", hint:"MIN(price), MAX(price) GROUP BY category", validate:"SELECT category, MIN(price) AS min_price, MAX(price) AS max_price FROM products GROUP BY category", schema:"products: id, name, category, price, stock" },
  // ── MODULE 5: joins (6 challenges) ──
  { id:21, mod:5, title:"orders_with_names", diff:"MED", desc_en:"Show orders with customer names. Join orders and customers.", desc_pt:"Mostre pedidos com nomes dos clientes.", hint:"JOIN customers ON o.customer_id = c.id", validate:"SELECT o.id, c.name, o.order_date, o.total_amount, o.status FROM orders o JOIN customers c ON o.customer_id = c.id", schema:"orders: id, customer_id, order_date, total_amount, status\ncustomers: id, name" },
  { id:22, mod:5, title:"items_with_products", diff:"MED", desc_en:"Show order items with product names and prices.", desc_pt:"Itens de pedido com nomes e preços dos produtos.", hint:"JOIN products ON oi.product_id = p.id", validate:"SELECT oi.order_id, p.name, oi.quantity, oi.unit_price FROM order_items oi JOIN products p ON oi.product_id = p.id", schema:"order_items: order_id, product_id, quantity, unit_price\nproducts: id, name, price" },
  { id:23, mod:5, title:"revenue_per_category", diff:"MED", desc_en:"Revenue per product category using JOINs.", desc_pt:"Receita por categoria usando JOINs.", hint:"JOIN order_items, JOIN products, GROUP BY", validate:"SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue FROM order_items oi JOIN products p ON oi.product_id = p.id GROUP BY p.category ORDER BY revenue DESC", schema:"order_items: order_id, product_id, quantity, unit_price\nproducts: id, name, category, price" },
  { id:24, mod:5, title:"top_3_customers", diff:"MED", desc_en:"Top 3 customers by total spending.", desc_pt:"Top 3 clientes por gasto total.", hint:"JOIN customers, GROUP BY, ORDER BY DESC, LIMIT 3", validate:"SELECT c.name, SUM(o.total_amount) AS total_spent FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.name ORDER BY total_spent DESC LIMIT 3", schema:"orders: customer_id, total_amount\ncustomers: id, name" },
  { id:25, mod:5, title:"avg_product_rating", diff:"MED", desc_en:"Average rating per product. Show name and avg rounded to 1 decimal.", desc_pt:"Média de avaliação por produto.", hint:"ROUND(AVG(rating),1) JOIN products GROUP BY", validate:"SELECT p.name, ROUND(AVG(r.rating),1) AS avg_rating FROM reviews r JOIN products p ON r.product_id = p.id GROUP BY p.name ORDER BY avg_rating DESC", schema:"reviews: product_id, rating\nproducts: id, name" },
  { id:26, mod:5, title:"customer_order_count", diff:"MED", desc_en:"Count orders per customer. Show name and count, sorted by count desc.", desc_pt:"Conte pedidos por cliente. Nome e contagem, decrescente.", hint:"JOIN customers GROUP BY c.name ORDER BY", validate:"SELECT c.name, COUNT(o.id) AS order_count FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.name ORDER BY order_count DESC", schema:"customers: id, name\norders: id, customer_id" },
  // ── MODULE 6: subqueries (5 challenges) ──
  { id:27, mod:6, title:"above_avg_price", diff:"HARD", desc_en:"Find products priced above the average price.", desc_pt:"Produtos com preço acima da média.", hint:"WHERE price > (SELECT AVG(price) FROM ...)", validate:"SELECT * FROM products WHERE price > (SELECT AVG(price) FROM products)", schema:"products: id, name, category, price, stock" },
  { id:28, mod:6, title:"products_never_ordered", diff:"HARD", desc_en:"Find products that have never been ordered.", desc_pt:"Produtos que nunca foram pedidos.", hint:"WHERE id NOT IN (SELECT product_id FROM ...)", validate:"SELECT * FROM products WHERE id NOT IN (SELECT DISTINCT product_id FROM order_items)", schema:"products: id, name\norder_items: product_id" },
  { id:29, mod:6, title:"customers_no_orders", diff:"HARD", desc_en:"Customers who never placed an order.", desc_pt:"Clientes que nunca fizeram pedido.", hint:"LEFT JOIN orders WHERE o.id IS NULL", validate:"SELECT c.* FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE o.id IS NULL", schema:"customers: id, name\norders: customer_id" },
  { id:30, mod:6, title:"most_expensive_per_cat", diff:"HARD", desc_en:"Find the most expensive product in each category.", desc_pt:"Produto mais caro de cada categoria.", hint:"WHERE price = (SELECT MAX(price) FROM products p2 WHERE p2.category = p1.category)", validate:"SELECT * FROM products p1 WHERE price = (SELECT MAX(price) FROM products p2 WHERE p2.category = p1.category)", schema:"products: id, name, category, price" },
  { id:31, mod:6, title:"orders_above_avg", diff:"HARD", desc_en:"Find orders with total above the average order value.", desc_pt:"Pedidos com valor acima da média.", hint:"WHERE total_amount > (SELECT AVG(total_amount) FROM orders)", validate:"SELECT * FROM orders WHERE total_amount > (SELECT AVG(total_amount) FROM orders)", schema:"orders: id, customer_id, order_date, total_amount, status" },
  // ── MODULE 7: window_fn (5 challenges) ──
  { id:32, mod:7, title:"running_total", diff:"HARD", desc_en:"Running total of revenue by order date.", desc_pt:"Total acumulado de receita por data.", hint:"SUM() OVER (ORDER BY order_date)", validate:"SELECT order_date, total_amount, SUM(total_amount) OVER (ORDER BY order_date) AS running_total FROM orders ORDER BY order_date", schema:"orders: order_date, total_amount" },
  { id:33, mod:7, title:"row_numbers", diff:"HARD", desc_en:"Add row numbers to products sorted by price descending.", desc_pt:"Adicione números de linha aos produtos por preço decrescente.", hint:"ROW_NUMBER() OVER (ORDER BY price DESC)", validate:"SELECT ROW_NUMBER() OVER (ORDER BY price DESC) AS rn, name, price FROM products", schema:"products: name, price" },
  { id:34, mod:7, title:"rank_by_spending", diff:"HARD", desc_en:"Rank customers by total spending using RANK().", desc_pt:"Ranqueie clientes por gasto total usando RANK().", hint:"RANK() OVER (ORDER BY total DESC)", validate:"SELECT c.name, SUM(o.total_amount) AS total, RANK() OVER (ORDER BY SUM(o.total_amount) DESC) AS rnk FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.name", schema:"orders: customer_id, total_amount\ncustomers: id, name" },
  { id:35, mod:7, title:"lag_comparison", diff:"EXPERT", desc_en:"Show each order with the previous order's amount using LAG().", desc_pt:"Mostre cada pedido com o valor do anterior usando LAG().", hint:"LAG(total_amount) OVER (ORDER BY order_date)", validate:"SELECT order_date, total_amount, LAG(total_amount) OVER (ORDER BY order_date) AS prev_amount FROM orders ORDER BY order_date", schema:"orders: order_date, total_amount" },
  { id:36, mod:7, title:"moving_avg_3", diff:"EXPERT", desc_en:"Calculate a 3-order moving average of total_amount.", desc_pt:"Calcule a média móvel de 3 pedidos.", hint:"AVG() OVER (ORDER BY ... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)", validate:"SELECT order_date, total_amount, ROUND(AVG(total_amount) OVER (ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS moving_avg FROM orders ORDER BY order_date", schema:"orders: order_date, total_amount" },
  // ── MODULE 8: ctes (5 challenges) ──
  { id:37, mod:8, title:"cte_top_customers", diff:"HARD", desc_en:"Use a CTE to find customers who spent over $500 total.", desc_pt:"Use CTE para clientes que gastaram mais de $500.", hint:"WITH spend AS (SELECT ... GROUP BY ...) SELECT * FROM spend WHERE total > 500", validate:"WITH spend AS (SELECT c.name, SUM(o.total_amount) AS total FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.name) SELECT * FROM spend WHERE total > 500", schema:"orders: customer_id, total_amount\ncustomers: id, name" },
  { id:38, mod:8, title:"cte_category_stats", diff:"HARD", desc_en:"Use CTE to compute category stats (count, avg price, total stock).", desc_pt:"Use CTE para stats de categoria (contagem, preço médio, estoque).", hint:"WITH stats AS (SELECT category, COUNT(*), AVG(price), SUM(stock) ...)", validate:"WITH stats AS (SELECT category, COUNT(*) AS cnt, ROUND(AVG(price),2) AS avg_price, SUM(stock) AS total_stock FROM products GROUP BY category) SELECT * FROM stats ORDER BY cnt DESC", schema:"products: category, price, stock" },
  { id:39, mod:8, title:"cte_monthly_revenue", diff:"HARD", desc_en:"Use CTE to calculate monthly revenue and order count.", desc_pt:"Use CTE para receita mensal e contagem de pedidos.", hint:"WITH monthly AS (SELECT SUBSTR(order_date,1,7) AS month, SUM(...), COUNT(*))", validate:"WITH monthly AS (SELECT SUBSTR(order_date,1,7) AS month, SUM(total_amount) AS revenue, COUNT(*) AS orders FROM orders GROUP BY month) SELECT * FROM monthly ORDER BY month", schema:"orders: order_date, total_amount" },
  { id:40, mod:8, title:"cte_chained", diff:"EXPERT", desc_en:"Use two CTEs: first get customer spending, then rank them.", desc_pt:"Use dois CTEs: primeiro gasto por cliente, depois ranqueie.", hint:"WITH spend AS (...), ranked AS (SELECT *, RANK() OVER ...)", validate:"WITH spend AS (SELECT c.name, SUM(o.total_amount) AS total FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.name), ranked AS (SELECT *, RANK() OVER (ORDER BY total DESC) AS rnk FROM spend) SELECT * FROM ranked", schema:"orders: customer_id, total_amount\ncustomers: id, name" },
  { id:41, mod:8, title:"orders_per_month", diff:"HARD", desc_en:"Count orders per month (YYYY-MM). Sorted chronologically.", desc_pt:"Conte pedidos por mês (AAAA-MM). Ordem cronológica.", hint:"SUBSTR(order_date,1,7) GROUP BY", validate:"SELECT SUBSTR(order_date,1,7) AS month, COUNT(*) AS cnt FROM orders GROUP BY month ORDER BY month", schema:"orders: order_date" },
  // ── EXPANDED: MODULE 1 extras ──
  { id:42, mod:1, title:"count_products", diff:"EASY", desc_en:"Count total number of products.", desc_pt:"Conte o total de produtos.", hint:"SELECT COUNT(*) FROM ...", validate:"SELECT COUNT(*) AS total FROM products", schema:"products: id, name, category, price, stock" },
  { id:43, mod:1, title:"all_orders", diff:"EASY", desc_en:"Select all columns from the orders table.", desc_pt:"Selecione todas as colunas da tabela orders.", hint:"SELECT * FROM ...", validate:"SELECT * FROM orders", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:44, mod:1, title:"product_names_prices", diff:"EASY", desc_en:"Show only product names and prices.", desc_pt:"Mostre apenas nomes e preços dos produtos.", hint:"SELECT col1, col2 FROM ...", validate:"SELECT name, price FROM products", schema:"products: id, name, category, price, stock" },
  { id:45, mod:1, title:"distinct_countries", diff:"EASY", desc_en:"List all unique customer countries.", desc_pt:"Liste todos os países únicos dos clientes.", hint:"SELECT DISTINCT ... FROM ...", validate:"SELECT DISTINCT country FROM customers", schema:"customers: id, name, email, city, country, signup_date" },
  { id:46, mod:1, title:"first_3_orders", diff:"EASY", desc_en:"Show the first 3 orders.", desc_pt:"Mostre os 3 primeiros pedidos.", hint:"SELECT * FROM ... LIMIT ...", validate:"SELECT * FROM orders LIMIT 3", schema:"orders: id, customer_id, order_date, total_amount, status" },
  // ── EXPANDED: MODULE 2 extras ──
  { id:47, mod:2, title:"cheap_products", diff:"EASY", desc_en:"Find products cheaper than $20.", desc_pt:"Produtos mais baratos que $20.", hint:"WHERE price < 20", validate:"SELECT * FROM products WHERE price < 20", schema:"products: id, name, category, price, stock" },
  { id:48, mod:2, title:"completed_orders", diff:"EASY", desc_en:"Find all completed orders.", desc_pt:"Encontre todos os pedidos completos.", hint:"WHERE status = 'completed'", validate:"SELECT * FROM orders WHERE status = 'completed'", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:49, mod:2, title:"high_value_orders", diff:"MED", desc_en:"Find orders with total above $200.", desc_pt:"Pedidos com valor acima de $200.", hint:"WHERE total_amount > 200", validate:"SELECT * FROM orders WHERE total_amount > 200", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:50, mod:2, title:"customers_gmail", diff:"MED", desc_en:"Find customers with Gmail addresses.", desc_pt:"Clientes com email Gmail.", hint:"WHERE email LIKE '%gmail%'", validate:"SELECT * FROM customers WHERE email LIKE '%gmail%'", schema:"customers: id, name, email, city, country, signup_date" },
  { id:51, mod:2, title:"low_stock_alert", diff:"MED", desc_en:"Products with stock below 30 and price above $40.", desc_pt:"Produtos com estoque abaixo de 30 e preço acima de $40.", hint:"WHERE stock < 30 AND price > 40", validate:"SELECT * FROM products WHERE stock < 30 AND price > 40", schema:"products: id, name, category, price, stock" },
  // ── EXPANDED: MODULE 3 extras ──
  { id:52, mod:3, title:"alpha_customers", diff:"EASY", desc_en:"List customers sorted alphabetically by name.", desc_pt:"Clientes em ordem alfabética por nome.", hint:"ORDER BY name ASC", validate:"SELECT * FROM customers ORDER BY name ASC", schema:"customers: id, name, email, city, country, signup_date" },
  { id:53, mod:3, title:"oldest_orders", diff:"EASY", desc_en:"Show the 5 oldest orders.", desc_pt:"Os 5 pedidos mais antigos.", hint:"ORDER BY order_date ASC LIMIT 5", validate:"SELECT * FROM orders ORDER BY order_date ASC LIMIT 5", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:54, mod:3, title:"most_stock", diff:"MED", desc_en:"Top 3 products by stock quantity.", desc_pt:"Top 3 produtos por quantidade em estoque.", hint:"ORDER BY stock DESC LIMIT 3", validate:"SELECT * FROM products ORDER BY stock DESC LIMIT 3", schema:"products: id, name, category, price, stock" },
  { id:55, mod:3, title:"sort_country_name", diff:"MED", desc_en:"Sort customers by country (A-Z), then name (A-Z).", desc_pt:"Ordene clientes por país (A-Z), depois nome (A-Z).", hint:"ORDER BY country ASC, name ASC", validate:"SELECT * FROM customers ORDER BY country ASC, name ASC", schema:"customers: id, name, email, city, country, signup_date" },
  { id:56, mod:3, title:"bottom_prices", diff:"MED", desc_en:"Show the 5 cheapest products. Display name and price only.", desc_pt:"Os 5 produtos mais baratos. Mostre nome e preço.", hint:"SELECT name, price ... ORDER BY ... LIMIT", validate:"SELECT name, price FROM products ORDER BY price ASC LIMIT 5", schema:"products: id, name, category, price, stock" },
  // ── EXPANDED: MODULE 4 extras ──
  { id:57, mod:4, title:"total_stock", diff:"EASY", desc_en:"Calculate total stock across all products.", desc_pt:"Calcule o estoque total de todos os produtos.", hint:"SELECT SUM(stock) ...", validate:"SELECT SUM(stock) AS total_stock FROM products", schema:"products: id, name, category, price, stock" },
  { id:58, mod:4, title:"order_count_by_status", diff:"MED", desc_en:"Count orders grouped by status.", desc_pt:"Conte pedidos agrupados por status.", hint:"GROUP BY status", validate:"SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status ORDER BY cnt DESC", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:59, mod:4, title:"avg_order_value", diff:"MED", desc_en:"Average order value, rounded to 2 decimals.", desc_pt:"Valor médio dos pedidos, arredondado para 2 decimais.", hint:"ROUND(AVG(total_amount), 2)", validate:"SELECT ROUND(AVG(total_amount), 2) AS avg_order FROM orders", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:60, mod:4, title:"customers_per_country", diff:"MED", desc_en:"Count customers per country. Sort by count descending.", desc_pt:"Conte clientes por país. Ordem decrescente.", hint:"GROUP BY country ORDER BY cnt DESC", validate:"SELECT country, COUNT(*) AS cnt FROM customers GROUP BY country ORDER BY cnt DESC", schema:"customers: id, name, email, city, country, signup_date" },
  { id:61, mod:4, title:"category_avg_stock", diff:"HARD", desc_en:"Average stock per category. Only show categories with avg stock > 40.", desc_pt:"Estoque médio por categoria. Só categorias com média > 40.", hint:"GROUP BY ... HAVING AVG(stock) > 40", validate:"SELECT category, ROUND(AVG(stock), 1) AS avg_stock FROM products GROUP BY category HAVING AVG(stock) > 40", schema:"products: category, stock" },
  // ── EXPANDED: MODULE 5 extras ──
  { id:62, mod:5, title:"all_customers_orders", diff:"MED", desc_en:"Show ALL customers with their order count (including those with 0 orders).", desc_pt:"Mostre TODOS os clientes com contagem de pedidos (incluindo 0).", hint:"LEFT JOIN orders ... COUNT(o.id)", validate:"SELECT c.name, COUNT(o.id) AS orders FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.name ORDER BY orders DESC", schema:"customers: id, name\norders: id, customer_id" },
  { id:63, mod:5, title:"product_review_count", diff:"MED", desc_en:"Count reviews per product. Show product name and review count.", desc_pt:"Conte avaliações por produto. Nome e contagem.", hint:"JOIN reviews GROUP BY p.name", validate:"SELECT p.name, COUNT(r.id) AS reviews FROM products p LEFT JOIN reviews r ON p.id = r.product_id GROUP BY p.name ORDER BY reviews DESC", schema:"products: id, name\nreviews: id, product_id" },
  { id:64, mod:5, title:"customer_total_items", diff:"HARD", desc_en:"Total items bought per customer (3-table join).", desc_pt:"Total de itens comprados por cliente (join de 3 tabelas).", hint:"JOIN orders JOIN order_items SUM(quantity)", validate:"SELECT c.name, SUM(oi.quantity) AS total_items FROM customers c JOIN orders o ON c.id = o.customer_id JOIN order_items oi ON o.id = oi.order_id GROUP BY c.name ORDER BY total_items DESC", schema:"customers: id, name\norders: id, customer_id\norder_items: order_id, quantity" },
  { id:65, mod:5, title:"unreviewed_products", diff:"HARD", desc_en:"Find products that have no reviews using LEFT JOIN.", desc_pt:"Produtos sem avaliações usando LEFT JOIN.", hint:"LEFT JOIN reviews WHERE r.id IS NULL", validate:"SELECT p.* FROM products p LEFT JOIN reviews r ON p.id = r.product_id WHERE r.id IS NULL", schema:"products: id, name\nreviews: id, product_id" },
  // ── EXPANDED: MODULE 6 extras ──
  { id:66, mod:6, title:"biggest_spender", diff:"HARD", desc_en:"Find the customer who spent the most (subquery for max).", desc_pt:"Cliente que mais gastou (subquery para max).", hint:"WHERE total = (SELECT MAX(total) FROM ...)", validate:"SELECT c.name, SUM(o.total_amount) AS total FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.name ORDER BY total DESC LIMIT 1", schema:"orders: customer_id, total_amount\ncustomers: id, name" },
  { id:67, mod:6, title:"products_ordered_twice", diff:"HARD", desc_en:"Products ordered in at least 2 different orders.", desc_pt:"Produtos pedidos em pelo menos 2 pedidos diferentes.", hint:"GROUP BY product_id HAVING COUNT(DISTINCT order_id) >= 2", validate:"SELECT p.name, COUNT(DISTINCT oi.order_id) AS order_count FROM order_items oi JOIN products p ON oi.product_id = p.id GROUP BY p.name HAVING COUNT(DISTINCT oi.order_id) >= 2", schema:"order_items: order_id, product_id\nproducts: id, name" },
  { id:68, mod:6, title:"above_avg_by_status", diff:"HARD", desc_en:"Orders above the average for their status group.", desc_pt:"Pedidos acima da média do seu grupo de status.", hint:"WHERE total > (SELECT AVG(...) WHERE status = outer.status)", validate:"SELECT * FROM orders o1 WHERE total_amount > (SELECT AVG(total_amount) FROM orders o2 WHERE o2.status = o1.status)", schema:"orders: id, order_date, total_amount, status" },
  { id:69, mod:6, title:"exists_with_orders", diff:"EXPERT", desc_en:"Find customers who have at least one order using EXISTS.", desc_pt:"Clientes com pelo menos um pedido usando EXISTS.", hint:"WHERE EXISTS (SELECT 1 FROM orders WHERE ...)", validate:"SELECT * FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)", schema:"customers: id, name\norders: customer_id" },
  { id:70, mod:6, title:"second_highest_price", diff:"EXPERT", desc_en:"Find the product with the second highest price.", desc_pt:"Produto com o segundo maior preço.", hint:"WHERE price = (SELECT MAX(price) FROM products WHERE price < (SELECT MAX(price)...))", validate:"SELECT * FROM products WHERE price = (SELECT MAX(price) FROM products WHERE price < (SELECT MAX(price) FROM products))", schema:"products: id, name, price" },
  // ── EXPANDED: MODULE 7 extras ──
  { id:71, mod:7, title:"dense_rank_products", diff:"HARD", desc_en:"Dense rank products by price descending.", desc_pt:"Dense rank de produtos por preço decrescente.", hint:"DENSE_RANK() OVER (ORDER BY price DESC)", validate:"SELECT name, price, DENSE_RANK() OVER (ORDER BY price DESC) AS d_rank FROM products", schema:"products: name, price" },
  { id:72, mod:7, title:"lead_next_order", diff:"HARD", desc_en:"Show each order with the next order's amount using LEAD().", desc_pt:"Mostre cada pedido com o valor do próximo usando LEAD().", hint:"LEAD(total_amount) OVER (ORDER BY order_date)", validate:"SELECT order_date, total_amount, LEAD(total_amount) OVER (ORDER BY order_date) AS next_amount FROM orders ORDER BY order_date", schema:"orders: order_date, total_amount" },
  { id:73, mod:7, title:"rank_per_category", diff:"EXPERT", desc_en:"Rank products by price within each category using PARTITION BY.", desc_pt:"Ranqueie produtos por preço dentro de cada categoria.", hint:"RANK() OVER (PARTITION BY category ORDER BY price DESC)", validate:"SELECT category, name, price, RANK() OVER (PARTITION BY category ORDER BY price DESC) AS cat_rank FROM products", schema:"products: name, category, price" },
  { id:74, mod:7, title:"running_count", diff:"HARD", desc_en:"Running count of orders by date.", desc_pt:"Contagem acumulada de pedidos por data.", hint:"COUNT(*) OVER (ORDER BY order_date)", validate:"SELECT order_date, COUNT(*) OVER (ORDER BY order_date) AS running_count FROM orders ORDER BY order_date", schema:"orders: order_date" },
  { id:75, mod:7, title:"pct_of_total", diff:"EXPERT", desc_en:"Each product's price as percentage of total (all products).", desc_pt:"Preço de cada produto como % do total.", hint:"ROUND(price * 100.0 / SUM(price) OVER (), 1)", validate:"SELECT name, price, ROUND(price * 100.0 / SUM(price) OVER (), 1) AS pct FROM products ORDER BY pct DESC", schema:"products: name, price" },
  // ── EXPANDED: MODULE 8 extras ──
  { id:76, mod:8, title:"cte_high_rated", diff:"HARD", desc_en:"Use CTE to find products with average rating above 4.", desc_pt:"Use CTE para produtos com avaliação média acima de 4.", hint:"WITH rated AS (SELECT product_id, AVG(rating) ...)", validate:"WITH rated AS (SELECT p.name, ROUND(AVG(r.rating),1) AS avg_r FROM reviews r JOIN products p ON r.product_id = p.id GROUP BY p.name) SELECT * FROM rated WHERE avg_r > 4", schema:"reviews: product_id, rating\nproducts: id, name" },
  { id:77, mod:8, title:"cte_order_summary", diff:"HARD", desc_en:"CTE with order summary per customer, then filter those with 2+ orders.", desc_pt:"CTE com resumo de pedidos por cliente, filtre os com 2+ pedidos.", hint:"WITH summary AS (...) SELECT * FROM summary WHERE order_count >= 2", validate:"WITH summary AS (SELECT c.name, COUNT(o.id) AS order_count, SUM(o.total_amount) AS total FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.name) SELECT * FROM summary WHERE order_count >= 2 ORDER BY total DESC", schema:"customers: id, name\norders: id, customer_id, total_amount" },
  { id:78, mod:8, title:"cte_revenue_ranked", diff:"EXPERT", desc_en:"Two CTEs: monthly revenue, then rank months by revenue.", desc_pt:"Dois CTEs: receita mensal, depois ranqueie meses por receita.", hint:"WITH monthly AS (...), ranked AS (SELECT *, RANK() OVER ...)", validate:"WITH monthly AS (SELECT SUBSTR(order_date,1,7) AS month, SUM(total_amount) AS revenue FROM orders GROUP BY month), ranked AS (SELECT *, RANK() OVER (ORDER BY revenue DESC) AS rnk FROM monthly) SELECT * FROM ranked", schema:"orders: order_date, total_amount" },
  { id:79, mod:8, title:"cte_customer_segments", diff:"EXPERT", desc_en:"CTE to segment customers: 'VIP' if total > $500, else 'Regular'.", desc_pt:"CTE para segmentar clientes: 'VIP' se total > $500, senão 'Regular'.", hint:"WITH spend AS (...) SELECT name, CASE WHEN total > 500 THEN 'VIP' ...", validate:"WITH spend AS (SELECT c.name, SUM(o.total_amount) AS total FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.name) SELECT name, total, CASE WHEN total > 500 THEN 'VIP' ELSE 'Regular' END AS segment FROM spend ORDER BY total DESC", schema:"customers: id, name\norders: customer_id, total_amount" },
  { id:80, mod:8, title:"cte_product_performance", diff:"EXPERT", desc_en:"CTE: product sales stats (units, revenue, avg price), ranked by revenue.", desc_pt:"CTE: stats de vendas por produto (unid, receita, preço médio), ranqueado.", hint:"WITH sales AS (SELECT p.name, SUM(oi.quantity), SUM(oi.quantity*oi.unit_price) ...)", validate:"WITH sales AS (SELECT p.name, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price) AS revenue, ROUND(AVG(oi.unit_price),2) AS avg_price FROM order_items oi JOIN products p ON oi.product_id = p.id GROUP BY p.name) SELECT *, RANK() OVER (ORDER BY revenue DESC) AS rnk FROM sales", schema:"order_items: product_id, quantity, unit_price\nproducts: id, name" },
  // ── MODULE 9: dml — Data Manipulation & Cleaning (10 challenges) ──
  { id:81, mod:9, title:"insert_new_product", diff:"EASY", desc_en:"Insert a new product: id=11, name='Smartphone', category='Electronics', price=699.99, stock=75.", desc_pt:"Insira um novo produto: id=11, nome='Smartphone', categoria='Electronics', preço=699.99, estoque=75.", hint:"INSERT INTO products VALUES (11, 'Smartphone', 'Electronics', ...)", validate:"INSERT INTO products VALUES (11,'Smartphone','Electronics',699.99,75)", verify:"SELECT id, name, category, price, stock FROM products WHERE id = 11", schema:"products: id, name, category, price, stock" },
  { id:82, mod:9, title:"delete_null_customers", diff:"EASY", desc_en:"Delete all records from raw_sales where customer_name is NULL. These entries are untrackable.", desc_pt:"Exclua todos os registros de raw_sales onde customer_name é NULL.", hint:"DELETE FROM ... WHERE customer_name IS NULL", validate:"DELETE FROM raw_sales WHERE customer_name IS NULL", verify:"SELECT COUNT(*) AS null_customers FROM raw_sales WHERE customer_name IS NULL", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:83, mod:9, title:"delete_invalid_quantity", diff:"EASY", desc_en:"Delete records from raw_sales where quantity is less than or equal to 0. Negative or zero quantities are invalid transactions.", desc_pt:"Exclua registros de raw_sales onde quantity ≤ 0. Quantidades negativas ou zero são inválidas.", hint:"DELETE FROM ... WHERE quantity <= 0", validate:"DELETE FROM raw_sales WHERE quantity <= 0", verify:"SELECT COUNT(*) AS bad_qty FROM raw_sales WHERE quantity <= 0", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:84, mod:9, title:"fix_negative_prices", diff:"MED", desc_en:"Fix data entry errors in raw_sales: update all negative unit_price values by inverting the sign (multiply by -1).", desc_pt:"Corrija erros de entrada: atualize preços negativos em raw_sales multiplicando por -1.", hint:"UPDATE raw_sales SET unit_price = unit_price * ... WHERE unit_price < 0", validate:"UPDATE raw_sales SET unit_price = unit_price * -1 WHERE unit_price < 0", verify:"SELECT COUNT(*) AS negative_prices FROM raw_sales WHERE unit_price < 0", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:85, mod:9, title:"fill_null_prices_with_avg", diff:"MED", desc_en:"Replace NULL unit_price values in raw_sales with the average of all non-NULL prices (rounded to 2 decimal places).", desc_pt:"Substitua preços NULL em raw_sales pela média dos preços não-NULL (arredondado para 2 decimais).", hint:"UPDATE raw_sales SET unit_price = (SELECT ROUND(AVG(unit_price),2) FROM raw_sales WHERE ...) WHERE unit_price IS NULL", validate:"UPDATE raw_sales SET unit_price = (SELECT ROUND(AVG(unit_price),2) FROM raw_sales WHERE unit_price IS NOT NULL) WHERE unit_price IS NULL", verify:"SELECT COUNT(*) AS null_prices FROM raw_sales WHERE unit_price IS NULL", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:86, mod:9, title:"delete_impossible_discount", diff:"MED", desc_en:"Delete records from raw_sales where discount > 1.0. A discount above 100% (i.e., > 1.0) is impossible and indicates bad data.", desc_pt:"Exclua registros de raw_sales onde discount > 1.0. Desconto acima de 100% é impossível.", hint:"DELETE FROM ... WHERE discount > 1.0", validate:"DELETE FROM raw_sales WHERE discount > 1.0", verify:"SELECT COUNT(*) AS bad_discount FROM raw_sales WHERE discount > 1.0", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:87, mod:9, title:"fix_negative_salaries", diff:"MED", desc_en:"In employee_salaries, some salaries were entered as negative by mistake. Fix them by multiplying by -1 to get the correct positive value.", desc_pt:"Em employee_salaries, alguns salários foram inseridos negativos por engano. Corrija multiplicando por -1.", hint:"UPDATE employee_salaries SET salary = salary * ... WHERE salary < 0", validate:"UPDATE employee_salaries SET salary = salary * -1 WHERE salary < 0", verify:"SELECT COUNT(*) AS negative_salaries FROM employee_salaries WHERE salary < 0", schema:"employee_salaries: id, name, department, salary, hire_date" },
  { id:88, mod:9, title:"delete_duplicate_sales", diff:"HARD", desc_en:"Remove duplicate rows from raw_sales. Keep only the record with the lowest id for each combination of (product_id, quantity, unit_price, sale_date). Use a subquery with MIN(id) and GROUP BY.", desc_pt:"Remova duplicatas de raw_sales mantendo apenas o menor id por combinação (product_id, quantity, unit_price, sale_date).", hint:"DELETE FROM raw_sales WHERE id NOT IN (SELECT MIN(id) FROM ... GROUP BY ...)", validate:"DELETE FROM raw_sales WHERE id NOT IN (SELECT MIN(id) FROM raw_sales GROUP BY product_id, quantity, unit_price, sale_date)", verify:"SELECT COUNT(*) AS total_rows FROM raw_sales", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:89, mod:9, title:"fill_zero_salary_dept_avg", diff:"HARD", desc_en:"Update employee_salaries: for employees with salary = 0, set their salary to the average salary (rounded to 2 decimals) of positive salaries in the same department.", desc_pt:"Atualize employee_salaries: salários zerados recebem a média dos salários positivos do mesmo departamento (2 decimais).", hint:"UPDATE employee_salaries SET salary = (SELECT ROUND(AVG(salary),2) FROM ... WHERE e2.department = employee_salaries.department AND salary > 0) WHERE salary = 0", validate:"UPDATE employee_salaries SET salary = (SELECT ROUND(AVG(salary),2) FROM employee_salaries e2 WHERE e2.department = employee_salaries.department AND salary > 0) WHERE salary = 0", verify:"SELECT COUNT(*) AS zero_salaries FROM employee_salaries WHERE salary = 0", schema:"employee_salaries: id, name, department, salary, hire_date" },
  { id:90, mod:9, title:"batch_insert_employees", diff:"HARD", desc_en:"Insert 3 new employees in a single INSERT statement: (11,'Jake Torres','Sales',3500.00,'2024-01-15'), (12,'Lena Park','Engineering',6000.00,'2024-02-01'), (13,'Mike Chen','Marketing',4200.00,'2024-03-10').", desc_pt:"Insira 3 funcionários em um único INSERT: (11,'Jake Torres','Sales',3500.00,'2024-01-15'), (12,'Lena Park','Engineering',6000.00,'2024-02-01'), (13,'Mike Chen','Marketing',4200.00,'2024-03-10').", hint:"INSERT INTO employee_salaries VALUES (11,...),(12,...),(13,...)", validate:"INSERT INTO employee_salaries VALUES (11,'Jake Torres','Sales',3500.00,'2024-01-15'),(12,'Lena Park','Engineering',6000.00,'2024-02-01'),(13,'Mike Chen','Marketing',4200.00,'2024-03-10')", verify:"SELECT id, name, department, salary FROM employee_salaries WHERE id >= 11 ORDER BY id", schema:"employee_salaries: id, name, department, salary, hire_date" },
  // ── MODULE 10: ddl — Schema Definition & Views (10 challenges) ──
  { id:91, mod:10, title:"create_products_archive", diff:"EASY", desc_en:"Create a table called products_archive with columns: id (INTEGER PRIMARY KEY), name (TEXT), category (TEXT), archived_at (TEXT).", desc_pt:"Crie uma tabela products_archive com: id (INTEGER PRIMARY KEY), name (TEXT), category (TEXT), archived_at (TEXT).", hint:"CREATE TABLE products_archive (id INTEGER PRIMARY KEY, name TEXT, ...)", validate:"CREATE TABLE products_archive (id INTEGER PRIMARY KEY, name TEXT, category TEXT, archived_at TEXT)", verify:"SELECT name FROM sqlite_master WHERE type='table' AND name='products_archive'", schema:"products_archive: id, name, category, archived_at" },
  { id:92, mod:10, title:"create_view_active_orders", diff:"EASY", desc_en:"Create a view called active_orders that selects all columns from orders where the status is 'pending' or 'shipped'.", desc_pt:"Crie uma view active_orders que seleciona todos os pedidos com status 'pending' ou 'shipped'.", hint:"CREATE VIEW active_orders AS SELECT * FROM orders WHERE status IN ('...', '...')", validate:"CREATE VIEW active_orders AS SELECT * FROM orders WHERE status IN ('pending','shipped')", verify:"SELECT * FROM active_orders ORDER BY id", schema:"orders: id, customer_id, order_date, total_amount, status" },
  { id:93, mod:10, title:"create_view_order_summary", diff:"MED", desc_en:"Create a view order_summary showing: order id, customer name (aliased as customer_name), order_date, and total_amount. Join orders with customers.", desc_pt:"Crie a view order_summary com: id do pedido, nome do cliente (como customer_name), order_date e total_amount.", hint:"CREATE VIEW order_summary AS SELECT o.id, c.name AS customer_name, ... FROM orders o JOIN customers c ON ...", validate:"CREATE VIEW order_summary AS SELECT o.id, c.name AS customer_name, o.order_date, o.total_amount FROM orders o JOIN customers c ON o.customer_id = c.id", verify:"SELECT * FROM order_summary ORDER BY id", schema:"orders: id, customer_id, order_date, total_amount\ncustomers: id, name" },
  { id:94, mod:10, title:"create_audit_log_table", diff:"MED", desc_en:"Create a table audit_log with: id (INTEGER PRIMARY KEY), action (TEXT NOT NULL), target_table (TEXT NOT NULL), changed_at (TEXT), user_id (INTEGER). Use NOT NULL constraints on critical fields.", desc_pt:"Crie a tabela audit_log: id (INTEGER PRIMARY KEY), action (TEXT NOT NULL), target_table (TEXT NOT NULL), changed_at (TEXT), user_id (INTEGER).", hint:"CREATE TABLE audit_log (id INTEGER PRIMARY KEY, action TEXT NOT NULL, ...)", validate:"CREATE TABLE audit_log (id INTEGER PRIMARY KEY, action TEXT NOT NULL, target_table TEXT NOT NULL, changed_at TEXT, user_id INTEGER)", verify:"SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'", schema:"audit_log: id, action, target_table, changed_at, user_id" },
  { id:95, mod:10, title:"create_view_category_revenue", diff:"MED", desc_en:"Create a view category_revenue showing each product category's total revenue (SUM of quantity * unit_price) from order_items joined with products. Order by revenue DESC.", desc_pt:"Crie a view category_revenue com a receita total por categoria (SUM de quantity*unit_price), ordenada por revenue DESC.", hint:"CREATE VIEW category_revenue AS SELECT p.category, SUM(...) AS revenue FROM order_items oi JOIN products p ON ... GROUP BY p.category ORDER BY revenue DESC", validate:"CREATE VIEW category_revenue AS SELECT p.category, SUM(oi.quantity*oi.unit_price) AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.id GROUP BY p.category ORDER BY revenue DESC", verify:"SELECT * FROM category_revenue", schema:"order_items: order_id, product_id, quantity, unit_price\nproducts: id, category" },
  { id:96, mod:10, title:"create_table_and_populate", diff:"HARD", desc_en:"In two statements: (1) CREATE TABLE promotions (id INTEGER PRIMARY KEY, code TEXT, discount REAL, expires TEXT); (2) INSERT 3 rows: (1,'SAVE10',0.10,'2024-12-31'), (2,'HALF50',0.50,'2024-06-30'), (3,'FREE100',1.00,'2024-03-15'). In production, wrap these in BEGIN/COMMIT.", desc_pt:"Em dois comandos: (1) crie a tabela promotions; (2) insira 3 linhas. Em produção, use BEGIN/COMMIT.", hint:"CREATE TABLE promotions (id INTEGER PRIMARY KEY, code TEXT, ...);\nINSERT INTO promotions VALUES (1,'SAVE10',...),(2,...),(3,...)", validate:"CREATE TABLE promotions (id INTEGER PRIMARY KEY, code TEXT, discount REAL, expires TEXT); INSERT INTO promotions VALUES (1,'SAVE10',0.10,'2024-12-31'),(2,'HALF50',0.50,'2024-06-30'),(3,'FREE100',1.00,'2024-03-15')", verify:"SELECT * FROM promotions ORDER BY id", schema:"promotions: id, code, discount, expires" },
  { id:97, mod:10, title:"create_view_customer_segments", diff:"HARD", desc_en:"Create a view customer_segments showing customer name, total spending (as total), and a segment label: 'VIP' if total > 500, else 'Regular'. Use CASE. Join orders with customers. Order by total DESC.", desc_pt:"Crie a view customer_segments com nome, total gasto e segmento ('VIP' se total>500, senão 'Regular'). Use CASE. Ordene por total DESC.", hint:"CREATE VIEW customer_segments AS SELECT c.name, SUM(...) AS total, CASE WHEN ...>500 THEN '...' ELSE '...' END AS segment FROM orders o JOIN customers c ON ... GROUP BY c.name ORDER BY total DESC", validate:"CREATE VIEW customer_segments AS SELECT c.name, SUM(o.total_amount) AS total, CASE WHEN SUM(o.total_amount)>500 THEN 'VIP' ELSE 'Regular' END AS segment FROM orders o JOIN customers c ON o.customer_id=c.id GROUP BY c.name ORDER BY total DESC", verify:"SELECT * FROM customer_segments", schema:"orders: customer_id, total_amount\ncustomers: id, name" },
  { id:98, mod:10, title:"create_view_top_products", diff:"HARD", desc_en:"Create a view top_products showing the 5 products with highest total revenue (SUM of quantity * unit_price from order_items), joined with products for the name. Order by revenue DESC, LIMIT 5.", desc_pt:"Crie a view top_products com os 5 produtos de maior receita (SUM de quantity*unit_price), com nome do produto. ORDER BY revenue DESC LIMIT 5.", hint:"CREATE VIEW top_products AS SELECT p.name, SUM(...) AS revenue FROM order_items oi JOIN products p ON ... GROUP BY p.name ORDER BY revenue DESC LIMIT 5", validate:"CREATE VIEW top_products AS SELECT p.name, SUM(oi.quantity*oi.unit_price) AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.id GROUP BY p.name ORDER BY revenue DESC LIMIT 5", verify:"SELECT * FROM top_products", schema:"order_items: order_id, product_id, quantity, unit_price\nproducts: id, name" },
  { id:99, mod:10, title:"create_table_view_and_insert", diff:"EXPERT", desc_en:"Three statements: (1) CREATE TABLE order_tags (order_id INTEGER, tag TEXT); (2) CREATE VIEW tagged_orders AS SELECT o.id, o.total_amount, o.status, ot.tag FROM orders o LEFT JOIN order_tags ot ON o.id=ot.order_id; (3) INSERT INTO order_tags VALUES (1,'urgent'),(3,'gift').", desc_pt:"Três instruções: (1) crie order_tags; (2) crie a view tagged_orders (LEFT JOIN); (3) insira 2 tags. Em produção, use BEGIN/COMMIT.", hint:"CREATE TABLE order_tags (order_id INTEGER, tag TEXT);\nCREATE VIEW tagged_orders AS SELECT o.id, ..., ot.tag FROM orders o LEFT JOIN order_tags ot ON ...;\nINSERT INTO order_tags VALUES (1,'...'),(3,'...')", validate:"CREATE TABLE order_tags (order_id INTEGER, tag TEXT); CREATE VIEW tagged_orders AS SELECT o.id, o.total_amount, o.status, ot.tag FROM orders o LEFT JOIN order_tags ot ON o.id=ot.order_id; INSERT INTO order_tags VALUES (1,'urgent'),(3,'gift')", verify:"SELECT id, total_amount, status, tag FROM tagged_orders WHERE tag IS NOT NULL ORDER BY id", schema:"orders: id, total_amount, status\norder_tags: order_id, tag (create this table)" },
  { id:100, mod:10, title:"create_clean_table_as_select", diff:"EXPERT", desc_en:"Create a new table raw_sales_clean using CREATE TABLE ... AS SELECT. Include only valid rows from raw_sales where: quantity > 0, unit_price IS NOT NULL, unit_price > 0, discount <= 1.0, AND customer_name IS NOT NULL.", desc_pt:"Crie a tabela raw_sales_clean usando CREATE TABLE ... AS SELECT com apenas linhas válidas de raw_sales (quantity>0, unit_price não-null e >0, discount<=1.0, customer_name não-null).", hint:"CREATE TABLE raw_sales_clean AS SELECT * FROM raw_sales WHERE quantity>0 AND unit_price IS NOT NULL AND ...", validate:"CREATE TABLE raw_sales_clean AS SELECT * FROM raw_sales WHERE quantity>0 AND unit_price IS NOT NULL AND unit_price>0 AND discount<=1.0 AND customer_name IS NOT NULL", verify:"SELECT COUNT(*) AS clean_rows FROM raw_sales_clean", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  // ── Module 9 extended (DML) ──────────────────────────────────
  { id:101, mod:9, title:"explore_dirty_data", diff:"EASY", desc_en:"Before cleaning, explore the data. Select all rows from raw_sales where quantity <= 0, OR unit_price IS NULL, OR unit_price <= 0, OR discount > 1.0, OR customer_name IS NULL. Order by id.", desc_pt:"Antes de limpar, explore os dados. Selecione todas as linhas de raw_sales com dados inválidos (quantity<=0, unit_price nulo ou <=0, discount>1.0, ou customer_name nulo). Ordene por id.", hint:"SELECT * FROM raw_sales WHERE quantity<=0 OR unit_price IS NULL OR unit_price<=0 OR ... ORDER BY id", validate:"SELECT * FROM raw_sales WHERE quantity<=0 OR unit_price IS NULL OR unit_price<=0 OR discount>1.0 OR customer_name IS NULL ORDER BY id", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:102, mod:9, title:"find_duplicate_sales", diff:"MED", desc_en:"Find duplicate rows in raw_sales. Group by product_id, quantity, unit_price, discount, sale_date, and customer_name. Return only groups with more than one occurrence — show these columns plus COUNT(*) as cnt. Order by cnt DESC.", desc_pt:"Encontre linhas duplicadas em raw_sales. Agrupe por product_id, quantity, unit_price, discount, sale_date, customer_name. Retorne grupos com mais de uma ocorrência, mais COUNT(*) como cnt. Ordene por cnt DESC.", hint:"SELECT ..., COUNT(*) AS cnt FROM raw_sales GROUP BY product_id, quantity, ... HAVING cnt>1 ORDER BY cnt DESC", validate:"SELECT product_id, quantity, unit_price, discount, sale_date, customer_name, COUNT(*) AS cnt FROM raw_sales GROUP BY product_id, quantity, unit_price, discount, sale_date, customer_name HAVING cnt>1 ORDER BY cnt DESC", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:103, mod:9, title:"update_salary_raises", diff:"HARD", desc_en:"Give department salary raises using UPDATE with CASE WHEN — only for rows where salary > 0. Engineering: +10%, Marketing: +5%, Sales: +8%. Employees with negative or zero salary are not affected.", desc_pt:"Aplique aumentos salariais por departamento com UPDATE + CASE WHEN — apenas onde salary > 0. Engineering: +10%, Marketing: +5%, Sales: +8%.", hint:"UPDATE employee_salaries SET salary = CASE WHEN department='Engineering' THEN salary*... WHEN ... ELSE salary END WHERE salary>0", validate:"UPDATE employee_salaries SET salary = CASE WHEN department='Engineering' THEN salary*1.10 WHEN department='Marketing' THEN salary*1.05 WHEN department='Sales' THEN salary*1.08 ELSE salary END WHERE salary>0", verify:"SELECT ROUND(AVG(salary),2) AS avg_salary FROM employee_salaries WHERE department='Engineering' AND salary>0", schema:"employee_salaries: id, name, department, salary, hire_date" },
  { id:104, mod:9, title:"insert_into_select_archive", diff:"HARD", desc_en:"In two statements: (1) CREATE TABLE order_archive (order_id INTEGER, customer_id INTEGER, total_amount REAL, status TEXT, order_date TEXT); (2) INSERT INTO order_archive using SELECT from orders where status = 'completed'.", desc_pt:"Em dois comandos: (1) crie order_archive; (2) insira via SELECT as ordens com status='completed'.", hint:"CREATE TABLE order_archive (order_id INTEGER, ...);\nINSERT INTO order_archive SELECT ... FROM orders WHERE status='...'", validate:"CREATE TABLE order_archive (order_id INTEGER, customer_id INTEGER, total_amount REAL, status TEXT, order_date TEXT); INSERT INTO order_archive SELECT id, customer_id, total_amount, status, order_date FROM orders WHERE status='completed'", verify:"SELECT COUNT(*) AS archived FROM order_archive", schema:"orders: id, customer_id, total_amount, status, order_date" },
  { id:105, mod:9, title:"delete_all_rows", diff:"EASY", desc_en:"Delete ALL rows from raw_sales without dropping the table. No WHERE clause needed.", desc_pt:"Exclua TODAS as linhas de raw_sales sem remover a tabela. Sem cláusula WHERE.", hint:"DELETE FROM raw_sales", validate:"DELETE FROM raw_sales", verify:"SELECT COUNT(*) AS remaining FROM raw_sales", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  { id:106, mod:9, title:"savepoint_atomic_cleanup", diff:"EXPERT", desc_en:"Use a SAVEPOINT called 'cleanup' to atomically remove two sets of bad data: (1) DELETE FROM raw_sales WHERE quantity <= 0; (2) DELETE FROM raw_sales WHERE unit_price IS NULL OR unit_price <= 0. End with RELEASE SAVEPOINT cleanup.", desc_pt:"Use um SAVEPOINT 'cleanup' para remover atomicamente dois conjuntos de dados inválidos: (1) DELETE WHERE quantity<=0; (2) DELETE WHERE unit_price IS NULL OR unit_price<=0. Finalize com RELEASE SAVEPOINT cleanup.", hint:"SAVEPOINT cleanup;\nDELETE FROM raw_sales WHERE quantity<=0;\nDELETE FROM raw_sales WHERE unit_price IS NULL OR unit_price<=0;\nRELEASE SAVEPOINT cleanup", validate:"SAVEPOINT cleanup; DELETE FROM raw_sales WHERE quantity<=0; DELETE FROM raw_sales WHERE unit_price IS NULL OR unit_price<=0; RELEASE SAVEPOINT cleanup", verify:"SELECT COUNT(*) AS clean_rows FROM raw_sales WHERE quantity>0 AND (unit_price IS NULL OR unit_price>0)", schema:"raw_sales: id, product_id, quantity, unit_price, discount, sale_date, customer_name" },
  // ── Module 10 extended (DDL) ─────────────────────────────────
  { id:107, mod:10, title:"create_table_if_not_exists", diff:"EASY", desc_en:"Create a table session_log using CREATE TABLE IF NOT EXISTS. Columns: id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, ts TEXT.", desc_pt:"Crie a tabela session_log com CREATE TABLE IF NOT EXISTS. Colunas: id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, ts TEXT.", hint:"CREATE TABLE IF NOT EXISTS session_log (id INTEGER PRIMARY KEY, user_id INTEGER, ...)", validate:"CREATE TABLE IF NOT EXISTS session_log (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, ts TEXT)", verify:"SELECT name FROM sqlite_master WHERE type='table' AND name='session_log'", schema:"session_log: id, user_id, action, ts" },
  { id:108, mod:10, title:"alter_table_add_column", diff:"MED", desc_en:"Add a new column discount_pct (REAL) to the products table using ALTER TABLE.", desc_pt:"Adicione a coluna discount_pct (REAL) à tabela products usando ALTER TABLE.", hint:"ALTER TABLE products ADD COLUMN discount_pct ...", validate:"ALTER TABLE products ADD COLUMN discount_pct REAL", verify:"SELECT name FROM pragma_table_info('products') WHERE name='discount_pct'", schema:"products: id, name, price, category, stock" },
  { id:109, mod:10, title:"recreate_view_high_value", diff:"MED", desc_en:"In two statements: (1) DROP VIEW IF EXISTS high_value_orders; (2) CREATE VIEW high_value_orders AS SELECT id, customer_id, total_amount, status FROM orders WHERE total_amount > 200, ORDER BY total_amount DESC.", desc_pt:"Em dois comandos: (1) DROP VIEW IF EXISTS high_value_orders; (2) recrie a view mostrando ordens com total_amount > 200, ordenadas por total_amount DESC.", hint:"DROP VIEW IF EXISTS high_value_orders;\nCREATE VIEW high_value_orders AS SELECT id, customer_id, total_amount, status FROM orders WHERE total_amount>... ORDER BY total_amount DESC", validate:"DROP VIEW IF EXISTS high_value_orders; CREATE VIEW high_value_orders AS SELECT id, customer_id, total_amount, status FROM orders WHERE total_amount>200 ORDER BY total_amount DESC", verify:"SELECT * FROM high_value_orders ORDER BY total_amount DESC", schema:"orders: id, customer_id, total_amount, status, order_date" },
  { id:110, mod:10, title:"create_index", diff:"MED", desc_en:"Create an index named idx_orders_status on the orders table for the status column.", desc_pt:"Crie um índice chamado idx_orders_status na tabela orders para a coluna status.", hint:"CREATE INDEX idx_orders_status ON orders(...)", validate:"CREATE INDEX idx_orders_status ON orders(status)", verify:"SELECT name FROM sqlite_master WHERE type='index' AND name='idx_orders_status'", schema:"orders: id, customer_id, total_amount, status, order_date" },
  { id:111, mod:10, title:"create_and_drop_table", diff:"EASY", desc_en:"In two statements: (1) CREATE TABLE staging_area (id INTEGER PRIMARY KEY, data TEXT); (2) DROP TABLE staging_area. Verify the table no longer exists.", desc_pt:"Em dois comandos: (1) crie staging_area; (2) DROP TABLE staging_area. Verifique que a tabela não existe mais.", hint:"CREATE TABLE staging_area (...);\nDROP TABLE staging_area", validate:"CREATE TABLE staging_area (id INTEGER PRIMARY KEY, data TEXT); DROP TABLE staging_area", verify:"SELECT COUNT(*) AS exists_count FROM sqlite_master WHERE type='table' AND name='staging_area'", schema:"staging_area: id, data" },
  { id:112, mod:10, title:"savepoint_schema_snapshot", diff:"EXPERT", desc_en:"Use a SAVEPOINT called 'schema_change' to atomically: (1) CREATE TABLE price_history (product_id INTEGER, price REAL, snapshot_date TEXT); (2) INSERT INTO price_history SELECT id, price, '2024-01-01' FROM products; (3) RELEASE SAVEPOINT schema_change.", desc_pt:"Use SAVEPOINT 'schema_change' para: (1) CREATE TABLE price_history; (2) INSERT INTO price_history SELECT dos produtos; (3) RELEASE. Operação atômica de snapshot de preços.", hint:"SAVEPOINT schema_change;\nCREATE TABLE price_history (product_id INTEGER, ...);\nINSERT INTO price_history SELECT id, price, '...' FROM products;\nRELEASE SAVEPOINT schema_change", validate:"SAVEPOINT schema_change; CREATE TABLE price_history (product_id INTEGER, price REAL, snapshot_date TEXT); INSERT INTO price_history SELECT id, price, '2024-01-01' FROM products; RELEASE SAVEPOINT schema_change", verify:"SELECT COUNT(*) AS snapshots FROM price_history", schema:"products: id, name, price, category, stock" },
];
CHALLENGES_DB.forEach(ch => { ch.color = ch.diff === "EASY" ? C.green : ch.diff === "MED" ? C.cyan : ch.diff === "HARD" ? C.amber : C.red; });

// ── 3-Level Progressive Hints ─────────────────────────────
// XP penalty applied to the solve reward (cumulative by level).
// Level 0 = no hints used, 1 = clause hint (free), 2 = skeleton (-5), 3 = fill-in (-15).
const HINT_XP_PENALTIES = [0, 0, 5, 15];

function maskSubqueries(q, aggressive) {
  let result = '';
  let i = 0;
  while (i < q.length) {
    if (q.slice(i, i + 8).toLowerCase() === '(select ') {
      let depth = 0, j = i;
      while (j < q.length) {
        if (q[j] === '(') depth++;
        else if (q[j] === ')') { if (--depth === 0) break; }
        j++;
      }
      if (aggressive) {
        result += '(SELECT ___ FROM ___)';
      } else {
        const sub = q.slice(i, j + 1);
        result += sub.replace(/\bFROM\s+\w+/i, 'FROM ___');
      }
      i = j + 1;
    } else {
      result += q[i++];
    }
  }
  return result;
}

function getHint2(ch) {
  let q = ch.validate;
  // Mask string literals and numbers
  q = q.replace(/'[^']*'/g, "'___'").replace(/\b\d+(\.\d+)?\b/g, '___');
  // Mask entire subquery content (balanced-paren aware)
  q = maskSubqueries(q, true);
  // If still unchanged (no literals, no subqueries), apply structural masking
  if (q === ch.validate) {
    const withCols = q.replace(/(SELECT\s+(?:DISTINCT\s+)?)(.+?)(\s+FROM\s)/i,
      (m, pre, cols, post) => pre + cols.trim().split(/\s*,\s*/).map(() => '___').join(', ') + post);
    q = withCols !== q ? withCols : q.replace(/\([^()]+\)/g, '(___)');
  }
  return q;
}

function getHint3(ch) {
  let q = ch.validate;
  // Mask string literals only
  q = q.replace(/'[^']*'/g, "'___'");
  // If no strings masked, partially reveal subqueries (keep SELECT list, mask FROM table)
  if (q === ch.validate) q = maskSubqueries(q, false);
  // If still unchanged (structural DDL/DML), mask trailing half of parenthesized column list
  if (q === ch.validate) {
    q = q.replace(/\(([^()]+)\)/, (m, inner) => {
      const parts = inner.split(',');
      if (parts.length <= 1) return m;
      const keep = Math.ceil(parts.length / 2);
      return '(' + parts.map((p, i) => i < keep ? p : ' ___').join(',') + ')';
    });
  }
  return q;
}

// ── Solution Explanations ─────────────────────────────────
// Shown after a correct solve. Indexed by challenge id.
const SOLUTION_EXPLANATIONS = {
  // Module 1 — first_query
  1:  { en: "SELECT * returns every column using the wildcard *. Without LIMIT this scans the whole table — fine for small datasets, but in production always name specific columns so your query stays stable if the schema changes.", pt: "SELECT * retorna todas as colunas com o curinga *. Sem LIMIT isso varre a tabela inteira — ok para datasets pequenos, mas em produção nomeie as colunas para que a query não quebre com mudanças no schema." },
  2:  { en: "Listing columns explicitly (SELECT name, email) fetches only what you need, documents intent, and prevents bugs when columns are added or reordered later.", pt: "Listar colunas explicitamente (SELECT name, email) busca apenas o necessário, documenta a intenção e evita bugs quando colunas são adicionadas ou reordenadas depois." },
  3:  { en: "LIMIT caps the number of rows returned. Without it a large table could return millions of rows — always add LIMIT when exploring unfamiliar data.", pt: "LIMIT limita o número de linhas retornadas. Sem ele uma tabela grande poderia retornar milhões de linhas — sempre use LIMIT ao explorar dados desconhecidos." },
  4:  { en: "DISTINCT deduplicates results, returning one row per unique value. Without it you'd get one row per product — many duplicates for each category.", pt: "DISTINCT remove duplicatas, retornando uma linha por valor único. Sem ele você teria uma linha por produto — muitas repetições por categoria." },
  5:  { en: "COUNT(*) counts every row including NULLs. The AS alias renames the output column from the default 'COUNT(*)' to 'total', making results easier to read.", pt: "COUNT(*) conta todas as linhas incluindo NULLs. O alias AS renomeia a coluna de saída de 'COUNT(*)' para 'total', tornando o resultado mais legível." },
  // Module 2 — filtering
  6:  { en: "WHERE filters rows before they're returned. String comparisons use single quotes and are case-sensitive in SQLite — 'Brazil' won't match 'brazil'.", pt: "WHERE filtra as linhas antes de retorná-las. Comparações de texto usam aspas simples e são sensíveis a maiúsculas no SQLite — 'Brazil' não combina com 'brazil'." },
  7:  { en: "Numeric comparisons need no quotes. > means strictly greater than — use >= to include the boundary value itself.", pt: "Comparações numéricas não precisam de aspas. > significa estritamente maior que — use >= para incluir o próprio valor limite." },
  8:  { en: "AND requires both conditions to be true simultaneously. Use OR when either condition is sufficient.", pt: "AND exige que ambas as condições sejam verdadeiras ao mesmo tempo. Use OR quando qualquer uma das condições for suficiente." },
  9:  { en: "IN is shorthand for multiple OR comparisons: status IN ('pending','shipped') equals status='pending' OR status='shipped'. IN is cleaner with 3+ values.", pt: "IN é um atalho para múltiplas comparações OR: status IN ('pending','shipped') equivale a status='pending' OR status='shipped'. IN é mais limpo com 3+ valores." },
  10: { en: "LIKE with % wildcards matches substrings. LOWER() normalizes case so 'Alice', 'ALICE', and 'alice' all match — without it the search would miss names in different cases.", pt: "LIKE com curingas % combina substrings. LOWER() normaliza maiúsculas para que 'Alice', 'ALICE' e 'alice' combinem — sem isso a busca perderia nomes com capitalizações diferentes." },
  // Module 3 — sorting
  11: { en: "DESC sorts from highest to lowest. Default (ASC) sorts lowest to highest. Without ORDER BY, row order is undefined and may change between queries.", pt: "DESC ordena do maior para o menor. O padrão (ASC) ordena do menor para o maior. Sem ORDER BY a ordem das linhas é indefinida e pode mudar entre queries." },
  12: { en: "ISO date format (YYYY-MM-DD) sorts correctly as plain text because the year comes first. DESC brings the most recent dates to the top.", pt: "O formato de data ISO (AAAA-MM-DD) ordena corretamente como texto simples porque o ano vem primeiro. DESC traz as datas mais recentes para o topo." },
  13: { en: "SQL applies ORDER BY before LIMIT, so sorting then slicing gives exactly the 3 cheapest products. Swap ASC/DESC and you'd get the 3 most expensive.", pt: "O SQL aplica ORDER BY antes de LIMIT, então ordenar e depois fatiar dá exatamente os 3 produtos mais baratos. Troque ASC/DESC para obter os 3 mais caros." },
  14: { en: "Multi-column sort: rows are first sorted by category A-Z, then within each category by price high-to-low. The second column only breaks ties in the first.", pt: "Ordenação por múltiplas colunas: as linhas são primeiro ordenadas por categoria A-Z, depois dentro de cada categoria por preço decrescente. A segunda coluna apenas desfaz empates da primeira." },
  15: { en: "SELECT specific columns + ORDER BY + LIMIT is the 'top N' pattern used everywhere in reporting. Selecting only id, total_amount, status avoids fetching unused columns.", pt: "SELECT de colunas específicas + ORDER BY + LIMIT é o padrão 'top N' usado em toda análise. Selecionar apenas id, total_amount, status evita buscar colunas desnecessárias." },
  // Module 4 — aggregations
  16: { en: "COUNT(*) with no GROUP BY aggregates the entire table into a single number. The * counts all rows including those with NULL values.", pt: "COUNT(*) sem GROUP BY agrega a tabela inteira em um único número. O * conta todas as linhas incluindo aquelas com valores NULL." },
  17: { en: "WHERE filters rows before aggregation runs. Only completed orders reach SUM() — this is more efficient than summing everything and filtering afterward.", pt: "WHERE filtra as linhas antes de a agregação executar. Apenas pedidos completos chegam ao SUM() — isso é mais eficiente do que somar tudo e filtrar depois." },
  18: { en: "AVG returns a float with many decimal places. ROUND(x, 2) limits output to 2 decimal places. The second argument is the number of digits after the decimal point.", pt: "AVG retorna um float com muitas casas decimais. ROUND(x, 2) limita a saída a 2 casas decimais. O segundo argumento é o número de dígitos após o ponto decimal." },
  19: { en: "GROUP BY collapses all rows with the same category into a single group. COUNT(*) then counts rows per group, not total rows. ORDER BY cnt DESC ranks categories by size.", pt: "GROUP BY colapsa todas as linhas com a mesma categoria em um único grupo. COUNT(*) conta linhas por grupo, não o total. ORDER BY cnt DESC ranqueia categorias pelo tamanho." },
  20: { en: "Multiple aggregate functions (MIN, MAX) can be computed in a single query. Each one is calculated independently for every GROUP BY group.", pt: "Múltiplas funções de agregação (MIN, MAX) podem ser computadas em uma única query. Cada uma é calculada independentemente para cada grupo do GROUP BY." },
  // Module 5 — joins
  21: { en: "INNER JOIN links rows from two tables where the key matches. Table aliases (o, c) shorten table names. Only orders with a matching customer are returned — no orphan rows.", pt: "INNER JOIN une linhas de duas tabelas onde a chave corresponde. Aliases (o, c) encurtam os nomes das tabelas. Apenas pedidos com cliente correspondente são retornados." },
  22: { en: "Without the JOIN you'd only see numeric product_id. The JOIN replaces IDs with human-readable names from the products table.", pt: "Sem o JOIN você veria apenas o product_id numérico. O JOIN substitui IDs por nomes legíveis da tabela de produtos." },
  23: { en: "Chain two JOINs to traverse relationships: order_items → products (for category). Then GROUP BY aggregates revenue per category across all joined rows.", pt: "Encadeie dois JOINs para percorrer relacionamentos: order_items → products (para categoria). Depois GROUP BY agrega a receita por categoria." },
  24: { en: "Group spending per customer (JOIN + GROUP BY), sort descending, then LIMIT 3. This 'leaderboard' pattern appears constantly in analytics.", pt: "Agrupe o gasto por cliente (JOIN + GROUP BY), ordene decrescente, depois LIMIT 3. Este padrão de 'ranking' aparece constantemente em análises." },
  25: { en: "Joining reviews to products gives product names instead of IDs. GROUP BY p.name aggregates all ratings for each product into a single AVG.", pt: "Juntar reviews a products fornece nomes de produtos em vez de IDs. GROUP BY p.name agrega todas as avaliações de cada produto em um único AVG." },
  26: { en: "COUNT(o.id) counts non-NULL order IDs per customer. Using COUNT(*) with a JOIN would also count the join rows, giving the same result — but COUNT(specific_column) is more explicit.", pt: "COUNT(o.id) conta IDs de pedidos não-NULL por cliente. COUNT(*) com JOIN daria o mesmo resultado aqui, mas COUNT(coluna_específica) é mais explícito." },
  // Module 6 — subqueries
  27: { en: "The scalar subquery runs first and returns one value (the average price). The outer WHERE then uses it like a literal number. More flexible than hardcoding the average.", pt: "A subquery escalar executa primeiro e retorna um valor (o preço médio). O WHERE externo usa esse valor como um número literal. Mais flexível do que codificar a média manualmente." },
  28: { en: "NOT IN excludes rows whose id appears in the subquery result. DISTINCT in the subquery is optional but removes duplicates, making the comparison set smaller.", pt: "NOT IN exclui linhas cujo id aparece no resultado da subquery. DISTINCT na subquery é opcional, mas remove duplicatas, tornando o conjunto de comparação menor." },
  29: { en: "LEFT JOIN preserves all left-table rows even with no match. When there's no matching order, all right-table columns are NULL — IS NULL on a right-table column identifies those unmatched customers.", pt: "LEFT JOIN preserva todas as linhas da tabela esquerda mesmo sem correspondência. Quando não há pedido correspondente, todas as colunas da tabela direita são NULL — IS NULL em uma coluna da tabela direita identifica esses clientes sem pedidos." },
  30: { en: "A correlated subquery references the outer query's current row (p1.category). It runs once per outer row to find the max price in that category — powerful but can be slow on large tables.", pt: "Uma subquery correlacionada referencia a linha atual da query externa (p1.category). Ela executa uma vez por linha externa para encontrar o preço máximo naquela categoria — poderosa, mas pode ser lenta em tabelas grandes." },
  31: { en: "The subquery computes the global average once. The outer WHERE compares each order's total against that single value. Common mistake: don't filter orders inside the subquery or you'd get the average of a subset.", pt: "A subquery computa a média global uma vez. O WHERE externo compara o total de cada pedido contra esse valor. Erro comum: não filtre pedidos dentro da subquery ou você obteria a média de um subconjunto." },
  // Module 7 — window functions
  32: { en: "SUM() OVER (ORDER BY date) computes a cumulative sum: each row shows the running total up to that point. The OVER clause keeps all rows visible — unlike GROUP BY which collapses them.", pt: "SUM() OVER (ORDER BY date) computa uma soma acumulada: cada linha mostra o total até aquele ponto. A cláusula OVER mantém todas as linhas visíveis — diferente de GROUP BY que as colapsa." },
  33: { en: "ROW_NUMBER() assigns unique sequential integers even for ties. Use RANK() if equal prices should share the same rank number (and the next rank is skipped).", pt: "ROW_NUMBER() atribui inteiros sequenciais únicos mesmo em empates. Use RANK() se preços iguais devem compartilhar o mesmo número de rank (e o próximo rank é pulado)." },
  34: { en: "RANK() gives tied rows the same rank and skips the next number. Two customers with the same total both get rank 1, and rank 2 is skipped. DENSE_RANK() wouldn't skip.", pt: "RANK() dá às linhas empatadas o mesmo rank e pula o próximo número. Dois clientes com o mesmo total ambos recebem rank 1, e o rank 2 é pulado. DENSE_RANK() não pularia." },
  35: { en: "LAG() looks back one row in the ordered window. The first row has no previous row, so it returns NULL. Use LAG(col, 1, 0) to provide a default value instead of NULL.", pt: "LAG() olha uma linha atrás na janela ordenada. A primeira linha não tem linha anterior, então retorna NULL. Use LAG(col, 1, 0) para fornecer um valor padrão em vez de NULL." },
  36: { en: "ROWS BETWEEN 2 PRECEDING AND CURRENT ROW defines a 3-row sliding window (this row plus the 2 before it). As you move down the table, the window slides with you.", pt: "ROWS BETWEEN 2 PRECEDING AND CURRENT ROW define uma janela deslizante de 3 linhas (esta linha mais as 2 anteriores). Conforme você desce na tabela, a janela desliza junto." },
  // Module 8 — CTEs
  37: { en: "A CTE (WITH ... AS) names a subquery and makes it reusable. The outer SELECT reads from it like a regular table — much cleaner than embedding the subquery inside WHERE or FROM.", pt: "Um CTE (WITH ... AS) nomeia uma subquery e a torna reutilizável. O SELECT externo lê dela como de uma tabela regular — muito mais limpo do que embutir a subquery dentro de WHERE ou FROM." },
  38: { en: "The CTE precomputes category stats (count, avg price, total stock). The outer SELECT reads from it as if it were a table. CTEs make complex aggregations readable.", pt: "O CTE pré-computa stats de categoria (contagem, preço médio, estoque total). O SELECT externo lê dele como se fosse uma tabela. CTEs tornam agregações complexas legíveis." },
  39: { en: "SUBSTR(order_date, 1, 7) extracts 'YYYY-MM' from a full date string. Any valid SELECT — including string functions and aggregates — works inside a CTE.", pt: "SUBSTR(order_date, 1, 7) extrai 'AAAA-MM' de uma string de data completa. Qualquer SELECT válido — incluindo funções de string e agregados — funciona dentro de um CTE." },
  40: { en: "Chained CTEs: the second CTE (ranked) can reference the first (spend). This lets you build data step by step — first compute totals, then rank them — keeping each step readable.", pt: "CTEs encadeados: o segundo CTE (ranked) pode referenciar o primeiro (spend). Isso permite construir dados passo a passo — primeiro compute totais, depois ranqueie — mantendo cada etapa legível." },
  41: { en: "SUBSTR(order_date, 1, 7) groups by month without any date functions. Sorting alphabetically by the extracted 'YYYY-MM' string gives correct chronological order.", pt: "SUBSTR(order_date, 1, 7) agrupa por mês sem funções de data. Ordenar alfabeticamente pela string 'AAAA-MM' extraída dá a ordem cronológica correta." },
  // Module 1 extras
  42: { en: "COUNT(*) with no GROUP BY counts the entire products table. AS total renames the output column for readability.", pt: "COUNT(*) sem GROUP BY conta a tabela de produtos inteira. AS total renomeia a coluna de saída para legibilidade." },
  43: { en: "SELECT * FROM orders returns all columns and all rows. Use LIMIT in practice when exploring large tables.", pt: "SELECT * FROM orders retorna todas as colunas e todas as linhas. Use LIMIT na prática ao explorar tabelas grandes." },
  44: { en: "Selecting only name and price fetches two of the five columns — less data, clearer intent.", pt: "Selecionar apenas name e price busca duas das cinco colunas — menos dados, intenção mais clara." },
  45: { en: "DISTINCT on a text column returns each unique value once, regardless of how many rows share it.", pt: "DISTINCT em uma coluna de texto retorna cada valor único uma vez, independentemente de quantas linhas o compartilham." },
  46: { en: "LIMIT 3 stops after the first 3 rows. Without ORDER BY the 3 rows returned are arbitrary.", pt: "LIMIT 3 para após as primeiras 3 linhas. Sem ORDER BY as 3 linhas retornadas são arbitrárias." },
  // Module 2 extras
  47: { en: "< 20 means strictly less than. The WHERE clause is evaluated row-by-row — only rows where price < 20 pass through.", pt: "< 20 significa estritamente menor que. A cláusula WHERE é avaliada linha por linha — apenas linhas onde price < 20 passam." },
  48: { en: "String equality with single quotes. If the status value were 'Completed' (capital C), this query would return 0 rows — case matters.", pt: "Igualdade de string com aspas simples. Se o valor de status fosse 'Completed' (C maiúsculo), esta query retornaria 0 linhas — maiúsculas importam." },
  49: { en: "> 200 excludes the boundary itself. Use >= 200 to include orders of exactly $200.", pt: "> 200 exclui o próprio limite. Use >= 200 para incluir pedidos de exatamente $200." },
  50: { en: "LIKE '%gmail%' matches any string containing 'gmail' anywhere. The two % wildcards mean 'anything before' and 'anything after'.", pt: "LIKE '%gmail%' combina qualquer string que contenha 'gmail' em qualquer lugar. Os dois curingas % significam 'qualquer coisa antes' e 'qualquer coisa depois'." },
  51: { en: "AND combines two numeric conditions. Both must be true: stock must be below 30 AND price must be above 40.", pt: "AND combina duas condições numéricas. Ambas devem ser verdadeiras: estoque deve ser abaixo de 30 E preço deve ser acima de 40." },
  // Module 3 extras
  52: { en: "ORDER BY name ASC sorts alphabetically (A → Z). ASC is the default and can be omitted, but writing it explicitly is clearer.", pt: "ORDER BY name ASC ordena alfabeticamente (A → Z). ASC é o padrão e pode ser omitido, mas escrevê-lo explicitamente é mais claro." },
  53: { en: "ASC on a date brings the oldest dates first. LIMIT 5 then takes the first 5 from that sorted list — the 5 oldest orders.", pt: "ASC em uma data traz as datas mais antigas primeiro. LIMIT 5 então pega as primeiras 5 dessa lista ordenada — os 5 pedidos mais antigos." },
  54: { en: "ORDER BY stock DESC sorts from most stock to least. LIMIT 3 slices off the top 3 — the three products with the most inventory.", pt: "ORDER BY stock DESC ordena do maior estoque para o menor. LIMIT 3 recorta o top 3 — os três produtos com mais inventário." },
  55: { en: "The first sort key (country) establishes the primary order. For customers in the same country, the second key (name) then sorts alphabetically within that group.", pt: "A primeira chave de ordenação (country) estabelece a ordem primária. Para clientes no mesmo país, a segunda chave (name) então ordena alfabeticamente dentro daquele grupo." },
  56: { en: "Selecting only name and price avoids fetching id, category, and stock. Combining SELECT with ORDER BY + LIMIT is the efficient 'cheapest N items' pattern.", pt: "Selecionar apenas name e price evita buscar id, category e stock. Combinar SELECT com ORDER BY + LIMIT é o padrão eficiente de 'N itens mais baratos'." },
  // Module 4 extras
  57: { en: "SUM(stock) adds up the stock column across all rows. Without GROUP BY this returns a single total for the entire products table.", pt: "SUM(stock) soma a coluna stock de todas as linhas. Sem GROUP BY retorna um total único para a tabela de produtos inteira." },
  58: { en: "GROUP BY status creates one row per status value. COUNT(*) per group shows how many orders are in each state. ORDER BY cnt DESC ranks statuses by volume.", pt: "GROUP BY status cria uma linha por valor de status. COUNT(*) por grupo mostra quantos pedidos estão em cada estado. ORDER BY cnt DESC ranqueia os statuses por volume." },
  59: { en: "AVG computes the mean across all rows. ROUND(..., 2) formats the output to 2 decimal places, suitable for displaying monetary values.", pt: "AVG computa a média de todas as linhas. ROUND(..., 2) formata a saída para 2 casas decimais, adequado para exibir valores monetários." },
  60: { en: "GROUP BY country aggregates customers by their country. ORDER BY cnt DESC puts the country with the most customers at the top.", pt: "GROUP BY country agrega clientes pelo país. ORDER BY cnt DESC coloca o país com mais clientes no topo." },
  61: { en: "HAVING filters groups after aggregation, unlike WHERE which filters rows before. You can't use WHERE AVG(stock) > 40 because the aggregate doesn't exist yet at that point.", pt: "HAVING filtra grupos após a agregação, diferente de WHERE que filtra linhas antes. Você não pode usar WHERE AVG(stock) > 40 porque o agregado ainda não existe naquele ponto." },
  // Module 5 extras
  62: { en: "LEFT JOIN preserves all customers even if they have no orders. COUNT(o.id) returns 0 for unmatched rows (NULLs), not 1 — COUNT(*) would incorrectly return 1 for those customers.", pt: "LEFT JOIN preserva todos os clientes mesmo sem pedidos. COUNT(o.id) retorna 0 para linhas sem correspondência (NULLs), não 1 — COUNT(*) retornaria incorretamente 1 para esses clientes." },
  63: { en: "LEFT JOIN ensures products with zero reviews still appear in the result. COUNT(r.id) returns 0 for products with no reviews — no risk of accidentally hiding them.", pt: "LEFT JOIN garante que produtos sem avaliações ainda apareçam no resultado. COUNT(r.id) retorna 0 para produtos sem avaliações — sem risco de ocultá-los acidentalmente." },
  64: { en: "Three-table join: customers → orders (via customer_id) → order_items (via order_id). Each JOIN adds another table's columns and multiplies rows for matching keys.", pt: "Join de três tabelas: customers → orders (via customer_id) → order_items (via order_id). Cada JOIN adiciona colunas de outra tabela e multiplica linhas para chaves correspondentes." },
  65: { en: "Anti-join: LEFT JOIN followed by WHERE r.id IS NULL finds products with no matching review. This is cleaner and faster than NOT IN with a subquery on large tables.", pt: "Anti-join: LEFT JOIN seguido de WHERE r.id IS NULL encontra produtos sem avaliação correspondente. Isso é mais limpo e rápido que NOT IN com subquery em tabelas grandes." },
  // Module 6 extras
  66: { en: "ORDER BY total DESC LIMIT 1 finds the maximum without a subquery. It's simpler and often faster than WHERE total = (SELECT MAX(total) ...).", pt: "ORDER BY total DESC LIMIT 1 encontra o máximo sem subquery. É mais simples e frequentemente mais rápido que WHERE total = (SELECT MAX(total) ...)." },
  67: { en: "COUNT(DISTINCT order_id) counts unique orders per product, not total line items. HAVING >= 2 then filters to products appearing in at least 2 separate orders.", pt: "COUNT(DISTINCT order_id) conta pedidos únicos por produto, não itens de linha totais. HAVING >= 2 filtra para produtos aparecendo em pelo menos 2 pedidos separados." },
  68: { en: "A correlated subquery runs once per outer row and uses o1.status from the outer query. This is the cleanest way to compare each row against its own group's average.", pt: "Uma subquery correlacionada executa uma vez por linha externa e usa o1.status da query externa. Esta é a forma mais limpa de comparar cada linha com a média de seu próprio grupo." },
  69: { en: "EXISTS returns true as soon as the subquery finds one matching row — it short-circuits immediately. It's often faster than IN for large tables.", pt: "EXISTS retorna verdadeiro assim que a subquery encontra uma linha correspondente — ele para imediatamente. É frequentemente mais rápido que IN para tabelas grandes." },
  70: { en: "Nested scalar subqueries: the inner one finds the global MAX, the outer subquery finds the MAX of everything below that, and the outer WHERE matches that price. An alternative is LIMIT 1 OFFSET 1.", pt: "Subqueries escalares aninhadas: a mais interna encontra o MAX global, a subquery externa encontra o MAX de tudo abaixo disso, e o WHERE externo combina esse preço. Uma alternativa é LIMIT 1 OFFSET 1." },
  // Module 7 extras
  71: { en: "DENSE_RANK doesn't skip rank numbers after ties. If two products share rank 1, the next is rank 2 (not 3). Use DENSE_RANK when sequential numbering matters more than gaps.", pt: "DENSE_RANK não pula números de rank após empates. Se dois produtos compartilham rank 1, o próximo é rank 2 (não 3). Use DENSE_RANK quando numeração sequencial importa mais que lacunas." },
  72: { en: "LEAD() looks forward one row. The last row has no next row, so it returns NULL. LAG() and LEAD() are the standard way to compare adjacent rows without a self-join.", pt: "LEAD() olha uma linha adiante. A última linha não tem próxima linha, então retorna NULL. LAG() e LEAD() são a forma padrão de comparar linhas adjacentes sem um auto-join." },
  73: { en: "PARTITION BY category resets the rank counter for each category. Without PARTITION BY, products would be ranked globally across all categories.", pt: "PARTITION BY category reinicia o contador de rank para cada categoria. Sem PARTITION BY, os produtos seriam ranqueados globalmente em todas as categorias." },
  74: { en: "COUNT(*) OVER (ORDER BY order_date) computes a running count: each row shows how many orders have occurred up to and including that date.", pt: "COUNT(*) OVER (ORDER BY order_date) computa uma contagem acumulada: cada linha mostra quantos pedidos ocorreram até e incluindo aquela data." },
  75: { en: "SUM(price) OVER () with an empty OVER computes the grand total across all rows, used as the denominator. Multiplying by 100.0 forces float division so you get decimals.", pt: "SUM(price) OVER () com OVER vazio computa o total geral de todas as linhas, usado como denominador. Multiplicar por 100.0 força divisão float para obter decimais." },
  // Module 8 extras
  76: { en: "The CTE joins reviews to products and computes avg rating per product name. The outer SELECT then filters WHERE avg_r > 4 — readable and avoids a nested subquery in HAVING.", pt: "O CTE une reviews a products e computa a avaliação média por nome de produto. O SELECT externo então filtra WHERE avg_r > 4 — legível e evita uma subquery aninhada no HAVING." },
  77: { en: "The CTE computes per-customer order count and total spending. The outer query filters WHERE order_count >= 2 — much cleaner than repeating the aggregation in a WHERE clause.", pt: "O CTE computa contagem de pedidos e gasto total por cliente. A query externa filtra WHERE order_count >= 2 — muito mais limpo que repetir a agregação em uma cláusula WHERE." },
  78: { en: "Two CTEs: the first computes monthly revenue, the second ranks those months. RANK() in the second CTE reads from the first, chaining transformations cleanly.", pt: "Dois CTEs: o primeiro computa receita mensal, o segundo ranqueia esses meses. RANK() no segundo CTE lê do primeiro, encadeando transformações de forma limpa." },
  79: { en: "The CTE computes total spending per customer. CASE WHEN in the outer SELECT then derives the segment label. Putting business logic in CASE WHEN keeps the CTE focused on data prep.", pt: "O CTE computa o gasto total por cliente. CASE WHEN no SELECT externo então deriva o rótulo de segmento. Colocar lógica de negócio no CASE WHEN mantém o CTE focado na preparação de dados." },
  80: { en: "The CTE calculates three metrics per product (units, revenue, avg price) in one pass. RANK() OVER in the outer SELECT then ranks products by revenue without re-scanning the table.", pt: "O CTE calcula três métricas por produto (unidades, receita, preço médio) em uma passagem. RANK() OVER no SELECT externo então ranqueia produtos por receita sem re-escanear a tabela." },
  // Module 9 — DML
  81: { en: "INSERT INTO with VALUES adds one or more rows. The values must match the column order defined when the table was created. Missing columns default to NULL.", pt: "INSERT INTO com VALUES adiciona uma ou mais linhas. Os valores devem corresponder à ordem das colunas definida quando a tabela foi criada. Colunas ausentes padrão para NULL." },
  82: { en: "IS NULL is the correct syntax — '= NULL' doesn't work in SQL. DELETE without WHERE deletes all rows, so the WHERE clause is critical here.", pt: "IS NULL é a sintaxe correta — '= NULL' não funciona em SQL. DELETE sem WHERE exclui todas as linhas, então a cláusula WHERE é crítica aqui." },
  83: { en: "<= 0 catches both zero and negative quantities in one condition. Common mistake: forgetting to include 0 (using < 0 instead of <= 0).", pt: "<= 0 captura tanto quantidades zero quanto negativas em uma condição. Erro comum: esquecer de incluir 0 (usar < 0 em vez de <= 0)." },
  84: { en: "Multiplying by -1 flips the sign. WHERE unit_price < 0 limits the UPDATE to only negative prices — without WHERE every price would be negated.", pt: "Multiplicar por -1 inverte o sinal. WHERE unit_price < 0 limita o UPDATE apenas aos preços negativos — sem WHERE cada preço seria negado." },
  85: { en: "A scalar subquery inside SET computes the fill value dynamically. The inner WHERE IS NOT NULL excludes NULLs from the average, preventing them from skewing the result.", pt: "Uma subquery escalar dentro de SET computa o valor de preenchimento dinamicamente. O WHERE IS NOT NULL interno exclui NULLs da média, evitando que eles distorçam o resultado." },
  86: { en: "Discounts are stored as fractions (0.10 = 10%), so > 1.0 means more than 100% off — a business impossibility indicating bad data.", pt: "Descontos são armazenados como frações (0.10 = 10%), então > 1.0 significa mais de 100% de desconto — uma impossibilidade de negócio que indica dados incorretos." },
  87: { en: "Same sign-flip pattern as fixing prices. WHERE salary < 0 ensures only negative salaries are corrected — employees with valid positive salaries are untouched.", pt: "Mesmo padrão de inversão de sinal que a correção de preços. WHERE salary < 0 garante que apenas salários negativos sejam corrigidos — funcionários com salários positivos válidos não são alterados." },
  88: { en: "DELETE WHERE id NOT IN (SELECT MIN(id) GROUP BY ...) keeps only the row with the lowest id per unique combination. All other copies are deleted.", pt: "DELETE WHERE id NOT IN (SELECT MIN(id) GROUP BY ...) mantém apenas a linha com o menor id por combinação única. Todas as outras cópias são excluídas." },
  89: { en: "The subquery is correlated: it uses employee_salaries.department from the outer row to find that department's average. This computes a per-department average dynamically for each row being updated.", pt: "A subquery é correlacionada: usa employee_salaries.department da linha externa para encontrar a média daquele departamento. Isso computa uma média por departamento dinamicamente para cada linha sendo atualizada." },
  90: { en: "One INSERT can add multiple rows by listing them as comma-separated value tuples — far more efficient than one INSERT per row for bulk operations.", pt: "Um INSERT pode adicionar múltiplas linhas listando-as como tuplas de valores separadas por vírgulas — muito mais eficiente do que um INSERT por linha para operações em lote." },
  // Module 9 extended
  101: { en: "OR combines multiple quality-check conditions: any row failing any check is flagged. This exploration step reveals the scope of dirty data before you start cleaning.", pt: "OR combina múltiplas condições de verificação de qualidade: qualquer linha que falhe em qualquer verificação é marcada. Este passo de exploração revela o escopo dos dados sujos antes de começar a limpeza." },
  102: { en: "GROUP BY all identifying columns then HAVING COUNT(*) > 1 finds exact duplicates. COUNT(*) per group tells you how many copies exist — useful to understand the scale of the problem.", pt: "GROUP BY em todas as colunas identificadoras e HAVING COUNT(*) > 1 encontra duplicatas exatas. COUNT(*) por grupo diz quantas cópias existem — útil para entender a escala do problema." },
  103: { en: "CASE WHEN inside SET acts like if/else. The ELSE salary clause leaves unchanged any department not listed. WHERE salary > 0 prevents applying raises to already-broken salary data.", pt: "CASE WHEN dentro de SET age como if/else. A cláusula ELSE salary deixa sem alteração qualquer departamento não listado. WHERE salary > 0 evita aplicar aumentos a dados de salário já corrompidos." },
  104: { en: "INSERT INTO ... SELECT is the standard archiving pattern: create the destination table, then copy matching rows in one statement. Faster than INSERT + VALUES for bulk copies.", pt: "INSERT INTO ... SELECT é o padrão padrão de arquivamento: crie a tabela destino e depois copie as linhas correspondentes em um comando. Mais rápido que INSERT + VALUES para cópias em lote." },
  105: { en: "DELETE without WHERE removes all rows but preserves the table structure and its indexes. This is different from DROP TABLE which removes the table entirely.", pt: "DELETE sem WHERE remove todas as linhas mas preserva a estrutura da tabela e seus índices. Isso é diferente de DROP TABLE que remove a tabela completamente." },
  106: { en: "SAVEPOINT wraps multiple DELETEs atomically. If the second DELETE fails, ROLLBACK TO SAVEPOINT cleanup undoes the first too. RELEASE SAVEPOINT applies all changes permanently.", pt: "SAVEPOINT envolve múltiplos DELETEs atomicamente. Se o segundo DELETE falhar, ROLLBACK TO SAVEPOINT cleanup desfaz o primeiro também. RELEASE SAVEPOINT aplica todas as mudanças permanentemente." },
  // Module 10 — DDL
  91:  { en: "CREATE TABLE defines the structure: column names and SQLite types (INTEGER, TEXT, REAL). INTEGER PRIMARY KEY creates an auto-incrementing unique identifier.", pt: "CREATE TABLE define a estrutura: nomes de colunas e tipos SQLite (INTEGER, TEXT, REAL). INTEGER PRIMARY KEY cria um identificador único auto-incrementado." },
  92:  { en: "A VIEW is a saved SELECT query — it stores no data itself. Querying the view re-runs the SELECT each time. Views are ideal for filtering or joining data that multiple queries need.", pt: "Uma VIEW é uma query SELECT salva — ela não armazena dados por si só. Consultar a view re-executa o SELECT a cada vez. Views são ideais para filtrar ou unir dados que múltiplas queries precisam." },
  93:  { en: "Views can encapsulate JOINs and column aliases. Any query that needs order + customer info can now use this view instead of repeating the JOIN.", pt: "Views podem encapsular JOINs e aliases de colunas. Qualquer query que precise de informações de pedido + cliente pode agora usar esta view em vez de repetir o JOIN." },
  94:  { en: "NOT NULL is a constraint that rejects NULL values for that column. Apply it to required fields — here, action and target_table must always be present for an audit log to be useful.", pt: "NOT NULL é uma restrição que rejeita valores NULL naquela coluna. Aplique em campos obrigatórios — aqui, action e target_table devem sempre estar presentes para que um log de auditoria seja útil." },
  95:  { en: "Views can contain GROUP BY and ORDER BY. The ORDER BY inside the view definition sets the default output order when the view is queried without its own ORDER BY.", pt: "Views podem conter GROUP BY e ORDER BY. O ORDER BY dentro da definição da view define a ordem de saída padrão quando a view é consultada sem seu próprio ORDER BY." },
  96:  { en: "CREATE TABLE then INSERT INTO populates it. In production you'd wrap both in BEGIN/COMMIT for atomicity. The SAVEPOINT in this environment provides that isolation.", pt: "CREATE TABLE depois INSERT INTO a popula. Em produção você envolveria ambos em BEGIN/COMMIT para atomicidade. O SAVEPOINT neste ambiente fornece esse isolamento." },
  97:  { en: "CASE WHEN inside a view creates derived columns — the segment label is computed from the data, not stored. Any downstream query reading this view gets the classification automatically.", pt: "CASE WHEN dentro de uma view cria colunas derivadas — o rótulo de segmento é computado dos dados, não armazenado. Qualquer query downstream que leia esta view obtém a classificação automaticamente." },
  98:  { en: "A view with LIMIT always returns at most 5 rows. This is useful for dashboards that need the top N without callers needing to remember to add LIMIT.", pt: "Uma view com LIMIT sempre retorna no máximo 5 linhas. Isso é útil para dashboards que precisam do top N sem que os chamadores precisem lembrar de adicionar LIMIT." },
  99:  { en: "Three DDL/DML statements in sequence: the view depends on the table created just before it. Order matters — CREATE VIEW before CREATE TABLE would fail.", pt: "Três instruções DDL/DML em sequência: a view depende da tabela criada logo antes. A ordem importa — CREATE VIEW antes de CREATE TABLE falharia." },
  100: { en: "CREATE TABLE ... AS SELECT creates and populates a table in one step using any valid SELECT as the data source. The clean table only contains rows passing all quality filters.", pt: "CREATE TABLE ... AS SELECT cria e popula uma tabela em uma etapa usando qualquer SELECT válido como fonte de dados. A tabela limpa contém apenas linhas que passam em todos os filtros de qualidade." },
  // Module 10 extended
  107: { en: "IF NOT EXISTS makes the statement idempotent — running it twice won't raise an error if the table already exists. Essential for schema migration scripts.", pt: "IF NOT EXISTS torna o comando idempotente — executá-lo duas vezes não gerará erro se a tabela já existir. Essencial para scripts de migração de schema." },
  108: { en: "ALTER TABLE ADD COLUMN extends an existing table without dropping and recreating it. Existing rows get NULL for the new column unless you specify a DEFAULT.", pt: "ALTER TABLE ADD COLUMN estende uma tabela existente sem precisar descartá-la e recriá-la. Linhas existentes recebem NULL para a nova coluna a menos que você especifique um DEFAULT." },
  109: { en: "SQLite can't ALTER a view, so the standard pattern is DROP IF EXISTS then re-CREATE. DROP IF EXISTS prevents errors when the view doesn't yet exist.", pt: "SQLite não pode alterar uma view com ALTER, então o padrão é DROP IF EXISTS e depois re-CREATE. DROP IF EXISTS evita erros quando a view ainda não existe." },
  110: { en: "CREATE INDEX builds a B-tree on the status column, making WHERE status='...' queries much faster. Always name indexes descriptively (idx_table_column) so their purpose is clear.", pt: "CREATE INDEX constrói uma B-tree na coluna status, tornando queries WHERE status='...' muito mais rápidas. Sempre nomeie índices descritivamente (idx_tabela_coluna) para que seu propósito seja claro." },
  111: { en: "DROP TABLE removes both data and structure permanently. CREATE TABLE then DROP TABLE here verifies the table can be created and deleted safely — a common schema test pattern.", pt: "DROP TABLE remove dados e estrutura permanentemente. CREATE TABLE depois DROP TABLE aqui verifica que a tabela pode ser criada e excluída com segurança — um padrão de teste de schema comum." },
  112: { en: "SAVEPOINT schema_change ensures CREATE TABLE and INSERT INTO succeed together or fail together. RELEASE SAVEPOINT finalizes both. This is the atomic schema + data snapshot pattern.", pt: "SAVEPOINT schema_change garante que CREATE TABLE e INSERT INTO tenham sucesso juntos ou falhem juntos. RELEASE SAVEPOINT finaliza ambos. Este é o padrão atômico de schema + snapshot de dados." },
};

// ── Company Archetype Tags ────────────────────────────────
const TAG_META = {
  ecomm:     { c: C.dim,   label_en: "e-commerce", label_pt: "e-commerce", icon: ">" },
  fintech:   { c: C.dim,   label_en: "fintech",    label_pt: "fintech",    icon: ">" },
  analytics: { c: C.dim,   label_en: "analytics",  label_pt: "analytics",  icon: ">" },
  social:    { c: C.dim,   label_en: "social",     label_pt: "social",     icon: ">" },
  hr:        { c: C.dim,   label_en: "hr",         label_pt: "rh",         icon: ">" },
  "data-eng":{ c: C.dim,   label_en: "data-eng",   label_pt: "dados",      icon: ">" },
};
const CHALLENGE_TAGS = {
  // Module 1 — first_query
  1:"ecomm", 2:"ecomm", 3:"ecomm", 4:"ecomm", 5:"analytics",
  42:"ecomm", 43:"ecomm", 44:"ecomm", 45:"ecomm", 46:"ecomm",
  // Module 2 — filtering
  6:"ecomm", 7:"ecomm", 8:"ecomm", 9:"ecomm", 10:"ecomm",
  47:"ecomm", 48:"ecomm", 49:"fintech", 50:"ecomm", 51:"ecomm",
  // Module 3 — sorting
  11:"ecomm", 12:"ecomm", 13:"ecomm", 14:"ecomm", 15:"fintech",
  52:"ecomm", 53:"ecomm", 54:"ecomm", 55:"ecomm", 56:"ecomm",
  // Module 4 — aggregations
  16:"analytics", 17:"fintech", 18:"analytics", 19:"analytics", 20:"analytics",
  57:"analytics", 58:"analytics", 59:"fintech", 60:"analytics", 61:"analytics",
  // Module 5 — joins
  21:"ecomm", 22:"ecomm", 23:"fintech", 24:"fintech", 25:"social",
  62:"analytics", 63:"social", 64:"analytics", 65:"social",
  // Module 6 — subqueries
  27:"analytics", 28:"analytics", 29:"analytics", 30:"analytics", 31:"fintech",
  66:"fintech", 67:"analytics", 68:"analytics", 69:"analytics", 70:"analytics",
  // Module 7 — window functions
  32:"fintech", 33:"analytics", 34:"analytics", 35:"analytics", 36:"fintech",
  71:"analytics", 72:"analytics", 73:"analytics", 74:"analytics", 75:"analytics",
  // Module 8 — CTEs
  37:"fintech", 38:"analytics", 39:"fintech", 40:"analytics", 41:"analytics",
  76:"social", 77:"analytics", 78:"fintech", 79:"fintech", 80:"analytics",
  // Module 9 — DML / data cleaning
  81:"data-eng", 82:"data-eng", 83:"data-eng", 84:"data-eng", 85:"data-eng",
  86:"data-eng", 87:"hr", 88:"data-eng", 89:"hr", 90:"hr",
  101:"data-eng", 102:"data-eng", 103:"hr", 104:"data-eng", 105:"data-eng", 106:"data-eng",
  // Module 10 — DDL / schema
  91:"data-eng", 92:"data-eng", 93:"data-eng", 94:"data-eng", 95:"data-eng",
  96:"data-eng", 97:"fintech", 98:"data-eng", 99:"data-eng", 100:"data-eng",
  107:"data-eng", 108:"data-eng", 109:"fintech", 110:"data-eng", 111:"data-eng", 112:"data-eng",
};
CHALLENGES_DB.forEach(ch => { ch.tag = CHALLENGE_TAGS[ch.id] || "analytics"; });

const MOD_LABELS = [
  {id:1, label:"SELECT"}, {id:2, label:"WHERE"}, {id:3, label:"ORDER"},
  {id:4, label:"GROUP"}, {id:5, label:"JOIN"},   {id:6, label:"SUB"},
  {id:7, label:"WINDOW"}, {id:8, label:"CTE"},   {id:9, label:"DML"}, {id:10, label:"DDL"},
];
const ARCHETYPE_ORDER = ["ecomm", "fintech", "analytics", "social", "hr", "data-eng"];

// ═══════════════════════════════════════════════════════════
//  QUIZ DATABASE — 30 multiple-choice questions
// ═══════════════════════════════════════════════════════════
const QUIZ_DB = [
  // Module 1: basics
  { id:1, mod:1, diff:"EASY", q_en:"Which keyword retrieves all columns?", q_pt:"Qual keyword retorna todas as colunas?", opts:["SELECT *","GET ALL","FETCH *","SHOW *"], ans:0 },
  { id:2, mod:1, diff:"EASY", q_en:"What does LIMIT 10 do?", q_pt:"O que LIMIT 10 faz?", opts:["Returns first 10 rows","Deletes 10 rows","Creates 10 tables","Skips 10 rows"], ans:0 },
  { id:3, mod:1, diff:"EASY", q_en:"Which clause removes duplicates?", q_pt:"Qual cláusula remove duplicatas?", opts:["DISTINCT","UNIQUE","NO_REPEAT","SINGLE"], ans:0 },
  { id:4, mod:1, diff:"EASY", q_en:"SELECT name FROM users — what does this return?", q_pt:"SELECT name FROM users — o que retorna?", opts:["Only the name column","All columns","The table structure","An error"], ans:0 },
  // Module 2: filtering
  { id:5, mod:2, diff:"EASY", q_en:"Which clause filters rows?", q_pt:"Qual cláusula filtra linhas?", opts:["WHERE","FILTER","HAVING","WHEN"], ans:0 },
  { id:6, mod:2, diff:"MED", q_en:"What operator checks for multiple values?", q_pt:"Qual operador verifica múltiplos valores?", opts:["IN","BETWEEN","LIKE","EACH"], ans:0 },
  { id:7, mod:2, diff:"MED", q_en:"LIKE '%son' matches which name?", q_pt:"LIKE '%son' combina com qual nome?", opts:["Johnson","Sonny","Sony","Stone"], ans:0 },
  { id:8, mod:2, diff:"MED", q_en:"BETWEEN 10 AND 20 includes which values?", q_pt:"BETWEEN 10 AND 20 inclui quais valores?", opts:["10, 15, 20","11, 15, 19","10, 15, 19","11, 15, 20"], ans:0 },
  // Module 3: sorting
  { id:9, mod:3, diff:"EASY", q_en:"ORDER BY price DESC means?", q_pt:"ORDER BY price DESC significa?", opts:["Highest price first","Lowest price first","Alphabetical","Random"], ans:0 },
  { id:10, mod:3, diff:"MED", q_en:"What's the default sort order?", q_pt:"Qual a ordem de classificação padrão?", opts:["ASC (ascending)","DESC (descending)","Random","By ID"], ans:0 },
  // Module 4: aggregations
  { id:11, mod:4, diff:"MED", q_en:"COUNT(*) vs COUNT(col) — what's the difference?", q_pt:"COUNT(*) vs COUNT(col) — qual a diferença?", opts:["COUNT(*) counts all rows, COUNT(col) ignores NULLs","They're the same","COUNT(col) is faster","COUNT(*) only counts NULLs"], ans:0 },
  { id:12, mod:4, diff:"MED", q_en:"Which clause groups results?", q_pt:"Qual cláusula agrupa resultados?", opts:["GROUP BY","ORDER BY","CLUSTER","PARTITION"], ans:0 },
  { id:13, mod:4, diff:"MED", q_en:"HAVING is used to filter...?", q_pt:"HAVING é usado para filtrar...?", opts:["Grouped results","Individual rows","Tables","Columns"], ans:0 },
  { id:14, mod:4, diff:"HARD", q_en:"SUM(price) with GROUP BY category returns?", q_pt:"SUM(price) com GROUP BY category retorna?", opts:["Total price per category","Total of all prices","One row per product","An error"], ans:0 },
  // Module 5: joins
  { id:15, mod:5, diff:"MED", q_en:"INNER JOIN returns?", q_pt:"INNER JOIN retorna?", opts:["Only matching rows from both tables","All rows from left table","All rows from both tables","Only non-matching rows"], ans:0 },
  { id:16, mod:5, diff:"MED", q_en:"LEFT JOIN returns?", q_pt:"LEFT JOIN retorna?", opts:["All left rows + matching right rows","Only matching rows","All right rows + matching left","Only left rows"], ans:0 },
  { id:17, mod:5, diff:"HARD", q_en:"What happens to non-matching rows in a LEFT JOIN?", q_pt:"O que acontece com linhas sem match no LEFT JOIN?", opts:["Right columns show NULL","They are deleted","They cause an error","They are ignored"], ans:0 },
  { id:18, mod:5, diff:"HARD", q_en:"Which join finds customers WITHOUT orders?", q_pt:"Qual join encontra clientes SEM pedidos?", opts:["LEFT JOIN ... WHERE right.id IS NULL","INNER JOIN","RIGHT JOIN","CROSS JOIN"], ans:0 },
  // Module 6: subqueries
  { id:19, mod:6, diff:"HARD", q_en:"WHERE price > (SELECT AVG(price) FROM products) is a?", q_pt:"WHERE price > (SELECT AVG(price) FROM products) é um?", opts:["Scalar subquery","Correlated subquery","Table subquery","Invalid SQL"], ans:0 },
  { id:20, mod:6, diff:"HARD", q_en:"NOT IN (SELECT ...) finds?", q_pt:"NOT IN (SELECT ...) encontra?", opts:["Rows NOT in the subquery result","Rows IN the result","All rows","Only NULLs"], ans:0 },
  { id:21, mod:6, diff:"HARD", q_en:"When does EXISTS return TRUE?", q_pt:"Quando EXISTS retorna TRUE?", opts:["When subquery returns at least 1 row","When subquery returns 0 rows","Always","When columns match"], ans:0 },
  // Module 7: window functions
  { id:22, mod:7, diff:"HARD", q_en:"ROW_NUMBER() vs RANK() — what's different?", q_pt:"ROW_NUMBER() vs RANK() — qual a diferença?", opts:["RANK() gives same rank for ties","They're identical","ROW_NUMBER() skips numbers","RANK() is faster"], ans:0 },
  { id:23, mod:7, diff:"HARD", q_en:"What does OVER (ORDER BY date) do?", q_pt:"O que OVER (ORDER BY date) faz?", opts:["Defines the window ordering","Sorts the final result","Groups by date","Filters by date"], ans:0 },
  { id:24, mod:7, diff:"EXPERT", q_en:"LAG(col, 1) returns?", q_pt:"LAG(col, 1) retorna?", opts:["Previous row's value","Next row's value","Current value","First value"], ans:0 },
  { id:25, mod:7, diff:"EXPERT", q_en:"ROWS BETWEEN 2 PRECEDING AND CURRENT ROW defines?", q_pt:"ROWS BETWEEN 2 PRECEDING AND CURRENT ROW define?", opts:["A 3-row sliding window","2 rows after current","Only current row","All rows"], ans:0 },
  // Module 8: CTEs
  { id:26, mod:8, diff:"HARD", q_en:"CTE stands for?", q_pt:"CTE significa?", opts:["Common Table Expression","Create Table Expression","Compiled Table Entity","Complex Table Export"], ans:0 },
  { id:27, mod:8, diff:"HARD", q_en:"WITH clause defines a?", q_pt:"A cláusula WITH define um?", opts:["Temporary named result set","Permanent table","New database","Stored procedure"], ans:0 },
  { id:28, mod:8, diff:"HARD", q_en:"Can you chain multiple CTEs?", q_pt:"Pode encadear múltiplos CTEs?", opts:["Yes, separated by commas","No, only one allowed","Only with UNION","Only in PostgreSQL"], ans:0 },
  { id:29, mod:8, diff:"EXPERT", q_en:"A recursive CTE requires?", q_pt:"Um CTE recursivo requer?", opts:["UNION ALL between base and recursive case","A LOOP keyword","A FOR EACH clause","GROUP BY"], ans:0 },
  { id:30, mod:8, diff:"EXPERT", q_en:"Which is more readable for complex queries?", q_pt:"Qual é mais legível para queries complexas?", opts:["CTEs (WITH clause)","Nested subqueries","Temporary tables","Views"], ans:0 },
  // ── EXPANDED QUIZ QUESTIONS ──
  { id:31, mod:1, diff:"EASY", q_en:"SELECT name, email FROM customers returns?", q_pt:"SELECT name, email FROM customers retorna?", opts:["Only name and email columns","All columns","Only rows with name","An error"], ans:0 },
  { id:32, mod:1, diff:"EASY", q_en:"What does LIMIT 10 do?", q_pt:"O que LIMIT 10 faz?", opts:["Returns max 10 rows","Skips 10 rows","Returns 10 columns","Filters by value 10"], ans:0 },
  { id:33, mod:2, diff:"MED", q_en:"WHERE price BETWEEN 10 AND 50 includes?", q_pt:"WHERE price BETWEEN 10 AND 50 inclui?", opts:["Both 10 and 50","Only values between, not 10 or 50","Only 10","Only 50"], ans:0 },
  { id:34, mod:2, diff:"MED", q_en:"WHERE col IS NULL checks for?", q_pt:"WHERE col IS NULL verifica?", opts:["Missing/unknown values","Zero values","Empty strings","All values"], ans:0 },
  { id:35, mod:3, diff:"MED", q_en:"ORDER BY col1 ASC, col2 DESC does what?", q_pt:"ORDER BY col1 ASC, col2 DESC faz o quê?", opts:["Sorts by col1 ascending, breaks ties with col2 descending","Sorts by col2 only","Sorts randomly","Returns an error"], ans:0 },
  { id:36, mod:3, diff:"EASY", q_en:"Default ORDER BY direction is?", q_pt:"Direção padrão de ORDER BY é?", opts:["ASC (ascending)","DESC (descending)","Random","Alphabetical only"], ans:0 },
  { id:37, mod:4, diff:"MED", q_en:"SUM(NULL, 5, 10) returns?", q_pt:"SUM(NULL, 5, 10) retorna?", opts:["15 (NULLs are ignored)","NULL","0","Error"], ans:0 },
  { id:38, mod:4, diff:"HARD", q_en:"HAVING COUNT(*) > 3 filters?", q_pt:"HAVING COUNT(*) > 3 filtra?", opts:["Groups with more than 3 rows","Rows with value > 3","The first 3 groups","Nothing"], ans:0 },
  { id:39, mod:5, diff:"MED", q_en:"What does ON specify in a JOIN?", q_pt:"O que ON especifica num JOIN?", opts:["The matching condition between tables","The output columns","The sort order","The table to delete"], ans:0 },
  { id:40, mod:5, diff:"HARD", q_en:"A 3-table join requires how many JOIN clauses?", q_pt:"Join de 3 tabelas precisa de quantas cláusulas JOIN?", opts:["2","1","3","0"], ans:0 },
  { id:41, mod:6, diff:"HARD", q_en:"A correlated subquery references?", q_pt:"Uma subquery correlacionada referencia?", opts:["The outer query","Only its own tables","Nothing","A different database"], ans:0 },
  { id:42, mod:6, diff:"EXPERT", q_en:"IN vs EXISTS — which is faster for large subqueries?", q_pt:"IN vs EXISTS — qual é mais rápido para subqueries grandes?", opts:["EXISTS (stops at first match)","IN (always faster)","They're identical","Neither works"], ans:0 },
  { id:43, mod:7, diff:"HARD", q_en:"PARTITION BY in a window function acts like?", q_pt:"PARTITION BY em window function funciona como?", opts:["GROUP BY but keeps all rows","WHERE clause","ORDER BY","HAVING"], ans:0 },
  { id:44, mod:7, diff:"EXPERT", q_en:"DENSE_RANK() vs RANK() on ties?", q_pt:"DENSE_RANK() vs RANK() em empates?", opts:["DENSE_RANK doesn't skip numbers","They behave the same","RANK doesn't handle ties","DENSE_RANK skips numbers"], ans:0 },
  { id:45, mod:8, diff:"HARD", q_en:"A CTE is available for?", q_pt:"Um CTE está disponível para?", opts:["Only the immediately following query","All queries in the session","All database users","Permanent use"], ans:0 },
  { id:46, mod:8, diff:"EXPERT", q_en:"WITH a AS (...), b AS (SELECT * FROM a) — what is b?", q_pt:"WITH a AS (...), b AS (SELECT * FROM a) — o que é b?", opts:["A CTE that references another CTE","An error","A permanent table","A view"], ans:0 },
  { id:47, mod:1, diff:"EASY", q_en:"How do you comment a single line in SQL?", q_pt:"Como comentar uma linha em SQL?", opts:["-- comment","// comment","# comment","/* comment"], ans:0 },
  { id:48, mod:4, diff:"MED", q_en:"What does ROUND(3.14159, 2) return?", q_pt:"O que ROUND(3.14159, 2) retorna?", opts:["3.14","3.15","3.1","3"], ans:0 },
  // ── MODULE 9: DML quiz ──
  { id:49, mod:9, diff:"EASY", q_en:"Which SQL command permanently removes rows from a table?", q_pt:"Qual comando SQL remove linhas permanentemente de uma tabela?", opts:["DELETE","REMOVE","DROP","ERASE"], ans:0 },
  { id:50, mod:9, diff:"EASY", q_en:"Which command modifies existing column values in rows?", q_pt:"Qual comando modifica valores de colunas em linhas existentes?", opts:["UPDATE","CHANGE","MODIFY","ALTER"], ans:0 },
  { id:51, mod:9, diff:"MED", q_en:"DELETE FROM sales WHERE qty <= 0 removes...?", q_pt:"DELETE FROM sales WHERE qty <= 0 remove...?", opts:["All rows where qty is 0 or negative","All rows in the table","Only rows where qty is exactly 0","Rows where qty is NULL"], ans:0 },
  { id:52, mod:9, diff:"MED", q_en:"How do you insert multiple rows in a single INSERT statement?", q_pt:"Como inserir múltiplas linhas em um único INSERT?", opts:["INSERT INTO t VALUES (1,...),(2,...),(3,...)","INSERT MULTI INTO t","INSERT ALL INTO t","BULK INSERT t VALUES"], ans:0 },
  { id:53, mod:9, diff:"MED", q_en:"UPDATE t SET price = price * -1 WHERE price < 0 does what?", q_pt:"UPDATE t SET price = price * -1 WHERE price < 0 faz o quê?", opts:["Converts negative prices to positive (inverts sign)","Deletes all negative price rows","Sets all prices to their negative","Sets negative prices to zero"], ans:0 },
  { id:54, mod:9, diff:"HARD", q_en:"Best pattern for keeping only the lowest-id row per group of duplicates?", q_pt:"Melhor padrão para manter apenas o menor id por grupo de duplicatas?", opts:["DELETE WHERE id NOT IN (SELECT MIN(id) FROM t GROUP BY cols)","DELETE DISTINCT FROM t","UPDATE t SET is_dup = true WHERE ...","SELECT UNIQUE FROM t"], ans:0 },
  // ── MODULE 10: DDL quiz ──
  { id:55, mod:10, diff:"EASY", q_en:"Which command creates a new table in the database?", q_pt:"Qual comando cria uma nova tabela no banco de dados?", opts:["CREATE TABLE","MAKE TABLE","ADD TABLE","INIT TABLE"], ans:0 },
  { id:56, mod:10, diff:"EASY", q_en:"What does a VIEW store?", q_pt:"O que uma VIEW armazena?", opts:["A named query (not physical data)","A copy of the table's data","An index on the table","A backup snapshot"], ans:0 },
  { id:57, mod:10, diff:"MED", q_en:"CREATE VIEW v AS SELECT * FROM t WHERE active = 1 creates...?", q_pt:"CREATE VIEW v AS SELECT * FROM t WHERE active = 1 cria...?", opts:["A virtual table based on the query","A physical copy of filtered rows","A stored procedure","An index on the active column"], ans:0 },
  { id:58, mod:10, diff:"MED", q_en:"PRIMARY KEY in CREATE TABLE ensures...?", q_pt:"PRIMARY KEY no CREATE TABLE garante...?", opts:["Each row has a unique, non-NULL identifier","Rows are sorted by that column","The column has a default value","Foreign key relationships"], ans:0 },
  { id:59, mod:10, diff:"MED", q_en:"What does wrapping statements in BEGIN ... COMMIT do?", q_pt:"O que BEGIN ... COMMIT faz ao envolver instruções?", opts:["Creates a transaction: all succeed or all roll back","Comments the SQL block out","Starts and stops a loop","Creates a named savepoint"], ans:0 },
  { id:60, mod:10, diff:"HARD", q_en:"Which statement about VIEWs is TRUE?", q_pt:"Qual afirmação sobre VIEWs é VERDADEIRA?", opts:["The query runs each time the view is accessed","Views store data permanently like tables","Dropping the base table keeps the view working","Views cannot include JOINs or aggregations"], ans:0 },
];



let globalDB = null;
async function getDB() {
  if (globalDB) return globalDB;
  // Dynamically load sql.js if not present
  if (!window.initSqlJs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const SQL = await window.initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` });
  globalDB = new SQL.Database();
  globalDB.run(DB_SCHEMA);
  return globalDB;
}
function runSQL(db, sql) {
  const t0 = performance.now();
  try { const r = db.exec(sql); const ms = (performance.now()-t0).toFixed(1); if(!r.length) return {ok:true,columns:[],rows:[],ms,msg:`0 rows (${ms}ms)`}; return {ok:true,columns:r[0].columns,rows:r[0].values,ms,msg:`${r[0].values.length} rows (${ms}ms)`}; }
  catch(e) { return {ok:false,columns:[],rows:[],ms:(performance.now()-t0).toFixed(1),msg:e.message}; }
}
function validateSQL(db, userSQL, expectedSQL, verify) {
  if (verify) {
    try {
      db.exec("SAVEPOINT sp_user");
      const ur = runSQL(db, userSQL);
      if (!ur.ok) {
        db.exec("ROLLBACK TO SAVEPOINT sp_user"); db.exec("RELEASE SAVEPOINT sp_user");
        return {pass:false, msg:ur.msg, result:ur};
      }
      const vr = runSQL(db, verify);
      db.exec("ROLLBACK TO SAVEPOINT sp_user"); db.exec("RELEASE SAVEPOINT sp_user");
      db.exec("SAVEPOINT sp_exp");
      runSQL(db, expectedSQL);
      const er = runSQL(db, verify);
      db.exec("ROLLBACK TO SAVEPOINT sp_exp"); db.exec("RELEASE SAVEPOINT sp_exp");
      const vs = vr.rows.map(r=>JSON.stringify(r)).sort(), es = er.rows.map(r=>JSON.stringify(r)).sort();
      if(vs.length !== es.length) return {pass:false, msg:`Expected ${es.length} rows, got ${vs.length}`, result:vr};
      if(!vs.every((r,i)=>r===es[i])) return {pass:false, msg:"Result doesn't match expected output", result:vr};
      return {pass:true, msg:`Correct! ${vr.rows.length} rows (${vr.ms}ms)`, result:vr};
    } catch(e) {
      try { db.exec("ROLLBACK TO SAVEPOINT sp_user"); db.exec("RELEASE SAVEPOINT sp_user"); } catch(_) {}
      try { db.exec("ROLLBACK TO SAVEPOINT sp_exp"); db.exec("RELEASE SAVEPOINT sp_exp"); } catch(_) {}
      return {pass:false, msg:e.message, result:{ok:false, columns:[], rows:[], ms:'0', msg:e.message}};
    }
  }
  const ur = runSQL(db, userSQL); if(!ur.ok) return {pass:false, msg:ur.msg, result:ur};
  const er = runSQL(db, expectedSQL);
  const us = ur.rows.map(r=>JSON.stringify(r)).sort(), es = er.rows.map(r=>JSON.stringify(r)).sort();
  if(us.length !== es.length) return {pass:false, msg:`Expected ${es.length} rows, got ${us.length}`, result:ur};
  if(!us.every((r,i)=>r===es[i])) return {pass:false, msg:"Row values don't match expected output", result:ur};
  return {pass:true, msg:`Correct! ${ur.rows.length} rows (${ur.ms}ms)`, result:ur};
}
function getExpectedResult(db, ch) {
  if (ch.verify) {
    try {
      db.exec("SAVEPOINT sp_show");
      runSQL(db, ch.validate);
      const er = runSQL(db, ch.verify);
      db.exec("ROLLBACK TO SAVEPOINT sp_show"); db.exec("RELEASE SAVEPOINT sp_show");
      return er;
    } catch(e) {
      try { db.exec("ROLLBACK TO SAVEPOINT sp_show"); db.exec("RELEASE SAVEPOINT sp_show"); } catch(_) {}
      return {ok:false, columns:[], rows:[], ms:'0', msg:e.message};
    }
  }
  return runSQL(db, ch.validate);
}

// ═══════════════════════════════════════════════════════════
//  AUX KEYBOARD — Termux-style virtual keyboard
// ═══════════════════════════════════════════════════════════

// Shared key button used in both the Termux rows and the token panel
function AuxKey({ label, onPress, flex = 1, repeat = false }) {
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  const start = (e) => {
    e.preventDefault();
    onPress();
    if (repeat) {
      timerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(onPress, 80);
      }, 380);
    }
  };
  const stop = () => {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
  };

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      style={{
        flex, minHeight: 40, background: "#000000",
        border: "none",
        cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: "#FFFFFF",
        fontWeight: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, letterSpacing: 0.3, userSelect: "none",
      }}
    >
      {label}
    </button>
  );
}

function TokenChip({ text, color, onTap }) {
  const startX = useRef(0);
  return (
    <button
      // Touch: only fire if the finger didn't scroll horizontally (>8 px = scroll)
      onTouchStart={e => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const dx = Math.abs(e.changedTouches[0].clientX - startX.current);
        if (dx < 8) { e.preventDefault(); onTap(); }
      }}
      // Desktop: plain click
      onClick={onTap}
      style={{
        background: "none", border: `1px solid ${C.border}`,
        cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: color === C.cyan ? C.cyan : C.dim,
        padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0,
        letterSpacing: 0.3, lineHeight: 1.4,
      }}
    >
      {text}
    </button>
  );
}

function AuxKeyboard({ onInsert, onControl, tabsRef }) {
  const keyboardTokens = useGameStore(s => s.keyboardTokens);
  const [activeTab, setActiveTab] = useState("sql");

  const SQL_SYMBOLS = [
    "=", "!=", "<>", "<", ">", "<=", ">=",
    "(", ")", "[", "]", "'", "\"",
    "%", "_", ".", ";", "||", "::",
    "+", "-", "/", "~", "&", "|",
  ];

  const tabDefs = [
    { id: "tables",  label: "TABLES",  color: C.dim,  tokens: keyboardTokens.tables,            onTap: t => onInsert(t) },
    { id: "columns", label: "COLUMNS", color: C.dim,  tokens: ["*", ...keyboardTokens.columns], onTap: c => onInsert(c) },
    { id: "sql",     label: "SQL",     color: C.cyan, tokens: keyboardTokens.keywords,           onTap: k => onInsert(k + " ") },
    { id: "agg",     label: "AGG",     color: C.dim,  tokens: keyboardTokens.agg || [],          onTap: k => onInsert(k) },
    { id: "symbols", label: "{}",      color: C.dim,  tokens: SQL_SYMBOLS,                       onTap: s => onInsert(s) },
  ];

  const activeTokens = tabDefs.find(t => t.id === activeTab);

  // Termux row 1: ESC ( ) HOME ↑ END PGUP→top
  const row1 = [
    { label: "ESC",  onPress: () => onControl("escape") },
    { label: "(",    onPress: () => onInsert("(") },
    { label: ")",    onPress: () => onInsert(")") },
    { label: "HOME", onPress: () => onControl("home") },
    { label: "↑",    onPress: () => onControl("up"),    repeat: true },
    { label: "END",  onPress: () => onControl("end") },
    { label: "PGUP", onPress: () => onControl("top") },
  ];

  // Termux row 2: TAB , ; ← ↓ → PGDN→bottom
  const row2 = [
    { label: "TAB",  onPress: () => onInsert("  ") },
    { label: ",",    onPress: () => onInsert(",") },
    { label: ";",    onPress: () => onInsert(";") },
    { label: "←",    onPress: () => onControl("left"),  repeat: true },
    { label: "↓",    onPress: () => onControl("down"),  repeat: true },
    { label: "→",    onPress: () => onControl("right"), repeat: true },
    { label: "PGDN", onPress: () => onControl("bottom") },
  ];

  return (
    <div
      style={{ background: "#000000", flexShrink: 0, userSelect: "none", borderTop: "1px solid #222" }}
      onTouchStart={e => e.preventDefault()}
    >

      <div ref={tabsRef}>
        {/* Tab selector row */}
        <div style={{ display: "flex" }}>
          {tabDefs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onPointerDown={e => { e.preventDefault(); setActiveTab(tab.id); }}
                style={{
                  flex: 1, minHeight: 34, background: "#000000",
                  border: "none",
                  borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                  cursor: "pointer", fontFamily: F.mono, fontSize: 11,
                  color: isActive ? tab.color : "#555",
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: 1, userSelect: "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Token chip panel — visible only when a tab is active */}
        {activeTokens && (
          <div style={{
            display: "flex", overflowX: "auto", padding: "5px 8px", gap: 5,
            scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
            minHeight: 38, background: "#000000",
          }}>
            {activeTokens.tokens.length === 0 && (
              <span style={{ fontFamily: F.mono, fontSize: 11, color: "#444", alignSelf: "center" }}>
                no {activeTokens.id} loaded
              </span>
            )}
            {activeTokens.tokens.map(tok => (
              <TokenChip
                key={tok}
                text={tok}
                color={activeTokens.color}
                onTap={() => activeTokens.onTap(tok)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Termux row 1: ESC / — HOME ↑ END PGUP */}
      <div style={{ display: "flex" }}>
        {row1.map(k => <AuxKey key={k.label} label={k.label} onPress={k.onPress} repeat={!!k.repeat} />)}
      </div>

      {/* Termux row 2: TAB CTRL ALT ← ↓ → PGDN */}
      <div style={{ display: "flex" }}>
        {row2.map(k => <AuxKey key={k.label} label={k.label} onPress={k.onPress} repeat={!!k.repeat} />)}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CODE SCREEN ONBOARDING — First-time walkthrough
// ═══════════════════════════════════════════════════════════
function CodeScreenOnboarding({ onComplete, lang, editorRef, kbdRef, auxRef, schemaRef, hintRef, expectedRef, tourBtnRef, hintBarRef, bottomAreaRef, schema, hint, db, validateQuery, auxTabsRef, runBtnRef, timerAreaRef }) {
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const ispt = lang === "pt";
  const PAD = 10;

  const steps = [
    {
      ref: schemaRef,
      icon: "◈",
      color: C.cyan,
      title: ispt ? "SCHEMA" : "SCHEMA",
      body: ispt
        ? "Veja as tabelas e colunas\ndisponíveis para este desafio.\nUse para montar sua query."
        : "View the tables and columns\navailable for this challenge.\nUse them to build your query.",
    },
    {
      ref: hintRef,
      icon: "?",
      color: C.amber,
      title: ispt ? "DICAS (3 NÍVEIS)" : "HINTS (3 LEVELS)",
      body: ispt
        ? "3 dicas progressivas:\n1 · cláusula (grátis)\n2 · esqueleto (-5 xp)\n3 · preencher lacunas (-15 xp)"
        : "3 progressive hints:\n1 · clause (free)\n2 · skeleton (-5 xp)\n3 · fill-in-blank (-15 xp)",
    },
    {
      ref: expectedRef,
      icon: "✓",
      color: C.green,
      title: ispt ? "RESPOSTA ESPERADA" : "EXPECTED OUTPUT",
      body: ispt
        ? "Veja o resultado esperado\nantes de submeter para\nvalidar sua lógica."
        : "Preview the expected output\nbefore submitting to\nvalidate your logic.",
    },
    {
      ref: kbdRef,
      extraHighlightRef: editorRef,
      icon: "⌨",
      color: C.amber,
      title: ispt ? "ABRIR TECLADO" : "OPEN KEYBOARD",
      body: ispt
        ? "Toque duas vezes na tela\nou pressione este botão ⌨\npara abrir o teclado nativo."
        : "Double tap the editor\nor press this ⌨ button\nto open the native keyboard.",
    },
    {
      ref: editorRef,
      cardRef: kbdRef,
      icon: "✕",
      color: C.cyan,
      title: ispt ? "FECHAR TECLADO" : "CLOSE KEYBOARD",
      body: ispt
        ? "Com o teclado aberto,\ntoque uma vez na tela\npara fechá-lo."
        : "With the keyboard open,\ntap anywhere on the editor\nto close it.",
    },
    {
      ref: editorRef,
      cardRef: kbdRef,
      icon: "↔",
      color: C.green,
      title: ispt ? "MOVER CURSOR" : "MOVE CURSOR",
      body: ispt
        ? "Deslize o dedo para mover\no cursor suavemente.\nOu toque para posicioná-lo."
        : "Slide your finger to move\nthe cursor smoothly.\nOr tap to place it anywhere.",
    },
    {
      ref: auxTabsRef,
      secondarySpotRef: runBtnRef,
      icon: "▶",
      color: C.green,
      title: ispt ? "ESCREVER E EXECUTAR" : "TYPE & RUN",
      body: ispt
        ? "Use os botões TABLES, COLUMNS,\nSQL e AGG para inserir tokens.\nPressione ▶ RUN para executar."
        : "Use TABLES, COLUMNS, SQL & AGG\nbuttons to insert tokens.\nPress ▶ RUN to execute.",
    },
    {
      ref: timerAreaRef,
      icon: "⏱",
      color: C.amber,
      title: ispt ? "TIMER & MULTIPLICADOR" : "TIMER & MULTIPLIER",
      body: ispt
        ? "Responda rápido para ganhar\nmais XP. Toque no timer\npara pausar quando precisar."
        : "Answer fast to earn more XP.\nTap the timer to pause it\nwhenever you need a break.",
    },
    {
      ref: tourBtnRef,
      icon: "?",
      color: C.purple,
      title: ispt ? "REPETIR TUTORIAL" : "REPLAY TUTORIAL",
      body: ispt
        ? "Toque neste botão ? a qualquer\nmomento para rever este tutorial\ne relembrar os controles."
        : "Tap this ? button at any time\nto replay this tutorial\nand review the controls.",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  useEffect(() => {
    const ref = current.ref;
    if (!ref?.current) { setSpotRect(null); return; }
    const update = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setSpotRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step]);

  const done = () => {
    try { localStorage.setItem(CODE_ONBOARDING_KEY, "1"); } catch(e) {}
    onComplete();
  };

  const H = typeof window !== "undefined" ? window.innerHeight : 800;
  const sp = spotRect;
  const editorAnimRect = (step === 3 || step === 4 || step === 5) ? editorRef?.current?.getBoundingClientRect() : null;
  const rawCard = current.cardRef?.current?.getBoundingClientRect();
  const cardSp = rawCard ? { top: rawCard.top - PAD, left: rawCard.left - PAD, width: rawCard.width + PAD * 2, height: rawCard.height + PAD * 2 } : sp;
  const extraHighlightRefs = current.extraHighlightRef
    ? (Array.isArray(current.extraHighlightRef) ? current.extraHighlightRef : [current.extraHighlightRef])
    : [];
  const extraHighlightRects = extraHighlightRefs.map(ref => {
    const r = ref?.current?.getBoundingClientRect();
    return r ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null;
  }).filter(Boolean);
  const secRaw = current.secondarySpotRef?.current?.getBoundingClientRect();
  const secRect = secRaw ? { top: secRaw.top - PAD, left: secRaw.left - PAD, width: secRaw.width + PAD * 2, height: secRaw.height + PAD * 2 } : null;
  const MIN_CARD_H = 250;
  const isPreviewStep = step === 0 || step === 1 || step === 2;
  const PREVIEW_H = 150;
  const previewOffset = isPreviewStep ? PREVIEW_H + 14 : 0;
  const spaceAbove = cardSp ? cardSp.top - 14 : 0;
  const spaceBelow = cardSp ? H - (cardSp.top + cardSp.height) - 14 - previewOffset : H * 0.5;

  let tooltipPos, tooltipMaxH;
  if (!cardSp) {
    // No spotlight — center card in viewport
    tooltipPos = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    tooltipMaxH = H * 0.55;
  } else if (spaceAbove >= MIN_CARD_H && spaceAbove >= spaceBelow) {
    // Enough room above spotlight
    tooltipMaxH = spaceAbove - 8;
    tooltipPos = { bottom: H - cardSp.top + 14, left: "50%", transform: "translateX(-50%)" };
  } else if (spaceBelow >= MIN_CARD_H) {
    // Enough room below spotlight
    tooltipMaxH = spaceBelow - 8;
    tooltipPos = { top: cardSp.top + cardSp.height + 14 + previewOffset, left: "50%", transform: "translateX(-50%)" };
  } else {
    // Large spotlight: float card in the lower portion of the spotlight itself
    tooltipMaxH = Math.min(320, Math.max(200, cardSp.height * 0.55));
    tooltipPos = { top: cardSp.top + cardSp.height * 0.38, left: "50%", transform: "translateX(-50%)" };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9500, pointerEvents: "auto" }}
      onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>

      {/* Dark overlay — four panels around primary spotlight */}
      {sp ? (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: Math.max(0, sp.top), background: "rgba(0,0,0,0.88)", pointerEvents: "none" }} />
          <div style={{ position: "fixed", top: sp.top, left: 0, width: Math.max(0, sp.left), height: sp.height, background: "rgba(0,0,0,0.88)", pointerEvents: "none" }} />
          <div style={{ position: "fixed", top: sp.top, left: sp.left + sp.width, right: 0, height: sp.height, background: "rgba(0,0,0,0.88)", pointerEvents: "none" }} />
          {/* Bottom area — split into faded + dark sections when a secondary spot exists */}
          {secRect ? (
            <>
              <div style={{ position: "fixed", top: sp.top + sp.height, left: 0, right: 0, height: Math.max(0, secRect.top - (sp.top + sp.height)), background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
              <div style={{ position: "fixed", top: secRect.top, left: 0, width: Math.max(0, secRect.left), height: secRect.height, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
              <div style={{ position: "fixed", top: secRect.top, left: secRect.left + secRect.width, right: 0, height: secRect.height, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
              <div style={{ position: "fixed", top: secRect.top + secRect.height, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", pointerEvents: "none" }} />
            </>
          ) : (
            <div style={{ position: "fixed", top: sp.top + sp.height, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", pointerEvents: "none" }} />
          )}
          {/* Border — primary spotlight */}
          <div style={{ position: "fixed", top: sp.top, left: sp.left, width: sp.width, height: sp.height, border: `1px solid ${current.color}`, pointerEvents: "none" }} />
          {/* Border — secondary spot */}
          {secRect && <div style={{ position: "fixed", top: secRect.top, left: secRect.left, width: secRect.width, height: secRect.height, border: `1px solid ${current.color}`, pointerEvents: "none" }} />}
          {/* Borders — extra highlights (no cutout, rendered above overlay) */}
          {extraHighlightRects.map((rect, i) => (
            <div key={i} style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, height: rect.height, border: `1px solid ${current.color}`, pointerEvents: "none" }} />
          ))}
          {/* Gesture animation overlaid on editor area */}
          {/* Preview panel — shows example content for SCHEMA/HINT/EXPECTED steps */}
          {isPreviewStep && (
            <div style={{ position: "fixed", top: sp.top + sp.height + 4, left: 8, right: 8, maxHeight: PREVIEW_H, overflowY: "auto", overflowX: "auto", zIndex: 9501, pointerEvents: "none" }}>
              {step === 0 && schema && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11 }}>
                  {schema.split("\n").map((l, i) => {
                    const [t, ...c] = l.split(":");
                    return <div key={i} style={{ marginBottom: 3 }}><span style={{ color: C.text }}>{t.trim()}</span><span style={{ color: C.dim }}>: </span><span style={{ color: C.dim }}>{c.join(":").trim()}</span></div>;
                  })}
                </div>
              )}
              {step === 1 && hint && (
                <div style={{ background: C.amberGhost, border: `1px solid ${C.amberDim}`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, color: C.amber, lineHeight: 1.7 }}>{hint}</div>
              )}
              {step === 2 && db && validateQuery && (() => {
                const er = runSQL(db, validateQuery);
                if (!er.ok) return <div style={{ background: C.redGhost, border: `1px solid ${C.red}40`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, color: C.red }}>{er.msg}</div>;
                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.green}40`, padding: "8px 10px" }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginBottom: 6 }}>-- expected result ({er.rows.length} rows)</div>
                    {er.rows.length > 0 && (
                      <table style={{ borderCollapse: "collapse", fontFamily: F.mono, fontSize: 11 }}>
                        <thead><tr>{er.columns.map(c => <th key={c} style={{ padding: "3px 8px", borderBottom: `1px solid ${C.border}`, color: C.green, textAlign: "left", fontWeight: 400, whiteSpace: "nowrap" }}>{c}</th>)}</tr></thead>
                        <tbody>{er.rows.slice(0, 5).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} style={{ padding: "3px 8px", borderBottom: `1px solid ${C.border}10`, color: v === null ? C.dim : C.white, fontStyle: v === null ? "italic" : "normal", whiteSpace: "nowrap" }}>{v === null ? "NULL" : String(v)}</td>)}</tr>)}</tbody>
                      </table>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          {editorAnimRect && (
            <div style={{
              position: "fixed",
              top: editorAnimRect.top + editorAnimRect.height * 0.2,
              left: editorAnimRect.left + editorAnimRect.width * 0.5,
              zIndex: 9502, pointerEvents: "none",
            }}>
              {step === 5 ? (
                <>
                  {/* Swipe track */}
                  <div style={{ position: "absolute", top: 0, left: -50, width: 100, height: 1, background: `${current.color}35` }} />
                  {/* Sliding finger */}
                  <div style={{ position: "absolute", width: 14, height: 14, marginTop: -7, marginLeft: -7, background: current.color, borderRadius: "50%", animation: "swipeFingerLR 2.5s ease-in-out infinite" }} />
                  {/* Text cursor following below */}
                  <div style={{ position: "absolute", width: 2, height: 20, marginTop: 5, marginLeft: -1, background: current.color, animation: "swipeCursorLR 2.5s ease-in-out infinite" }} />
                  {/* Direction arrows */}
                  <div style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", fontFamily: F.mono, fontSize: 11, color: `${current.color}80`, letterSpacing: 8, whiteSpace: "nowrap" }}>← →</div>
                  {/* Label */}
                  <div style={{ position: "absolute", top: 34, left: "50%", transform: "translateX(-50%)", fontFamily: F.mono, fontSize: 10, color: current.color, letterSpacing: 2, whiteSpace: "nowrap" }}>
                    {ispt ? "DESLIZE" : "SWIPE"}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ position: "absolute", width: 40, height: 40, marginTop: -20, marginLeft: -20, border: `2px solid ${current.color}`, borderRadius: "50%", animation: `${step === 4 ? "tapRippleSingle" : "tapDouble1"} 2.2s ease-out infinite` }} />
                  {step === 3 && <div style={{ position: "absolute", width: 40, height: 40, marginTop: -20, marginLeft: -20, border: `2px solid ${current.color}`, borderRadius: "50%", animation: "tapDouble2 2.2s ease-out infinite" }} />}
                  <div style={{ position: "absolute", width: 8, height: 8, marginTop: -4, marginLeft: -4, background: current.color, borderRadius: "50%", animation: `${step === 4 ? "dotSingle" : "dotDouble"} 2.2s ease infinite` }} />
                  <div style={{ position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)", fontFamily: F.mono, fontSize: 10, color: current.color, letterSpacing: 2, whiteSpace: "nowrap" }}>
                    {step === 3 ? (ispt ? "TOQUE×2" : "DOUBLE TAP") : (ispt ? "TOQUE" : "TAP")}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", pointerEvents: "none" }} />
      )}

      {/* Tooltip card */}
      <div style={{
        position: "fixed", ...tooltipPos,
        width: "min(310px, 88vw)",
        maxHeight: tooltipMaxH, overflowY: "auto",
        background: C.black, border: `1px solid ${C.border}`,
        padding: "18px 20px",
        zIndex: 9501,
      }}>
        {/* Step indicator dots */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, justifyContent: "center" }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 7, height: 2,
              background: i === step ? C.cyan : C.border,
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 30, color: C.cyan }}>
            {current.icon}
          </span>
        </div>
        {/* Title */}
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.text, letterSpacing: 2.5, textAlign: "center", marginBottom: 10 }}>
          {current.title}
        </div>
        {/* Body */}
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, lineHeight: 1.9, textAlign: "center", whiteSpace: "pre-wrap", marginBottom: 18 }}>
          {current.body}
        </div>
        {/* Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onPointerDown={e => { e.preventDefault(); done(); }} style={{
            flex: 1, padding: "10px 0", cursor: "pointer", minHeight: 42,
            fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 1,
            background: "none", border: `1px solid ${C.border}`,
          }}>{ispt ? "PULAR" : "SKIP"}</button>
          <button onPointerDown={e => { e.preventDefault(); isLast ? done() : setStep(s => s + 1); }} style={{
            flex: 2, padding: "10px 0", cursor: "pointer", minHeight: 42,
            fontFamily: F.mono, fontSize: 13, color: C.cyan, fontWeight: 700, letterSpacing: 2,
            background: "none", border: `1px solid ${C.cyan}`,
          }}>{isLast ? (ispt ? "ENTENDIDO ▶" : "GOT IT ▶") : (ispt ? "PRÓXIMO ▶" : "NEXT ▶")}</button>
        </div>
      </div>
    </div>
  );
}

// ── Challenge timer durations (seconds) ──────────────────
const TIMER_DURATIONS = { EASY: 240, MED: 360, HARD: 600, EXPERT: 900 };

function getTimeMultiplier(timerSec, totalSec, expired) {
  if (expired) return 0.75;
  const frac = timerSec / totalSec;
  if (frac > 0.75) return 2.0;
  if (frac > 0.50) return 1.5;
  if (frac > 0.25) return 1.25;
  return 1.0;
}

// ═══════════════════════════════════════════════════════════
//  CHALLENGE EDITOR — Real SQL execution
// ═══════════════════════════════════════════════════════════
function ChallengeScreen({ onBack, challengeId = 1, onNext, onXP, onXPBreakdown, isDaily = false, moduleId = null, exercises = null, onExNav = null, solved = null }) {
  const { t, lang } = useLang();
  const ch = CHALLENGES_DB.find(c => c.id === challengeId) || CHALLENGES_DB[0];
  const nextCh = CHALLENGES_DB.find(c => c.id === challengeId + 1);
  const defaultSql = ch.mod >= 9 ? "" : "SELECT \n  \nFROM ";
  const totalTimerSec = TIMER_DURATIONS[ch.diff] || 360;

  const [sql, setSql] = useState(() => loadSQLDraft(challengeId) || defaultSql);
  const [result, setResult] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [resOpen, setResOpen] = useState(true);
  const [showSchema, setShowSchema] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [probOpen, setProbOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [cPos, setCPos] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [db, setDb] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [showCodeOnboarding, setShowCodeOnboarding] = useState(() => {
    try { return !localStorage.getItem(CODE_ONBOARDING_KEY); } catch(e) { return false; }
  });
  // Timer state
  const [timerSec, setTimerSec] = useState(totalTimerSec);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerIntervalRef = useRef(null);
  // XP tracking
  const [hadWrongRun, setHadWrongRun] = useState(false);
  const [wrongRunCount, setWrongRunCount] = useState(0);

  const taRef = useRef(null), edRef = useRef(null);
  const kbdBtnRef = useRef(null), auxKbRef = useRef(null);
  const hintBarRef = useRef(null), bottomAreaRef = useRef(null), auxTabsRef = useRef(null), runBtnRef = useRef(null);
  const schemaBtnRef = useRef(null), hintBtnRef = useRef(null), expectedBtnRef = useRef(null), tourBtnRef = useRef(null), timerAreaRef = useRef(null);
  const bsTimerRef = useRef(null), bsIntervalRef = useRef(null);
  // Mirrors current sql/cPos/editing without stale-closure issues in repeat callbacks
  const sqlRef = useRef(sql);
  const cPosRef = useRef(0);
  const editingRef = useRef(false);
  useEffect(() => { sqlRef.current = sql; }, [sql]);
  useEffect(() => { cPosRef.current = cPos; }, [cPos]);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { saveSQLDraft(challengeId, sql); }, [challengeId, sql]);

  // Android back button closes the keyboard instead of navigating away
  useEffect(() => {
    if (!isTouch.current) return;
    const onPop = () => {
      if (editingRef.current) {
        taRef.current?.blur();
        setEditing(false);
        history.pushState(null, ""); // restore the state we just popped
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Push a history entry whenever keyboard opens so back-button can pop it
  useEffect(() => {
    if (!isTouch.current) return;
    if (editing) history.pushState({ kbd: true }, "");
  }, [editing]);
  // Saved before entering history navigation; restored on ↓ back to present
  const historyDraftRef = useRef("");

  // Syntax highlight — memoised tokenizer output
  const hlTables  = useMemo(() => ch.schema.split("\n").map(l => l.split(":")[0].trim()).filter(Boolean), [ch.schema]);
  const hlColumns = useMemo(() => ch.schema.split("\n").flatMap(l => { const p = l.split(":"); return p.length > 1 ? p.slice(1).join(":").split(",").map(c => c.trim()) : []; }).filter(Boolean), [ch.schema]);
  const hlTokens  = useMemo(() => tokenizeSQL(sql, hlTables, hlColumns), [sql, hlTables, hlColumns]);

  // Zustand store — set active challenge for keyboard token loading
  const { setActiveChallenge, pushQueryHistory, navigateHistory, resetHistoryIndex, setCursorPosition } = useGameStore(
    useShallow(s => ({
      setActiveChallenge: s.setActiveChallenge,
      pushQueryHistory: s.pushQueryHistory,
      navigateHistory: s.navigateHistory,
      resetHistoryIndex: s.resetHistoryIndex,
      setCursorPosition: s.setCursorPosition,
    }))
  );

  useEffect(() => {
    setActiveChallenge(ch);
    const draft = loadSQLDraft(challengeId);
    setSql(draft || defaultSql);
    setCPos(0);
    setVerdict(null);
    setResult(null);
    setShowHint(false);
    setHintLevel(0);
    setShowExplain(false);
    // Reset timer and tracking
    setTimerSec(TIMER_DURATIONS[ch.diff] || 360);
    setTimerPaused(false);
    setTimerExpired(false);
    setHadWrongRun(false);
    setWrongRunCount(0);
    return () => setActiveChallenge(null);
  }, [challengeId]);

  useEffect(() => { getDB().then(d => { setDb(d); setDbReady(true); }); }, []);

  // Timer countdown
  useEffect(() => {
    if (verdict?.pass || timerPaused || timerExpired || showCodeOnboarding) {
      clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setTimerSec(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          setTimerExpired(true);
          SFX.play("wrong");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerIntervalRef.current);
  }, [timerPaused, timerExpired, verdict?.pass, showCodeOnboarding]);

  // Auto-open explanation when challenge is correctly solved
  useEffect(() => { if (verdict?.pass) setShowExplain(true); }, [verdict]);

  // Measure char width and line height from DOM (not canvas — canvas uses different font metrics)
  const [charW, setCharW] = useState(10.8);
  const [lineH, setLineH] = useState(36);
  const measRef = useRef(null);
  useEffect(() => {
    const measure = () => {
      // Measure charW from a hidden span with identical styles
      if (measRef.current) {
        const rect = measRef.current.getBoundingClientRect();
        if (rect.width > 0) setCharW(rect.width / 20); // 20 chars in the span
      }
      // Measure lineH from textarea computed style
      const ta = taRef.current;
      if (ta) {
        const style = window.getComputedStyle(ta);
        const lh = parseFloat(style.lineHeight);
        if (!isNaN(lh) && lh > 0) setLineH(lh);
      }
    };
    requestAnimationFrame(measure);
    setTimeout(measure, 500); // remeasure after font loads
  }, []);

  // Cursor position from cPos
  const cursorLines = sql.substring(0, cPos).split("\n");
  const cRow = cursorLines.length - 1;
  const cCol = cursorLines[cursorLines.length - 1].length;

  const tapToPos = (x, y) => {
    const r = edRef.current?.getBoundingClientRect(); if (!r) return cPos;
    const row = Math.max(0, Math.floor((y - r.top - 14) / lineH));
    const col = Math.max(0, Math.round((x - r.left - 18 + charW * 0.5) / charW));
    const ls = sql.split("\n"), cr = Math.min(row, ls.length - 1), cc = Math.min(col, ls[cr].length);
    let p = 0; for (let i = 0; i < cr; i++) p += ls[i].length + 1; return p + cc;
  };

  const lastTapTime = useRef(0);
  const swipeStart = useRef({ x: 0, y: 0, pos: 0 });
  const isSwiping = useRef(false);
  // True on real touch devices; false on desktop/mouse
  const isTouch = useRef(false);
  useEffect(() => {
    isTouch.current = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    // Desktop: auto-focus the textarea immediately so physical keyboard is always ready
    if (!isTouch.current) {
      setEditing(true);
      requestAnimationFrame(() => { taRef.current?.focus(); });
    }
  }, []);

  // Desktop mouse click only — touch is handled entirely by onEditorTouch*
  const onTap = (e) => {
    if (isTouch.current) return;
    const newPos = tapToPos(e.clientX, e.clientY);
    setCPos(newPos);
    // Re-focus in case the user clicked outside and lost focus
    taRef.current?.focus();
  };

  const onEditorTouchStart = (e) => {
    e.preventDefault(); // block synthetic mouse/focus events from reaching textarea
    const touch = e.touches?.[0];
    if (!touch) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY, pos: cPosRef.current };
    isSwiping.current = false;
  };

  const onEditorTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStart.current.x;
    const dy = touch.clientY - swipeStart.current.y;

    if (!isSwiping.current && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    isSwiping.current = true;

    const charOffset = Math.round(dx / (charW * 1.5));
    const lineOffset = Math.round(dy / (lineH * 0.8));
    const startPos = swipeStart.current.pos;
    const lines = sqlRef.current.split("\n");
    let count = 0, startRow = 0, startCol = 0;
    for (let i = 0; i < lines.length; i++) {
      if (count + lines[i].length >= startPos) { startRow = i; startCol = startPos - count; break; }
      count += lines[i].length + 1;
    }
    const newRow = Math.max(0, Math.min(lines.length - 1, startRow + lineOffset));
    const newCol = Math.max(0, Math.min(lines[newRow].length, startCol + charOffset));
    let newPos = 0;
    for (let i = 0; i < newRow; i++) newPos += lines[i].length + 1;
    const finalPos = newPos + newCol;
    setCPos(finalPos);
    if (editingRef.current && taRef.current) {
      taRef.current.setSelectionRange(finalPos, finalPos);
    }
  };

  const onEditorTouchEnd = (e) => {
    e.preventDefault(); // block synthetic click that would re-focus textarea
    if (!isSwiping.current) {
      const touch = e.changedTouches?.[0];
      if (touch) setCPos(tapToPos(touch.clientX, touch.clientY));

      const now = Date.now();
      const isDouble = now - lastTapTime.current < 300;
      lastTapTime.current = isDouble ? 0 : now; // reset after double so triple doesn't retrigger

      if (editingRef.current) {
        // Any tap while keyboard is open → close it
        toggleKeyboard();
      } else if (isDouble) {
        // Double tap while closed → open keyboard
        toggleKeyboard();
      }
      // Single tap while closed → just reposition cursor (already done above)
    } else if (editingRef.current) {
      // Swipe ended while keyboard is open — keep keyboard open, restore textarea focus
      taRef.current?.focus();
    }
    isSwiping.current = false;
  };

  const onDrag = (e) => { e.preventDefault(); const touch = e.touches?.[0]; if (touch) setCPos(tapToPos(touch.clientX, touch.clientY)); };
  // Use functional updates so cPos is always current
  const insert = (text) => {
    setCPos(prev => {
      setSql(s => s.substring(0, prev) + text + s.substring(prev));
      return prev + text.length;
    });
  };

  // Smart Enter for the UI ↵ button — applies the same indentation logic as the physical key
  const smartEnter = useCallback(() => {
    const pos = cPosRef.current;
    const text = sqlRef.current;
    const ins = sqlSmartNewline(text, pos);
    const newSql = text.substring(0, pos) + ins + text.substring(pos);
    const newPos = pos + ins.length;
    setSql(newSql);
    sqlRef.current = newSql;
    setCPos(newPos);
    cPosRef.current = newPos;
    if (taRef.current) {
      requestAnimationFrame(() => {
        if (taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(newPos, newPos); }
      });
    }
  }, []);
  const backspace = () => {
    setCPos(prev => {
      if (prev <= 0) return prev;
      setSql(s => s.substring(0, prev - 1) + s.substring(prev));
      return prev - 1;
    });
  };
  // Auto-scroll editor to keep cursor visible
  useEffect(() => {
    const ed = edRef.current;
    if (!ed) return;
    const cursorTop = 14 + cRow * lineH;
    const cursorLeft = 18 + cCol * charW;
    const edH = ed.clientHeight;
    const edW = ed.clientWidth;
    // Vertical: scroll if cursor is outside visible area
    if (cursorTop < ed.scrollTop + 10) {
      ed.scrollTop = Math.max(0, cursorTop - 20);
    } else if (cursorTop + lineH > ed.scrollTop + edH - 10) {
      ed.scrollTop = cursorTop + lineH - edH + 20;
    }
    // Horizontal: scroll if cursor is outside visible area
    if (cursorLeft < ed.scrollLeft + 30) {
      ed.scrollLeft = Math.max(0, cursorLeft - 40);
    } else if (cursorLeft > ed.scrollLeft + edW - 40) {
      ed.scrollLeft = cursorLeft - edW + 60;
    }
  }, [cRow, cCol, charW, lineH]);

  // Scroll helpers for arrow buttons
  const scrollEditor = (dir) => {
    const ed = edRef.current;
    if (!ed) return;
    if (dir === "up") ed.scrollTop = Math.max(0, ed.scrollTop - lineH * 3);
    if (dir === "down") ed.scrollTop += lineH * 3;
    if (dir === "left") ed.scrollLeft = Math.max(0, ed.scrollLeft - charW * 10);
    if (dir === "right") ed.scrollLeft += charW * 10;
  };
  const kbToggling = useRef(false);
  const toggleKeyboard = () => {
    kbToggling.current = true;
    if (editing) { taRef.current?.blur(); setEditing(false); }
    else { setEditing(true); setTimeout(() => { const ta = taRef.current; if (ta) { ta.focus(); ta.setSelectionRange(cPos, cPos); } kbToggling.current = false; }, 100); }
    setTimeout(() => { kbToggling.current = false; }, 300);
  };
  const handleBlur = () => {
    setTimeout(() => { if (!kbToggling.current) setEditing(false); }, 200);
  };
  const computeXPBreakdown = (isCorrect, isFirst) => {
    const base = ch.diff === "EASY" ? 25 : ch.diff === "MED" ? 50 : ch.diff === "HARD" ? 75 : 100;
    const hintPen = HINT_XP_PENALTIES[hintLevel] || 0;
    const noHintBonus = hintLevel === 0 ? 5 : 0;
    const firstTryBonus = !hadWrongRun && hintLevel === 0;
    const timeMult = getTimeMultiplier(timerSec, totalTimerSec, timerExpired);
    const perseveranceBonus = timerExpired ? 10 : 0;
    const dailyBonus = isDaily ? 100 : 0;
    const baseMod = Math.max(0, base - hintPen + noHintBonus);
    const firstTryFactor = firstTryBonus ? 1.1 : 1.0;
    const withMults = Math.round(baseMod * timeMult * firstTryFactor);
    const total = isFirst ? Math.max(5, withMults + perseveranceBonus) + dailyBonus : 0;
    return { base, diff: ch.diff, hintPenalty: hintPen, noHintBonus, firstTryBonus, timeMultiplier: timeMult, perseveranceBonus, dailyBonus, total, isFirstSolve: isFirst };
  };

  const handleRun = () => {
    if (!db) return;
    const trimmed = sql.trim();
    pushQueryHistory(trimmed);
    resetHistoryIndex();

    const processResult = (v, r) => {
      setVerdict(v);
      if (v.pass) {
        SFX.play("correct");
        const isFirst = !solved?.has(ch.id);
        const bd = computeXPBreakdown(true, isFirst);
        if (isFirst) {
          if (onXPBreakdown) onXPBreakdown(bd);
          if (onXP) onXP(bd.total, ch.id, { submitted_sql: trimmed, is_correct: true, xp_earned: bd.total, is_first_try: !hadWrongRun, had_hints: hintLevel > 0 });
        }
      } else {
        SFX.play("wrong");
        setHadWrongRun(true);
        setWrongRunCount(c => c + 1);
        if (onXP) onXP(0, ch.id, { submitted_sql: trimmed, is_correct: false, xp_earned: 0 });
      }
    };

    if (ch.verify) {
      let r;
      try {
        db.exec("SAVEPOINT sp_run");
        const ur = runSQL(db, trimmed);
        if (!ur.ok) {
          db.exec("ROLLBACK TO SAVEPOINT sp_run"); db.exec("RELEASE SAVEPOINT sp_run");
          setResult(ur); setVerdict(null); SFX.play("wrong");
          setHadWrongRun(true); setWrongRunCount(c => c + 1);
          if (onXP) onXP(0, ch.id, { submitted_sql: trimmed, is_correct: false, xp_earned: 0 });
          setResOpen(true); setOpenPanel(null); return;
        }
        r = runSQL(db, ch.verify);
        db.exec("ROLLBACK TO SAVEPOINT sp_run"); db.exec("RELEASE SAVEPOINT sp_run");
      } catch(e) {
        try { db.exec("ROLLBACK TO SAVEPOINT sp_run"); db.exec("RELEASE SAVEPOINT sp_run"); } catch(_) {}
        const er = {ok:false, columns:[], rows:[], ms:'0', msg:e.message};
        setResult(er); setVerdict(null); SFX.play("wrong");
        setHadWrongRun(true); setWrongRunCount(c => c + 1);
        if (onXP) onXP(0, ch.id, { submitted_sql: trimmed, is_correct: false, xp_earned: 0 });
        setResOpen(true); setOpenPanel(null); return;
      }
      setResult(r);
      processResult(validateSQL(db, trimmed, ch.validate, ch.verify), r);
    } else {
      const r = runSQL(db, trimmed);
      setResult(r);
      if (r.ok) {
        processResult(validateSQL(db, sql.trim(), ch.validate), r);
      } else {
        setVerdict(null);
        SFX.play("wrong");
        setHadWrongRun(true); setWrongRunCount(c => c + 1);
        if (onXP) onXP(0, ch.id, { submitted_sql: sql.trim(), is_correct: false, xp_earned: 0 });
      }
    }
    setResOpen(true);
    setOpenPanel(null);
  };
  const clearResult = () => { setResult(null); setVerdict(null); setShowExplain(false); };
  const resetSQL = () => { setSql(defaultSql); setCPos(defaultSql.length); setResult(null); setVerdict(null); };
  const desc = lang === "pt" ? ch.desc_pt : ch.desc_en;

  // AuxKeyboard handlers
  const handleAuxInsert = useCallback((text) => {
    // Smart close paren: dedent to matching open paren's indent level (mirrors physical ) key)
    if (text === ")") {
      const result = sqlSmartCloseParen(sqlRef.current, cPosRef.current);
      if (result) {
        const newSql = sqlRef.current.substring(0, result.lineStart) + result.ins + sqlRef.current.substring(cPosRef.current);
        const newPos = result.lineStart + result.ins.length;
        setSql(newSql);
        sqlRef.current = newSql;
        setCPos(newPos);
        cPosRef.current = newPos;
        if (editing && taRef.current) {
          requestAnimationFrame(() => { if (taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(newPos, newPos); } });
        }
        return;
      }
    }
    // Smart leading space: if inserting a word token and the char before cursor
    // is not already whitespace / opening bracket, prepend a space
    const isWord = /^[A-Za-z_]/.test(text);
    if (isWord) {
      const before = sqlRef.current.substring(0, cPos);
      if (before.length > 0 && !/[\s(,]$/.test(before)) {
        text = " " + text;
      }
    }
    insert(text);
    // Keep native keyboard open if already editing
    if (editing && taRef.current) {
      const ta = taRef.current;
      requestAnimationFrame(() => {
        ta.focus();
        setCPos(prev => { ta.setSelectionRange(prev, prev); return prev; });
      });
    }
  }, [insert, editing, cPos]);

  const handleAuxControl = useCallback((action) => {
    if (action === "escape") { onBack(); return; }

    // Always read cPosRef.current so repeat-interval calls see the latest position
    const moveTo = (newPos) => {
      cPosRef.current = newPos;
      setCPos(newPos);
      requestAnimationFrame(() => {
        if (taRef.current) {
          taRef.current.focus();
          taRef.current.setSelectionRange(newPos, newPos);
        }
      });
    };

    const pos = cPosRef.current;
    if (action === "left") {
      moveTo(Math.max(0, pos - 1));
    } else if (action === "right") {
      moveTo(Math.min(sqlRef.current.length, pos + 1));
    } else if (action === "up" || action === "down") {
      const s = sqlRef.current;
      const lines = s.split("\n");
      let rem = pos, lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (rem <= lines[i].length) { lineIdx = i; break; }
        rem -= lines[i].length + 1;
      }
      const col = rem;
      const targetLine = lineIdx + (action === "up" ? -1 : 1);
      if (targetLine < 0 || targetLine >= lines.length) return;
      let newPos = 0;
      for (let i = 0; i < targetLine; i++) newPos += lines[i].length + 1;
      moveTo(newPos + Math.min(col, lines[targetLine].length));
    } else if (action === "home") {
      moveTo(sqlRef.current.lastIndexOf("\n", pos - 1) + 1);
    } else if (action === "end") {
      const s = sqlRef.current;
      const lineEnd = s.indexOf("\n", pos);
      moveTo(lineEnd === -1 ? s.length : lineEnd);
    } else if (action === "top") {
      moveTo(0);
    } else if (action === "bottom") {
      moveTo(sqlRef.current.length);
    }
  }, [onBack]);

  const handleHistoryNav = useCallback((direction) => {
    const isUp = direction === "up";
    // Save draft the moment we leave the "current" position
    if (isUp && useGameStore.getState().historyIndex === -1) {
      historyDraftRef.current = sqlRef.current;
    }
    const query = navigateHistory(isUp ? 1 : -1);
    if (query !== null) {
      setSql(query);
      setCPos(query.length);
    } else if (!isUp) {
      // ↓ past the most recent entry → restore the pre-navigation draft
      const draft = historyDraftRef.current;
      setSql(draft);
      setCPos(draft.length);
    }
  }, [navigateHistory]);

  // Schema viewer: handle `.schema` command typed in the editor
  const schemaOutput = (() => {
    const s = sql.trim().toLowerCase();
    if (s === ".schema" || s === ".tables") {
      return ch.schema.split("\n").filter(l => l.indexOf(':') !== -1).map(l => {
        const ci = l.indexOf(':');
        return { table: l.slice(0, ci).trim(), cols: l.slice(ci + 1).trim() };
      });
    }
    return null;
  })();

  // Desktop keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
      if (e.key === "Escape") { e.preventDefault(); onBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sql, db]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000000", position: "relative" }}>

      {/* Hamburger exercise list overlay (lesson mode) */}
      {menuOpen && exercises && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.97)", zIndex: 200, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.cyan, letterSpacing: 1 }}>// exercises</span>
            <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.dim, padding: "3px 10px" }}>✕</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
            {exercises.map((ex, i) => {
              const isCurrent = ex.id === challengeId;
              const isCompleted = solved?.has(ex.id);
              return (
                <button key={ex.id} onClick={() => { onExNav?.(ex.id); setMenuOpen(false); }} style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: isCurrent ? C.panel : "none",
                  border: "none", borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer", padding: "12px 16px", textAlign: "left",
                  touchAction: "pan-y",
                }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: isCurrent ? C.cyan : C.muted, minWidth: 24 }}>{i + 1}.</span>
                  <span style={{ fontFamily: F.mono, fontSize: 13, color: isCurrent ? C.cyan : C.text, flex: 1 }}>{ex.title}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, padding: "1px 5px" }}>{ex.diff}</span>
                  {isCompleted && <span style={{ color: C.green, fontSize: 13, fontFamily: F.mono }}>✓</span>}
                  {isCurrent && <span style={{ color: C.cyan, fontSize: 12 }}>◀</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Header — always visible */}
      <div style={{ padding: "5px 12px", borderBottom: `1px solid ${C.border}`, background: C.black, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: C.dim, padding: "4px 10px", minHeight: 28 }}>←</button>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>#{ch.id}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.green, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.title}</span>
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, border: `1px solid ${C.border}`, padding: "2px 6px" }}>{ch.diff}</span>
        {exercises && (
          <button onClick={() => setMenuOpen(true)} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 16, color: C.dim, padding: "2px 8px", minHeight: 28, lineHeight: 1 }}>☰</button>
        )}
      </div>

      {/* Problem description — collapsible */}
      <button onClick={() => setProbOpen(!probOpen)} style={{
        background: C.black, border: "none", borderBottom: `1px solid ${C.border}`,
        cursor: "pointer", textAlign: "left", width: "100%",
        padding: "5px 12px", display: "flex", alignItems: probOpen ? "flex-start" : "center", gap: 6, flexShrink: 0,
      }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.dim }}>{probOpen ? "▼" : "▶"}</span>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.white, overflow: "hidden", textOverflow: probOpen ? "unset" : "ellipsis", whiteSpace: probOpen ? "normal" : "nowrap", flex: 1, lineHeight: 1.6 }}>
          <span style={{ color: C.dim }}>-- </span>{desc}
        </div>
      </button>
      {probOpen && (
        <div style={{ padding: "8px 12px 10px", borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, animation: "fadeSlide 0.15s ease" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button ref={schemaBtnRef} onClick={e => { e.stopPropagation(); setShowSchema(!showSchema); }} style={{ background: "none", border: `1px solid ${showSchema ? C.cyan : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: showSchema ? C.cyan : C.dim, padding: "4px 8px" }}>{showSchema ? "hide_schema" : ".schema"}</button>
            <button ref={hintBtnRef} onClick={e => { e.stopPropagation(); if (hintLevel === 0) { setHintLevel(1); setShowHint(true); } else { setShowHint(!showHint); } }} style={{ background: "none", border: `1px solid ${showHint && hintLevel > 0 ? C.dim : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: showHint && hintLevel > 0 ? C.dim : C.muted, padding: "4px 8px" }}>{showHint && hintLevel > 0 ? "hide_hint" : hintLevel > 1 ? `hints(-${HINT_XP_PENALTIES[hintLevel]}xp)` : "hint"}</button>
            <button ref={expectedBtnRef} onClick={e => { e.stopPropagation(); setShowExpected(!showExpected); }} style={{ background: "none", border: `1px solid ${showExpected ? C.dim : C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: showExpected ? C.dim : C.muted, padding: "4px 8px" }}>{showExpected ? "hide_expected" : "expected"}</button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {TAG_META[ch.tag] && (
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, padding: "4px 8px", letterSpacing: 0.5, userSelect: "none" }}>
                  [ {lang === "pt" ? TAG_META[ch.tag].label_pt : TAG_META[ch.tag].label_en} ]
                </span>
              )}
              <button ref={tourBtnRef} onClick={e => { e.stopPropagation(); setProbOpen(true); setShowCodeOnboarding(true); }} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "4px 8px" }}>?</button>
            </div>
          </div>
          {showSchema && (
            <div style={{ marginTop: 8, background: C.surface, border: `1px solid ${C.border}`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, animation: "fadeSlide 0.15s ease" }}>
              {ch.schema.split("\n").map((l, i) => {
                const ci = l.indexOf(':');
                if (ci === -1) return <div key={i} style={{ marginBottom: 3 }}><span style={{ color: C.dim }}>{l.trim()}</span></div>;
                return <div key={i} style={{ marginBottom: 3 }}><span style={{ color: C.text }}>{l.slice(0, ci).trim()}</span><span style={{ color: C.dim }}>: </span><span style={{ color: C.dim }}>{l.slice(ci + 1).trim()}</span></div>;
              })}
            </div>
          )}
          {showHint && hintLevel > 0 && (
            <div style={{ marginTop: 8, animation: "fadeSlide 0.15s ease" }}>
              {/* Hint 1 — clause hint, free */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.dim}`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>// hint_1 · clause</div>
                <span style={{ whiteSpace: "pre-wrap" }}>{ch.hint}</span>
              </div>
              {/* Unlock Hint 2 */}
              {hintLevel === 1 && (
                <button onClick={() => setHintLevel(2)} style={{ marginTop: 5, background: "none", border: `1px dashed ${C.borderBright}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "6px 10px", width: "100%", textAlign: "left", display: "block" }}>
                  {lang === "pt" ? "▸ dica 2 — custo: -5 xp ao resolver" : "▸ hint 2 — cost: -5 xp on solve"}
                </button>
              )}
              {/* Hint 2 — skeleton query */}
              {hintLevel >= 2 && (
                <div style={{ marginTop: 5, background: C.surface, border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.dim}`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>// hint_2 · skeleton (-5 xp)</div>
                  <span style={{ whiteSpace: "pre-wrap" }}>{getHint2(ch)}</span>
                </div>
              )}
              {/* Unlock Hint 3 */}
              {hintLevel === 2 && (
                <button onClick={() => setHintLevel(3)} style={{ marginTop: 5, background: "none", border: `1px dashed ${C.borderBright}`, cursor: "pointer", fontFamily: F.mono, fontSize: 11, color: C.dim, padding: "6px 10px", width: "100%", textAlign: "left", display: "block" }}>
                  {lang === "pt" ? "▸ dica 3 — custo: -15 xp ao resolver" : "▸ hint 3 — cost: -15 xp on solve"}
                </button>
              )}
              {/* Hint 3 — fill-in-the-blank */}
              {hintLevel >= 3 && (
                <div style={{ marginTop: 5, background: C.surface, border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.dim}`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>// hint_3 · fill-in-the-blank (-15 xp)</div>
                  <span style={{ whiteSpace: "pre-wrap" }}>{getHint3(ch)}</span>
                </div>
              )}
            </div>
          )}
          {showExpected && db && (() => {
            const er = getExpectedResult(db, ch);
            if (!er.ok) return <div style={{ marginTop: 8, background: C.redGhost, border: `1px solid ${C.red}40`, padding: "8px 10px", fontFamily: F.mono, fontSize: 11, color: C.red }}>{er.msg}</div>;
            const label = ch.verify ? "-- state after operation" : "-- expected result";
            return (
              <div style={{ marginTop: 8, background: C.surface, border: `1px solid ${C.green}40`, padding: "8px 10px", overflowX: "auto" }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginBottom: 6 }}>{label} ({er.rows.length} rows)</div>
                {er.rows.length > 0 && (
                  <table style={{ borderCollapse: "collapse", fontFamily: F.mono, fontSize: 11 }}>
                    <thead><tr>{er.columns.map(c => <th key={c} style={{ padding: "3px 8px", borderBottom: `1px solid ${C.border}`, color: C.green, textAlign: "left", fontWeight: 400, whiteSpace: "nowrap" }}>{c}</th>)}</tr></thead>
                    <tbody>{er.rows.slice(0, 20).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} style={{ padding: "3px 8px", borderBottom: `1px solid ${C.border}10`, color: v === null ? C.dim : C.white, fontStyle: v === null ? "italic" : "normal", whiteSpace: "nowrap" }}>{v === null ? "NULL" : String(v)}</td>)}</tr>)}</tbody>
                  </table>
                )}
              </div>
            );
          })()}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Hidden measurement span — same font/size as textarea */}
        <span ref={measRef} style={{ position: "absolute", visibility: "hidden", fontFamily: F.mono, fontSize: 18, whiteSpace: "pre", pointerEvents: "none" }}>XXXXXXXXXXXXXXXXXXXX</span>
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {/* Scroll arrows — positioned over the editor, not inside scroll */}
          <div onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 4, zIndex: 30, pointerEvents: "auto" }}>
            <button onClick={(e) => { e.stopPropagation(); scrollEditor("up"); }} style={{ background: `${C.black}E0`, border: `1px solid ${C.border}`, cursor: "pointer", padding: "8px 10px", fontFamily: F.mono, fontSize: 16, color: C.dim, lineHeight: 1 }}>▲</button>
            <button onClick={(e) => { e.stopPropagation(); scrollEditor("down"); }} style={{ background: `${C.black}E0`, border: `1px solid ${C.border}`, cursor: "pointer", padding: "8px 10px", fontFamily: F.mono, fontSize: 16, color: C.dim, lineHeight: 1 }}>▼</button>
          </div>
          <div ref={edRef} style={{ height: "100%", padding: "8px 18px", overflowY: "scroll", overflowX: "scroll", background: `linear-gradient(180deg,${C.void},${C.black})`, position: "relative", touchAction: "none" }}
            onTouchStart={onEditorTouchStart} onTouchMove={onEditorTouchMove} onTouchEnd={onEditorTouchEnd} onClick={onTap}>
            {/* Custom cursor handle — hidden when keyboard is open */}
          {!editing && <div onTouchMove={onDrag} onTouchStart={e => e.stopPropagation()} style={{ position: "absolute", left: `${18 + cCol * charW - charW}px`, top: `${14 + cRow * lineH}px`, zIndex: 10, pointerEvents: "auto", touchAction: "none", transition: "left 0.05s,top 0.05s" }}>
              <div style={{ fontFamily: F.mono, fontSize: 18, color: C.cyan, lineHeight: 2, animation: "blink 1s step-end infinite", userSelect: "none" }}>█</div>
            </div>}
            {!dbReady && <div style={{ position: "absolute", top: 12, left: 18, fontFamily: F.mono, fontSize: 14, color: C.amber, animation: "blink 1s step-end infinite" }}>loading sql engine...</div>}
            {/* Syntax highlight layer — mirrors textarea content with token colors */}
            <pre aria-hidden style={{
              position: "absolute", top: 8, left: 18, right: 18,
              margin: 0, paddingTop: 6, border: "none",
              fontFamily: F.mono, fontSize: 18, lineHeight: 2,
              whiteSpace: "pre", wordWrap: "normal", overflowWrap: "normal", tabSize: 2,
              color: TOKEN_COLORS.text, background: "transparent",
              pointerEvents: "none", zIndex: 1, userSelect: "none",
            }}>
              {sql === ""
                ? <span style={{ color: "#333" }}>{"-- write SQL here"}</span>
                : hlTokens.map((tok, i) => (
                    <span key={i} style={{ color: TOKEN_COLORS[tok.type] }}>{tok.value}</span>
                  ))
              }
            </pre>
            <textarea
              ref={taRef}
              value={sql}
              onChange={e => { setSql(e.target.value); setCPos(e.target.selectionStart || 0); }}
              onBlur={handleBlur}
              onSelect={e => setCPos(e.target.selectionStart || 0)}
              onFocus={() => { if (!isTouch.current) setEditing(true); }}
              onKeyDown={e => {
                const pos = e.target.selectionStart;
                const text = e.target.value;

                if (e.key === "Enter") {
                  e.preventDefault();
                  const ins = sqlSmartNewline(text, pos);
                  setSql(text.substring(0, pos) + ins + text.substring(pos));
                  const newPos = pos + ins.length;
                  setCPos(newPos);
                  requestAnimationFrame(() => { if (taRef.current) { taRef.current.setSelectionRange(newPos, newPos); } });
                } else if (e.key === "Tab") {
                  e.preventDefault();
                  setSql(text.substring(0, pos) + "  " + text.substring(pos));
                  const newPos = pos + 2;
                  setCPos(newPos);
                  requestAnimationFrame(() => { if (taRef.current) { taRef.current.setSelectionRange(newPos, newPos); } });
                } else if (e.key === ")") {
                  const result = sqlSmartCloseParen(text, pos);
                  if (result) {
                    e.preventDefault();
                    setSql(text.substring(0, result.lineStart) + result.ins + text.substring(pos));
                    const newPos = result.lineStart + result.ins.length;
                    setCPos(newPos);
                    requestAnimationFrame(() => { if (taRef.current) { taRef.current.setSelectionRange(newPos, newPos); } });
                  }
                }
              }}
              readOnly={isTouch.current && !editing}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              placeholder="-- write SQL here"
              style={{
                position: "relative", zIndex: 2,
                width: "100%",
                minHeight: `${Math.max(200, (sql.split("\n").length + 3) * lineH)}px`,
                background: "transparent", border: "none", color: "transparent",
                fontFamily: F.mono, fontSize: 18, lineHeight: 2, resize: "none", tabSize: 2,
                outline: "none", caretColor: editing ? C.cyan : "transparent",
                paddingTop: 6, cursor: "text", whiteSpace: "pre",
                overflowX: "hidden", overflowY: "hidden",
                wordWrap: "normal", overflowWrap: "normal",
                touchAction: isTouch.current ? "none" : "auto",
              }}
            />
          </div>
        </div>
        {/* Hint bar */}
        <div ref={hintBarRef} style={{ padding: "2px 0", textAlign: "center", fontFamily: F.mono, fontSize: 10, color: C.muted, background: C.black, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          {!dbReady ? "loading sql engine..." : "swipe to move cursor · tap to focus"}
        </div>
        {/* Results — shown in BOTH modes */}
        {result && (
          <div style={{ background: C.black, borderTop: `2px solid ${result.ok ? (verdict?.pass ? C.green : C.cyan) : C.red}`, flexShrink: 0 }}>
            {verdict && <div style={{ padding: "8px 16px", fontFamily: F.mono, fontSize: 15, color: verdict.pass ? C.green : C.red, background: C.panel, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }}>{verdict.pass ? "✓" : "✗"}</span>
              <span style={{ flex: 1 }}>{verdict.msg}</span>
              {verdict.pass && SOLUTION_EXPLANATIONS[ch.id] && (
                <button onClick={() => setShowExplain(v => !v)} style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, background: "none", border: `1px solid ${C.border}`, padding: "6px 10px", cursor: "pointer", letterSpacing: 1 }}>
                  {showExplain ? (lang === "pt" ? "ocultar" : "hide") : (lang === "pt" ? "explicar" : "explain")}
                </button>
              )}
              {verdict.pass && nextCh && (
                <button onClick={() => onNext && onNext(nextCh.id)} style={{ fontFamily: F.mono, fontSize: 14, color: C.cyan, background: "none", border: `1px solid ${C.cyan}`, padding: "8px 16px", cursor: "pointer", letterSpacing: 1.5 }}>
                  NEXT ▶
                </button>
              )}
              {verdict.pass && !nextCh && (
                <button onClick={onBack} style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, background: "none", border: `1px solid ${C.border}`, padding: "8px 16px", cursor: "pointer", letterSpacing: 1.5 }}>
                  ALL DONE ✓
                </button>
              )}
            </div>}
            {/* Solution explanation — shown after a correct solve */}
            {verdict?.pass && showExplain && SOLUTION_EXPLANATIONS[ch.id] && (
              <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel, padding: "10px 16px", animation: "fadeSlide 0.15s ease" }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.greenDim, marginBottom: 8, letterSpacing: 1 }}>// solution_explanation</div>
                <div style={{ background: C.surface, border: `1px solid ${C.green}30`, padding: "8px 10px", marginBottom: 8, overflowX: "auto" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginBottom: 4 }}>-- solution</div>
                  <pre style={{ margin: 0, fontFamily: F.mono, fontSize: 12, color: C.green, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.7 }}>{ch.validate}</pre>
                </div>
                <p style={{ margin: 0, fontFamily: F.mono, fontSize: 12, color: C.text, lineHeight: 1.8 }}>
                  {lang === "pt" ? SOLUTION_EXPLANATIONS[ch.id].pt : SOLUTION_EXPLANATIONS[ch.id].en}
                </p>
              </div>
            )}
            <button onClick={() => setResOpen(!resOpen)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: F.mono, fontSize: 14, color: result.ok ? C.green : C.red, transition: "transform 0.25s", transform: resOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
              <span style={{ fontFamily: F.mono, fontSize: 14, color: result.ok ? C.green : C.red }}>{result.ok ? `✓ ${result.msg}` : `✗ ${result.msg}`}</span>
            </button>
            {resOpen && result.ok && result.rows.length > 0 && (
              <div style={{ padding: "0 16px 10px", maxHeight: 180, overflowY: "auto", overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontFamily: F.mono, fontSize: 13 }}>
                  <thead><tr>{result.columns.map(c => <th key={c} style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, color: C.cyan, textAlign: "left", fontWeight: 400, whiteSpace: "nowrap" }}>{c}</th>)}</tr></thead>
                  <tbody>{result.rows.slice(0, 50).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}10`, color: v === null ? C.dim : C.white, fontStyle: v === null ? "italic" : "normal", whiteSpace: "nowrap" }}>{v === null ? "NULL" : String(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {resOpen && !result.ok && <div style={{ padding: "4px 16px 10px", fontFamily: F.mono, fontSize: 14, color: C.red, lineHeight: 1.8 }}>{result.msg}</div>}
            {/* Edit button to go back to coding — only shown after a correct answer */}
            {verdict?.pass && <button onClick={clearResult} style={{ width: "100%", padding: "8px 0", cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.dim, background: C.panel, border: "none", borderTop: `1px solid ${C.border}`, letterSpacing: 1 }}>✎ EDIT CODE</button>}
          </div>
        )}
        {/* Schema viewer — shown when .schema command is detected */}
        {schemaOutput && (
          <div style={{ padding: "8px 14px", background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0, fontFamily: F.mono, fontSize: 12, animation: "fadeSlide 0.15s ease" }}>
            <div style={{ color: C.dim, marginBottom: 6 }}>-- schema output --</div>
            {schemaOutput.map(({ table, cols }) => (
              <div key={table} style={{ marginBottom: 4 }}>
                <span style={{ color: C.text }}>{table}</span>
                <span style={{ color: C.dim }}>: </span>
                <span style={{ color: C.dim }}>{cols}</span>
              </div>
            ))}
          </div>
        )}
        {/* AuxKeyboard + RUN bar — wrapped together for tour spotlight */}
        <div ref={bottomAreaRef}>
          <AuxKeyboard
            onInsert={handleAuxInsert}
            onControl={handleAuxControl}
            tabsRef={auxTabsRef}
          />
          {/* ── Timer bar (shown until solved) ── */}
          {(!verdict?.pass) && (() => {
            const timerMins = Math.floor(timerSec / 60);
            const timerSecs = timerSec % 60;
            const frac = timerSec / totalTimerSec;
            const timerColor = timerExpired ? C.muted : frac > 0.5 ? C.green : frac > 0.25 ? C.amber : C.red;
            const mult = getTimeMultiplier(timerSec, totalTimerSec, timerExpired);
            return (
              <div ref={timerAreaRef} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} style={{ background: C.black, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {/* Countdown progress bar */}
                <div style={{ height: 2, background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${frac * 100}%`, background: timerColor, transition: "width 1s linear, background 0.5s ease" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", padding: "3px 8px", gap: 6 }}>
                  <button
                    onClick={() => !timerExpired && setTimerPaused(p => !p)}
                    onTouchStart={e => e.stopPropagation()}
                    onTouchEnd={e => { e.stopPropagation(); if (!timerExpired) setTimerPaused(p => !p); }}
                    style={{ background: "none", border: `1px solid ${timerExpired ? C.muted : timerColor}40`, cursor: timerExpired ? "default" : "pointer", fontFamily: F.mono, fontSize: 11, color: timerExpired ? C.muted : timerColor, padding: "2px 7px", flexShrink: 0, minHeight: 24, letterSpacing: 0.5, animation: !timerExpired && frac < 0.25 && !timerPaused ? "timerPulse 1s ease infinite" : "none" }}
                  >
                    {timerExpired ? "TIME" : timerPaused ? "▶" : `⏱ ${timerMins}:${String(timerSecs).padStart(2,"0")}`}
                  </button>
                  {!timerExpired && (
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{timerPaused ? "paused" : `×${mult.toFixed(1)} bonus`}</span>
                  )}
                  {!timerExpired && wrongRunCount > 0 && (
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginLeft: "auto" }}>{wrongRunCount} {lang === "pt" ? "erros" : "tries"}</span>
                  )}
                  {timerExpired && (
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>+10 {lang === "pt" ? "persistência" : "perseverance"} if solved</span>
                  )}
                </div>
              </div>
            );
          })()}
          {/* ── RUN + utility bar ── */}
          {(!result || !verdict?.pass) && (
            <div onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ padding: "4px 8px", paddingBottom: "calc(4px + env(safe-area-inset-bottom, 0px))", background: C.black, borderTop: `1px solid ${C.border}`, display: "flex", gap: 6, flexShrink: 0 }}>
              <button ref={kbdBtnRef} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleKeyboard(); }} style={{ padding: "8px 0", cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: editing ? C.cyan : C.dim, background: "none", border: `1px solid ${editing ? C.cyan : C.border}`, minHeight: 40, width: 46, flexShrink: 0 }}>{editing ? "⌨✕" : "⌨"}</button>
              <button
                onPointerDown={e => { e.preventDefault(); backspace(); bsTimerRef.current = setTimeout(() => { bsIntervalRef.current = setInterval(backspace, 80); }, 380); }}
                onPointerUp={() => { clearTimeout(bsTimerRef.current); clearInterval(bsIntervalRef.current); }}
                onPointerLeave={() => { clearTimeout(bsTimerRef.current); clearInterval(bsIntervalRef.current); }}
                style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "8px 0", fontFamily: F.mono, fontSize: 16, color: C.dim, minHeight: 40, width: 42, flexShrink: 0, fontWeight: 700 }}>⌫</button>
              <button onClick={() => insert(" ")} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "8px 0", fontFamily: F.mono, fontSize: 18, color: C.dim, minHeight: 40, flex: 1, flexShrink: 0 }}>⎵</button>
              <button onClick={smartEnter} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "8px 0", fontFamily: F.mono, fontSize: 15, color: C.dim, minHeight: 40, width: 42, flexShrink: 0 }}>↵</button>
              <button onClick={resetSQL} style={{ padding: "8px 0", cursor: "pointer", fontFamily: F.mono, fontSize: 15, color: C.dim, background: "none", border: `1px solid ${C.border}`, minHeight: 40, width: 38, flexShrink: 0 }}>↺</button>
              <button ref={runBtnRef} onClick={handleRun} disabled={!dbReady} style={{ flex: 1, padding: "8px 0", cursor: dbReady ? "pointer" : "not-allowed", fontFamily: F.mono, fontSize: 14, letterSpacing: 1, fontWeight: 700, color: C.green, background: "none", border: `1px solid ${C.green}`, minHeight: 40, opacity: dbReady ? 1 : 0.5 }}>▶ RUN</button>
            </div>
          )}
        </div>
      </div>

      {/* Code screen onboarding — shows on first visit */}
      {showCodeOnboarding && (
        <CodeScreenOnboarding
          onComplete={() => setShowCodeOnboarding(false)}
          lang={lang}
          editorRef={edRef}
          kbdRef={kbdBtnRef}
          auxRef={auxKbRef}
          schemaRef={schemaBtnRef}
          hintRef={hintBtnRef}
          expectedRef={expectedBtnRef}
          tourBtnRef={tourBtnRef}
          hintBarRef={hintBarRef}
          bottomAreaRef={bottomAreaRef}
          schema={ch.schema}
          hint={ch.hint}
          db={db}
          validateQuery={ch.verify || ch.validate}
          auxTabsRef={auxTabsRef}
          runBtnRef={runBtnRef}
          timerAreaRef={timerAreaRef}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PRACTICE — 12 real challenges
// ═══════════════════════════════════════════════════════════
function PracticeScreen({ onNavigate, solved = new Set() }) {
  const { lang } = useLang();
  const { t } = useLang();
  const [filter, setFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const filtered = CHALLENGES_DB
    .filter(c => filter === "ALL" || c.diff === filter)
    .filter(c => tagFilter === "ALL" || c.tag === tagFilter);
  const goRandom = () => {
    const unsolved = filtered.filter(c => !solved.has(c.id));
    const pool = unsolved.length > 0 ? unsolved : filtered;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) onNavigate("challenge", pick.id);
  };
  return (
    <div style={{ padding: "12px 16px 20px", fontFamily: F.mono, animation: "langSwitch 0.2s ease" }}>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>
        <Prompt path="/code" /><span style={{ color: C.text }}> ls --sort=diff challenges/</span>
      </div>
      {/* Difficulty filter bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 4, overflowX: "auto", scrollbarWidth: "none" }}>
        {["ALL","EASY","MED","HARD","EXPERT"].map(f => {
          const total = f === "ALL" ? CHALLENGES_DB.length : CHALLENGES_DB.filter(c => c.diff === f).length;
          const solvedCnt = f === "ALL" ? solved.size : CHALLENGES_DB.filter(c => c.diff === f && solved.has(c.id)).length;
          const pct = total > 0 ? Math.round(solvedCnt / total * 100) : 0;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: "none", border: `1px solid ${filter === f ? C.dim : C.border}`,
              cursor: "pointer", padding: "5px 10px", whiteSpace: "nowrap",
              fontFamily: F.mono, fontSize: 11, color: filter === f ? C.text : C.muted,
            }}>
              {f} <span style={{ opacity: 0.6 }}>{pct}%</span>
            </button>
          );
        })}
        <button onClick={goRandom} style={{
          background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
          padding: "5px 10px", fontFamily: F.mono, fontSize: 11, color: C.dim, marginLeft: "auto", flexShrink: 0,
        }}>{lang === "pt" ? "ALEATÓRIO" : "RANDOM"}</button>
      </div>
      {/* Archetype filter bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
        <button onClick={() => setTagFilter("ALL")} style={{
          background: tagFilter === "ALL" ? `${C.dim}18` : "none", border: `1px solid ${tagFilter === "ALL" ? C.dim : C.border}`,
          cursor: "pointer", padding: "4px 8px", whiteSpace: "nowrap",
          fontFamily: F.mono, fontSize: 10, color: tagFilter === "ALL" ? C.text : C.muted,
        }}>ALL</button>
        {Object.entries(TAG_META).map(([key, tm]) => (
          <button key={key} onClick={() => setTagFilter(key)} style={{
            background: "none", border: `1px solid ${tagFilter === key ? C.dim : C.border}`,
            cursor: "pointer", padding: "4px 8px", whiteSpace: "nowrap",
            fontFamily: F.mono, fontSize: 10, color: tagFilter === key ? C.text : C.muted,
          }}>{lang === "pt" ? tm.label_pt : tm.label_en}</button>
        ))}
      </div>
      {/* Challenge list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map((ch, i) => {
          const isSolved = solved.has(ch.id);
          const dc = C.muted;
          const tm = TAG_META[ch.tag];
          const baseXp = ch.diff === "EASY" ? 25 : ch.diff === "MED" ? 50 : ch.diff === "HARD" ? 75 : 100;
          const maxXp = Math.round((baseXp + 5) * 2.0 * 1.1); // no-hint + ×2 time + first-try
          return (
            <button key={ch.id} onClick={() => onNavigate("challenge", ch.id)} style={{
              background: "none", border: `1px solid ${isSolved ? `${C.green}25` : "transparent"}`,
              cursor: "pointer", textAlign: "left", width: "100%", padding: "8px 10px",
              display: "flex", alignItems: "center", gap: 10,
              animation: `fadeSlide 0.2s ease ${Math.min(i, 20) * 0.02}s both`,
            }}>
              <span style={{ color: isSolved ? C.green : C.muted, fontSize: 11, width: 14, flexShrink: 0 }}>
                {isSolved ? "✓" : "·"}
              </span>
              <span style={{ color: dc, fontSize: 10, minWidth: 32, flexShrink: 0 }}>{ch.diff}</span>
              <span style={{ fontSize: 13, color: isSolved ? C.dim : C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ch.title}
              </span>
              {!isSolved && (
                <span style={{ fontSize: 9, color: C.muted, border: `1px solid ${C.border}`, padding: "1px 5px", flexShrink: 0 }}>
                  {maxXp}xp
                </span>
              )}
              {isSolved && (
                <span style={{ fontSize: 9, color: C.dim, flexShrink: 0 }}>+{baseXp}xp</span>
              )}
              {tm && (
                <span style={{ fontSize: 9, color: C.muted, flexShrink: 0, letterSpacing: 0.5 }}>
                  {lang === "pt" ? tm.label_pt : tm.label_en}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>
        {filtered.length} challenges · {solved.size}/{CHALLENGES_DB.length} solved
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  REVIEW
// ═══════════════════════════════════════════════════════════
function ReviewScreen({ onXP }) {
  const { t, lang } = useLang();
  const p = lang === "pt";
  const allCards = [
    // EASY (12 cards)
    { front: p ? "O que SELECT faz?" : "What does SELECT do?", back: p ? "Escolhe quais colunas retornar na query." : "Chooses which columns to return in the query.", diff: "EASY" },
    { front: p ? "O que FROM faz?" : "What does FROM do?", back: p ? "Especifica de qual tabela buscar os dados." : "Specifies which table to fetch data from.", diff: "EASY" },
    { front: p ? "O que LIMIT faz?" : "What does LIMIT do?", back: p ? "Limita o número de linhas retornadas.\nEx: LIMIT 10 → só 10 linhas." : "Limits the number of rows returned.\nEx: LIMIT 10 → only 10 rows.", diff: "EASY" },
    { front: p ? "O que DISTINCT faz?" : "What does DISTINCT do?", back: p ? "Remove linhas duplicadas do resultado." : "Removes duplicate rows from the result.", diff: "EASY" },
    { front: p ? "O que WHERE faz?" : "What does WHERE do?", back: p ? "Filtra linhas baseado em uma condição.\nEx: WHERE price > 50" : "Filters rows based on a condition.\nEx: WHERE price > 50", diff: "EASY" },
    { front: p ? "O que ORDER BY faz?" : "What does ORDER BY do?", back: p ? "Ordena o resultado.\nASC = crescente (padrão)\nDESC = decrescente" : "Sorts the result.\nASC = ascending (default)\nDESC = descending", diff: "EASY" },
    { front: p ? "SELECT * significa o quê?" : "What does SELECT * mean?", back: p ? "Seleciona TODAS as colunas da tabela." : "Selects ALL columns from the table.", diff: "EASY" },
    { front: p ? "Como comentar em SQL?" : "How to comment in SQL?", back: p ? "-- para linha única\n/* */ para bloco" : "-- for single line\n/* */ for block comments", diff: "EASY" },
    { front: p ? "O que NULL significa?" : "What does NULL mean?", back: p ? "Valor ausente/desconhecido.\nNULL ≠ 0, NULL ≠ ''\nUse IS NULL para testar." : "Missing/unknown value.\nNULL ≠ 0, NULL ≠ ''\nUse IS NULL to test.", diff: "EASY" },
    { front: p ? "O que AND faz em WHERE?" : "What does AND do in WHERE?", back: p ? "Combina condições — AMBAS precisam ser verdadeiras.\nWHERE a > 5 AND b = 'x'" : "Combines conditions — BOTH must be true.\nWHERE a > 5 AND b = 'x'", diff: "EASY" },
    { front: p ? "O que OR faz em WHERE?" : "What does OR do in WHERE?", back: p ? "Combina condições — pelo menos UMA verdadeira.\nWHERE a > 5 OR b = 'x'" : "Combines conditions — at least ONE must be true.\nWHERE a > 5 OR b = 'x'", diff: "EASY" },
    { front: p ? "O que LIKE faz?" : "What does LIKE do?", back: p ? "Busca por padrão de texto.\n% = qualquer sequência\n_ = um caractere\nEx: WHERE name LIKE 'Jo%'" : "Pattern matching for text.\n% = any sequence\n_ = one character\nEx: WHERE name LIKE 'Jo%'", diff: "EASY" },
    // MED (12 cards)
    { front: p ? "COUNT(*) vs COUNT(col)?" : "COUNT(*) vs COUNT(col)?", back: p ? "COUNT(*) conta todas as linhas.\nCOUNT(col) ignora NULLs naquela coluna." : "COUNT(*) counts all rows.\nCOUNT(col) ignores NULLs in that column.", diff: "MED" },
    { front: p ? "O que GROUP BY faz?" : "What does GROUP BY do?", back: p ? "Agrupa linhas com valores iguais.\nUsado com funções: COUNT, SUM, AVG.\nEx: GROUP BY category" : "Groups rows with the same values.\nUsed with: COUNT, SUM, AVG.\nEx: GROUP BY category", diff: "MED" },
    { front: p ? "HAVING vs WHERE?" : "HAVING vs WHERE?", back: p ? "WHERE filtra ANTES do agrupamento.\nHAVING filtra DEPOIS do GROUP BY.\nHAVING COUNT(*) > 5" : "WHERE filters BEFORE grouping.\nHAVING filters AFTER GROUP BY.\nHAVING COUNT(*) > 5", diff: "MED" },
    { front: p ? "O que INNER JOIN faz?" : "What does INNER JOIN do?", back: p ? "Retorna apenas linhas com match em AMBAS tabelas.\nLinhas sem match são excluídas." : "Returns only rows with matches in BOTH tables.\nUnmatched rows are excluded.", diff: "MED" },
    { front: p ? "O que LEFT JOIN faz?" : "What does LEFT JOIN do?", back: p ? "Retorna TODAS as linhas da tabela esquerda + matches da direita.\nSem match → NULL nos campos da direita." : "Returns ALL rows from left table + matches from right.\nNo match → NULL in right columns.", diff: "MED" },
    { front: p ? "O que é um alias (AS)?" : "What is an alias (AS)?", back: p ? "Renomeia coluna ou tabela temporariamente.\nSELECT name AS cliente\nFROM orders AS o" : "Temporarily renames a column or table.\nSELECT name AS customer\nFROM orders AS o", diff: "MED" },
    { front: p ? "SUM vs COUNT?" : "SUM vs COUNT?", back: p ? "COUNT = quantas linhas\nSUM = soma dos valores numéricos\nCOUNT(price) ≠ SUM(price)" : "COUNT = how many rows\nSUM = adds numeric values\nCOUNT(price) ≠ SUM(price)", diff: "MED" },
    { front: p ? "O que IN faz?" : "What does IN do?", back: p ? "Testa se valor está numa lista.\nWHERE country IN ('BR','US','UK')\nEquivalente a múltiplos OR." : "Tests if value is in a list.\nWHERE country IN ('BR','US','UK')\nEquivalent to multiple ORs.", diff: "MED" },
    { front: p ? "AVG ignora NULLs?" : "Does AVG ignore NULLs?", back: p ? "SIM. AVG(col) ignora NULLs.\nSó calcula a média dos valores não-nulos." : "YES. AVG(col) ignores NULLs.\nOnly averages non-null values.", diff: "MED" },
    { front: p ? "Como ordenar por 2 colunas?" : "How to sort by 2 columns?", back: p ? "ORDER BY col1 ASC, col2 DESC\nPrimeiro ordena por col1,\ndepois desempata por col2." : "ORDER BY col1 ASC, col2 DESC\nFirst sorts by col1,\nthen breaks ties with col2.", diff: "MED" },
    { front: p ? "O que é subquery?" : "What is a subquery?", back: p ? "Uma query dentro de outra query.\nSELECT * FROM orders\nWHERE customer_id IN\n  (SELECT id FROM customers\n   WHERE country='BR')" : "A query inside another query.\nSELECT * FROM orders\nWHERE customer_id IN\n  (SELECT id FROM customers\n   WHERE country='BR')", diff: "MED" },
    { front: p ? "ROUND(col, n) faz o quê?" : "What does ROUND(col, n) do?", back: p ? "Arredonda para n casas decimais.\nROUND(3.14159, 2) → 3.14" : "Rounds to n decimal places.\nROUND(3.14159, 2) → 3.14", diff: "MED" },
    // HARD (10 cards)
    { front: p ? "O que é uma CTE (WITH)?" : "What is a CTE (WITH)?", back: p ? "Common Table Expression — tabela temporária.\nWITH top AS (\n  SELECT ... \n)\nSELECT * FROM top" : "Common Table Expression — temp table.\nWITH top AS (\n  SELECT ... \n)\nSELECT * FROM top", diff: "HARD" },
    { front: p ? "ROW_NUMBER() faz o quê?" : "What does ROW_NUMBER() do?", back: p ? "Atribui número sequencial a cada linha.\nROW_NUMBER() OVER (\n  ORDER BY price DESC\n)\nNunca repete números." : "Assigns sequential number to each row.\nROW_NUMBER() OVER (\n  ORDER BY price DESC\n)\nNever repeats numbers.", diff: "HARD" },
    { front: p ? "RANK vs DENSE_RANK?" : "RANK vs DENSE_RANK?", back: p ? "RANK: pula posições em empate.\n1,2,2,4 ← pulou 3\nDENSE_RANK: não pula.\n1,2,2,3 ← contínuo" : "RANK: skips positions on ties.\n1,2,2,4 ← skipped 3\nDENSE_RANK: doesn't skip.\n1,2,2,3 ← continuous", diff: "HARD" },
    { front: p ? "O que LAG() faz?" : "What does LAG() do?", back: p ? "Acessa o valor da linha ANTERIOR.\nLAG(col, 1) OVER (ORDER BY date)\nÚtil para comparar com dia anterior." : "Accesses the PREVIOUS row's value.\nLAG(col, 1) OVER (ORDER BY date)\nUseful for comparing with previous day.", diff: "HARD" },
    { front: p ? "O que LEAD() faz?" : "What does LEAD() do?", back: p ? "Acessa o valor da PRÓXIMA linha.\nLEAD(col, 1) OVER (ORDER BY date)\nOposto do LAG." : "Accesses the NEXT row's value.\nLEAD(col, 1) OVER (ORDER BY date)\nOpposite of LAG.", diff: "HARD" },
    { front: p ? "Escreva: receita total por categoria" : "Write: total revenue by category", back: "SELECT category,\n  SUM(price * quantity)\n    AS revenue\nFROM products p\nJOIN order_items oi\n  ON p.id = oi.product_id\nGROUP BY category;", diff: "HARD" },
    { front: p ? "O que PARTITION BY faz?" : "What does PARTITION BY do?", back: p ? "Divide linhas em grupos para window functions.\nSUM(amount) OVER (\n  PARTITION BY category\n)\nComo GROUP BY mas sem colapsar linhas." : "Divides rows into groups for window functions.\nSUM(amount) OVER (\n  PARTITION BY category\n)\nLike GROUP BY but doesn't collapse rows.", diff: "HARD" },
    { front: p ? "Subquery correlacionada?" : "Correlated subquery?", back: p ? "Subquery que referencia a query externa.\nSELECT * FROM orders o\nWHERE amount > (\n  SELECT AVG(amount)\n  FROM orders o2\n  WHERE o2.customer_id = o.customer_id\n)" : "Subquery that references the outer query.\nSELECT * FROM orders o\nWHERE amount > (\n  SELECT AVG(amount)\n  FROM orders o2\n  WHERE o2.customer_id = o.customer_id\n)", diff: "HARD" },
    { front: p ? "EXISTS vs IN?" : "EXISTS vs IN?", back: p ? "IN: compara contra lista de valores.\nEXISTS: verifica se subquery retorna algo.\nEXISTS é mais eficiente para tabelas grandes." : "IN: compares against a list of values.\nEXISTS: checks if subquery returns anything.\nEXISTS is more efficient for large tables.", diff: "HARD" },
    { front: p ? "Média móvel de 3 dias?" : "3-day moving average?", back: "AVG(amount) OVER (\n  ORDER BY date\n  ROWS BETWEEN\n    2 PRECEDING\n    AND CURRENT ROW\n)", diff: "HARD" },
    // EASY DML (2 cards)
    { front: p ? "O que DELETE faz?" : "What does DELETE do?", back: p ? "Remove permanentemente linhas que atendem a condição.\nDELETE FROM t WHERE col = val\nSem WHERE: remove TODAS as linhas!" : "Permanently removes rows matching a condition.\nDELETE FROM t WHERE col = val\nWithout WHERE: deletes ALL rows!", diff: "EASY" },
    { front: p ? "O que UPDATE faz?" : "What does UPDATE do?", back: p ? "Modifica valores existentes nas linhas que atendem a condição.\nUPDATE t SET col = val WHERE cond\nSem WHERE: atualiza TODAS as linhas!" : "Modifies existing column values in matching rows.\nUPDATE t SET col = val WHERE condition\nWithout WHERE: updates ALL rows!", diff: "EASY" },
    // EASY DDL (2 cards)
    { front: p ? "O que CREATE TABLE faz?" : "What does CREATE TABLE do?", back: p ? "Define a estrutura de uma nova tabela.\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n)\nAinda sem dados — só o esquema." : "Defines a new table structure.\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n)\nNo data yet — just the schema.", diff: "EASY" },
    { front: p ? "O que CREATE VIEW faz?" : "What does CREATE VIEW do?", back: p ? "Cria uma query nomeada e reutilizável.\nCREATE VIEW active AS\n  SELECT * FROM orders\n  WHERE status = 'active'\nViews não armazenam dados." : "Creates a named, reusable query.\nCREATE VIEW active AS\n  SELECT * FROM orders\n  WHERE status = 'active'\nViews don't store data.", diff: "EASY" },
    // MED DML (4 cards)
    { front: p ? "DELETE vs DROP TABLE?" : "DELETE vs DROP TABLE?", back: p ? "DELETE remove LINHAS (tabela permanece).\nDROP TABLE remove a tabela inteira.\nDELETE é DML; DROP é DDL." : "DELETE removes ROWS (table stays).\nDROP TABLE removes the TABLE itself.\nDELETE is DML; DROP is DDL.", diff: "MED" },
    { front: p ? "Como preencher NULLs com a média?" : "How to fill NULLs with the average?", back: "UPDATE t\nSET col = (\n  SELECT AVG(col)\n  FROM t\n  WHERE col IS NOT NULL\n)\nWHERE col IS NULL", diff: "MED" },
    { front: p ? "Como remover duplicatas pelo menor id?" : "How to remove duplicates keeping lowest id?", back: "DELETE FROM t\nWHERE id NOT IN (\n  SELECT MIN(id)\n  FROM t\n  GROUP BY dup_col1,\n           dup_col2\n)", diff: "MED" },
    { front: p ? "O que INSERT INTO ... SELECT faz?" : "What does INSERT INTO ... SELECT do?", back: p ? "Copia linhas de uma tabela para outra.\nINSERT INTO archive\nSELECT * FROM orders\nWHERE status = 'completed'" : "Copies rows from one table to another.\nINSERT INTO archive\nSELECT * FROM orders\nWHERE status = 'completed'", diff: "MED" },
    // MED DDL (4 cards)
    { front: p ? "CREATE TABLE vs CREATE VIEW?" : "CREATE TABLE vs CREATE VIEW?", back: p ? "TABLE: armazena dados reais no disco.\nVIEW: armazena uma query, não dados.\nConsultar uma view reexecuta a query.\nTabelas são físicas; views são virtuais." : "TABLE: stores actual data on disk.\nVIEW: stores a query, not data.\nQuerying a view reruns the query.\nTables are physical; views are virtual.", diff: "MED" },
    { front: p ? "O que ALTER TABLE ADD COLUMN faz?" : "What does ALTER TABLE ADD COLUMN do?", back: p ? "Adiciona uma nova coluna a uma tabela existente.\nALTER TABLE products\n  ADD COLUMN discount REAL\nLinhas existentes recebem NULL na nova coluna." : "Adds a new column to an existing table.\nALTER TABLE products\n  ADD COLUMN discount REAL\nExisting rows get NULL for the new column.", diff: "MED" },
    { front: p ? "DROP TABLE vs DROP VIEW?" : "DROP TABLE vs DROP VIEW?", back: p ? "DROP TABLE remove a tabela E seus dados.\nDROP VIEW remove só a definição da view.\nAmbos aceitam IF EXISTS para evitar erros." : "DROP TABLE removes table AND its data.\nDROP VIEW removes only the view definition.\nBoth can use IF EXISTS to avoid errors.", diff: "MED" },
    { front: p ? "O que CREATE INDEX faz?" : "What does CREATE INDEX do?", back: p ? "Cria um índice para acelerar buscas.\nCREATE INDEX idx_name ON t(col)\nTradeoff: mais espaço, queries mais rápidas.\nÚtil para colunas usadas no WHERE." : "Creates an index to speed up searches.\nCREATE INDEX idx_name ON t(col)\nTrades storage space for query speed.\nUseful for columns used in WHERE.", diff: "MED" },
    // HARD DML (2 cards)
    { front: p ? "UPDATE com CASE WHEN?" : "UPDATE with CASE WHEN?", back: "UPDATE t SET col =\n  CASE\n    WHEN cond1 THEN val1\n    WHEN cond2 THEN val2\n    ELSE default\n  END", diff: "HARD" },
    { front: p ? "O que é uma transação?" : "What is a transaction?", back: p ? "Grupo de comandos que executam como uma unidade.\nTodos têm sucesso ou todos falham.\nSAVEPOINT sp; ...; RELEASE sp;\nROLLBACK TO sp desfaz todas as mudanças." : "A group of statements that run as one unit.\nAll succeed or all fail.\nSAVEPOINT sp; ...; RELEASE sp;\nROLLBACK TO sp to undo all changes.", diff: "HARD" },
    // HARD DDL (2 cards)
    { front: p ? "SAVEPOINT vs BEGIN/COMMIT?" : "SAVEPOINT vs BEGIN/COMMIT?", back: p ? "Ambos criam transações. No SQLite:\nBEGIN; ...; COMMIT (plana)\nSAVEPOINT name; ...; RELEASE name\nSAVEPOINT suporta aninhamento.\nROLLBACK TO name desfaz até aquele ponto." : "Both create transactions. In SQLite:\nBEGIN; ...; COMMIT (flat)\nSAVEPOINT name; ...; RELEASE name\nSAVEPOINT supports nesting.\nROLLBACK TO name undoes to that point.", diff: "HARD" },
    { front: p ? "CREATE TABLE AS SELECT?" : "CREATE TABLE AS SELECT?", back: p ? "Cria uma tabela a partir do resultado de uma query.\nCREATE TABLE clean_data AS\n  SELECT * FROM raw_data\n  WHERE valid = 1\nPadrão rápido de ETL / snapshot." : "Creates a table from a query result.\nCREATE TABLE clean_data AS\n  SELECT * FROM raw_data\n  WHERE valid = 1\nQuick ETL / snapshot pattern.", diff: "HARD" },
  ];

  const [diff, setDiff] = useState("ALL");
  const cards = diff === "ALL" ? allCards : allCards.filter(c => c.diff === diff);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flipAnim, setFlipAnim] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [statsByDiff, setStatsByDiff] = useState({ ALL: { r: 0, c: 0 }, EASY: { r: 0, c: 0 }, MED: { r: 0, c: 0 }, HARD: { r: 0, c: 0 } });
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [ejecting, setEjecting] = useState(null); // "left" | "right" | null
  const [gameOver, setGameOver] = useState(false);
  const touchStart = useRef(0);

  const card = cards[idx % cards.length];
  const pts = card?.diff === "EASY" ? 1 : card?.diff === "MED" ? 2 : 3;

  const flip = () => { if (swiping || ejecting || gameOver) return; setFlipAnim(true); setTimeout(() => { setFlipped(!flipped); setFlipAnim(false); }, 200); };

  const nextCard = (known) => {
    if (gameOver) return;
    const cardDiff = card?.diff || "EASY";
    if (known) {
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      if (onXP) onXP(pts);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) { setGameOver(true); setEjecting(null); return; }
    }
    setStatsByDiff(prev => ({
      ...prev,
      ALL: { r: prev.ALL.r + 1, c: prev.ALL.c + (known ? 1 : 0) },
      [cardDiff]: { r: (prev[cardDiff]?.r || 0) + 1, c: (prev[cardDiff]?.c || 0) + (known ? 1 : 0) },
    }));
    setReviewed(r => r + 1);
    setFlipped(false);
    setSwipeX(0);
    setSwiping(false);
    setIdx(i => i + 1);
  };

  const resetGame = () => { setScore(0); setLives(3); setReviewed(0); setCorrect(0); setIdx(0); setFlipped(false); setGameOver(false); setSwipeX(0); setEjecting(null); setStatsByDiff({ ALL: { r: 0, c: 0 }, EASY: { r: 0, c: 0 }, MED: { r: 0, c: 0 }, HARD: { r: 0, c: 0 } }); };

  const onTS = (e) => {
    if (ejecting) return;
    e.stopPropagation();
    touchStart.current = e.touches[0].clientX;
    setSwiping(false);
  };
  const onTM = (e) => {
    if (ejecting) return;
    const dx = e.touches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 10) setSwiping(true);
    setSwipeX(dx);
  };
  const onTE = (e) => {
    if (ejecting) return;
    e.stopPropagation();
    if (Math.abs(swipeX) > 80) {
      const dir = swipeX > 0 ? "right" : "left";
      setEjecting(dir);
      setTimeout(() => {
        nextCard(dir === "right");
        setEjecting(null);
      }, 280);
    } else {
      setSwipeX(0);
      setSwiping(false);
    }
  };

  const swDir = ejecting || (swipeX > 30 ? "right" : swipeX < -30 ? "left" : null);
  const swPct = ejecting ? 1 : Math.min(Math.abs(swipeX) / 120, 1);

  // Derived card transform
  const cardTransform = ejecting
    ? `translateX(${ejecting === "right" ? 520 : -520}px) rotate(${ejecting === "right" ? 20 : -20}deg)`
    : `translateX(${swipeX}px) rotate(${swipeX * 0.04}deg)`;
  const cardTransition = ejecting
    ? "transform 0.28s cubic-bezier(0.35,0,0.65,0), opacity 0.22s ease"
    : swiping ? "none" : "transform 0.3s ease, border-color 0.2s";
  const cardOpacity = ejecting ? 0 : 1;

  // Hearts display
  const Hearts = () => (
    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, letterSpacing: 1 }}>
      HP: {lives}/3
    </div>
  );

  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim }}><Prompt path="/review" /></div>
          <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyan, marginTop: 6 }}>{t("review_title")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Hearts />
          <div style={{ fontFamily: F.mono, fontSize: 20, color: C.dim }}>{score}<span style={{ fontSize: 13, color: C.muted }}>pt</span></div>
        </div>
      </div>

      {/* Difficulty selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {["ALL","EASY","MED","HARD"].map(d => {
          const st = statsByDiff[d] || { r: 0, c: 0 };
          const pct = st.r > 0 ? Math.round(st.c / st.r * 100) : 0;
          return (
            <button key={d} onClick={() => { setDiff(d); setIdx(0); setFlipped(false); }} style={{
              background: "none", border: `1px solid ${diff === d ? C.dim : C.border}`,
              cursor: "pointer", padding: "8px 14px", minHeight: 40,
              fontFamily: F.mono, fontSize: 14, color: diff === d ? C.text : C.dim,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2, whiteSpace: "nowrap",
            }}><span>{d}</span><span style={{ fontSize: 11, color: diff === d ? C.dim : C.muted }}>{pct}%</span></button>
          );
        })}
      </div>

      <ProgressBar progress={cards.length > 0 ? ((idx % cards.length) + 1) / cards.length : 0} />

      {/* Game Over overlay */}
      {gameOver ? (
        <div style={{ marginTop: 20, background: C.panel, border: `1px solid ${C.red}`, padding: "32px 22px", textAlign: "center" }}>
          <div style={{ fontFamily: F.mono, fontSize: 28, color: C.red, marginBottom: 8 }}>GAME OVER</div>
          <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, marginBottom: 6 }}>{lang === "pt" ? "Você perdeu todas as vidas!" : "You lost all lives!"}</div>
          <div style={{ fontFamily: F.mono, fontSize: 36, color: C.dim, margin: "16px 0" }}>{score} <span style={{ fontSize: 18, color: C.muted }}>pts</span></div>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginBottom: 20 }}>{reviewed} {lang === "pt" ? "cards revisados" : "cards reviewed"}</div>
          <button onClick={resetGame} style={{ fontFamily: F.mono, fontSize: 16, color: C.cyan, background: "none", border: `1px solid ${C.cyan}`, padding: "14px 28px", cursor: "pointer", letterSpacing: 2 }}>
            {lang === "pt" ? "JOGAR DENOVO" : "PLAY AGAIN"}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 16, color: C.dim, textAlign: "center" }}>// no cards for "{diff}"</div>
      ) : (
        <>
          {/* Swipe hints */}
          <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 0 4px", fontFamily: F.mono, fontSize: 13 }}>
            <div style={{ color: C.dim, opacity: swDir === "left" ? 0.6 + swPct * 0.4 : 0.3 }}>← miss</div>
            <div style={{ fontSize: 12, color: C.dim }}>{card.diff} +{pts}pt</div>
            <div style={{ color: C.green, opacity: swDir === "right" ? 0.6 + swPct * 0.4 : 0.3 }}>+{pts}pt →</div>
          </div>

          {/* Swipable card */}
          <div
            key={idx}
            onClick={!swiping && !ejecting ? flip : undefined}
            onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
            style={{
              marginTop: 4, background: C.panel,
              border: `1px solid ${swDir === "right" ? C.green : swDir === "left" ? C.red : flipped ? C.cyanDim : C.border}`,
              padding: "28px 20px", minHeight: 220, cursor: "pointer",
              display: "flex", flexDirection: "column", justifyContent: "center",
              animation: flipAnim ? "flipCard 0.4s ease" : "cardIn 0.28s ease",
              position: "relative",
              boxShadow: "none",
              transform: cardTransform,
              transition: cardTransition,
              opacity: cardOpacity,
              touchAction: "pan-y", userSelect: "none",
              willChange: "transform, opacity",
            }}
          >
            {swDir === "right" && <div style={{ position: "absolute", top: 14, left: 14, fontFamily: F.mono, fontSize: 20, color: C.green, opacity: swPct, fontWeight: 700, transform: "rotate(-10deg)", border: `1px solid ${C.green}`, padding: "4px 12px" }}>+{pts}</div>}
            {swDir === "left" && <div style={{ position: "absolute", top: 14, right: 14, fontFamily: F.mono, fontSize: 20, color: C.dim, opacity: swPct, fontWeight: 700, transform: "rotate(10deg)", border: `1px solid ${C.border}`, padding: "4px 12px" }}>miss</div>}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: flipped ? C.dim : C.border }} />
            <div style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: flipped ? C.cyanDim : C.dim, marginBottom: 16, textAlign: "center" }}>{flipped ? t("answer") : `[ ${card.type} · ${card.diff} ]`}</div>
            {!flipped
              ? <div style={{ fontFamily: F.mono, fontSize: 20, color: C.white, lineHeight: 1.7, textAlign: "center" }}>{card.front}</div>
              : <div style={{ fontFamily: F.mono, fontSize: 15, color: C.text, lineHeight: 2, whiteSpace: "pre-wrap" }}>{card.back}</div>
            }
            {!flipped && <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 24, textAlign: "center" }}>{t("tap_reveal")}<Cursor /></div>}
          </div>

          {/* Action buttons when flipped */}
          {flipped && (
            <div style={{ display: "flex", gap: 10, marginTop: 14, animation: "fadeSlide 0.2s ease" }}>
              <button onClick={() => nextCard(false)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, padding: "14px 6px", cursor: "pointer", textAlign: "center", minHeight: 52, fontFamily: F.mono, fontSize: 16, color: C.dim }}>
                ← miss
              </button>
              <button onClick={() => nextCard(true)} style={{ flex: 1, background: "none", border: `1px solid ${C.green}`, padding: "14px 6px", cursor: "pointer", textAlign: "center", minHeight: 52, fontFamily: F.mono, fontSize: 16, color: C.green }}>
                +{pts}pt →
              </button>
            </div>
          )}
        </>
      )}

      {/* Session stats */}
      <CLIBox title={t("session_stats")} style={{ marginTop: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { l: "HP", v: `${lives}/3`, c: C.dim },
            { l: "SCORE", v: `${score}`, c: C.dim },
            { l: t("done"), v: String(reviewed), c: C.dim },
            { l: "CARDS", v: String(cards.length), c: C.dim },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontSize: 20, color: s.c }}>{s.v}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </CLIBox>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  QUIZ SCREEN
// ═══════════════════════════════════════════════════════════
function QuizScreen({ onXP }) {
  const { t, lang } = useLang();
  const [modFilter, setModFilter] = useState(0); // 0 = all
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timer, setTimer] = useState(15);
  const timerRef = useRef(null);

  const questions = useMemo(() => {
    const base = modFilter === 0 ? QUIZ_DB : QUIZ_DB.filter(q => q.mod === modFilter);
    return base.map(q => {
      const tagged = q.opts.map((opt, i) => ({ opt, correct: i === q.ans }));
      for (let i = tagged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
      }
      return { ...q, opts: tagged.map(t => t.opt), ans: tagged.findIndex(t => t.correct) };
    });
  }, [modFilter]);

  const q = questions[idx % questions.length];
  const pts = q?.diff === "EASY" ? 10 : q?.diff === "MED" ? 20 : q?.diff === "HARD" ? 30 : 40;

  // Timer countdown
  useEffect(() => {
    if (showResult) return;
    setTimer(15);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleAnswer(-1); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [idx, showResult === false]);

  const getStreakMult = (s) => s >= 10 ? 2.0 : s >= 5 ? 1.5 : s >= 3 ? 1.25 : 1.0;
  const getQuizTimeMult = (t) => t > 10 ? 1.5 : t > 5 ? 1.25 : 1.0;

  const handleAnswer = (optIdx) => {
    if (showResult) return;
    clearInterval(timerRef.current);
    setSelected(optIdx);
    setShowResult(true);
    setTotal(t => t + 1);
    if (optIdx === q.ans) {
      const nextStreak = streak + 1;
      const streakMult = getStreakMult(nextStreak);
      const timeMult = getQuizTimeMult(timer);
      const combined = Math.min(3.0, streakMult * timeMult);
      const earned = Math.round(pts * combined);
      setScore(s => s + earned);
      setStreak(nextStreak);
      if (onXP) onXP(earned);
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    setSelected(null);
    setShowResult(false);
    setIdx(i => i + 1);
  };

  const resetQuiz = () => { setIdx(0); setSelected(null); setShowResult(false); setScore(0); setTotal(0); setStreak(0); };

  const timerColor = timer > 10 ? C.green : timer > 5 ? C.amber : C.red;
  const modNames = ["ALL","M1: SELECT","M2: WHERE","M3: ORDER","M4: GROUP","M5: JOIN","M6: SUB","M7: WINDOW","M8: CTE","M9: DML","M10: DDL"];

  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim }}><Prompt path="/quiz" /></div>
          <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyan, marginTop: 6 }}>SQL_QUIZ</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, letterSpacing: 0.5 }}>[ STREAK: {streak}{streak >= 3 ? ` ×${getStreakMult(streak).toFixed(2)}` : "" } ]</div>
          <div style={{ fontFamily: F.mono, fontSize: 20, color: C.dim }}>{score}<span style={{ fontSize: 12, color: C.muted }}>pt</span></div>
        </div>
      </div>

      {/* Module filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {modNames.map((name, i) => (
          <button key={i} onClick={() => { setModFilter(i); resetQuiz(); }} style={{
            background: "none", border: `1px solid ${modFilter === i ? C.dim : C.border}`,
            cursor: "pointer", padding: "6px 10px", minHeight: 34,
            fontFamily: F.mono, fontSize: 11, color: modFilter === i ? C.text : C.dim, whiteSpace: "nowrap",
          }}>{name}</button>
        ))}
      </div>

      {/* Progress + Timer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <ProgressBar progress={questions.length > 0 ? ((idx % questions.length) + 1) / questions.length : 0} />
        <div style={{ fontFamily: F.mono, fontSize: 22, color: timerColor, minWidth: 40, textAlign: "right" }}>{timer}s</div>
      </div>

      {/* Question card */}
      <div style={{ background: C.panel, border: `1px solid ${showResult ? (selected === q.ans ? C.green : C.red) : C.border}`, padding: "20px 18px", marginBottom: 14, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: C.border }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>[{(idx % questions.length) + 1}/{questions.length}]</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, border: `1px solid ${C.border}`, padding: "3px 10px", letterSpacing: 1 }}>{q.diff}</span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 18, color: C.white, lineHeight: 1.6 }}>{lang === "pt" ? q.q_pt : q.q_en}</div>
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {q.opts.map((opt, i) => {
          const isCorrect = i === q.ans;
          const isSelected = i === selected;
          let bg = "none", borderColor = C.border, textColor = C.white;
          if (showResult) {
            if (isCorrect) { bg = C.greenGhost; borderColor = C.green; textColor = C.green; }
            else if (isSelected && !isCorrect) { bg = C.redGhost; borderColor = C.red; textColor = C.red; }
            else { textColor = C.dim; }
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} disabled={showResult} style={{
              background: bg, border: `1px solid ${borderColor}`, cursor: showResult ? "default" : "pointer",
              padding: "14px 16px", fontFamily: F.mono, fontSize: 16, color: textColor,
              textAlign: "left", minHeight: 50, display: "flex", alignItems: "center", gap: 12,
              transition: "all 0.2s",
            }}>
              <span style={{ fontFamily: F.mono, fontSize: 14, color: showResult && isCorrect ? C.green : C.dim, flexShrink: 0, width: 24 }}>
                {showResult ? (isCorrect ? "✓" : isSelected ? "✗" : "○") : String.fromCharCode(65 + i)}
              </span>
              <span style={{ fontFamily: F.mono }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Next button */}
      {showResult && (
        <button onClick={nextQuestion} style={{
          width: "100%", padding: "14px 0", cursor: "pointer",
          fontFamily: F.mono, fontSize: 16, letterSpacing: 2, fontWeight: 700,
          color: C.cyan, background: "none", border: `1px solid ${C.cyan}`,
          minHeight: 50,
        }}>NEXT ▶</button>
      )}

      {/* Stats bar */}
      <CLIBox title="QUIZ_STATS" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { l: "SCORE", v: `${score}`, c: C.dim },
            { l: "ACC", v: total > 0 ? `${Math.round((score / (total * pts)) * 100)}%` : "—", c: C.dim },
            { l: "STREAK", v: `${streak}`, c: C.dim },
            { l: "Q's", v: `${total}/${questions.length}`, c: C.dim },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontSize: 18, color: s.c }}>{s.v}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </CLIBox>
    </div>
  );
}

// ── Radar chart (shared SVG primitive) ──────────────────────
function RadarChart({ axes, color, w = 300, h = 300, cx, cy, r, labelDist }) {
  cx = cx ?? w / 2; cy = cy ?? h / 2;
  r = r ?? Math.min(w, h) * 0.32;
  labelDist = labelDist ?? r + 26;
  const n = axes.length;
  const rings = [0.25, 0.5, 0.75, 1.0];
  const pt = (i, pct) => {
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    return [cx + r * pct * Math.cos(a), cy + r * pct * Math.sin(a)];
  };
  const poly = (pct) => Array.from({ length: n }, (_, i) => pt(i, pct).join(",")).join(" ");
  const dataPoly = axes.map((ax, i) => pt(i, Math.max(ax.pct, 0.01)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: w, display: "block", margin: "0 auto", overflow: "visible" }}>
      {rings.map((p, gi) => (
        <polygon key={gi} points={poly(p)} fill="none" stroke={C.border} strokeWidth={p === 1 ? 1 : 0.5} opacity={0.5} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.border} strokeWidth={0.5} opacity={0.4} />;
      })}
      <polygon points={dataPoly} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, Math.max(ax.pct, 0.01));
        return <circle key={i} cx={x} cy={y} r={3} fill={ax.dotColor || color} />;
      })}
      {axes.map((ax, i) => {
        const a = (2 * Math.PI * i / n) - Math.PI / 2;
        const lx = cx + labelDist * Math.cos(a);
        const ly = cy + labelDist * Math.sin(a);
        const ta = Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle";
        return (
          <text key={i} x={lx} y={ly} textAnchor={ta} dominantBaseline="middle"
            fontFamily={F.mono} fontSize={9} fill={ax.labelColor || C.dim} letterSpacing={0.5}>
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

function SkillRadar({ solved }) {
  const { t } = useLang();
  const axes = MOD_LABELS.map(({ id, label }) => {
    const chs = CHALLENGES_DB.filter(c => c.mod === id);
    const pct = chs.length ? chs.filter(c => solved.has(c.id)).length / chs.length : 0;
    return { label, pct };
  });
  return (
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 13, color: C.cyanDim, letterSpacing: 1.5, marginBottom: 10 }}>┤ {t("skill_radar")} ├</div>
      <RadarChart axes={axes} color={C.cyan} w={310} h={300} cx={155} cy={150} r={100} labelDist={130} />
    </div>
  );
}

function ArchetypeViz({ solved }) {
  const { t, lang } = useLang();
  const data = ARCHETYPE_ORDER.map(key => {
    const meta = TAG_META[key];
    const chs = CHALLENGES_DB.filter(c => c.tag === key);
    const sc = chs.filter(c => solved.has(c.id)).length;
    const total = chs.length;
    return { key, ...meta, sc, total, pct: total ? sc / total : 0 };
  });
  const axes = data.map(d => ({
    label: `${d.icon} ${lang === "pt" ? d.label_pt : d.label_en}`,
    pct: d.pct, dotColor: d.c, labelColor: d.c,
  }));
  return (
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 13, color: C.cyanDim, letterSpacing: 1.5, marginBottom: 10 }}>┤ {t("archetype")} ├</div>
      <RadarChart axes={axes} color={C.purple} w={270} h={260} cx={135} cy={130} r={82} labelDist={108} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {data.map(d => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: d.c, width: 14, textAlign: "center", flexShrink: 0 }}>{d.icon}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, width: 76, letterSpacing: 0.5, flexShrink: 0 }}>
              {lang === "pt" ? d.label_pt : d.label_en}
            </span>
            <div style={{ flex: 1, position: "relative", overflow: "hidden", lineHeight: 1 }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.border, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{"░".repeat(60)}</span>
              <span style={{ position: "absolute", left: 0, top: 0, display: "block", overflow: "hidden", width: `${d.pct * 100}%`, fontFamily: F.mono, fontSize: 11, color: d.c, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{"█".repeat(60)}</span>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, width: 64, textAlign: "right", flexShrink: 0 }}>
              {Math.round(d.pct * 100)}% {d.sc}/{d.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════
function ProfileScreen({ xp = 0, solved = new Set(), syncing = false }) {
  const { t, lang } = useLang();
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const lv = getLevel(xp);
  const [expandedBadge, setExpandedBadge] = useState(null);
  const [devTaps, setDevTaps] = useState(0);
  const [devResetVisible, setDevResetVisible] = useState(false);

  const handleDevTap = () => {
    const next = devTaps + 1;
    setDevTaps(next);
    if (next >= 5) { setDevResetVisible(true); setDevTaps(0); }
  };
  const earnedAch = ACHIEVEMENTS.filter(a => a.check(solved, xp));
  const acc = CHALLENGES_DB.length > 0 ? Math.round(solved.size / CHALLENGES_DB.length * 100) : 0;
  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      <div style={{ textAlign: "center", padding: "8px 0 22px" }}>
        <div style={{ width: 80, height: 80, margin: "0 auto 16px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", background: C.panel }}>
          <span style={{ fontFamily: F.mono, fontSize: 36, color: C.dim, fontWeight: 400 }}>U</span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, letterSpacing: 2, animation: "rankReveal 0.8s ease" }}>{lv.rank}</div>
        <div onClick={handleDevTap} style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, marginTop: 4, userSelect: "none" }}>LVL {lv.level} · {xp.toLocaleString()} XP</div>
        {devResetVisible && (
          <button onClick={() => { if (confirm("Reset all XP and progress?")) { localStorage.clear(); location.reload(); } }} style={{ marginTop: 8, fontFamily: F.mono, fontSize: 11, color: C.red, background: "none", border: `1px solid ${C.red}40`, padding: "4px 12px", cursor: "pointer", letterSpacing: 1, opacity: 0.7 }}>⚠ DEV RESET</button>
        )}
        
        {/* Sync Status */}
        {user && (
          <div style={{ fontFamily: F.mono, fontSize: 10, color: syncing ? C.dim : C.green, marginTop: 4, letterSpacing: 1 }}>
            {syncing ? t("syncing").toUpperCase() : t("synced").toUpperCase()}
          </div>
        )}

        {/* Level progress bar */}
        <div style={{ maxWidth: 200, margin: "10px auto 0" }}>
          <div style={{ height: 4, background: C.border, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, lv.progress * 100)}%`, background: C.dim, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginTop: 4 }}>{xp - lv.cur} / {lv.nxt - lv.cur} to LVL {lv.level + 1}</div>
        </div>

        {/* Google Sign In Button */}
        {!user && !loading && (
          <button
            onClick={signInWithGoogle}
            style={{
              marginTop: 20,
              padding: "12px 16px",
              cursor: "pointer",
              fontFamily: F.mono,
              fontSize: 13,
              color: C.dim,
              background: "none",
              border: `1px solid ${C.border}`,
              letterSpacing: 0.5,
              textAlign: "left",
              whiteSpace: "nowrap",
            }}
          >
            &gt; ./authenticate --provider=google
          </button>
        )}
      </div>
      <Divider />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
        {[
          { l: t("total_xp"), v: xp.toLocaleString(), c: C.text },
          { l: t("solved_label"), v: String(solved.size), c: C.text },
          { l: "LEVEL", v: String(lv.level), c: C.text },
          { l: t("accuracy_label"), v: `${acc}%`, c: C.text },
        ].map((s, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
            <div style={{ fontFamily: F.mono, fontSize: 13, color: C.muted, letterSpacing: 1.5, marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontFamily: F.mono, fontSize: 32, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
      <Divider />
      <SkillRadar solved={solved} />
      <Divider />
      <ArchetypeViz solved={solved} />
      <Divider />

      {/* Achievements — expandable */}
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, letterSpacing: 1.5, marginBottom: 12 }}>┤ {t("achievements")} ({earnedAch.length}/{ACHIEVEMENTS.length}) ├</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {ACHIEVEMENTS.map((a, i) => {
            const earned = a.check(solved, xp);
            const expanded = expandedBadge === a.id;
            return (
              <div key={a.id} onClick={() => setExpandedBadge(expanded ? null : a.id)} style={{
                background: C.panel, border: `1px solid ${earned ? C.borderBright : C.border}`,
                padding: expanded ? "14px 10px" : "18px 10px", textAlign: "center",
                opacity: earned ? 1 : 0.3, cursor: "pointer",
                gridColumn: expanded ? "1 / -1" : "auto",
                transition: "all 0.2s",
                animation: earned ? `popIn 0.4s ease ${i * 0.1}s both` : "none",
              }}>
                <div style={{
                  fontFamily: F.mono, fontSize: expanded ? 42 : 36, marginBottom: 8,
                  color: earned ? C.text : C.muted,
                }}>{a.i}</div>
                <div style={{ fontFamily: F.mono, fontSize: 14, color: earned ? C.white : C.dim }}>{lang === "pt" ? a.n_pt : a.n_en}</div>
                {expanded && (
                  <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginTop: 6, animation: "fadeSlide 0.2s ease" }}>
                    {lang === "pt" ? a.d_pt : a.d_en}
                    {earned && <div style={{ color: C.cyan, marginTop: 4 }}>✓ {lang === "pt" ? "DESBLOQUEADO" : "UNLOCKED"}</div>}
                    {!earned && <div style={{ color: C.muted, marginTop: 4 }}>[ {lang === "pt" ? "BLOQUEADO" : "LOCKED"} ]</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.muted, marginTop: 20, lineHeight: 2.2, textAlign: "center" }}>
        {t("footer_1")}<br />{t("footer_2")}<br />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {loading ? (
             <span style={{ color: C.dim, fontSize: 12 }}>[ loading... ]</span>
          ) : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.cyanDim, cursor: "pointer", fontSize: 12 }} onClick={() => { if(confirm(lang === "pt" ? "Sair da conta?" : "Sign out?")) signOut(); }}>{t("logout")}</span>
              <span style={{ color: C.dim, fontSize: 11 }}>({user.email})</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  ONBOARDING
// ═══════════════════════════════════════════════════════════
function OnboardingScreen({ onComplete, lang }) {
  const [step, setStep] = useState(0);
  const ispt = lang === "pt";
  const slides = [
    { icon: ">_", title: ispt ? "BEM-VINDO AO PUNKSQL" : "WELCOME TO PUNKSQL", body: ispt ? "Aprenda SQL resolvendo desafios reais.\nEscreva queries, execute no navegador,\ne suba de nível como num jogo." : "Learn SQL by solving real challenges.\nWrite queries, execute in-browser,\nand level up like a game.", color: C.cyan },
    { icon: "◈", title: ispt ? "APRENDA" : "LEARN", body: ispt ? "A aba LEARN tem 8 módulos:\nSELECT → WHERE → ORDER BY → GROUP BY\n→ JOIN → Subqueries → Window → CTEs\n\nCada módulo tem 5-6 exercícios\nque vão do fácil ao expert." : "The LEARN tab has 8 modules:\nSELECT → WHERE → ORDER BY → GROUP BY\n→ JOIN → Subqueries → Window → CTEs\n\nEach module has 5-6 exercises\nranging from easy to expert.", color: C.green },
    { icon: ">", title: ispt ? "CODE + QUIZ" : "CODE + QUIZ", body: ispt ? "CODE: 41 desafios SQL reais.\nEscreva SQL, clique RUN para testar,\nSUBMIT para validar. Use os botões\nde keywords — sem precisar de teclado!\n\nQUIZ: 30 perguntas de múltipla\nescolha com timer de 15s." : "CODE: 41 real SQL challenges.\nWrite SQL, tap RUN to test,\nSUBMIT to validate. Use keyword\nbuttons — no keyboard needed!\n\nQUIZ: 30 multiple-choice questions\nwith a 15-second timer.", color: C.cyan },
    { icon: "◇", title: ispt ? "CARDS + XP" : "CARDS + XP", body: ispt ? "CARDS: Flashcards com swipe.\nDireita = sabia (+pts)\nEsquerda = não sabia (-1 vida)\n3 vidas — Game Over reseta!\n\nXP: Tudo dá XP — challenges, quiz,\ncards. Suba de nível e ganhe badges!" : "CARDS: Swipeable flashcards.\nRight = knew it (+pts)\nLeft = didn't know (-1 life)\n3 lives — Game Over resets!\n\nXP: Everything earns XP — challenges,\nquiz, cards. Level up and earn badges!", color: C.amber },
    { icon: "▲", title: ispt ? "PRONTO PARA COMEÇAR?" : "READY TO START?", body: ispt ? "Dica: Na tela de código, use\nos botões SQL no rodapé.\nToque na tela para mover o cursor.\nBotão ⌨ abre o teclado.\n\nComece pelo módulo 1: first_query\nBoa sorte, dev!" : "Tip: In the code editor, use\nthe SQL buttons at the bottom.\nTap the screen to move cursor.\nThe ⌨ button opens keyboard.\n\nStart with module 1: first_query\nGood luck, dev!", color: C.green },
  ];
  const s = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.void, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "24px 28px" }}>
      {/* Step indicator dots */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8, height: 2,
            background: i === step ? C.cyan : C.border,
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Icon / logo */}
      {step === 0 ? (
        <div style={{ marginBottom: 24 }}><AsciiLogo color={C.text} accent={C.dim} /></div>
      ) : (
        <div style={{
          fontFamily: F.mono, fontSize: 40, color: C.dim, marginBottom: 20,
        }}>{s.icon}</div>
      )}

      {/* Title */}
      <div style={{
        fontFamily: F.mono, fontSize: 18, color: C.text, letterSpacing: 3,
        marginBottom: 20, textAlign: "center",
      }}>{step === 0 ? null : s.title}</div>

      {/* Body */}
      <div style={{
        fontFamily: F.mono, fontSize: 15, color: C.dim, lineHeight: 2,
        textAlign: "center", whiteSpace: "pre-wrap", maxWidth: 360,
        marginBottom: 40,
      }}>{s.body}</div>

      {/* Nav buttons */}
      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 360 }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{
            flex: 1, padding: "14px 0", cursor: "pointer",
            fontFamily: F.mono, fontSize: 15, color: C.dim,
            background: "none", border: `1px solid ${C.border}`, minHeight: 50,
          }}>← BACK</button>
        )}
        <button onClick={() => isLast ? onComplete() : setStep(step + 1)} style={{
          flex: 2, padding: "14px 0", cursor: "pointer",
          fontFamily: F.mono, fontSize: 15, color: C.cyan, fontWeight: 700,
          background: "none", border: `1px solid ${C.cyan}`, minHeight: 50,
          letterSpacing: 2,
        }}>{isLast ? (ispt ? "COMEÇAR ▶" : "START ▶") : (ispt ? "PRÓXIMO ▶" : "NEXT ▶")}</button>
      </div>

      {/* Skip */}
      {!isLast && (
        <button onClick={onComplete} style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: F.mono, fontSize: 13, color: C.muted, marginTop: 16,
          letterSpacing: 1,
        }}>{ispt ? "PULAR >" : "SKIP >"}</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════
export default function PunkSQLCLI() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [appFocusMode, setAppFocusMode] = useState(false);
  const [lang, setLang] = useState("en");
  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState("main");

  // Dual memory: last code challenge + last learn module
  const [lastCodeId, setLastCodeId] = useState(1);
  const [lastLearnId, setLastLearnId] = useState(1);
  const [lastContext, setLastContext] = useState("code");

  // Persistent XP (loads from storage on mount)
  const [xp, setXp] = useState(0);
  const [solved, setSolved] = useState(new Set());
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Supabase Sync
  const { syncing, logAttempt } = useProgress(
    { xp, solved_ids: Array.from(solved), lang },
    (serverData) => {
      // Merge logic: take highest XP and union of solved IDs
      if (serverData.xp > xp) setXp(serverData.xp);
      if (serverData.solved_ids?.length > (solved.size || 0)) {
        setSolved(prev => new Set([...Array.from(prev), ...serverData.solved_ids]));
      }
      if (serverData.lang) setLang(serverData.lang);
    }
  );

  // Load progress from persistent storage on mount
  useEffect(() => {
    const data = loadProgress();
    if (data) {
      setXp(data.xp || 0);
      setSolved(new Set(data.solved || []));
      if (data.lang) setLang(data.lang);
      if (data.lastCodeId) setLastCodeId(data.lastCodeId);
      if (data.lastLearnId) setLastLearnId(data.lastLearnId);
      if (data.lastContext) setLastContext(data.lastContext);
    }
    setStorageLoaded(true);
  }, []);

  // Save progress whenever xp/solved/lang/resume state changes (after initial load)
  useEffect(() => {
    if (storageLoaded) saveProgress(xp, solved, lang, lastCodeId, lastLearnId, lastContext);
  }, [xp, solved, lang, lastCodeId, lastLearnId, lastContext, storageLoaded]);
  // Level up, badge, and XP breakdown overlays
  const [levelUpShow, setLevelUpShow] = useState(null);
  const [badgeShow, setBadgeShow] = useState(null);
  const [xpBreakdownShow, setXpBreakdownShow] = useState(null);
  const pendingXPBreakdown = useRef(null);
  const levelUpActive = useRef(false);
  const prevLevel = useRef(getLevel(0).level);
  const prevEarned = useRef(new Set());

  const markSolved = useCallback((id) => {
    setSolved(prev => {
      const next = new Set(prev);
      next.add(id);
      window.__qq_solved = next;
      return next;
    });
  }, []);
  const addXP = useCallback((pts, challengeId) => {
    // Only award XP on first solve
    if (challengeId && window.__qq_solved?.has(challengeId)) return;
    setXp(prev => {
      const n = prev + pts;
      window.__qq_xp = n;
      // Check level up
      const oldLv = getLevel(prev).level;
      const newLv = getLevel(n).level;
      if (newLv > oldLv) { levelUpActive.current = true; setTimeout(() => { setLevelUpShow(newLv); SFX.play("levelup"); }, 300); }
      return n;
    });
    if (challengeId && pts > 0) markSolved(challengeId);
  }, [markSolved]);

  const handleXP = useCallback((pts, challengeId, details) => {
    addXP(pts, challengeId);
    if (details) {
       logAttempt({
         challenge_id: challengeId,
         ...details
       });
    }
  }, [addXP, logAttempt]);

  const handleXPBreakdown = useCallback((bd) => {
    if (levelUpActive.current) {
      pendingXPBreakdown.current = bd;
    } else {
      setTimeout(() => setXpBreakdownShow(bd), 400);
    }
  }, []);

  const dismissLevelUp = useCallback(() => {
    setLevelUpShow(null);
    levelUpActive.current = false;
    if (pendingXPBreakdown.current) {
      const bd = pendingXPBreakdown.current;
      pendingXPBreakdown.current = null;
      setTimeout(() => setXpBreakdownShow(bd), 250);
    }
  }, []);

  // Check for new badge unlocks after solved changes
  useEffect(() => {
    const newEarned = ACHIEVEMENTS.filter(a => a.check(solved, xp));
    const newIds = newEarned.map(a => a.id);
    const freshUnlock = newIds.find(id => !prevEarned.current.has(id));
    if (freshUnlock && solved.size > 0) {
      const badge = ACHIEVEMENTS.find(a => a.id === freshUnlock);
      if (badge) setTimeout(() => { setBadgeShow(badge); SFX.play("badge"); }, levelUpShow ? 2800 : 500);
    }
    prevEarned.current = new Set(newIds);
  }, [solved, xp]);

  const t = useCallback(k => i18n[lang][k] || k, [lang]);

  const LEARN_MODULES = [
    { id: 1, n: "first_query" }, { id: 2, n: "filtering" }, { id: 3, n: "sorting" },
    { id: 4, n: "aggregations" }, { id: 5, n: "joins" }, { id: 6, n: "subqueries" },
    { id: 7, n: "window_fn" }, { id: 8, n: "ctes" },
    { id: 9, n: "dml" }, { id: 10, n: "ddl" },
  ];

  const nav = (target, id) => {
    if (target === "challenge") {
      if (id) setLastCodeId(id);
      setLastContext("code");
      setScreen("challenge");
    } else if (target === "lesson") {
      if (id) setLastLearnId(id);
      setLastContext("learn");
      setScreen("lesson");
    } else if (target === "daily") {
      setScreen("daily");
    } else {
      setTab(target);
    }
  };

  const currentCode = CHALLENGES_DB.find(c => c.id === lastCodeId);
  const currentMod = LEARN_MODULES.find(m => m.id === lastLearnId);
  const isLearnCtx = lastContext === "learn";
  const continueCtx = isLearnCtx
    ? (lang === "pt" ? "CONTINUAR LIÇÃO" : "CONTINUE LESSON")
    : (lang === "pt" ? "CONTINUAR CÓDIGO" : "CONTINUE CODING");
  const continueLabel = isLearnCtx
    ? `#${lastLearnId} ${currentMod?.n || "aggregations"}`
    : `#${lastCodeId} ${currentCode?.title || "select_all"}`;
  const handleContinue = () => {
    if (isLearnCtx) nav("lesson", lastLearnId);
    else nav("challenge", lastCodeId);
  };

  // Lesson exercise navigation (hooks must be before any returns)
  const lessonExercises = CHALLENGES_DB.filter(c => c.mod === lastLearnId);
  const [lessonChId, setLessonChId] = useState(() => {
    const first = CHALLENGES_DB.filter(c => c.mod === 4)[0];
    return first?.id || 1;
  });
  useEffect(() => {
    const first = CHALLENGES_DB.filter(c => c.mod === lastLearnId)[0];
    if (first) setLessonChId(first.id);
  }, [lastLearnId]);

  const handleLessonNav = useCallback((id) => {
    setLessonChId(id);
    const ch = CHALLENGES_DB.find(c => c.id === id);
    if (ch) setLastLearnId(ch.mod);
    setLastCodeId(id);
    setLastContext("learn");
  }, []);

  const handleCodeNav = useCallback((id) => {
    setLastCodeId(id);
    setLastContext("code");
  }, []);

  const MAIN_TABS = ["home", "learn", "practice", "quiz", "review", "profile"];
  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);
  const swipeInScrollable = useRef(false);
  const handleSwipeStart = useCallback((e) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    let el = e.target;
    let inScrollable = false;
    while (el && el !== e.currentTarget) {
      const ox = window.getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth) {
        inScrollable = true;
        break;
      }
      el = el.parentElement;
    }
    swipeInScrollable.current = inScrollable;
  }, []);
  const handleSwipeEnd = useCallback((e) => {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (swipeInScrollable.current) return;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const idx = MAIN_TABS.indexOf(tab);
    if (dx < 0 && idx < MAIN_TABS.length - 1) setTab(MAIN_TABS[idx + 1]);
    if (dx > 0 && idx > 0) setTab(MAIN_TABS[idx - 1]);
  }, [tab]);

  const shell = { maxWidth: 480, margin: "0 auto", height: "var(--app-h, 100dvh)", background: "#000000", fontFamily: F.mono, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" };
  const ctx = { lang, t };

  // Build focus title from current challenge
  const focusCh = CHALLENGES_DB.find(c => c.id === (screen === "lesson" ? lessonChId : lastCodeId));
  const focusTitle = appFocusMode && focusCh ? `#${focusCh.id} ${focusCh.title}` : null;

  if (showOnboarding) return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines /><OnboardingScreen lang={lang} onComplete={() => setShowOnboarding(false)} /></div></LangContext.Provider>
  );

  // Daily challenge rotates by date
  const dailyChallengeId = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    return CHALLENGES_DB[dayOfYear % CHALLENGES_DB.length].id;
  })();

  if (screen === "daily") return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <ChallengeScreen key="daily" onBack={() => setScreen("main")} challengeId={dailyChallengeId} onXP={handleXP} onXPBreakdown={handleXPBreakdown} isDaily={true} onNext={(id) => { setLastCodeId(id); setLastContext("code"); setScreen("challenge"); }} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={dismissLevelUp} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
      {xpBreakdownShow && <XPBreakdownOverlay breakdown={xpBreakdownShow} lang={lang} onDone={() => setXpBreakdownShow(null)} />}
    </div></LangContext.Provider>
  );

  if (screen === "challenge") return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <ChallengeScreen key={lastCodeId} onBack={() => setScreen("main")} challengeId={lastCodeId} onXP={handleXP} onXPBreakdown={handleXPBreakdown} exercises={CHALLENGES_DB} onExNav={handleCodeNav} onNext={(id) => { setLastCodeId(id); setLastContext("code"); }} solved={solved} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={dismissLevelUp} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
      {xpBreakdownShow && <XPBreakdownOverlay breakdown={xpBreakdownShow} lang={lang} onDone={() => setXpBreakdownShow(null)} />}
    </div></LangContext.Provider>
  );

  if (screen === "lesson") return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <ChallengeScreen key={`lesson-${lessonChId}`} onBack={() => setScreen("main")} challengeId={lessonChId} onXP={handleXP} onXPBreakdown={handleXPBreakdown} exercises={lessonExercises} onExNav={handleLessonNav} onNext={handleLessonNav} solved={solved} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={dismissLevelUp} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
      {xpBreakdownShow && <XPBreakdownOverlay breakdown={xpBreakdownShow} lang={lang} onDone={() => setXpBreakdownShow(null)} />}
    </div></LangContext.Provider>
  );

  return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <TopBar lang={lang} setLang={setLang} startCollapsed={tab !== "home"} showContinue onContinue={handleContinue} continueLabel={continueLabel} continueCtx={continueCtx} />
      <StatusBar xp={xp} solved={solved} />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", zIndex: 1 }} onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
        {tab === "home" && <HomeScreen onNavigate={nav} solved={solved} xp={xp} />}
        {tab === "learn" && <LearnScreen onNavigate={nav} solved={solved} />}
        {tab === "practice" && <PracticeScreen onNavigate={nav} solved={solved} />}
        {tab === "quiz" && <QuizScreen onXP={handleXP} />}
        {tab === "review" && <ReviewScreen onXP={handleXP} />}
        {tab === "profile" && <ProfileScreen xp={xp} solved={solved} syncing={syncing} />}
      </div>
      <TabBar active={tab} onTabChange={setTab} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={dismissLevelUp} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
      {xpBreakdownShow && <XPBreakdownOverlay breakdown={xpBreakdownShow} lang={lang} onDone={() => setXpBreakdownShow(null)} />}
    </div></LangContext.Provider>
  );
}
