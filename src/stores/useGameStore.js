import { create } from "zustand";

const SQL_KEYWORDS = [
  "SELECT","FROM","WHERE","JOIN","ON","LEFT JOIN","INNER JOIN",
  "GROUP BY","ORDER BY","HAVING","LIMIT","AS","AND","OR","NOT",
  "IN","LIKE","BETWEEN","IS NULL","DISTINCT","COUNT()","SUM()",
  "AVG()","MIN()","MAX()","ROUND()","SUBSTR()","DESC","ASC",
  "WITH","OVER","PARTITION BY","ROW_NUMBER()","RANK()","LAG()","LEAD()",
];

const HISTORY_KEY = "punksql-query-history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100))); }
  catch {}
}

const useGameStore = create((set, get) => ({
  // Active challenge metadata
  activeChallenge: null,
  setActiveChallenge: (challenge) => {
    const tokens = challenge ? {
      keywords: SQL_KEYWORDS,
      tables: challenge.schema
        .split("\n")
        .map(l => l.split(":")[0].trim())
        .filter(Boolean),
      columns: challenge.schema
        .split("\n")
        .flatMap(l => {
          const parts = l.split(":");
          return parts.length > 1
            ? parts.slice(1).join(":").split(",").map(c => c.trim())
            : [];
        })
        .filter((v, i, a) => v && a.indexOf(v) === i),
    } : { keywords: SQL_KEYWORDS, tables: [], columns: [] };
    set({ activeChallenge: challenge, keyboardTokens: tokens });
  },

  // Cursor position for terminal text manipulation
  cursorPosition: { line: 0, col: 0 },
  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  // Keyboard tokens loaded dynamically based on active exercise
  keyboardTokens: { keywords: SQL_KEYWORDS, tables: [], columns: [] },
  setKeyboardTokens: (tokens) =>
    set({ keyboardTokens: { ...get().keyboardTokens, ...tokens } }),

  // Query history (terminal command history cache)
  queryHistory: loadHistory(),
  historyIndex: -1,
  pushQueryHistory: (query) => {
    if (!query.trim()) return;
    set((state) => {
      const deduped = [query, ...state.queryHistory.filter(q => q !== query)];
      saveHistory(deduped);
      return { queryHistory: deduped, historyIndex: -1 };
    });
  },
  navigateHistory: (direction) => {
    const { historyIndex, queryHistory } = get();
    const len = queryHistory.length;
    if (len === 0) return null;
    let idx = historyIndex + direction;
    idx = Math.max(-1, Math.min(len - 1, idx));
    set({ historyIndex: idx });
    return idx === -1 ? null : queryHistory[idx];
  },
  resetHistoryIndex: () => set({ historyIndex: -1 }),
}));

export default useGameStore;
