import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ═══════════════════════════════════════════════════════════
//  QUERYQUEST // CYBERPUNK CLI — XL MOBILE
// ═══════════════════════════════════════════════════════════

// ── Persistent Storage Helpers ────────────────────────────
const STORAGE_KEY = "qq-save";
async function loadProgress() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch(e) {}
  // Fallback to window globals
  try {
    if (typeof window.__qq_xp === "number") return { xp: window.__qq_xp, solved: [...(window.__qq_solved || [])], lang: "en" };
  } catch(e) {}
  return null;
}
async function saveProgress(xp, solved, lang) {
  try {
    const data = JSON.stringify({ xp, solved: [...solved], lang, ts: Date.now() });
    await window.storage.set(STORAGE_KEY, data);
  } catch(e) {}
  // Also keep window globals as fallback
  try { window.__qq_xp = xp; window.__qq_solved = solved; } catch(e) {}
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
  void: "#020410", black: "#060C18", panel: "#0A1224", surface: "#0E1830",
  border: "#163050", borderBright: "#1A5080",
  cyan: "#00F0FF", cyanDim: "#40C8E0", cyanGhost: "rgba(0,240,255,0.08)",
  cyanGlow: "rgba(0,240,255,0.18)", cyanHot: "#80FFFF",
  green: "#00FF88", greenDim: "#40DD88", greenGhost: "rgba(0,255,136,0.10)",
  amber: "#FFB800", amberDim: "#E0B040", amberGhost: "rgba(255,184,0,0.10)",
  red: "#FF3050", redDim: "#E04060", redGhost: "rgba(255,48,80,0.10)",
  white: "#F0F8FF", dim: "#A0C0D4", muted: "#5A7E98", purple: "#D0A0FF",
};

const F = { mono: "'Share Tech Mono', 'Fira Code', 'JetBrains Mono', 'Courier New', monospace" };

// ── i18n ──────────────────────────────────────────────────
const i18n = {
  en: {
    tab_home: "HOME", tab_learn: "LEARN", tab_code: "CODE", tab_cards: "CARDS", tab_user: "USER",
    boot_1: "[SYS] QueryQuest v1.0 // init",
    boot_2: "[NET] sandbox:5432 ok",
    boot_3: "[USR] eduardo // lvl 12",
    daily_challenge: "daily_challenge", challenge_name: "revenue_by_quarter",
    challenge_desc: "Calculate total revenue per quarter. Find the highest growth rate.",
    execute: "[ EXECUTE ]", resume: "RESUME", daily_quests: "DAILY_QUESTS",
    quest_1_cmd: "solve --count 2", quest_2_cmd: "review --cards 10", quest_3_cmd: "earn --xp 100",
    stat_today: "TODAY", stat_week: "WEEK", stat_acc: "ACC", stat_solved: "solved", stat_correct: "correct",
    learn_cmd: "ls -la", learn_title: "SQL_FUNDAMENTALS",
    learn_sub: "// zero to interview // 8 modules",
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
    practice_showing: "// {n} of 80",
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
    league_title: "league_silver", league_sub: "// resets 4d | top 10 → GOLD",
    achievements: "ACHIEVEMENTS",
    badge_1: "1st_SELECT", badge_2: "JOIN_MASTER", badge_3: "7D_STREAK",
    badge_4: "SPEED", badge_5: "OWL", badge_6: "PERFECT",
    footer_1: "QueryQuest v1.0", footer_2: "duckdb // 23ms",
    settings: "[ settings ]", logout: "[ logout ]",
    continue_lesson: "CONTINUE LESSON",
    continue_mod: "mod_04 // aggregations",
  },
  pt: {
    tab_home: "INÍCIO", tab_learn: "TRILHA", tab_code: "CÓDIGO", tab_cards: "CARDS", tab_user: "PERFIL",
    boot_1: "[SIS] QueryQuest v1.0 // init",
    boot_2: "[NET] sandbox:5432 ok",
    boot_3: "[USR] eduardo // nvl 12",
    daily_challenge: "desafio_diário", challenge_name: "receita_trimestre",
    challenge_desc: "Calcule a receita total por trimestre. Ache a maior taxa de crescimento.",
    execute: "[ EXECUTAR ]", resume: "CONTINUAR", daily_quests: "MISSÕES_DIÁRIAS",
    quest_1_cmd: "resolver --total 2", quest_2_cmd: "revisar --cards 10", quest_3_cmd: "ganhar --xp 100",
    stat_today: "HOJE", stat_week: "SEMANA", stat_acc: "PREC", stat_solved: "resolvidos", stat_correct: "corretos",
    learn_cmd: "ls -la", learn_title: "FUNDAMENTOS_SQL",
    learn_sub: "// do zero à entrevista // 8 módulos",
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
    practice_showing: "// {n} de 80",
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
    league_title: "liga_prata", league_sub: "// reseta 4d | top 10 → OURO",
    achievements: "CONQUISTAS",
    badge_1: "1º_SELECT", badge_2: "JOIN", badge_3: "SÉRIE_7D",
    badge_4: "VELOZ", badge_5: "CORUJA", badge_6: "PERFEITO",
    footer_1: "QueryQuest v1.0", footer_2: "duckdb // 23ms",
    settings: "[ config ]", logout: "[ sair ]",
    continue_lesson: "CONTINUAR LIÇÃO",
    continue_mod: "mod_04 // agregações",
  },
};

