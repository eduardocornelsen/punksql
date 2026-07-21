// dbtEngine — a compile-accurate dbt simulator that executes for real.
//
// Implements the teaching-relevant slice of dbt-core in JS (TDD §1.2/§3.3):
// Jinja-subset templating ({{ ref }}, {{ source }}, {{ config }}, {{ var }},
// {% if %}, {% for %}, {% set %}), a mini manifest, the model DAG with
// topological sort, and compile/run/test/build/seed executing against an
// injected `exec(sql) → {ok, columns, rows, msg}` (the sandbox SqlEngine).
//
// Honesty boundary: this is NOT full Jinja/Python — snapshots, packages,
// hooks and arbitrary macros are out of scope (surfaced via the [sim] badge).

// ── YAML-lite parser ──────────────────────────────────────────
// Indentation-based subset via recursive descent: nested maps, lists of
// scalars, lists of maps, inline lists. Enough for dbt_project.yml /
// schema.yml / sources.yml teaching files (anchors, multi-line strings,
// flow maps etc. are out of scope).
export function parseYamlLite(text) {
  const lines = [];
  for (const raw of (text || "").split("\n")) {
    const noComment = raw.replace(/(^|\s)#.*$/, "");
    if (!noComment.trim()) continue;
    lines.push({ indent: noComment.match(/^( *)/)[1].length, body: noComment.trim() });
  }

  const parseScalar = (raw) => {
    const s = raw.trim();
    if (s === "" || s === "~" || s === "null") return null;
    if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === "[]") return [];
    if (s.startsWith("[") && s.endsWith("]")) return s.slice(1, -1).split(",").map(parseScalar);
    const q = s.match(/^(['"])(.*)\1$/);
    if (q) return q[2];
    return s;
  };

  let pos = 0;

  // Parses the block starting at `pos` where every line has indent >= minIndent.
  function parseBlock(minIndent) {
    if (pos >= lines.length || lines[pos].indent < minIndent) return null;
    return lines[pos].body.startsWith("- ") || lines[pos].body === "-"
      ? parseSeq(lines[pos].indent)
      : parseMap(lines[pos].indent);
  }

  function parseSeq(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && (lines[pos].body.startsWith("- ") || lines[pos].body === "-")) {
      const itemBody = lines[pos].body === "-" ? "" : lines[pos].body.slice(2);
      const kv = itemBody.match(/^([\w.+-]+):(?:\s+(.*))?$/);
      if (kv) {
        // list item is a map — its first key sits on the dash line; the rest
        // of the map's keys are the following lines at indent+2 (or deeper)
        pos++;
        const obj = {};
        if (kv[2] !== undefined && kv[2] !== "") obj[kv[1]] = parseScalar(kv[2]);
        else obj[kv[1]] = parseChild(indent + 2); // nested value on deeper lines
        const rest = (pos < lines.length && lines[pos].indent > indent && !lines[pos].body.startsWith("- ")) ? parseMap(lines[pos].indent) : null;
        if (rest) Object.assign(obj, rest);
        arr.push(obj);
      } else if (itemBody === "") {
        pos++;
        arr.push(parseBlock(indent + 1));
      } else {
        pos++;
        arr.push(parseScalar(itemBody));
      }
    }
    return arr;
  }

  // value of "key:" with nothing after — a nested block, or null if none
  function parseChild(childMinIndent) {
    if (pos < lines.length && lines[pos].indent >= childMinIndent) return parseBlock(childMinIndent);
    return null;
  }

  function parseMap(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent && !lines[pos].body.startsWith("- ")) {
      const kv = lines[pos].body.match(/^([\w.+ -]+?):(?:\s+(.*))?$/);
      if (!kv) { pos++; continue; } // skip unparseable line
      const key = kv[1].trim();
      if (kv[2] !== undefined && kv[2] !== "") {
        obj[key] = parseScalar(kv[2]);
        pos++;
      } else {
        pos++;
        obj[key] = parseChild(indent + 1);
      }
    }
    return obj;
  }

  return parseBlock(0) || {};
}

// ── Jinja subset: tokenizer + block parser + evaluator ────────
function jinjaTokens(src) {
  const tokens = [];
  const re = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
  let last = 0, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: src.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith("{{")) tokens.push({ type: "expr", value: t.slice(2, -2).trim() });
    else if (t.startsWith("{%")) tokens.push({ type: "stmt", value: t.slice(2, -2).trim() });
    // {# comment #} dropped
    last = m.index + t.length;
  }
  if (last < src.length) tokens.push({ type: "text", value: src.slice(last) });
  return tokens;
}

