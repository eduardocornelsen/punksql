import { create } from "zustand";

const HISTORY_KEY = "punksql-repl-history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 200))); }
  catch {}
}

let _nextId = 1;

const useSandboxStore = create((set, get) => ({
  scrollback: [],     // append-only list of output blocks
  replHistory: loadHistory(),
  historyIndex: -1,

  pushBlock: (block) =>
    set((s) => ({ scrollback: [...s.scrollback, { id: _nextId++, ...block }] })),

  clearScrollback: () => set({ scrollback: [] }),

  pushHistory: (cmd) => {
    if (!cmd.trim()) return;
    set((s) => {
      const next = [cmd, ...s.replHistory.filter((c) => c !== cmd)];
      saveHistory(next);
      return { replHistory: next, historyIndex: -1 };
    });
  },

  navigateHistory: (dir) => {
    const { historyIndex, replHistory } = get();
    const len = replHistory.length;
    if (!len) return null;
    const idx = Math.max(-1, Math.min(len - 1, historyIndex + dir));
    set({ historyIndex: idx });
    return idx === -1 ? null : replHistory[idx];
  },

  resetHistoryIndex: () => set({ historyIndex: -1 }),
}));

export default useSandboxStore;