const LangContext = createContext({ lang: "en", t: (k) => k });
function useLang() { return useContext(LangContext); }

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes scanline{0%{top:-100%}100%{top:100%}}
@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes crtFlicker{0%,100%{opacity:1}50%{opacity:0.98}}
@keyframes pulseGlow{0%,100%{text-shadow:0 0 8px rgba(0,240,255,0.5)}50%{text-shadow:0 0 20px rgba(0,240,255,0.9),0 0 36px rgba(0,240,255,0.4)}}
@keyframes nodeActive{0%,100%{box-shadow:0 0 12px rgba(0,240,255,0.5),inset 0 0 12px rgba(0,240,255,0.15)}50%{box-shadow:0 0 28px rgba(0,240,255,0.8),inset 0 0 16px rgba(0,240,255,0.25)}}
@keyframes flipCard{0%{transform:perspective(600px) rotateY(0)}50%{transform:perspective(600px) rotateY(90deg)}100%{transform:perspective(600px) rotateY(0)}}
@keyframes streakPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)}}
@keyframes bootLine{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
@keyframes langSwitch{from{opacity:0.85}to{opacity:1}}
@keyframes levelUp{0%{transform:scale(0.5);opacity:0}20%{transform:scale(1.2);opacity:1}40%{transform:scale(0.95)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes badgeUnlock{0%{transform:scale(0) rotate(-180deg);opacity:0}50%{transform:scale(1.3) rotate(10deg);opacity:1}75%{transform:scale(0.9) rotate(-5deg)}100%{transform:scale(1) rotate(0)}}
@keyframes shinePass{0%{left:-100%}100%{left:200%}}
@keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
*{scrollbar-width:thin;-webkit-tap-highlight-color:transparent}
textarea:focus{outline:none}button{-webkit-tap-highlight-color:transparent}
`;

// ── Utilities ─────────────────────────────────────────────
const Cursor = () => <span style={{ display: "inline-block", width: 12, height: 20, background: C.cyan, marginLeft: 4, animation: "blink 530ms step-end infinite", boxShadow: `0 0 10px ${C.cyan}80` }} />;

const Prompt = ({ path = "~" }) => (
  <span style={{ fontFamily: F.mono, fontSize: 15 }}>
    <span style={{ color: C.green }}>user</span><span style={{ color: C.dim }}>@</span><span style={{ color: C.purple }}>qq</span>
    <span style={{ color: C.dim }}>:</span><span style={{ color: C.amber }}>{path}</span><span style={{ color: C.cyan }}> $</span>
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
    {title && <div style={{ position: "absolute", top: -10, left: 16, background: C.panel, padding: "0 10px", fontFamily: F.mono, fontSize: 16, color: C.cyanDim, letterSpacing: 1.5 }}>┤ {title} ├</div>}
    <div style={{ padding: "22px 18px" }}>{children}</div>
  </div>
);

const Scanlines = () => (
  <>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 999, background: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(0,0,0,0.06) 4px,rgba(0,0,0,0.06) 8px)", mixBlendMode: "multiply" }} />
    <div style={{ position: "absolute", left: 0, right: 0, height: 10, zIndex: 999, pointerEvents: "none", background: `linear-gradient(180deg,transparent,${C.cyan}05,transparent)`, animation: "scanline 6s linear infinite" }} />
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 998, background: "radial-gradient(ellipse at center,transparent 65%,rgba(0,0,0,0.35) 100%)" }} />
  </>
);

// ── Level & Achievement System ────────────────────────────
const LEVELS = [0,25,75,150,250,400,600,850,1150,1500,1900,2400,3000,3700,4500,5500,6700,8000,9500,11200];
function getLevel(xp) {
  let lvl = 1;
  for (let i = 1; i < LEVELS.length; i++) { if (xp >= LEVELS[i]) lvl = i + 1; else break; }
  const cur = LEVELS[lvl - 1] || 0;
  const nxt = LEVELS[lvl] || LEVELS[LEVELS.length - 1] + 2000;
  return { level: lvl, cur, nxt, progress: (xp - cur) / (nxt - cur) };
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
  { id: "all_done", i: "◈", n_en: "SQL Master", n_pt: "SQL Mestre", d_en: "Solve all 80 challenges", d_pt: "Resolva todos os 80 desafios", c: C.cyanHot, check: (s) => s.size >= 80 },
];

function LevelUpOverlay({ level, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 9999, background: `${C.void}E0`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
      <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, letterSpacing: 3, marginBottom: 12, animation: "fadeSlide 0.3s ease" }}>LEVEL UP</div>
      <div style={{ fontFamily: F.mono, fontSize: 72, color: C.cyan, textShadow: `0 0 40px ${C.cyan}80, 0 0 80px ${C.cyan}40`, animation: "levelUp 0.8s ease", lineHeight: 1 }}>{level}</div>
      <div style={{ width: 120, height: 2, background: C.cyan, margin: "16px 0", boxShadow: `0 0 20px ${C.cyan}`, animation: "fadeSlide 0.5s ease 0.3s both" }} />
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.cyanDim, letterSpacing: 2, animation: "fadeSlide 0.5s ease 0.5s both" }}>+{LEVELS[level - 1] ? LEVELS[level] - LEVELS[level - 1] : "???"} XP to next</div>
    </div>
  );
}

function BadgeUnlockOverlay({ badge, lang, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 9998, background: `${C.void}E0`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, letterSpacing: 3, marginBottom: 16, animation: "fadeSlide 0.3s ease" }}>ACHIEVEMENT UNLOCKED</div>
      <div style={{ fontSize: 64, animation: "badgeUnlock 0.8s ease", color: badge.c, textShadow: `0 0 30px ${badge.c}80`, marginBottom: 12 }}>{badge.i}</div>
      <div style={{ fontFamily: F.mono, fontSize: 20, color: badge.c, letterSpacing: 2, animation: "fadeSlide 0.4s ease 0.3s both", textShadow: `0 0 12px ${badge.c}40` }}>{lang === "pt" ? badge.n_pt : badge.n_en}</div>
      <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, marginTop: 8, animation: "fadeSlide 0.4s ease 0.5s both" }}>{lang === "pt" ? badge.d_pt : badge.d_en}</div>
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
                border: `1.5px solid ${isCur ? C.cyan : C.border}`,
                cursor: "pointer", fontFamily: F.mono, fontSize: compact ? 8 : 9, fontWeight: 700,
                color: isCur ? C.black : C.dim,
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: "rotate(45deg)",
                boxShadow: isCur ? `0 0 6px ${C.cyan}50` : "none",
                padding: 0, flexShrink: 0,
              }}>
                <span style={{ transform: "rotate(-45deg)" }}>{i + 1}</span>
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
          <button onClick={onContinue} style={{ background: C.cyanGhost, border: `1px solid ${C.cyan}40`, cursor: "pointer", fontFamily: F.mono, fontSize: 12, color: C.cyan, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, overflow: "hidden", flex: 1, minWidth: 0 }}>
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
          background: C.cyan, border: `1px solid ${C.cyanHot}`, cursor: "pointer",
          fontFamily: F.mono, fontSize: 12, color: C.black, fontWeight: 700,
          padding: "7px 10px", display: "flex", alignItems: "center", gap: 6,
          boxShadow: `0 0 10px ${C.cyan}30`, letterSpacing: 0.5,
          overflow: "hidden", flexShrink: 1, minWidth: 0,
        }}>
          <span style={{ flexShrink: 0 }}>▶</span>
          <div style={{ textAlign: "left", overflow: "hidden", minWidth: 0 }}>
            <div style={{ fontSize: 13, lineHeight: 1.2, whiteSpace: "nowrap" }}>{continueCtx}</div>
            <div style={{ fontSize: 12, color: `${C.black}80`, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{continueLabel}</div>
          </div>
        </button>
      ) : <div style={{ flex: 1 }} />}
      {/* Spacer */}
      {!exercises && <div style={{ flex: 1 }} />}
      {/* Right: Lang switcher + collapse */}
      <div style={{ display: "flex", position: "relative", border: `1px solid ${C.cyan}50`, background: C.void, overflow: "hidden", width: 110, flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 1, bottom: 1, left: lang === "en" ? 1 : "50%", width: "calc(50% - 1px)", background: C.cyan, transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 14px ${C.cyan}50`, zIndex: 0 }} />
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
      <span style={{ color, textShadow: `0 0 10px ${color}50` }}>{"█".repeat(f)}</span>
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
    { id: "home", label: t("tab_home"), icon: "⌂" },
    { id: "learn", label: t("tab_learn"), icon: "◈" },
    { id: "practice", label: t("tab_code"), icon: ">" },
    { id: "quiz", label: "QUIZ", icon: "?" },
    { id: "review", label: t("tab_cards"), icon: "◇" },
    { id: "profile", label: t("tab_user"), icon: "◉" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.black, position: "sticky", bottom: 0, zIndex: 100, padding: "0 0 env(safe-area-inset-bottom, 14px)" }}>
      {tabs.map(tab => {
        const on = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            padding: "14px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            position: "relative", minHeight: 62,
          }}>
            {on && <div style={{ position: "absolute", top: -1, left: "12%", right: "12%", height: 3, background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` }} />}
            <span style={{ fontFamily: F.mono, fontSize: 34, color: on ? C.cyan : C.dim, textShadow: on ? `0 0 12px ${C.cyan}80` : "none", transition: "all 0.2s" }}>{tab.icon}</span>
            <span style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1.5, color: on ? C.cyan : C.dim }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Status Bar ────────────────────────────────────────────
function StatusBar({ xp = 0, solved = new Set() }) {
  const [time, setTime] = useState("");
  useEffect(() => { const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  const lv = getLevel(xp);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: C.black }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.amber, letterSpacing: 1 }}>LVL</span>
            <span style={{ fontFamily: F.mono, fontSize: 22, color: C.amber, textShadow: `0 0 8px ${C.amber}40` }}>{lv.level}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.cyan }}>XP</span>
            <span style={{ fontFamily: F.mono, fontSize: 22, color: C.cyanHot, textShadow: `0 0 8px ${C.cyan}40` }}>{xp.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.green }}>{solved.size}/{CHALLENGES_DB.length}</span>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, letterSpacing: 1 }}>{time}</span>
        </div>
      </div>
      {/* XP progress to next level */}
      <div style={{ padding: "0 18px 8px" }}>
        <div style={{ height: 3, background: C.border, position: "relative", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, lv.progress * 100)}%`, background: C.cyan, boxShadow: `0 0 6px ${C.cyan}60`, transition: "width 0.5s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HOME
// ═══════════════════════════════════════════════════════════
function HomeScreen({ onNavigate, solved = new Set(), xp = 0 }) {
  const { t, lang } = useLang();
  const solvedToday = solved.size; // simplified — in production would filter by date
  const quests = [
    { cmd: t("quest_1_cmd"), cur: Math.min(solvedToday, 2), max: 2, xp: 30, done: solvedToday >= 2 },
    { cmd: t("quest_2_cmd"), cur: Math.min(xp, 100), max: 100, xp: 20, done: xp >= 100 },
    { cmd: t("quest_3_cmd"), cur: Math.min(solved.size, 5), max: 5, xp: 25, done: solved.size >= 5 },
  ];
  return (
    <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 18, animation: "langSwitch 0.3s ease" }}>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, lineHeight: 2.2 }}>
        {[t("boot_1"), t("boot_2"), t("boot_3")].map((line, i) => (
          <div key={i} style={{ animation: `bootLine 0.3s ease ${i * 0.15}s both` }}>
            <span style={{ color: C.cyanDim }}>{line.split("]")[0]}]</span><span style={{ color: C.dim }}>{line.split("]").slice(1).join("]")}</span>
          </div>
        ))}
      </div>
      <Divider char="═" color={C.borderBright} />

      <CLIBox title={t("daily_challenge")} color={C.borderBright}>
        {(() => {
          const dc = CHALLENGES_DB.find(c => c.id === 17) || CHALLENGES_DB[0];
          const dcDesc = lang === "pt" ? dc.desc_pt : dc.desc_en;
          return (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 26, color: C.cyan, animation: "pulseGlow 3s ease infinite" }}>{dc.title}</div>
                <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 8 }}><Prompt path="/daily" /></div>
              </div>
              <Tag color={dc.color}>{dc.diff}</Tag>
            </div>
            <p style={{ fontFamily: F.mono, fontSize: 20, color: C.dim, lineHeight: 1.9, margin: "0 0 18px" }}>
              <span style={{ color: C.cyanDim }}>// </span>{dcDesc}
            </p>
          </>);
        })()}
        <button onClick={() => onNavigate("daily")} style={{
          width: "100%", padding: "16px 0", cursor: "pointer",
          fontFamily: F.mono, fontSize: 19, letterSpacing: 3, fontWeight: 700,
          color: C.black, background: C.cyan, border: `1px solid ${C.cyan}`,
          boxShadow: `0 0 24px ${C.cyan}35, inset 0 0 24px ${C.cyan}25`,
          minHeight: 62,
        }}>{t("execute")}</button>
      </CLIBox>

      {(() => {
        // Find first active module (first not-fully-solved)
        const modDefs = [{ id:1,n:"first_query",tp:"SELECT, FROM, DISTINCT, LIMIT"},{id:2,n:"filtering",tp:"WHERE, AND/OR, IN, LIKE"},{id:3,n:"sorting",tp:"ORDER BY, ASC/DESC, LIMIT"},{id:4,n:"aggregations",tp:"COUNT, SUM, AVG, GROUP BY"},{id:5,n:"joins",tp:"INNER JOIN, LEFT JOIN, ON"},{id:6,n:"subqueries",tp:"IN, NOT IN, EXISTS"},{id:7,n:"window_fn",tp:"ROW_NUMBER, RANK, LAG"},{id:8,n:"ctes",tp:"WITH, recursive CTEs"}];
        const activeMod = modDefs.find(m => {
          const chs = CHALLENGES_DB.filter(c => c.mod === m.id);
          return !chs.every(c => solved.has(c.id));
        }) || modDefs[0];
        const modChs = CHALLENGES_DB.filter(c => c.mod === activeMod.id);
        const modSolved = modChs.filter(c => solved.has(c.id)).length;
        const prog = modChs.length > 0 ? modSolved / modChs.length : 0;
        return (
          <button onClick={() => onNavigate("lesson", activeMod.id)} style={{ background: C.panel, border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", width: "100%", padding: "18px" }}>
            <div style={{ fontFamily: F.mono, fontSize: 19, color: C.cyanDim, letterSpacing: 1.5, marginBottom: 12 }}>┤ {t("resume")} ├</div>
            <div style={{ fontFamily: F.mono, fontSize: 34, color: C.white, marginBottom: 6 }}>
              mod_{String(activeMod.id).padStart(2, "0")}<span style={{ color: C.dim }}>://</span><span style={{ color: C.cyan }}>{activeMod.n}</span>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, marginBottom: 14 }}>{activeMod.tp}</div>
            <ProgressBar progress={prog} />
            <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, marginTop: 6 }}>{modSolved}/{modChs.length} solved</div>
          </button>
        );
      })()}

      <div>
        <div style={{ fontFamily: F.mono, fontSize: 19, color: C.cyanDim, letterSpacing: 1.5, marginBottom: 12 }}>┤ {t("daily_quests")} ├</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quests.map((q, i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${q.done ? C.greenDim : C.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, animation: `fadeSlide 0.3s ease ${i * 0.08}s both`, minHeight: 62 }}>

              <span style={{ fontFamily: F.mono, fontSize: 22, color: q.done ? C.green : C.dim, textShadow: q.done ? `0 0 8px ${C.green}60` : "none", width: 24, textAlign: "center" }}>{q.done ? "✓" : "○"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.mono, fontSize: 20, color: q.done ? C.greenDim : C.white }}>
                  <span style={{ color: C.dim }}>$ </span><span style={{ textDecoration: q.done ? "line-through" : "none", color: q.done ? C.dim : C.white }}>{q.cmd}</span>
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, marginTop: 5 }}>
                  [{q.cur}/{q.max}]{!q.done && <span style={{ marginLeft: 8 }}>{"█".repeat(Math.round((q.cur / q.max) * 8))}{"░".repeat(8 - Math.round((q.cur / q.max) * 8))}</span>}
                </div>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 17, color: q.done ? C.greenDim : C.cyanDim }}>+{q.xp}xp</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[{ label: t("stat_today"), value: String(solved.size), sub: t("stat_solved"), color: C.cyan, glow: C.cyan }, { label: "XP", value: xp.toLocaleString(), sub: "total", color: C.green, glow: C.green }, { label: t("stat_acc"), value: CHALLENGES_DB.length > 0 ? `${Math.round(solved.size / CHALLENGES_DB.length * 100)}%` : "0%", sub: t("stat_correct"), color: C.amber, glow: C.amber }].map((s, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${s.color}30`, padding: "18px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 16, color: s.color, letterSpacing: 1.5, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: F.mono, fontSize: 40, color: s.color, textShadow: `0 0 16px ${s.glow}40, 0 0 4px ${s.glow}20`, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 8, letterSpacing: 1 }}>{s.sub}</div>
          </div>
        ))}
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
    const s = allDone ? "done" : prevDone ? "active" : "lock";
    const p = total > 0 ? solvedCount / total : 0;
    const xpEarned = modChallenges.filter(c => solved.has(c.id)).reduce((sum, c) => {
      return sum + (c.diff === "EASY" ? 25 : c.diff === "MED" ? 50 : c.diff === "HARD" ? 75 : 100);
    }, 0);
    return { ...m, s, p, l: total, c: total, xp: xpEarned, solvedCount };
  });
  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginBottom: 8 }}><Prompt path="/learn" /> <span style={{ color: C.white }}>{t("learn_cmd")}</span></div>
      <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyan, marginBottom: 6, animation: "pulseGlow 3s ease infinite" }}>{t("learn_title")}</div>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginBottom: 20 }}>{t("learn_sub")}</div>
      <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ position: "absolute", left: 23, top: 30, bottom: 30, width: 2, background: `linear-gradient(180deg,${C.green},${C.cyan},${C.border})`, zIndex: 0 }} />
        {mods.map((m, i) => {
          const done = m.s === "done", act = m.s === "active", lock = m.s === "lock";
          const nc = done ? C.green : act ? C.cyan : C.dim;
          const clickable = !lock;
          const nodeBg = done ? "#081A12" : act ? "#081420" : "#060C18";
          return (
            <div
              key={m.id}
              onClick={clickable ? () => onNavigate("lesson", m.id) : undefined}
              style={{
                display: "flex", gap: 16, alignItems: "flex-start", padding: "10px 0",
                animation: `fadeSlide 0.3s ease ${i * 0.04}s both`,
                cursor: clickable ? "pointer" : "default",
                position: "relative", zIndex: 1,
              }}
            >
              <div style={{ width: 46, minWidth: 46, display: "flex", justifyContent: "center", paddingTop: 6, position: "relative", zIndex: 2 }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${nc}`, background: nodeBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: act ? `0 0 16px ${C.cyan}50` : `0 0 0 4px ${C.void}`, animation: act ? "nodeActive 2.5s ease infinite" : "none", transform: "rotate(45deg)", position: "relative", zIndex: 3 }}>
                  <span style={{ transform: "rotate(-45deg)", fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: nc }}>{m.id}</span>
                </div>
              </div>
              <div style={{
                flex: 1, background: C.panel,
                border: `1px solid ${act ? C.borderBright : C.border}`,
                padding: "16px 18px", opacity: lock ? 0.4 : 1,
                transition: "border-color 0.15s",
              }}
                onMouseEnter={e => clickable && (e.currentTarget.style.borderColor = act ? C.cyan : C.greenDim)}
                onMouseLeave={e => clickable && (e.currentTarget.style.borderColor = act ? C.borderBright : C.border)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: F.mono, fontSize: 15, color: done ? C.greenDim : act ? C.cyan : C.white }}>{done && <span style={{ color: C.greenDim }}>✓ </span>}{m.n}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 5 }}>{m.tp}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {done && <span style={{ fontFamily: F.mono, fontSize: 14, color: C.greenDim }}>+{m.xp}xp</span>}
                    {clickable && <span style={{ fontFamily: F.mono, fontSize: 16, color: act ? C.cyan : C.dim }}>▶</span>}
                  </div>
                </div>
                {act && <div style={{ marginTop: 12 }}><ProgressBar progress={m.p} /><div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 8 }}>{t("challenges")}: {m.solvedCount}/{m.c}</div></div>}
                {lock && <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 6 }}>{t("locked")} {mods[i - 1]?.n}</div>}
              </div>
            </div>
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
];
CHALLENGES_DB.forEach(ch => { ch.color = ch.diff === "EASY" ? C.green : ch.diff === "MED" ? C.cyan : ch.diff === "HARD" ? C.amber : C.red; });

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
function validateSQL(db, userSQL, expectedSQL) {
  const ur = runSQL(db, userSQL); if(!ur.ok) return {pass:false, msg:ur.msg, result:ur};
  const er = runSQL(db, expectedSQL);
  const us = ur.rows.map(r=>JSON.stringify(r)).sort(), es = er.rows.map(r=>JSON.stringify(r)).sort();
  if(us.length !== es.length) return {pass:false, msg:`Expected ${es.length} rows, got ${us.length}`, result:ur};
  if(!us.every((r,i)=>r===es[i])) return {pass:false, msg:"Row values don't match expected output", result:ur};
  return {pass:true, msg:`Correct! ${ur.rows.length} rows (${ur.ms}ms)`, result:ur};
}