// Parse tokens into a block tree (if/for nesting).
function parseBlocks(tokens) {
  const rootBody = [];
  const stack = [{ body: rootBody }];
  const top = () => stack[stack.length - 1];

  for (const tok of tokens) {
    if (tok.type !== "stmt") { top().body.push(tok); continue; }
    const s = tok.value;
    const kw = s.split(/\s+/)[0];

    if (kw === "if") {
      const node = { type: "if", branches: [{ cond: s.slice(2).trim(), body: [] }] };
      top().body.push(node);
      stack.push({ node, body: node.branches[0].body });
    } else if (kw === "elif") {
      const cur = top();
      if (!cur.node || cur.node.type !== "if") throw new Error("Jinja: 'elif' outside if block");
      const br = { cond: s.slice(4).trim(), body: [] };
      cur.node.branches.push(br);
      cur.body = br.body;
    } else if (kw === "else") {
      const cur = top();
      if (!cur.node || (cur.node.type !== "if" && cur.node.type !== "for")) throw new Error("Jinja: 'else' outside block");
      if (cur.node.type === "if") {
        const br = { cond: null, body: [] };
        cur.node.branches.push(br);
        cur.body = br.body;
      } else {
        cur.node.elseBody = [];
        cur.body = cur.node.elseBody;
      }
    } else if (kw === "endif") {
      if (!top().node || top().node.type !== "if") throw new Error("Jinja: unexpected 'endif'");
      stack.pop();
    } else if (kw === "for") {
      const m = s.match(/^for\s+(\w+)\s+in\s+([\s\S]+)$/);
      if (!m) throw new Error(`Jinja: cannot parse '{% ${s} %}'`);
      const node = { type: "for", varName: m[1], listExpr: m[2].trim(), body: [] };
      top().body.push(node);
      stack.push({ node, body: node.body });
    } else if (kw === "endfor") {
      if (!top().node || top().node.type !== "for") throw new Error("Jinja: unexpected 'endfor'");
      stack.pop();
    } else if (kw === "set") {
      const m = s.match(/^set\s+(\w+)\s*=\s*([\s\S]+)$/);
      if (!m) throw new Error(`Jinja: cannot parse '{% ${s} %}'`);
      top().body.push({ type: "set", varName: m[1], expr: m[2].trim() });
    } else {
      throw new Error(`Jinja: unsupported tag '{% ${kw} %}' (sim covers if/for/set)`);
    }
  }
  if (stack.length !== 1) throw new Error(`Jinja: unclosed '{% ${top().node.type} %}' block`);
  return rootBody;
}

// Tiny expression evaluator: literals, vars, ref/source/var/config calls,
// comparisons, and/or/not, `in`, `~` concat, list literals, loop attrs.
function evalExpr(expr, ctx) {
  let i = 0;
  const src = expr;
  const peek = () => src[i];
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };

  function parsePrimary() {
    ws();
    const c = peek();
    if (c === "(") { i++; const v = parseOr(); ws(); if (peek() === ")") i++; return v; }
    if (c === "[") {
      i++; const arr = [];
      ws();
      while (i < src.length && peek() !== "]") {
        arr.push(parseOr()); ws();
        if (peek() === ",") { i++; ws(); }
      }
      i++; return arr;
    }
    if (c === "'" || c === '"') {
      const q = c; i++; let s = "";
      while (i < src.length && src[i] !== q) { s += src[i]; i++; }
      i++; return s;
    }
    const num = src.slice(i).match(/^-?\d+(\.\d+)?/);
    if (num) { i += num[0].length; return Number(num[0]); }
    const word = src.slice(i).match(/^[\w.]+/);
    if (!word) throw new Error(`Jinja: cannot evaluate '${expr}'`);
    i += word[0].length;
    const name = word[0];
    ws();
    if (peek() === "(") {
      // function call — collect args
      i++;
      const args = []; const kwargs = {};
      ws();
      while (i < src.length && peek() !== ")") {
        const save = i;
        const kw = src.slice(i).match(/^(\w+)\s*=/);
        if (kw && src[i + kw[0].length] !== "=") { i += kw[0].length; kwargs[kw[1]] = parseOr(); }
        else { i = save; args.push(parseOr()); }
        ws();
        if (peek() === ",") { i++; ws(); }
      }
      i++;
      return ctx.call(name, args, kwargs);
    }
    if (name === "true" || name === "True") return true;
    if (name === "false" || name === "False") return false;
    if (name === "none" || name === "None") return null;
    return ctx.lookup(name);
  }

  function parseUnary() {
    ws();
    if (src.slice(i).match(/^not\b/)) { i += 3; return !truthy(parseUnary()); }
    return parsePrimary();
  }
  function parseConcat() {
    let left = parseUnary();
    ws();
    while (peek() === "~") { i++; const r = parseUnary(); left = String(left) + String(r); ws(); }
    return left;
  }
  function parseCompare() {
    const left = parseConcat();
    ws();
    const op = src.slice(i).match(/^(==|!=|>=|<=|>|<|\bin\b)/);
    if (!op) return left;
    i += op[0].length;
    const right = parseConcat();
    switch (op[0]) {
      case "==": return left === right;
      case "!=": return left !== right;
      case ">=": return left >= right;
      case "<=": return left <= right;
      case ">":  return left > right;
      case "<":  return left < right;
      case "in": return Array.isArray(right) ? right.includes(left) : String(right).includes(String(left));
    }
  }
  function parseAnd() {
    let left = parseCompare();
    ws();
    while (src.slice(i).match(/^and\b/)) { i += 3; const r = parseCompare(); left = truthy(left) && truthy(r); ws(); }
    return left;
  }
  function parseOr() {
    let left = parseAnd();
    ws();
    while (src.slice(i).match(/^or\b/)) { i += 2; const r = parseAnd(); left = truthy(left) || truthy(r); ws(); }
    return left;
  }

  const result = parseOr();
  return result;
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

