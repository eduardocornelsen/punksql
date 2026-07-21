"use client";
// DbtMissions — the dbt learning track UI (TDD §4/Phase 4):
// mission list (tutorial + graded missions), mission brief, tutorial
// stepper, and the grader's result checklist. Mounted by DbtWorkspace.
import { useState } from "react";
import { DBT_MISSIONS, DBT_TUTORIAL, DBT_TRACK_XP } from "@/data/dbtChallenges";

const C = {
  black: "#000000", panel: "#0D0D0D", surface: "#111111",
  border: "#222222", borderBright: "#333333",
  cyan: "#00FFFF", green: "#00FF88", amber: "#FFBB00", red: "#FF3333",
  orange: "#FF9944", purple: "#CC88FF", white: "#FFFFFF",
  dim: "#9a9a9a", muted: "#7a7a7a", text: "#CCCCCC",
};
const F = { mono: "'JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'Courier New', monospace" };
const DIFF_COLOR = { EASY: C.green, MED: C.amber, HARD: C.red };

export function MissionBrief({ mission, lang, onStart, onClose, solved }) {
  const [showHint, setShowHint] = useState(false);
  const ispt = lang === "pt";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.orange}40`, maxWidth: 400, width: "100%", maxHeight: "86%", overflowY: "auto", padding: "16px 16px 14px", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.muted }}>✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: DIFF_COLOR[mission.diff], border: `1px solid ${DIFF_COLOR[mission.diff]}50`, padding: "1px 6px", letterSpacing: 1 }}>{mission.diff}</span>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.amber }}>+{mission.xp} XP</span>
          {solved && <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green }}>✓ {ispt ? "CONCLUÍDA" : "SOLVED"}</span>}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 13, color: C.orange, marginBottom: 10, letterSpacing: 1 }}>{mission.title}</div>
        <pre style={{ fontFamily: F.mono, fontSize: 11, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: "0 0 12px" }}>{ispt ? mission.desc_pt : mission.desc_en}</pre>
        {showHint ? (
          <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, whiteSpace: "pre-wrap", lineHeight: 1.6, margin: "0 0 12px", padding: "6px 10px", borderLeft: `2px solid ${C.amber}40`, background: `${C.amber}08` }}>{mission.hint}</pre>
        ) : (
          <button onClick={() => setShowHint(true)} style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, background: "none", border: `1px solid ${C.border}`, cursor: "pointer", padding: "4px 10px", marginBottom: 12 }}>{ispt ? "mostrar dica" : "show hint"}</button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onStart} style={{ flex: 1, fontFamily: F.mono, fontSize: 11, color: C.orange, background: `${C.orange}14`, border: `1px solid ${C.orange}`, cursor: "pointer", padding: "8px 12px", letterSpacing: 1 }}>
            ▶ {solved ? (ispt ? "REFAZER" : "REPLAY") : (ispt ? "ABRIR NO LAB" : "OPEN IN LAB")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionResult({ mission, result, lang, onClose, onExit, firstSolve }) {
  const ispt = lang === "pt";
  const pass = result.pass;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
      <div style={{ background: C.panel, border: `1px solid ${pass ? C.green : C.red}50`, maxWidth: 420, width: "100%", maxHeight: "88%", overflowY: "auto", padding: "16px" }}>
        <div style={{ fontFamily: F.mono, fontSize: 15, color: pass ? C.green : C.red, letterSpacing: 2, marginBottom: 4 }}>
          {pass ? (ispt ? "✓ MISSÃO CONCLUÍDA" : "✓ MISSION PASSED") : (ispt ? "✗ AINDA NÃO" : "✗ NOT YET")}
        </div>
        {pass && firstSolve && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.amber, marginBottom: 8 }}>+{mission.xp} XP</div>}
        {pass && !firstSolve && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginBottom: 8 }}>{ispt ? "(já resolvida — sem XP repetido)" : "(already solved — no repeat XP)"}</div>}

        <div style={{ margin: "10px 0", borderTop: `1px solid ${C.border}` }} />
        {result.checks.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, padding: "3px 0", alignItems: "baseline" }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: c.ok ? C.green : C.red, flexShrink: 0 }}>{c.ok ? "✓" : "✗"}</span>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: c.ok ? C.text : C.red }}>{c.label}</span>
              {!c.ok && c.detail && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.dim, marginTop: 1, wordBreak: "break-word" }}>{c.detail}</div>}
            </div>
          </div>
        ))}

        {pass && (
          <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: "12px 0 0", padding: "8px 10px", borderLeft: `2px solid ${C.green}40`, background: `${C.green}06` }}>
            {ispt ? mission.explanation_pt : mission.explanation_en}
          </pre>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {pass ? (
            <button onClick={onExit} style={{ flex: 1, fontFamily: F.mono, fontSize: 11, color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}`, cursor: "pointer", padding: "8px 12px", letterSpacing: 1 }}>
              {ispt ? "→ MISSÕES" : "→ MISSIONS"}
            </button>
          ) : (
            <button onClick={onClose} style={{ flex: 1, fontFamily: F.mono, fontSize: 11, color: C.amber, background: `${C.amber}10`, border: `1px solid ${C.amber}`, cursor: "pointer", padding: "8px 12px", letterSpacing: 1 }}>
              {ispt ? "← CONTINUAR EDITANDO" : "← KEEP WORKING"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TutorialOverlay({ lang, onFinish, onClose, solved }) {
  const [step, setStep] = useState(0);
  const ispt = lang === "pt";
  const steps = DBT_TUTORIAL.steps;
  const cur = steps[step];
  const isLast = step === steps.length - 1;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 70, background: C.panel, borderTop: `2px solid ${C.purple}`, boxShadow: "0 -8px 30px rgba(0,0,0,0.7)", padding: "12px 14px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.purple, letterSpacing: 1.5 }}>TUTORIAL {step + 1}/{steps.length}</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.text }}>{ispt ? cur.t_pt : cur.t_en}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: C.muted }}>✕</button>
      </div>
      <pre style={{ fontFamily: F.mono, fontSize: 10.5, color: C.dim, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: "0 0 10px", maxHeight: 180, overflowY: "auto" }}>{ispt ? cur.b_pt : cur.b_en}</pre>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          style={{ fontFamily: F.mono, fontSize: 10, padding: "6px 12px", background: "none", border: `1px solid ${step === 0 ? C.border : C.borderBright}`, color: step === 0 ? C.border : C.dim, cursor: step === 0 ? "default" : "pointer" }}>← prev</button>
        {!isLast ? (
          <button onClick={() => setStep((s) => s + 1)} style={{ fontFamily: F.mono, fontSize: 10, padding: "6px 14px", background: `${C.purple}14`, border: `1px solid ${C.purple}`, color: C.purple, cursor: "pointer" }}>next →</button>
        ) : (
          <button onClick={onFinish} style={{ fontFamily: F.mono, fontSize: 10, padding: "6px 14px", background: `${C.green}14`, border: `1px solid ${C.green}`, color: C.green, cursor: "pointer", letterSpacing: 1 }}>
            ✓ {solved ? (ispt ? "CONCLUÍDO" : "DONE") : `${ispt ? "CONCLUIR" : "FINISH"} (+${DBT_TUTORIAL.xp} XP)`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DbtMissionList({ lang, solvedIds, onOpenMission, onOpenTutorial, onClose }) {
  const ispt = lang === "pt";
  const solvedCount = [DBT_TUTORIAL, ...DBT_MISSIONS].filter((m) => solvedIds.has(m.id)).length;
  const earnedXp = [DBT_TUTORIAL, ...DBT_MISSIONS].filter((m) => solvedIds.has(m.id)).reduce((a, m) => a + m.xp, 0);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 65, background: C.black, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "9px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.orange, letterSpacing: 2 }}>DBT MISSIONS</span>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginLeft: 10 }}>
          {solvedCount}/{DBT_MISSIONS.length + 1} · {earnedXp}/{DBT_TRACK_XP} XP
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.muted, padding: "2px 6px" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.dim, lineHeight: 1.7, marginBottom: 12 }}>
          {ispt
            ? "Missões avaliadas pelo output real materializado — qualquer SQL correto passa. Sua área livre é preservada e restaurada ao sair."
            : "Missions are graded on real materialized output — any correct SQL passes. Your free-play project is stashed and restored when you exit."}
        </div>

        {/* Tutorial card */}
        <button onClick={onOpenTutorial}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: solvedIds.has("tut") ? `${C.purple}08` : `${C.purple}10`, border: `1px solid ${C.purple}40`, cursor: "pointer", padding: "10px 12px", marginBottom: 10, textAlign: "left" }}>
          <span style={{ fontFamily: F.mono, fontSize: 15, color: C.purple }}>▷</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.purple }}>{ispt ? DBT_TUTORIAL.title_pt : DBT_TUTORIAL.title_en}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{ispt ? "passo a passo guiado" : "guided walkthrough"} · +{DBT_TUTORIAL.xp} XP</div>
          </div>
          {solvedIds.has("tut") && <span style={{ fontFamily: F.mono, fontSize: 12, color: C.green }}>✓</span>}
        </button>

        {/* Mission cards */}
        {DBT_MISSIONS.map((m, i) => {
          const solved = solvedIds.has(m.id);
          return (
            <button key={m.id} onClick={() => onOpenMission(m)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: solved ? `${C.green}06` : "none", border: `1px solid ${solved ? `${C.green}30` : C.border}`, cursor: "pointer", padding: "9px 12px", marginBottom: 6, textAlign: "left" }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: solved ? C.green : C.muted, width: 22, flexShrink: 0 }}>{solved ? "✓" : String(i + 1).padStart(2, "0")}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: solved ? C.dim : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 8, color: DIFF_COLOR[m.diff], border: `1px solid ${DIFF_COLOR[m.diff]}40`, padding: "1px 5px", flexShrink: 0 }}>{m.diff}</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.amber, flexShrink: 0, width: 46, textAlign: "right" }}>+{m.xp}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
