// dbtGrader — grades a dbt mission (TDD §4.3):
//   ① run the USER's project in a rolled-back scratch scope → capture target
//   ② run the SOLUTION project the same way → capture expected
//   ③ compare SELECT * output (column-name aligned, row-sorted)
//   ④ structural assertions: materialization, required refs/sources,
//      required tests declared AND passing
// Nothing the grader materializes survives — everything runs inside a
// SAVEPOINT that is always rolled back, so the sandbox DB is untouched.
import { compileProject, runProject, compileGenericTest } from "./dbtEngine.js";

function round6(v) {
  return typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v;
}

// Capture a relation's full output plus its sqlite_master type.
function captureRelation(exec, name) {
  const r = exec(`SELECT * FROM ${name}`);
  if (!r.ok) return { ok: false, msg: r.msg };
  const t = exec(`SELECT type FROM sqlite_master WHERE name='${name.replace(/'/g, "''")}' AND type IN ('table','view')`);
  return {
    ok: true,
    columns: r.columns.map((c) => c.toLowerCase()),
    rows: r.rows,
    relType: t.ok && t.rows.length ? t.rows[0][0] : null,
  };
}

// Run a compiled project inside an always-rolled-back savepoint and hand a
// snapshot of everything the caller asked for out of the scratch scope.
function runInScratch(exec, project, { target, testNames = [] }) {
  exec("SAVEPOINT dbt_grade");
  try {
    const logs = [];
    const run = runProject(project, exec, (l) => logs.push(l));
    if (!run.ok) {
      const firstErr = logs.find((l) => l.level === "error");
      return { ok: false, msg: firstErr ? firstErr.text.trim() : "dbt run failed" };
    }
    const captured = captureRelation(exec, target);
    if (!captured.ok) return { ok: false, msg: `cannot read model '${target}': ${captured.msg}` };

    const testOutcomes = {};
    for (const name of testNames) {
      const t = project.manifest.genericTests.find((g) => g.name === name);
      if (!t) { testOutcomes[name] = { declared: false }; continue; }
      const r = exec(compileGenericTest(t));
      testOutcomes[name] = { declared: true, failures: r.ok ? Number(r.rows?.[0]?.[0] ?? 0) : null, error: r.ok ? null : r.msg };
    }
    return { ok: true, captured, testOutcomes };
  } finally {
    exec("ROLLBACK TO SAVEPOINT dbt_grade");
    exec("RELEASE SAVEPOINT dbt_grade");
  }
}

function compareOutputs(got, want) {
  const wantCols = want.columns, gotCols = got.columns;
  if (wantCols.length !== gotCols.length || [...wantCols].sort().join(",") !== [...gotCols].sort().join(",")) {
    return { ok: false, detail: `columns differ — expected [${wantCols.join(", ")}], got [${gotCols.join(", ")}]` };
  }
  if (got.rows.length !== want.rows.length) {
    return { ok: false, detail: `row count differs — expected ${want.rows.length}, got ${got.rows.length}` };
  }
  // align got's column order to want's, then sort rows and compare
  const idx = wantCols.map((c) => gotCols.indexOf(c));
  const norm = (rows, map) => rows
    .map((r) => JSON.stringify((map ? map.map((i) => r[i]) : r).map(round6)))
    .sort();
  const a = norm(want.rows), b = norm(got.rows, idx);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return { ok: false, detail: `row values differ (after sorting) — expected ${a[i]}, got ${b[i]}` };
  }
  return { ok: true };
}

// Transitive refs/sources of `target` in a compiled project.
function transitiveDeps(project, target) {
  const refs = new Set(), sources = new Set();
  const visit = (n, seen) => {
    const node = project.compiled[n];
    if (!node || seen.has(n)) return;
    seen.add(n);
    node.sources.forEach((s) => sources.add(s));
    node.refs.forEach((r) => { refs.add(r); visit(r, seen); });
  };
  visit(target, new Set());
  return { refs, sources };
}

/**
 * Grade a mission. Returns { pass, checks: [{ id, label, ok, detail }] }.
 * challenge.validate: { target, mustMaterialize?, mustUseRef?, mustUseSource?,
 *                       mustPassTests?, rawMustMatch? (regex string on target's raw) }
 */
export function gradeDbtChallenge(challenge, userVfs, exec) {
  const v = challenge.validate;
  const checks = [];
  const check = (id, label, ok, detail = "") => { checks.push({ id, label, ok, detail }); return ok; };
  const done = () => ({ pass: checks.every((c) => c.ok), checks });

  // ① compile the user's project
  const userProject = compileProject(userVfs);
  if (!check("compile", "project compiles", userProject.errors.length === 0, userProject.errors.join(" · "))) return done();
  const targetNode = userProject.compiled[v.target];
  if (!check("target", `model '${v.target}' exists`, !!targetNode, `create models/**/${v.target}.sql`)) return done();

  // ② static structural assertions
  if (v.mustMaterialize) {
    for (const [model, mat] of Object.entries(v.mustMaterialize)) {
      const node = userProject.compiled[model];
      check(`mat_${model}`, `${model} is materialized as ${mat}`, !!node && node.materialized === mat,
        node ? `currently '${node.materialized}'` : "model missing");
    }
  }
  const deps = transitiveDeps(userProject, v.target);
  for (const ref of v.mustUseRef || []) {
    check(`ref_${ref}`, `uses {{ ref('${ref}') }}`, deps.refs.has(ref), `make ${v.target} (or its upstreams) ref '${ref}'`);
  }
  for (const src of v.mustUseSource || []) {
    check(`src_${src}`, `uses {{ source('${src.replace(".", "', '")}') }}`, deps.sources.has(src), "select from the source, not the raw table name");
  }
  if (v.rawMustMatch) {
    const raw = userProject.manifest.models[v.target]?.raw || "";
    check("raw", v.rawMustMatchLabel || "model uses the required construct", new RegExp(v.rawMustMatch, "i").test(raw), "");
  }
  if (!checks.every((c) => c.ok)) return done();

  // ③ run USER project in scratch, capture target + test outcomes
  const testNames = v.mustPassTests || [];
  const userRun = runInScratch(exec, userProject, { target: v.target, testNames });
  if (!check("run", "dbt run succeeds", userRun.ok, userRun.msg || "")) return done();

  for (const name of testNames) {
    const o = userRun.testOutcomes[name];
    if (!check(`test_decl_${name}`, `test '${name}' is declared in schema.yml`, o.declared, "add it under the column's tests:")) continue;
    check(`test_pass_${name}`, `test '${name}' passes`, o.failures === 0,
      o.error ? o.error : o.failures > 0 ? `${o.failures} failing row${o.failures > 1 ? "s" : ""}` : "");
  }

  // ④ run SOLUTION project in scratch, compare outputs
  const solProject = compileProject(challenge.solution);
  if (solProject.errors.length) {
    check("solution", "internal: solution compiles", false, solProject.errors.join(" · "));
    return done();
  }
  const solRun = runInScratch(exec, solProject, { target: v.target });
  if (!check("solution_run", "internal: solution runs", solRun.ok, solRun.msg || "")) return done();

  const cmp = compareOutputs(userRun.captured, solRun.captured);
  check("output", `${v.target} output matches expected`, cmp.ok, cmp.detail || "");

  return done();
}