// Render one model's Jinja → SQL. Collects refs/sources/config as side effects.
export function renderModel(content, opts) {
  const { modelName, vars = {}, resolveRef, resolveSource, isIncremental = false } = opts;
  const collected = { refs: [], sources: [], config: {} };

  const scopes = [{}]; // variable scopes ({% set %}, for-loop vars)
  const lookup = (name) => {
    if (name.startsWith("loop.")) {
      for (let s = scopes.length - 1; s >= 0; s--) if (scopes[s].loop) return scopes[s].loop[name.slice(5)];
      return undefined;
    }
    for (let s = scopes.length - 1; s >= 0; s--) if (name in scopes[s]) return scopes[s][name];
    if (name === "this") return resolveRef ? resolveRef(modelName) : modelName;
    throw new Error(`Jinja: undefined variable '${name}'`);
  };
  const call = (name, args, kwargs) => {
    switch (name) {
      case "ref": {
        const target = args[0];
        if (!collected.refs.includes(target)) collected.refs.push(target);
        return resolveRef ? resolveRef(target) : target;
      }
      case "source": {
        const key = `${args[0]}.${args[1]}`;
        if (!collected.sources.includes(key)) collected.sources.push(key);
        return resolveSource ? resolveSource(args[0], args[1]) : args[1];
      }
      case "config":
        Object.assign(collected.config, kwargs);
        return "";
      case "var": {
        const [key, dflt] = args;
        if (key in vars) return vars[key];
        if (dflt !== undefined) return dflt;
        throw new Error(`var '${key}' is not defined (add it under vars: in dbt_project.yml)`);
      }
      case "is_incremental":
        return isIncremental;
      default:
        throw new Error(`Jinja: unsupported function '${name}()' (sim covers ref/source/config/var/is_incremental)`);
    }
  };
  const ctx = { lookup, call };

  const renderBody = (body) => {
    let out = "";
    for (const node of body) {
      if (node.type === "text") out += node.value;
      else if (node.type === "expr") out += String(evalExpr(node.value, ctx) ?? "");
      else if (node.type === "set") scopes[scopes.length - 1][node.varName] = evalExpr(node.expr, ctx);
      else if (node.type === "if") {
        for (const br of node.branches) {
          if (br.cond === null || truthy(evalExpr(br.cond, ctx))) { out += renderBody(br.body); break; }
        }
      } else if (node.type === "for") {
        const list = evalExpr(node.listExpr, ctx);
        if (!Array.isArray(list)) throw new Error(`Jinja: for-loop over non-list '${node.listExpr}'`);
        list.forEach((item, idx) => {
          scopes.push({ [node.varName]: item, loop: { index: idx + 1, index0: idx, first: idx === 0, last: idx === list.length - 1 } });
          out += renderBody(node.body);
          scopes.pop();
        });
        if (list.length === 0 && node.elseBody) out += renderBody(node.elseBody);
      }
    }
    return out;
  };

  const sql = renderBody(parseBlocks(jinjaTokens(content)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { sql, ...collected };
}

// ── Manifest: parse the VFS into nodes/sources/tests ──────────
const MODEL_RE = /^models\/.*\.sql$/;
const SINGULAR_TEST_RE = /^tests\/.*\.sql$/;
const SEED_RE = /^seeds\/.*\.csv$/;
const YML_RE = /\.(yml|yaml)$/;

function baseName(path) {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.(sql|csv|yml|yaml)$/i, "");
}

export function buildManifest(vfs) {
  const errors = [];
  const models = {};   // name -> { path, raw, config, refs, sources, columns, description }
  const sources = {};  // "src.table" -> { identifier, description }
  const genericTests = []; // { name, model, column, type, params }
  const singularTests = []; // { name, path, raw }
  const seeds = {};    // name -> { path, raw }
  let projectVars = {};
  let projectName = "punksql_project";
  let projectConfig = {};

  // 1. dbt_project.yml
  if (vfs["dbt_project.yml"] != null) {
    try {
      const py = parseYamlLite(vfs["dbt_project.yml"]);
      if (py.vars && typeof py.vars === "object") projectVars = py.vars;
      if (py.name) projectName = py.name;
      if (py.models && typeof py.models === "object") projectConfig = py.models[projectName] || py.models;
    } catch (e) {
      errors.push(`dbt_project.yml: ${e.message}`);
    }
  }

  // Folder-level +materialized from dbt_project.yml, e.g. models.staging.+materialized
  const folderMaterialization = (path) => {
    // path like models/staging/stg_orders.sql → folder key "staging"
    const parts = path.split("/");
    if (parts.length < 3) return null;
    const cfg = projectConfig[parts[1]];
    if (cfg && typeof cfg === "object" && cfg["+materialized"]) return cfg["+materialized"];
    return null;
  };

  // 2. schema/source yml files
  for (const [path, content] of Object.entries(vfs)) {
    if (!YML_RE.test(path) || path === "dbt_project.yml") continue;
    let doc;
    try { doc = parseYamlLite(content); } catch (e) { errors.push(`${path}: ${e.message}`); continue; }
    for (const src of doc.sources || []) {
      const srcName = src.name;
      for (const t of src.tables || []) {
        sources[`${srcName}.${t.name}`] = {
          identifier: t.identifier || t.name,
          description: t.description || "",
        };
      }
    }
    for (const mdl of doc.models || []) {
      const meta = { columns: [], description: mdl.description || "", ymlPath: path };
      for (const col of mdl.columns || []) {
        meta.columns.push({ name: col.name, description: col.description || "" });
        for (const t of col.tests || []) {
          if (typeof t === "string") {
            genericTests.push({ name: `${t}_${mdl.name}_${col.name}`, model: mdl.name, column: col.name, type: t, params: {} });
          } else if (t && typeof t === "object") {
            const type = Object.keys(t)[0];
            genericTests.push({ name: `${type}_${mdl.name}_${col.name}`, model: mdl.name, column: col.name, type, params: t[type] || {} });
          }
        }
      }
      // stash column docs; model may be declared before its .sql is seen
      models[mdl.name] = Object.assign(models[mdl.name] || {}, { docs: meta });
    }
  }

  // 3. model .sql files
  for (const [path, content] of Object.entries(vfs)) {
    if (MODEL_RE.test(path)) {
      const name = baseName(path);
      models[name] = Object.assign(models[name] || {}, {
        path, raw: content, folderMat: folderMaterialization(path),
      });
    } else if (SINGULAR_TEST_RE.test(path)) {
      singularTests.push({ name: baseName(path), path, raw: content });
    } else if (SEED_RE.test(path)) {
      seeds[baseName(path)] = { path, raw: content };
    }
  }

  // prune yml-declared models that have no .sql file (docs-only entries are not nodes)
  for (const [name, m] of Object.entries(models)) {
    if (!m.path) { delete models[name]; }
  }
  // drop tests pointing at models that don't exist
  for (const t of genericTests) {
    if (!models[t.model]) errors.push(`${t.name}: test references unknown model '${t.model}'`);
  }

  return { projectName, vars: projectVars, models, sources, genericTests, singularTests, seeds, errors };
}

// ── Compile: render every model, build DAG, topo sort ─────────
export function compileProject(vfs, { vars = {} } = {}) {
  const manifest = buildManifest(vfs);
  const errors = [...manifest.errors];
  const mergedVars = { ...manifest.vars, ...vars };
  const compiled = {};   // name -> { sql, config, refs, sources, materialized }
  const dag = {};        // name -> [upstream model names]

  const resolveRef = (name) => name;
  const resolveSource = (src, table) => {
    const s = manifest.sources[`${src}.${table}`];
    if (!s) throw new Error(`source('${src}', '${table}') is not defined in any .yml file`);
    return s.identifier;
  };

  for (const [name, model] of Object.entries(manifest.models)) {
    try {
      const r = renderModel(model.raw, {
        modelName: name, vars: mergedVars, resolveRef, resolveSource,
        isIncremental: false, // resolved for real at run time
      });
      const materialized = r.config.materialized || model.folderMat || "view";
      compiled[name] = { sql: r.sql, config: r.config, refs: r.refs, sources: r.sources, materialized };
      dag[name] = r.refs.filter((ref) => ref !== name);
      for (const ref of r.refs) {
        if (!(ref in manifest.models)) errors.push(`${name}: ref('${ref}') — model not found`);
      }
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }

  // topological sort (Kahn) — deterministic: alphabetical among ready nodes
  const order = [];
  const indeg = {};
  const names = Object.keys(compiled).sort();
  for (const n of names) indeg[n] = 0;
  for (const n of names) for (const up of dag[n] || []) if (up in indeg) indeg[n]++;
  const ready = names.filter((n) => indeg[n] === 0);
  while (ready.length) {
    ready.sort();
    const n = ready.shift();
    order.push(n);
    for (const m of names) {
      if ((dag[m] || []).includes(n) && --indeg[m] === 0) ready.push(m);
    }
  }
  if (order.length !== names.length) {
    const cyclic = names.filter((n) => !order.includes(n));
    errors.push(`Compilation error: dependency cycle involving ${cyclic.join(" → ")}`);
  }

  return { manifest, compiled, dag, order, vars: mergedVars, errors };
}

// Inline ephemeral upstreams as CTEs into a model's SQL.
export function withEphemeralCtes(name, project) {
  const { compiled, dag } = project;
  const node = compiled[name];
  if (!node) return null;
  // gather transitive ephemeral upstreams, in dependency order
  const ctes = [];
  const visit = (n, seen) => {
    for (const up of dag[n] || []) {
      if (seen.has(up)) continue;
      seen.add(up);
      if (compiled[up] && compiled[up].materialized === "ephemeral") {
        visit(up, seen);
        ctes.push(up);
      }
    }
  };
  visit(name, new Set());
  if (!ctes.length) return node.sql;
  const cteSql = ctes.map((c) => `${c} as (\n${indent(stripTrailingSemicolon(withEphemeralInlineRefs(compiled[c].sql, compiled)), 2)}\n)`).join(",\n");
  return `with ${cteSql}\n${stripTrailingSemicolon(node.sql)}`;
}
function withEphemeralInlineRefs(sql, _compiled) { return sql; } // refs already resolved to names; CTE names match
function stripTrailingSemicolon(sql) { return sql.replace(/;\s*$/, ""); }
function indent(sql, n) { const pad = " ".repeat(n); return sql.split("\n").map((l) => pad + l).join("\n"); }

// ── Execution helpers ─────────────────────────────────────────
function relationType(exec, name) {
  const r = exec(`SELECT type FROM sqlite_master WHERE name='${name.replace(/'/g, "''")}' AND type IN ('table','view')`);
  if (r.ok && r.rows.length) return r.rows[0][0];
  return null;
}

function fmtMs(t0) { return `${((nowMs() - t0) / 1000).toFixed(2)}s`; }
function nowMs() { return (typeof performance !== "undefined" ? performance.now() : Date.now()); }
function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ── dbt run ───────────────────────────────────────────────────
// Materializes models in DAG order. Each model runs in its own SAVEPOINT so a
// failure rolls back only that model; downstream models are SKIPped (real dbt
// behavior). Returns { results, ok } and streams lines through log().
export function runProject(project, exec, log = () => {}, { selectNames = null } = {}) {
  const { compiled, order, errors } = project;
  if (errors.length) {
    for (const e of errors) log({ level: "error", text: `Compilation Error: ${e}` });
    log({ level: "error", text: "Encountered compilation errors — nothing was run" });
    return { ok: false, results: [] };
  }
  const toRun = order.filter((n) => compiled[n].materialized !== "ephemeral")
                     .filter((n) => !selectNames || selectNames.has(n));
  const total = toRun.length;
  log({ level: "info", text: `${ts()}  Running with dbt-sim` });
  log({ level: "info", text: `${ts()}  Found ${Object.keys(compiled).length} models, ${project.manifest.genericTests.length + project.manifest.singularTests.length} tests, ${Object.keys(project.manifest.sources).length} sources` });
  log({ level: "info", text: "" });

  const results = [];
  const failed = new Set();
  // Ephemeral models never run, so failure must propagate through them.
  const anyUpstreamFailed = (n, seen = new Set()) => (project.dag[n] || []).some((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    if (failed.has(u)) return true;
    return compiled[u]?.materialized === "ephemeral" && anyUpstreamFailed(u, seen);
  });
  let idx = 0;
  for (const name of toRun) {
    idx++;
    const node = compiled[name];
    const upstreamFailed = anyUpstreamFailed(name);
    if (upstreamFailed) {
      failed.add(name);
      results.push({ name, status: "skip" });
      log({ level: "warn", text: `${ts()}  ${idx} of ${total} SKIP relation ${name} (upstream failure) .......... [SKIP]` });
      continue;
    }
    const t0 = nowMs();
    const mat = node.materialized;
    const existing = relationType(exec, name);
    let status = "ok", detail = "";

    exec(`SAVEPOINT dbt_${idx}`);
    try {
      let r;
      if (mat === "incremental" && existing === "table") {
        // honest incremental simulation: re-render with is_incremental()=true, INSERT INTO
        const rr = renderModel(project.manifest.models[name].raw, {
          modelName: name, vars: project.vars,
          resolveRef: (x) => x,
          resolveSource: (s, t) => project.manifest.sources[`${s}.${t}`].identifier,
          isIncremental: true,
        });
        r = exec(`INSERT INTO ${name} ${stripTrailingSemicolon(rr.sql)}`);
        detail = "incremental";
      } else {
        const sql = withEphemeralCtes(name, project);
        if (existing === "view") exec(`DROP VIEW IF EXISTS ${name}`);
        if (existing === "table") exec(`DROP TABLE IF EXISTS ${name}`);
        const ddl = (mat === "table" || mat === "incremental")
          ? `CREATE TABLE ${name} AS\n${stripTrailingSemicolon(sql)}`
          : `CREATE VIEW ${name} AS\n${stripTrailingSemicolon(sql)}`;
        r = exec(ddl);
        detail = mat === "incremental" ? "table (first incremental run)" : mat;
      }
      if (!r.ok) throw new Error(r.msg);
      exec(`RELEASE SAVEPOINT dbt_${idx}`);
    } catch (e) {
      exec(`ROLLBACK TO SAVEPOINT dbt_${idx}`);
      exec(`RELEASE SAVEPOINT dbt_${idx}`);
      status = "error";
      detail = e.message;
      failed.add(name);
    }

    results.push({ name, status, materialized: mat, detail });
    if (status === "ok") {
      log({ level: "ok", text: `${ts()}  ${idx} of ${total} OK created sql ${detail} model main.${name} ${dots(name, detail)} [OK in ${fmtMs(t0)}]` });
    } else {
      log({ level: "error", text: `${ts()}  ${idx} of ${total} ERROR creating sql ${mat} model main.${name} ${dots(name, mat)} [ERROR in ${fmtMs(t0)}]` });
      log({ level: "error", text: `    ${detail}` });
    }
  }

  const nOk = results.filter((r) => r.status === "ok").length;
  const nErr = results.filter((r) => r.status === "error").length;
  const nSkip = results.filter((r) => r.status === "skip").length;
  log({ level: "info", text: "" });
  log({
    level: nErr ? "error" : "ok",
    text: nErr
      ? `${ts()}  Completed with ${nErr} error${nErr > 1 ? "s" : ""}. Done. PASS=${nOk} ERROR=${nErr} SKIP=${nSkip} TOTAL=${total}`
      : `${ts()}  Completed successfully. Done. PASS=${nOk} ERROR=${nErr} SKIP=${nSkip} TOTAL=${total}`,
  });
  return { ok: nErr === 0, results };
}

function dots(name, detail) {
  const used = name.length + String(detail).length;
  return ".".repeat(Math.max(3, 46 - used));
}

// ── dbt test ──────────────────────────────────────────────────
export function compileGenericTest(t) {
  const model = t.model, col = t.column;
  switch (t.type) {
    case "not_null":
      return `select count(*) as failures from ${model} where ${col} is null`;
    case "unique":
      return `select count(*) as failures from (select ${col} from ${model} where ${col} is not null group by ${col} having count(*) > 1)`;
    case "accepted_values": {
      const vals = (t.params.values || []).map((v) => (typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`)).join(", ");
      return `select count(*) as failures from ${model} where ${col} is not null and ${col} not in (${vals})`;
    }
    case "relationships": {
      const to = String(t.params.to || "").replace(/^ref\(['"]|['"]\)$/g, "");
      const field = t.params.field || "id";
      return `select count(*) as failures from ${model} c left join ${to} p on c.${col} = p.${field} where c.${col} is not null and p.${field} is null`;
    }
    default:
      return null;
  }
}

export function testProject(project, exec, log = () => {}, { selectNames = null } = {}) {
  const { manifest, errors } = project;
  if (errors.length) {
    for (const e of errors) log({ level: "error", text: `Compilation Error: ${e}` });
    return { ok: false, results: [] };
  }
  const generic = manifest.genericTests.filter((t) => !selectNames || selectNames.has(t.model));
  const singular = selectNames ? [] : manifest.singularTests;
  const total = generic.length + singular.length;
  if (!total) { log({ level: "warn", text: `${ts()}  Nothing to test — add tests: to a schema.yml or .sql files under tests/` }); return { ok: true, results: [] }; }
  log({ level: "info", text: `${ts()}  Running ${total} test${total > 1 ? "s" : ""}` });
  log({ level: "info", text: "" });

  const results = [];
  let idx = 0;
  const runOne = (name, sql) => {
    idx++;
    const t0 = nowMs();
    const r = exec(sql);
    if (!r.ok) {
      results.push({ name, status: "error", failures: null, detail: r.msg });
      log({ level: "error", text: `${ts()}  ${idx} of ${total} ERROR ${name} ${dots(name, "")} [ERROR in ${fmtMs(t0)}]` });
      log({ level: "error", text: `    ${r.msg}` });
      return;
    }
    const failures = Number(r.rows?.[0]?.[0] ?? 0);
    if (failures === 0) {
      results.push({ name, status: "pass", failures: 0 });
      log({ level: "ok", text: `${ts()}  ${idx} of ${total} PASS ${name} ${dots(name, "")} [PASS in ${fmtMs(t0)}]` });
    } else {
      results.push({ name, status: "fail", failures });
      log({ level: "error", text: `${ts()}  ${idx} of ${total} FAIL ${failures} ${name} ${dots(name, String(failures))} [FAIL ${failures} in ${fmtMs(t0)}]` });
    }
  };

  for (const t of generic) {
    const sql = compileGenericTest(t);
    if (!sql) { log({ level: "warn", text: `${ts()}  SKIP unknown test type '${t.type}'` }); continue; }
    runOne(t.name, sql);
  }
  for (const t of singular) {
    // singular test passes when the query returns 0 rows
    runOne(t.name, `select count(*) as failures from (\n${stripTrailingSemicolon(t.raw)}\n)`);
  }

  const nPass = results.filter((r) => r.status === "pass").length;
  const nFail = results.filter((r) => r.status === "fail").length;
  const nErr = results.filter((r) => r.status === "error").length;
  log({ level: "info", text: "" });
  log({
    level: nFail + nErr ? "error" : "ok",
    text: `${ts()}  Done. PASS=${nPass} WARN=0 ERROR=${nErr} FAIL=${nFail} TOTAL=${results.length}`,
  });
  return { ok: nFail + nErr === 0, results };
}

// ── dbt seed ──────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function seedProject(project, exec, log = () => {}) {
  const seeds = Object.entries(project.manifest.seeds);
  if (!seeds.length) { log({ level: "warn", text: `${ts()}  No seeds found (add .csv files under seeds/)` }); return { ok: true, results: [] }; }
  log({ level: "info", text: `${ts()}  Running ${seeds.length} seed${seeds.length > 1 ? "s" : ""}` });
  const results = [];
  let idx = 0;
  for (const [name, seed] of seeds) {
    idx++;
    const t0 = nowMs();
    try {
      const rows = parseCsv(seed.raw.trim());
      if (rows.length < 1) throw new Error("empty CSV");
      const header = rows[0];
      const dataRows = rows.slice(1);
      const colTypes = header.map((_, ci) => {
        const sample = dataRows.map((r) => r[ci]).filter((v) => v !== "" && v != null);
        if (sample.length && sample.every((v) => /^-?\d+$/.test(v))) return "INTEGER";
        if (sample.length && sample.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return "REAL";
        return "TEXT";
      });
      exec(`DROP TABLE IF EXISTS ${name}`);
      const ddl = `CREATE TABLE ${name} (${header.map((h, ci) => `${h} ${colTypes[ci]}`).join(", ")})`;
      const r1 = exec(ddl);
      if (!r1.ok) throw new Error(r1.msg);
      for (const row of dataRows) {
        const vals = row.map((v, ci) => v === "" ? "NULL" : colTypes[ci] === "TEXT" ? `'${v.replace(/'/g, "''")}'` : v).join(", ");
        const r2 = exec(`INSERT INTO ${name} VALUES (${vals})`);
        if (!r2.ok) throw new Error(r2.msg);
      }
      results.push({ name, status: "ok", rows: dataRows.length });
      log({ level: "ok", text: `${ts()}  ${idx} of ${seeds.length} OK loaded seed file main.${name} ${dots(name, "seed")} [INSERT ${dataRows.length} in ${fmtMs(t0)}]` });
    } catch (e) {
      results.push({ name, status: "error", detail: e.message });
      log({ level: "error", text: `${ts()}  ${idx} of ${seeds.length} ERROR loading seed main.${name}: ${e.message}` });
    }
  }
  return { ok: results.every((r) => r.status !== "error"), results };
}

// ── Node selection: name, +name (with ancestors), name+ (with descendants) ──
export function selectNodes(project, selector) {
  if (!selector) return null;
  const names = new Set();
  const { dag, compiled } = project;
  const downstreamOf = (n) => Object.keys(dag).filter((m) => (dag[m] || []).includes(n));
  const addUp = (n) => { if (!compiled[n] || names.has(`u:${n}`)) return; names.add(`u:${n}`); names.add(n); (dag[n] || []).forEach(addUp); };
  const addDown = (n) => { if (!compiled[n] || names.has(`d:${n}`)) return; names.add(`d:${n}`); names.add(n); downstreamOf(n).forEach(addDown); };

  for (const raw of selector.split(/[\s,]+/).filter(Boolean)) {
    const lead = raw.startsWith("+"), trail = raw.endsWith("+");
    const name = raw.replace(/^\+|\+$/g, "");
    if (!compiled[name]) return { error: `Selector '${raw}': model '${name}' not found` };
    names.add(name);
    if (lead) (project.dag[name] || []).forEach(addUp);
    if (trail) downstreamOf(name).forEach(addDown);
  }
  return { set: new Set([...names].filter((n) => !n.includes(":"))) };
}

// ── CLI dispatcher: "dbt run", "dbt test --select stg_orders+" … ──
export function runDbtCommand(cmdline, vfs, exec, log, { vars = {} } = {}) {
  const argv = cmdline.trim().replace(/^dbt\s+/, "").split(/\s+/);
  const verb = argv[0];
  let selector = null;
  const si = argv.findIndex((a) => a === "--select" || a === "-s");
  if (si >= 0) selector = argv.slice(si + 1).join(" ");

  const project = compileProject(vfs, { vars });

  const sel = selectNodes(project, selector);
  if (sel && sel.error) { log({ level: "error", text: sel.error }); return { ok: false, project }; }
  const selectNames = sel ? sel.set : null;

  switch (verb) {
    case "compile": {
      if (project.errors.length) {
        project.errors.forEach((e) => log({ level: "error", text: `Compilation Error: ${e}` }));
        return { ok: false, project };
      }
      log({ level: "ok", text: `${ts()}  Compiled ${Object.keys(project.compiled).length} models — see target/compiled/` });
      return { ok: true, project };
    }
    case "run":
      return { ...runProject(project, exec, log, { selectNames }), project };
    case "test":
      return { ...testProject(project, exec, log, { selectNames }), project };
    case "seed":
      return { ...seedProject(project, exec, log), project };
    case "build": {
      const s = seedProject(project, exec, () => {}); // silent if no seeds
      const r = runProject(project, exec, log, { selectNames });
      if (!r.ok) return { ok: false, project, results: r.results };
      const t = testProject(project, exec, log, { selectNames });
      return { ok: s.ok && r.ok && t.ok, project, results: [...r.results, ...t.results] };
    }
    case "ls":
    case "list": {
      const rows = project.order.map((n) => `${compiled_badge(project.compiled[n].materialized)} ${n}`);
      Object.keys(project.manifest.sources).forEach((s) => rows.push(`[src ] source:${s}`));
      rows.forEach((r) => log({ level: "info", text: r }));
      return { ok: true, project };
    }
    default:
      log({ level: "error", text: `Unknown command 'dbt ${verb || ""}' — try: run · test · build · compile · seed · ls` });
      return { ok: false, project };
  }
}
function compiled_badge(mat) {
  return `[${(mat || "view").slice(0, 4).padEnd(4)}]`;
}
