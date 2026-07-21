// Shared syntax tokenizers for the sandbox + dbt lab editors (TDD §5.1).
// Each tokenizer returns [{ color, text }]; tokensToHtml renders them for a
// highlight overlay layered behind a transparent textarea.

const C_TEXT = "#CCCCCC";
const C_DIM = "#9a9a9a";

export const SQL_KW_SET = new Set([
  "SELECT","DISTINCT","FROM","WHERE","JOIN","ON","LEFT","RIGHT","INNER","FULL","CROSS",
  "GROUP","ORDER","HAVING","LIMIT","OFFSET","AS","WITH","UNION","ALL","EXCEPT","INTERSECT",
  "AND","OR","NOT","IN","LIKE","ILIKE","BETWEEN","IS","NULL","EXISTS","CASE","WHEN","THEN",
  "ELSE","END","ASC","DESC","PARTITION","OVER","ROWS","PRECEDING","CURRENT","ROW","BY",
  "CREATE","DROP","ALTER","INSERT","INTO","VALUES","UPDATE","SET","DELETE","TABLE","VIEW",
  "INDEX","UNIQUE","IF","ADD","COLUMN","RENAME","PRIMARY","KEY","REFERENCES","DEFAULT",
  "AUTOINCREMENT","SAVEPOINT","RELEASE","ROLLBACK","ATTACH","DETACH","PRAGMA",
  "OUTER","NATURAL","USING","RETURNING","EXPLAIN","QUERY","PLAN",
]);
export const SQL_FUNC_SET = new Set([
  "COUNT","SUM","AVG","MIN","MAX","ROUND","COALESCE","NULLIF","CAST","TYPEOF",
  "LENGTH","UPPER","LOWER","SUBSTR","TRIM","REPLACE","INSTR","DATE","STRFTIME",
  "JULIANDAY","ROW_NUMBER","RANK","DENSE_RANK","LAG","LEAD","FIRST_VALUE",
  "LAST_VALUE","NTILE","PERCENT_RANK","ABS","RANDOM","IFNULL","PRINTF","IIF",
]);
export const SQL_TYPE_SET = new Set(["INTEGER","TEXT","REAL","BLOB","NUMERIC","BOOLEAN"]);

const EMPTY_SET = new Set();

export function tokenizeSQL(code, tableSet = EMPTY_SET, colSet = EMPTY_SET) {
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
      let color = C_TEXT;
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
    tokens.push({ color: C_DIM, text: code[i] }); i++;
  }
  return tokens;
}

export function tokenizeYAML(code) {
  const tokens = [];
  for (const rawLine of code.split("\n")) {
    const line = rawLine;
    // comment
    if (/^\s*#/.test(line)) {
      tokens.push({ color: "#3d5a45", text: line }); tokens.push({ color: C_DIM, text: "\n" }); continue;
    }
    // key: value
    const kv = line.match(/^(\s*(?:-\s+)?)([\w-]+)(\s*:\s*)(.*)$/);
    if (kv) {
      const [, indent, key, colon, val] = kv;
      tokens.push({ color: "#555555", text: indent });
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
        tokens.push({ color: C_TEXT, text: val });
      }
      tokens.push({ color: C_DIM, text: "\n" }); continue;
    }
    // list item
    const li = line.match(/^(\s*-\s+)(.*)$/);
    if (li) {
      tokens.push({ color: "#555555", text: li[1] });
      tokens.push({ color: C_TEXT, text: li[2] });
      tokens.push({ color: C_DIM, text: "\n" }); continue;
    }
    // section header (word ending with :)
    if (/^\s*[\w-]+:\s*$/.test(line)) {
      const m = line.match(/^(\s*)([\w-]+)(:\s*)$/);
      if (m) {
        tokens.push({ color: C_DIM, text: m[1] });
        tokens.push({ color: "#FFBB00", text: m[2] }); // amber for section keys
        tokens.push({ color: "#555555", text: m[3] });
        tokens.push({ color: C_DIM, text: "\n" }); continue;
      }
    }
    tokens.push({ color: C_TEXT, text: line });
    tokens.push({ color: C_DIM, text: "\n" });
  }
  return tokens;
}

// Jinja-aware SQL tokenizer for dbt models (TDD §5.3 <JinjaEditor>):
// {{ … }} / {% … %} / {# … #} get distinct delimiter/function/string colors,
// everything outside runs through the plain SQL tokenizer.
const JINJA_FN_SET = new Set(["ref", "source", "config", "var", "is_incremental", "this"]);
const JINJA_KW_SET = new Set(["if", "elif", "else", "endif", "for", "endfor", "set", "in", "not", "and", "or", "macro", "endmacro"]);

function tokenizeJinjaInner(inner, fnColor) {
  const tokens = [];
  let i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < inner.length && inner[j] !== c) j++;
      tokens.push({ color: "#b5946a", text: inner.slice(i, j + 1) });
      i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < inner.length && /[A-Za-z0-9_.]/.test(inner[j])) j++;
      const word = inner.slice(i, j);
      const base = word.split(".")[0];
      let color = "#DDDDDD";
      if (JINJA_FN_SET.has(base)) color = fnColor;
      else if (JINJA_KW_SET.has(base)) color = "#CC88FF";
      else if (base === "loop") color = "#88BBDD";
      tokens.push({ color, text: word });
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i; while (j < inner.length && /[0-9.]/.test(inner[j])) j++;
      tokens.push({ color: "#7ec8a0", text: inner.slice(i, j) });
      i = j; continue;
    }
    tokens.push({ color: "#777777", text: c });
    i++;
  }
  return tokens;
}

export function tokenizeJinjaSQL(code, tableSet = EMPTY_SET, colSet = EMPTY_SET) {
  const tokens = [];
  const re = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
  let last = 0, m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push(...tokenizeSQL(code.slice(last, m.index), tableSet, colSet));
    const t = m[0];
    if (t.startsWith("{#")) {
      tokens.push({ color: "#3d5a45", text: t });
    } else {
      const open = t.slice(0, 2), close = t.slice(-2);
      const delimColor = "#FF9944"; // dbt orange
      tokens.push({ color: delimColor, text: open });
      tokens.push(...tokenizeJinjaInner(t.slice(2, -2), open === "{{" ? "#FFBB00" : "#FF9944"));
      tokens.push({ color: delimColor, text: close });
    }
    last = m.index + t.length;
  }
  if (last < code.length) tokens.push(...tokenizeSQL(code.slice(last), tableSet, colSet));
  return tokens;
}

// Build HTML string from token array for use as innerHTML
export function tokensToHtml(tokens) {
  return tokens.map(({ color, text }) => {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<span style="color:${color}">${escaped}</span>`;
  }).join("");
}