// ═══════════════════════════════════════════════════════════
//  CHALLENGE EDITOR — Real SQL execution
// ═══════════════════════════════════════════════════════════
function ChallengeScreen({ onBack, challengeId = 1, onNext, onXP, isDaily = false, moduleId = null, onFocusChange }) {
  const { t, lang } = useLang();
  const ch = CHALLENGES_DB.find(c => c.id === challengeId) || CHALLENGES_DB[0];
  const nextCh = CHALLENGES_DB.find(c => c.id === challengeId + 1);

  // Module exercises for navigation dots (only when opened from Learn)
  const modExercises = moduleId ? CHALLENGES_DB.filter(c => c.mod === moduleId) : null;
  const modIdx = modExercises ? modExercises.findIndex(c => c.id === challengeId) : -1;
  const prevModCh = modExercises && modIdx > 0 ? modExercises[modIdx - 1] : null;
  const nextModCh = modExercises && modIdx < modExercises.length - 1 ? modExercises[modIdx + 1] : null;

  const [sql, setSql] = useState("SELECT \n  \nFROM ");
  const [result, setResult] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [resOpen, setResOpen] = useState(true);
  const [showSchema, setShowSchema] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [probOpen, setProbOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cPos, setCPos] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [db, setDb] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [focusMode, setFocusModeRaw] = useState(false);
  const setFocusMode = (v) => {
    const newVal = typeof v === "function" ? v(focusMode) : v;
    setFocusModeRaw(newVal);
    if (onFocusChange) onFocusChange(newVal);
  };
  const taRef = useRef(null), edRef = useRef(null), tapT = useRef(null);
  const kw = ["SELECT","FROM","WHERE","JOIN","ON","LEFT JOIN","GROUP BY","ORDER BY","HAVING","LIMIT","AS","AND","OR","IN","COUNT()","SUM()","AVG()","ROUND()","DESC","DISTINCT","SUBSTR()"];

  useEffect(() => { getDB().then(d => { setDb(d); setDbReady(true); }); }, []);

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

  const onTap = (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTapTime.current < 50) return;
    lastTapTime.current = now;
    const x = e.touches?.[0]?.clientX ?? e.clientX, y = e.touches?.[0]?.clientY ?? e.clientY;
    setCPos(tapToPos(x, y));
    isSwiping.current = false;
    // Tap toggles focus mode
    if (tapT.current) {
      clearTimeout(tapT.current);
      tapT.current = null;
      setFocusMode(f => !f);
    } else {
      tapT.current = setTimeout(() => { tapT.current = null; }, 350);
    }
  };

  const onEditorTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY, pos: cPos };
    isSwiping.current = false;
  };

  const onEditorTouchMove = (e) => {
    e.preventDefault(); // Always block native scroll
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStart.current.x;
    const dy = touch.clientY - swipeStart.current.y;

    // Only activate cursor movement after 8px threshold
    if (!isSwiping.current && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    isSwiping.current = true;

    // Calculate character and line offsets from swipe distance
    const charOffset = Math.round(dx / (charW * 1.5)); // 1.5x dampening for precision
    const lineOffset = Math.round(dy / (lineH * 0.8)); // 0.8x for comfortable vertical

    const startPos = swipeStart.current.pos;
    const lines = sql.split("\n");

    // Get start row/col
    let count = 0, startRow = 0, startCol = 0;
    for (let i = 0; i < lines.length; i++) {
      if (count + lines[i].length >= startPos) { startRow = i; startCol = startPos - count; break; }
      count += lines[i].length + 1;
    }

    // Apply offsets
    const newRow = Math.max(0, Math.min(lines.length - 1, startRow + lineOffset));
    const newCol = Math.max(0, Math.min(lines[newRow].length, startCol + charOffset));

    // Convert back to position
    let newPos = 0;
    for (let i = 0; i < newRow; i++) newPos += lines[i].length + 1;
    newPos += newCol;

    setCPos(newPos);
  };

  const onEditorTouchEnd = (e) => {
    if (!isSwiping.current) {
      // Was a tap, not a swipe — handle focus toggle + position cursor
      const touch = e.changedTouches?.[0];
      if (touch) {
        setCPos(tapToPos(touch.clientX, touch.clientY));
      }
      if (tapT.current) {
        clearTimeout(tapT.current);
        tapT.current = null;
        setFocusMode(f => !f);
      } else {
        tapT.current = setTimeout(() => { tapT.current = null; }, 350);
      }
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
  const handleRun = () => {
    if (!db) return;
    const r = runSQL(db, sql.trim());
    setResult(r);
    if (r.ok) {
      const v = validateSQL(db, sql.trim(), ch.validate);
      setVerdict(v);
      if (v.pass) {
        SFX.play("correct");
        if (onXP) {
          const pts = ch.diff === "EASY" ? 25 : ch.diff === "MED" ? 50 : ch.diff === "HARD" ? 75 : 100;
          onXP(pts + (isDaily ? 100 : 0), ch.id);
        }
      } else { SFX.play("wrong"); }
    } else {
      setVerdict(null);
      SFX.play("wrong");
    }
    setResOpen(true);
    setOpenPanel(null);
  };
  const clearResult = () => { setResult(null); setVerdict(null); };
  const resetSQL = () => { setSql("SELECT \n  \nFROM "); setCPos(7); setResult(null); setVerdict(null); };
  const desc = lang === "pt" ? ch.desc_pt : ch.desc_en;

  // Desktop keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
      if (e.key === "Escape" && !focusMode) { e.preventDefault(); onBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sql, db, focusMode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.void }}>
      {/* Header — hidden in focus mode (title moves to TopBar) */}
      {!focusMode && (
        <div style={{ padding: "6px 14px", borderBottom: `1px solid ${C.border}`, background: C.black, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.dim, padding: "5px 12px", minHeight: 32 }}>ESC</button>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: F.mono, fontSize: 14, color: C.cyan, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{ch.id} {ch.title}</div></div>
          <Tag color={ch.color}>{ch.diff}</Tag>
        </div>
      )}
      {/* Problem line — always visible (collapsed in focus mode) */}
      <button onClick={() => !focusMode && setProbOpen(!probOpen)} style={{ background: probOpen && !focusMode ? C.panel : C.black, border: "none", borderBottom: `1px solid ${C.border}`, cursor: focusMode ? "default" : "pointer", textAlign: "left", width: "100%", padding: focusMode ? "5px 14px" : "6px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {!focusMode && <span style={{ fontFamily: F.mono, fontSize: 14, color: C.cyanDim, transition: "transform 0.25s", transform: probOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>}
        <div style={{ fontFamily: F.mono, fontSize: focusMode ? 11 : 13, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}><span style={{ color: C.cyanDim }}>/* </span>{desc}<span style={{ color: C.cyanDim }}> */</span></div>
      </button>
      {probOpen && !focusMode && (
        <div style={{ padding: "0 14px 10px", borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, animation: "fadeSlide 0.2s ease" }}>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, lineHeight: 1.7, marginBottom: 8 }}>{desc}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={e => { e.stopPropagation(); setShowSchema(!showSchema); }} style={{ background: C.black, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.cyanDim, padding: "5px 10px", minHeight: 30 }}>{showSchema ? "HIDE" : "SCHEMA"}</button>
            <button onClick={e => { e.stopPropagation(); setShowHint(!showHint); }} style={{ background: C.black, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.amber, padding: "5px 10px", minHeight: 30 }}>{showHint ? "HIDE" : "HINT"}</button>
          </div>
          {showSchema && <div style={{ marginTop: 12, background: C.black, border: `1px solid ${C.border}`, padding: 14, fontFamily: F.mono, fontSize: 14, animation: "fadeSlide 0.15s ease" }}>{ch.schema.split("\n").map((l, i) => { const [t, ...c] = l.split(":"); return <div key={i} style={{ marginBottom: 4 }}><span style={{ color: C.purple }}>{t.trim()}</span><span style={{ color: C.dim }}>: </span><span style={{ color: C.green }}>{c.join(":").trim()}</span></div>; })}</div>}
          {showHint && <div style={{ marginTop: 12, background: C.amberGhost, border: `1px solid ${C.amberDim}`, padding: 14, fontFamily: F.mono, fontSize: 14, color: C.amber, lineHeight: 1.8 }}>{ch.hint}</div>}
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
          {!editing && <div onTouchMove={onDrag} onTouchStart={e => e.stopPropagation()} style={{ position: "absolute", left: `${18 + cCol * charW - charW}px`, top: `${14 + cRow * lineH}px`, zIndex: 10, pointerEvents: "auto", touchAction: "none", display: "flex", flexDirection: "column", alignItems: "center", transition: "left 0.05s,top 0.05s" }}>
              <div style={{ width: 2, height: lineH * 0.7, background: C.cyan, boxShadow: `0 0 8px ${C.cyan}80`, animation: "blink 1s step-end infinite" }} />
              <div style={{ width: 22, height: 22, background: C.cyan, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", marginTop: -1, boxShadow: `0 0 10px ${C.cyan}60`, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 7, height: 7, background: C.black, borderRadius: "50%", transform: "rotate(45deg)" }} /></div>
            </div>}
            {!dbReady && <div style={{ position: "absolute", top: 12, left: 18, fontFamily: F.mono, fontSize: 14, color: C.amber, animation: "blink 1s step-end infinite" }}>loading sql engine...</div>}
            <textarea ref={taRef} value={sql} onChange={e => { setSql(e.target.value); setCPos(e.target.selectionStart || 0); }} onBlur={handleBlur} onSelect={e => setCPos(e.target.selectionStart || 0)} readOnly={!editing} spellCheck={false} placeholder="-- write SQL here" style={{ width: "100%", minHeight: `${Math.max(200, (sql.split("\n").length + 3) * lineH)}px`, background: "transparent", border: "none", color: C.cyanHot, fontFamily: F.mono, fontSize: 18, lineHeight: 2, resize: "none", outline: "none", caretColor: editing ? C.cyan : "transparent", paddingTop: 6, cursor: "default", whiteSpace: "pre", overflowX: "hidden", overflowY: "hidden", wordWrap: "normal", overflowWrap: "normal", touchAction: "none" }} />
          </div>
        </div>
        {/* Hint bar */}
        <div style={{ padding: "2px 0", textAlign: "center", fontFamily: F.mono, fontSize: 10, color: C.muted, background: C.black, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          {!dbReady ? "loading sql engine..." : focusMode ? "FOCUS · swipe to move · tap or ✕ to exit" : "swipe to move cursor · tap to focus"}
        </div>
        {/* Results — shown in BOTH modes */}
        {result && (
          <div style={{ background: C.black, borderTop: `2px solid ${result.ok ? (verdict?.pass ? C.green : C.cyan) : C.red}`, flexShrink: 0 }}>
            {verdict && <div style={{ padding: "8px 16px", fontFamily: F.mono, fontSize: 15, color: verdict.pass ? C.green : C.red, background: verdict.pass ? C.greenGhost : C.redGhost, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }}>{verdict.pass ? "✓" : "✗"}</span>
              <span style={{ flex: 1 }}>{verdict.msg}</span>
              {verdict.pass && nextCh && (
                <button onClick={() => onNext && onNext(nextCh.id)} style={{ fontFamily: F.mono, fontSize: 14, color: C.black, background: C.cyan, border: `1px solid ${C.cyan}`, padding: "8px 16px", cursor: "pointer", letterSpacing: 1.5, boxShadow: `0 0 12px ${C.cyan}30`, animation: "pulseGlow 2s ease infinite" }}>
                  NEXT ▶
                </button>
              )}
              {verdict.pass && !nextCh && (
                <button onClick={onBack} style={{ fontFamily: F.mono, fontSize: 14, color: C.black, background: C.amber, border: `1px solid ${C.amber}`, padding: "8px 16px", cursor: "pointer", letterSpacing: 1.5 }}>
                  ALL DONE ✓
                </button>
              )}
            </div>}
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
            {/* Edit button to go back to coding */}
            <button onClick={clearResult} style={{ width: "100%", padding: "8px 0", cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.dim, background: C.panel, border: "none", borderTop: `1px solid ${C.border}`, letterSpacing: 1 }}>✎ EDIT CODE</button>
          </div>
        )}
        {/* Toolbars — hidden when result showing OR when keyboard is open */}
        {!result && !editing && (
          <>
            {/* ── Collapsible TBL / COLS / SQL panels ── */}
            {(() => {
              const tblNames = ch.schema.split("\n").map(l => l.split(":")[0].trim());
              const colNames = ch.schema.split("\n").flatMap(l => { const parts = l.split(":"); return parts.length > 1 ? parts.slice(1).join(":").split(",").map(c => c.trim()) : []; }).filter((v, i, a) => v && a.indexOf(v) === i);
              const panels = [
                { key: "tbl", label: "TBL", color: C.purple, items: tblNames.map(t => ({ text: t, color: C.purple, bg: `${C.purple}15`, border: `${C.purple}30` })) },
                { key: "cols", label: "COLS", color: C.green, items: colNames.map(c => ({ text: c, color: C.green, bg: "none", border: C.border })) },
                { key: "sql", label: "SQL", color: C.cyan, items: kw.map(k => ({ text: k, color: C.cyan, bg: C.cyanGhost, border: `${C.cyan}25` })) },
              ];
              return (
                <>
                  <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                    {panels.map(p => (
                      <button key={p.key} onClick={() => setOpenPanel(openPanel === p.key ? null : p.key)} style={{
                        flex: 1, padding: "9px 0", cursor: "pointer",
                        fontFamily: F.mono, fontSize: 14, fontWeight: 700, letterSpacing: 1,
                        color: openPanel === p.key ? C.black : p.color,
                        background: openPanel === p.key ? p.color : C.black,
                        border: "none", borderRight: `1px solid ${C.border}`,
                        transition: "all 0.15s",
                      }}>{p.label}</button>
                    ))}
                    <button onClick={() => setFocusMode(f => !f)} style={{
                      padding: "9px 14px", cursor: "pointer",
                      fontFamily: F.mono, fontSize: 14, fontWeight: 700, letterSpacing: 1,
                      color: focusMode ? C.black : C.amber,
                      background: focusMode ? C.amber : C.black,
                      border: "none",
                      transition: "all 0.15s", flexShrink: 0,
                    }}>{focusMode ? "✕" : "◉"}</button>
                  </div>
                  {openPanel && (() => {
                    const p = panels.find(x => x.key === openPanel);
                    if (!p) return null;
                    return (
                      <div style={{ padding: "5px 10px", background: C.panel, borderTop: `1px solid ${C.border}`, display: "flex", gap: 5, overflowX: "auto", flexShrink: 0, animation: "fadeSlide 0.15s ease" }}>
                        {p.items.map((item, i) => (
                          <button key={i} onClick={() => insert(item.text + " ")} style={{
                            background: item.bg, border: `1px solid ${item.border}`, cursor: "pointer",
                            padding: "8px 14px", whiteSpace: "nowrap",
                            fontFamily: F.mono, fontSize: 16, color: item.color, minHeight: 38,
                          }}>{item.text}</button>
                        ))}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
            {/* ── Utility keys ── */}
            <div style={{ padding: "5px 10px", background: C.panel, borderTop: `1px solid ${C.border}`, display: "flex", gap: 5, overflowX: "auto", flexShrink: 0 }}>
              <button onClick={backspace} style={{ background: C.redGhost, border: `1px solid ${C.red}40`, cursor: "pointer", padding: "6px 14px", fontFamily: F.mono, fontSize: 16, color: C.red, minHeight: 36, fontWeight: 700 }}>⌫</button>
              <button onClick={() => insert("\n")} style={{ background: C.cyanGhost, border: `1px solid ${C.cyan}40`, cursor: "pointer", padding: "6px 14px", fontFamily: F.mono, fontSize: 16, color: C.cyan, minHeight: 36, fontWeight: 700 }}>↵ ENTER</button>
              <button onClick={() => insert("  ")} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "6px 10px", fontFamily: F.mono, fontSize: 13, color: C.dim, minHeight: 36 }}>TAB</button>
              <button onClick={() => insert(" ")} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "6px 14px", fontFamily: F.mono, fontSize: 13, color: C.dim, minHeight: 36 }}>SPC</button>
              {["*",",","(",")","'","=",">","<",";","."].map(ch2 => (
                <button key={ch2} onClick={() => insert(ch2)} style={{ background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "6px 8px", fontFamily: F.mono, fontSize: 15, color: C.white, minHeight: 36 }}>{ch2}</button>
              ))}
            </div>
          </>
        )}
        {/* ── RUN button — shown when no result. When keyboard open, only show RUN (hide toolbars above) ── */}
        {!result && (
          <div onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ padding: "4px 14px 6px", background: C.black, display: "flex", gap: 8, flexShrink: 0 }}>
            <button onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleKeyboard(); }} style={{ padding: "10px 0", cursor: "pointer", fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: editing ? C.amber : C.dim, background: editing ? C.amberGhost : "none", border: `1px solid ${editing ? C.amber : C.border}`, minHeight: 42, width: 56, flexShrink: 0 }}>{editing ? "⌨ ✕" : "⌨"}</button>
            <button onClick={resetSQL} style={{ padding: "10px 0", cursor: "pointer", fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.dim, background: "none", border: `1px solid ${C.border}`, minHeight: 42, width: 48, flexShrink: 0 }}>↺</button>
            <button onClick={handleRun} disabled={!dbReady} style={{ flex: 1, padding: "10px 0", cursor: dbReady ? "pointer" : "not-allowed", fontFamily: F.mono, fontSize: 15, letterSpacing: 2, fontWeight: 700, color: C.black, background: C.green, border: `1px solid ${C.green}`, boxShadow: `0 0 16px ${C.green}35`, minHeight: 42, opacity: dbReady ? 1 : 0.4 }}>▶ RUN</button>
          </div>
        )}
      </div>
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
  const filtered = filter === "ALL" ? CHALLENGES_DB : CHALLENGES_DB.filter(c => c.diff === filter);
  const goRandom = () => {
    const unsolved = filtered.filter(c => !solved.has(c.id));
    const pool = unsolved.length > 0 ? unsolved : filtered;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) onNavigate("challenge", pick.id);
  };
  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, marginBottom: 8 }}><Prompt path="/practice" /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ fontFamily: F.mono, fontSize: 28, color: C.cyan, animation: "pulseGlow 3s ease infinite", flex: 1 }}>{t("practice_title")}</div>
        <button onClick={goRandom} style={{ background: C.cyanGhost, border: `1px solid ${C.cyan}40`, cursor: "pointer", padding: "8px 14px", fontFamily: F.mono, fontSize: 14, color: C.cyan, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>🎲 {lang === "pt" ? "ALEATÓRIO" : "RANDOM"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto" }}>
        {["ALL","EASY","MED","HARD","EXPERT"].map(f => {
          const total = f === "ALL" ? CHALLENGES_DB.length : CHALLENGES_DB.filter(c => c.diff === f).length;
          const solvedCnt = f === "ALL" ? solved.size : CHALLENGES_DB.filter(c => c.diff === f && solved.has(c.id)).length;
          const pct = total > 0 ? Math.round(solvedCnt / total * 100) : 0;
          return <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? C.cyanGhost : "none", border: `1px solid ${filter === f ? C.cyan : C.border}`, cursor: "pointer", padding: "10px 14px", minHeight: 44, fontFamily: F.mono, fontSize: 15, color: filter === f ? C.cyan : C.dim, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}><span>{f}</span><span style={{ fontSize: 11, color: filter === f ? C.cyan : C.muted }}>{pct}%</span></button>;
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((ch, i) => {
          const isSolved = solved.has(ch.id);
          return (
          <button key={ch.id} onClick={() => onNavigate("challenge", ch.id)} style={{ background: C.panel, border: `1px solid ${isSolved ? `${C.green}40` : C.border}`, cursor: "pointer", textAlign: "left", width: "100%", padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, animation: `fadeSlide 0.3s ease ${i * 0.04}s both`, minHeight: 68 }}>
            <div style={{ width: 36, height: 36, flexShrink: 0, border: `2px solid ${isSolved ? C.green : ch.color}`, background: isSolved ? `${C.green}15` : "none", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(45deg)" }}>
              <span style={{ transform: "rotate(-45deg)", fontFamily: F.mono, fontSize: isSolved ? 16 : 15, fontWeight: 700, color: isSolved ? C.green : ch.color }}>{isSolved ? "✓" : ch.id}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.mono, fontSize: 17, color: isSolved ? C.greenDim : C.white }}>{ch.title}</div>
              <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, marginTop: 4 }}>{lang === "pt" ? ch.desc_pt : ch.desc_en}</div>
            </div>
            <Tag color={ch.color}>{ch.diff}</Tag>
          </button>
          );
        })}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 16, textAlign: "center" }}>{lang === "pt" ? `// ${filtered.length} de ${CHALLENGES_DB.length}` : `// ${filtered.length} of ${CHALLENGES_DB.length}`}</div>
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
  const [gameOver, setGameOver] = useState(false);
  const touchStart = useRef(0);

  const card = cards[idx % cards.length];
  const pts = card?.diff === "EASY" ? 1 : card?.diff === "MED" ? 2 : 3;

  const flip = () => { if (swiping || gameOver) return; setFlipAnim(true); setTimeout(() => { setFlipped(!flipped); setFlipAnim(false); }, 200); };

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
      if (newLives <= 0) { setGameOver(true); return; }
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

  const resetGame = () => { setScore(0); setLives(3); setReviewed(0); setCorrect(0); setIdx(0); setFlipped(false); setGameOver(false); setSwipeX(0); setStatsByDiff({ ALL: { r: 0, c: 0 }, EASY: { r: 0, c: 0 }, MED: { r: 0, c: 0 }, HARD: { r: 0, c: 0 } }); };

  const onTS = (e) => { touchStart.current = e.touches[0].clientX; setSwiping(false); };
  const onTM = (e) => { const dx = e.touches[0].clientX - touchStart.current; if (Math.abs(dx) > 10) setSwiping(true); setSwipeX(dx); };
  const onTE = () => { if (Math.abs(swipeX) > 80) { nextCard(swipeX > 0); } else { setSwipeX(0); setSwiping(false); } };

  const swDir = swipeX > 30 ? "right" : swipeX < -30 ? "left" : null;
  const swPct = Math.min(Math.abs(swipeX) / 120, 1);

  // Hearts display
  const Hearts = () => (
    <div style={{ display: "flex", gap: 4 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ fontFamily: F.mono, fontSize: 22, color: i < lives ? C.red : C.muted, textShadow: i < lives ? `0 0 6px ${C.red}60` : "none", transition: "color 0.3s" }}>
          {i < lives ? "♥" : "♡"}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim }}><Prompt path="/review" /></div>
          <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyan, marginTop: 6, animation: "pulseGlow 3s ease infinite" }}>{t("review_title")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Hearts />
          <div style={{ fontFamily: F.mono, fontSize: 20, color: C.amber, textShadow: `0 0 8px ${C.amber}40` }}>{score}<span style={{ fontSize: 13, color: C.dim }}>pt</span></div>
        </div>
      </div>

      {/* Difficulty selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {["ALL","EASY","MED","HARD"].map(d => {
          const dColor = d === "EASY" ? C.green : d === "MED" ? C.cyan : d === "HARD" ? C.amber : C.dim;
          const st = statsByDiff[d] || { r: 0, c: 0 };
          const pct = st.r > 0 ? Math.round(st.c / st.r * 100) : 0;
          return (
            <button key={d} onClick={() => { setDiff(d); setIdx(0); setFlipped(false); }} style={{
              background: diff === d ? `${dColor}15` : "none", border: `1px solid ${diff === d ? dColor : C.border}`,
              cursor: "pointer", padding: "8px 14px", minHeight: 40,
              fontFamily: F.mono, fontSize: 14, color: diff === d ? dColor : C.dim,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2, whiteSpace: "nowrap",
            }}><span>{d}</span><span style={{ fontSize: 11, color: diff === d ? dColor : C.muted }}>{pct}%</span></button>
          );
        })}
      </div>

      <ProgressBar progress={cards.length > 0 ? ((idx % cards.length) + 1) / cards.length : 0} />

      {/* Game Over overlay */}
      {gameOver ? (
        <div style={{ marginTop: 20, background: C.panel, border: `1px solid ${C.red}`, padding: "32px 22px", textAlign: "center" }}>
          <div style={{ fontFamily: F.mono, fontSize: 28, color: C.red, marginBottom: 8 }}>GAME OVER</div>
          <div style={{ fontFamily: F.mono, fontSize: 16, color: C.dim, marginBottom: 6 }}>{lang === "pt" ? "Você perdeu todas as vidas!" : "You lost all lives!"}</div>
          <div style={{ fontFamily: F.mono, fontSize: 36, color: C.amber, textShadow: `0 0 12px ${C.amber}40`, margin: "16px 0" }}>{score} <span style={{ fontSize: 18, color: C.dim }}>pts</span></div>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginBottom: 20 }}>{reviewed} {lang === "pt" ? "cards revisados" : "cards reviewed"}</div>
          <button onClick={resetGame} style={{ fontFamily: F.mono, fontSize: 16, color: C.black, background: C.cyan, border: `1px solid ${C.cyan}`, padding: "14px 28px", cursor: "pointer", boxShadow: `0 0 16px ${C.cyan}30`, letterSpacing: 2 }}>
            {lang === "pt" ? "JOGAR DENOVO" : "PLAY AGAIN"}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 16, color: C.dim, textAlign: "center" }}>// no cards for "{diff}"</div>
      ) : (
        <>
          {/* Swipe hints */}
          <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 0 4px", fontFamily: F.mono, fontSize: 13 }}>
            <div style={{ color: C.red, opacity: swDir === "left" ? 0.6 + swPct * 0.4 : 0.3 }}>← -1 ♥</div>
            <div style={{ fontSize: 12, color: C.dim }}>{card.diff} +{pts}pt</div>
            <div style={{ color: C.green, opacity: swDir === "right" ? 0.6 + swPct * 0.4 : 0.3 }}>+{pts}pt →</div>
          </div>

          {/* Swipable card */}
          <div onClick={!swiping ? flip : undefined} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} style={{
            marginTop: 4, background: C.panel,
            border: `1px solid ${swDir === "right" ? C.green : swDir === "left" ? C.red : flipped ? C.cyanDim : C.border}`,
            padding: "28px 20px", minHeight: 220, cursor: "pointer",
            display: "flex", flexDirection: "column", justifyContent: "center",
            animation: flipAnim ? "flipCard 0.4s ease" : "none",
            position: "relative",
            boxShadow: swDir === "right" ? `0 0 24px ${C.green}20` : swDir === "left" ? `0 0 24px ${C.red}20` : "none",
            transform: `translateX(${swipeX}px) rotate(${swipeX * 0.04}deg)`,
            transition: swiping ? "none" : "transform 0.3s ease, border-color 0.2s",
            touchAction: "pan-y", userSelect: "none",
          }}>
            {swDir === "right" && <div style={{ position: "absolute", top: 14, left: 14, fontFamily: F.mono, fontSize: 20, color: C.green, opacity: swPct, fontWeight: 700, transform: "rotate(-10deg)", border: `2px solid ${C.green}`, padding: "4px 12px" }}>+{pts}</div>}
            {swDir === "left" && <div style={{ position: "absolute", top: 14, right: 14, fontFamily: F.mono, fontSize: 20, color: C.red, opacity: swPct, fontWeight: 700, transform: "rotate(10deg)", border: `2px solid ${C.red}`, padding: "4px 12px" }}>-1♥</div>}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: flipped ? `linear-gradient(90deg,transparent,${C.cyan},transparent)` : `linear-gradient(90deg,transparent,${C.border},transparent)` }} />
            <div style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: flipped ? C.cyanDim : C.dim, marginBottom: 16, textAlign: "center" }}>{flipped ? t("answer") : `[ ${card.type} · ${card.diff} ]`}</div>
            {!flipped
              ? <div style={{ fontFamily: F.mono, fontSize: 20, color: C.white, lineHeight: 1.7, textAlign: "center" }}>{card.front}</div>
              : <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyanHot, lineHeight: 2, whiteSpace: "pre-wrap" }}>{card.back}</div>
            }
            {!flipped && <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, marginTop: 24, textAlign: "center" }}>{t("tap_reveal")}<Cursor /></div>}
          </div>

          {/* Action buttons when flipped */}
          {flipped && (
            <div style={{ display: "flex", gap: 10, marginTop: 14, animation: "fadeSlide 0.2s ease" }}>
              <button onClick={() => nextCard(false)} style={{ flex: 1, background: C.redGhost, border: `1px solid ${C.red}50`, padding: "14px 6px", cursor: "pointer", textAlign: "center", minHeight: 52, fontFamily: F.mono, fontSize: 16, color: C.red }}>
                ← -1 ♥
              </button>
              <button onClick={() => nextCard(true)} style={{ flex: 1, background: C.greenGhost, border: `1px solid ${C.green}50`, padding: "14px 6px", cursor: "pointer", textAlign: "center", minHeight: 52, fontFamily: F.mono, fontSize: 16, color: C.green }}>
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
            { l: "♥", v: `${lives}/3`, c: C.red },
            { l: "SCORE", v: `${score}`, c: C.amber },
            { l: t("done"), v: String(reviewed), c: C.green },
            { l: "CARDS", v: String(cards.length), c: C.cyan },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontSize: 20, color: s.c, textShadow: `0 0 8px ${s.c}30` }}>{s.v}</div>
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

  const questions = modFilter === 0 ? QUIZ_DB : QUIZ_DB.filter(q => q.mod === modFilter);
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

  const handleAnswer = (optIdx) => {
    if (showResult) return;
    clearInterval(timerRef.current);
    setSelected(optIdx);
    setShowResult(true);
    setTotal(t => t + 1);
    if (optIdx === q.ans) {
      setScore(s => s + pts);
      setStreak(s => s + 1);
      if (onXP) onXP(pts);
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
  const modNames = ["ALL","M1: SELECT","M2: WHERE","M3: ORDER","M4: GROUP","M5: JOIN","M6: SUB","M7: WINDOW","M8: CTE"];

  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.dim }}><Prompt path="/quiz" /></div>
          <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyan, marginTop: 6, animation: "pulseGlow 3s ease infinite" }}>SQL_QUIZ</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontFamily: F.mono, fontSize: 14, color: C.amber }}>🔥{streak}</div>
          <div style={{ fontFamily: F.mono, fontSize: 20, color: C.green, textShadow: `0 0 8px ${C.green}40` }}>{score}<span style={{ fontSize: 12, color: C.dim }}>pt</span></div>
        </div>
      </div>

      {/* Module filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {modNames.map((name, i) => (
          <button key={i} onClick={() => { setModFilter(i); resetQuiz(); }} style={{
            background: modFilter === i ? C.cyanGhost : "none", border: `1px solid ${modFilter === i ? C.cyan : C.border}`,
            cursor: "pointer", padding: "6px 10px", minHeight: 34,
            fontFamily: F.mono, fontSize: 11, color: modFilter === i ? C.cyan : C.dim, whiteSpace: "nowrap",
          }}>{name}</button>
        ))}
      </div>

      {/* Progress + Timer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <ProgressBar progress={questions.length > 0 ? ((idx % questions.length) + 1) / questions.length : 0} />
        <div style={{ fontFamily: F.mono, fontSize: 22, color: timerColor, minWidth: 40, textAlign: "right", textShadow: timer <= 5 ? `0 0 8px ${C.red}60` : "none" }}>{timer}s</div>
      </div>

      {/* Question card */}
      <div style={{ background: C.panel, border: `1px solid ${showResult ? (selected === q.ans ? C.green : C.red) : C.border}`, padding: "20px 18px", marginBottom: 14, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.cyan},transparent)` }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>[{(idx % questions.length) + 1}/{questions.length}]</span>
          <Tag color={q.color || (q.diff === "EASY" ? C.green : q.diff === "MED" ? C.cyan : q.diff === "HARD" ? C.amber : C.red)}>{q.diff}</Tag>
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
          color: C.black, background: C.cyan, border: `1px solid ${C.cyan}`,
          boxShadow: `0 0 16px ${C.cyan}30`, minHeight: 50,
          animation: "pulseGlow 2s ease infinite",
        }}>NEXT ▶</button>
      )}

      {/* Stats bar */}
      <CLIBox title="QUIZ_STATS" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { l: "SCORE", v: `${score}`, c: C.amber },
            { l: "ACC", v: total > 0 ? `${Math.round((score / (total * pts)) * 100)}%` : "—", c: C.green },
            { l: "STREAK", v: `🔥${streak}`, c: C.red },
            { l: "Q's", v: `${total}/${questions.length}`, c: C.cyan },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontSize: 18, color: s.c, textShadow: `0 0 8px ${s.c}30` }}>{s.v}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </CLIBox>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════
function ProfileScreen({ xp = 0, solved = new Set() }) {
  const { t, lang } = useLang();
  const lv = getLevel(xp);
  const [expandedBadge, setExpandedBadge] = useState(null);
  const earnedAch = ACHIEVEMENTS.filter(a => a.check(solved, xp));
  const acc = CHALLENGES_DB.length > 0 ? Math.round(solved.size / CHALLENGES_DB.length * 100) : 0;
  return (
    <div style={{ padding: "16px 18px 20px", animation: "langSwitch 0.3s ease" }}>
      <div style={{ textAlign: "center", padding: "8px 0 22px" }}>
        <div style={{ width: 80, height: 80, margin: "0 auto 16px", border: `2px solid ${C.cyan}`, display: "flex", alignItems: "center", justifyContent: "center", background: C.cyanGhost, boxShadow: `0 0 28px ${C.cyan}25`, transform: "rotate(45deg)" }}>
          <span style={{ transform: "rotate(-45deg)", fontFamily: F.mono, fontSize: 36, color: C.cyan, fontWeight: 700 }}>U</span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 15, color: C.cyan, animation: "pulseGlow 3s ease infinite" }}>player</div>
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, marginTop: 6 }}>LVL {lv.level} · {xp.toLocaleString()} XP</div>
        {/* Level progress bar */}
        <div style={{ maxWidth: 200, margin: "10px auto 0" }}>
          <div style={{ height: 4, background: C.border, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, lv.progress * 100)}%`, background: C.amber, boxShadow: `0 0 8px ${C.amber}60`, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, marginTop: 4 }}>{xp - lv.cur} / {lv.nxt - lv.cur} to LVL {lv.level + 1}</div>
        </div>
      </div>
      <Divider />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
        {[
          { l: t("total_xp"), v: xp.toLocaleString(), c: C.cyanHot },
          { l: t("solved_label"), v: String(solved.size), c: C.green },
          { l: "LEVEL", v: String(lv.level), c: C.amber },
          { l: t("accuracy_label"), v: `${acc}%`, c: C.cyan },
        ].map((s, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
            <div style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, letterSpacing: 1.5, marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontFamily: F.mono, fontSize: 32, color: s.c, textShadow: `0 0 12px ${s.c}25` }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Achievements — expandable */}
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 14, color: C.cyanDim, letterSpacing: 1.5, marginBottom: 12 }}>┤ {t("achievements")} ({earnedAch.length}/{ACHIEVEMENTS.length}) ├</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {ACHIEVEMENTS.map((a, i) => {
            const earned = a.check(solved, xp);
            const expanded = expandedBadge === a.id;
            return (
              <div key={a.id} onClick={() => setExpandedBadge(expanded ? null : a.id)} style={{
                background: C.panel, border: `1px solid ${earned ? `${a.c}50` : C.border}`,
                padding: expanded ? "14px 10px" : "18px 10px", textAlign: "center",
                opacity: earned ? 1 : 0.35, cursor: "pointer",
                gridColumn: expanded ? "1 / -1" : "auto",
                transition: "all 0.2s",
                animation: earned ? `popIn 0.4s ease ${i * 0.1}s both` : "none",
              }}>
                <div style={{
                  fontFamily: F.mono, fontSize: expanded ? 42 : 36, marginBottom: 8,
                  color: earned ? a.c : C.dim,
                  textShadow: earned ? `0 0 16px ${a.c}60` : "none",
                }}>{a.i}</div>
                <div style={{ fontFamily: F.mono, fontSize: 14, color: earned ? C.white : C.dim }}>{lang === "pt" ? a.n_pt : a.n_en}</div>
                {expanded && (
                  <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim, marginTop: 6, animation: "fadeSlide 0.2s ease" }}>
                    {lang === "pt" ? a.d_pt : a.d_en}
                    {earned && <div style={{ color: a.c, marginTop: 4 }}>✓ {lang === "pt" ? "DESBLOQUEADO" : "UNLOCKED"}</div>}
                    {!earned && <div style={{ color: C.muted, marginTop: 4 }}>🔒 {lang === "pt" ? "BLOQUEADO" : "LOCKED"}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.muted, marginTop: 20, lineHeight: 2.2, textAlign: "center" }}>
        {t("footer_1")}<br />{t("footer_2")}<br />
        <span style={{ color: C.cyanDim }}>{t("settings")}</span><span style={{ color: C.dim }}> · </span><span style={{ color: C.cyanDim }}>{t("logout")}</span>
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
    { icon: ">_", title: ispt ? "BEM-VINDO AO QUERYQUEST" : "WELCOME TO QUERYQUEST", body: ispt ? "Aprenda SQL resolvendo desafios reais.\nEscreva queries, execute no navegador,\ne suba de nível como num jogo." : "Learn SQL by solving real challenges.\nWrite queries, execute in-browser,\nand level up like a game.", color: C.cyan },
    { icon: "◈", title: ispt ? "APRENDA" : "LEARN", body: ispt ? "A aba LEARN tem 8 módulos:\nSELECT → WHERE → ORDER BY → GROUP BY\n→ JOIN → Subqueries → Window → CTEs\n\nCada módulo tem 5-6 exercícios\nque vão do fácil ao expert." : "The LEARN tab has 8 modules:\nSELECT → WHERE → ORDER BY → GROUP BY\n→ JOIN → Subqueries → Window → CTEs\n\nEach module has 5-6 exercises\nranging from easy to expert.", color: C.green },
    { icon: ">", title: ispt ? "CODE + QUIZ" : "CODE + QUIZ", body: ispt ? "CODE: 41 desafios SQL reais.\nEscreva SQL, clique RUN para testar,\nSUBMIT para validar. Use os botões\nde keywords — sem precisar de teclado!\n\nQUIZ: 30 perguntas de múltipla\nescolha com timer de 15s." : "CODE: 41 real SQL challenges.\nWrite SQL, tap RUN to test,\nSUBMIT to validate. Use keyword\nbuttons — no keyboard needed!\n\nQUIZ: 30 multiple-choice questions\nwith a 15-second timer.", color: C.cyan },
    { icon: "◇", title: ispt ? "CARDS + XP" : "CARDS + XP", body: ispt ? "CARDS: Flashcards com swipe.\nDireita = sabia (+pts)\nEsquerda = não sabia (-1 vida)\n3 vidas — Game Over reseta!\n\nXP: Tudo dá XP — challenges, quiz,\ncards. Suba de nível e ganhe badges!" : "CARDS: Swipeable flashcards.\nRight = knew it (+pts)\nLeft = didn't know (-1 life)\n3 lives — Game Over resets!\n\nXP: Everything earns XP — challenges,\nquiz, cards. Level up and earn badges!", color: C.amber },
    { icon: "▲", title: ispt ? "PRONTO PARA COMEÇAR?" : "READY TO START?", body: ispt ? "Dica: Na tela de código, use\nos botões SQL no rodapé.\nToque na tela para mover o cursor.\nBotão ⌨ abre o teclado.\n\nComece pelo módulo 1: first_query\nBoa sorte, dev!" : "Tip: In the code editor, use\nthe SQL buttons at the bottom.\nTap the screen to move cursor.\nThe ⌨ button opens keyboard.\n\nStart with module 1: first_query\nGood luck, dev!", color: C.green },
  ];
  const s = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.void, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "24px 28px" }}>
      {/* CRT scanlines overlay */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.015) 2px, rgba(0,240,255,0.015) 4px)", pointerEvents: "none", zIndex: 1 }} />

      {/* Step indicator dots */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8, height: 8,
            background: i === step ? s.color : C.border,
            transition: "all 0.3s ease",
            boxShadow: i === step ? `0 0 8px ${s.color}60` : "none",
          }} />
        ))}
      </div>

      {/* Icon */}
      <div style={{
        fontFamily: F.mono, fontSize: 48, color: s.color, marginBottom: 20,
        textShadow: `0 0 24px ${s.color}60, 0 0 48px ${s.color}30`,
        animation: "pulseGlow 3s ease infinite",
      }}>{s.icon}</div>

      {/* Title */}
      <div style={{
        fontFamily: F.mono, fontSize: 20, color: s.color, letterSpacing: 3,
        marginBottom: 20, textAlign: "center",
        textShadow: `0 0 12px ${s.color}40`,
      }}>{s.title}</div>

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
          fontFamily: F.mono, fontSize: 15, color: C.black, fontWeight: 700,
          background: s.color, border: `1px solid ${s.color}`, minHeight: 50,
          boxShadow: `0 0 20px ${s.color}40`,
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
export default function QueryQuestCLI() {
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

  // Load progress from persistent storage on mount
  useEffect(() => {
    loadProgress().then(data => {
      if (data) {
        setXp(data.xp || 0);
        setSolved(new Set(data.solved || []));
        if (data.lang) setLang(data.lang);
      }
      setStorageLoaded(true);
    });
  }, []);

  // Save progress whenever xp/solved/lang changes (after initial load)
  useEffect(() => {
    if (storageLoaded) saveProgress(xp, solved, lang);
  }, [xp, solved, lang, storageLoaded]);
  // Level up & badge overlays
  const [levelUpShow, setLevelUpShow] = useState(null);
  const [badgeShow, setBadgeShow] = useState(null);
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
      if (newLv > oldLv) setTimeout(() => { setLevelUpShow(newLv); SFX.play("levelup"); }, 300);
      return n;
    });
    if (challengeId) markSolved(challengeId);
  }, [markSolved]);

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

  const shell = { maxWidth: 480, margin: "0 auto", height: "100vh", background: C.void, fontFamily: F.mono, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", boxShadow: `0 0 80px ${C.cyan}08`, animation: "crtFlicker 4s ease infinite" };
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
      <TopBar lang={lang} setLang={setLang} startCollapsed focusTitle={focusTitle} />
      <ChallengeScreen key="daily" onBack={() => { setScreen("main"); setAppFocusMode(false); }} challengeId={dailyChallengeId} onXP={addXP} isDaily moduleId={null} onNext={(id) => { setLastCodeId(id); setLastContext("code"); setScreen("challenge"); }} onFocusChange={setAppFocusMode} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={() => setLevelUpShow(null)} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
    </div></LangContext.Provider>
  );

  if (screen === "challenge") return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <TopBar lang={lang} setLang={setLang} startCollapsed focusTitle={focusTitle} />
      <ChallengeScreen key={lastCodeId} onBack={() => { setScreen("main"); setAppFocusMode(false); }} challengeId={lastCodeId} onXP={addXP} isDaily={false} moduleId={null} onNext={(id) => { setLastCodeId(id); setLastContext("code"); }} onFocusChange={setAppFocusMode} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={() => setLevelUpShow(null)} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
    </div></LangContext.Provider>
  );

  if (screen === "lesson") return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <TopBar lang={lang} setLang={setLang} startCollapsed exercises={lessonExercises} currentExId={lessonChId} onExNav={handleLessonNav} focusTitle={focusTitle} />
      <ChallengeScreen key={`lesson-${lessonChId}`} onBack={() => { setScreen("main"); setAppFocusMode(false); }} challengeId={lessonChId} onXP={addXP} moduleId={null} onNext={handleLessonNav} onFocusChange={setAppFocusMode} />
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={() => setLevelUpShow(null)} />}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
    </div></LangContext.Provider>
  );

  return (
    <LangContext.Provider value={ctx}><div style={shell}><style>{globalCSS}</style><Scanlines />
      <TopBar lang={lang} setLang={setLang} startCollapsed={tab !== "home"} showContinue onContinue={handleContinue} continueLabel={continueLabel} continueCtx={continueCtx} />
      <StatusBar xp={xp} solved={solved} />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", zIndex: 1 }}>
        {tab === "home" && <HomeScreen onNavigate={nav} solved={solved} xp={xp} />}
        {tab === "learn" && <LearnScreen onNavigate={nav} solved={solved} />}
        {tab === "practice" && <PracticeScreen onNavigate={nav} solved={solved} />}
        {tab === "quiz" && <QuizScreen onXP={addXP} />}
        {tab === "review" && <ReviewScreen onXP={addXP} />}
        {tab === "profile" && <ProfileScreen xp={xp} solved={solved} />}
      </div>
      <TabBar active={tab} onTabChange={setTab} />
      {/* Level up overlay */}
      {levelUpShow && <LevelUpOverlay level={levelUpShow} onDone={() => setLevelUpShow(null)} />}
      {/* Badge unlock overlay */}
      {badgeShow && <BadgeUnlockOverlay badge={badgeShow} lang={lang} onDone={() => setBadgeShow(null)} />}
    </div></LangContext.Provider>
  );
}
