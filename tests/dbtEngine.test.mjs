// Unit tests for the dbt simulator core (node --test).
// The SQL executor is injected, so these run against a tiny in-memory fake
// that understands just enough (CREATE/DROP/INSERT bookkeeping + canned rows).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseYamlLite, renderModel, buildManifest, compileProject,
  withEphemeralCtes, compileGenericTest, runProject, testProject,
  seedProject, selectNodes, runDbtCommand,
} from "../src/lib/dbtEngine.js";

// ── fake engine ───────────────────────────────────────────────
function fakeEngine({ failOn = [], testFailures = {} } = {}) {
  const relations = {}; // name -> 'table' | 'view'
  const sqlLog = [];
  const exec = (sql) => {
    sqlLog.push(sql);
    const s = sql.trim();
    if (failOn.some((f) => s.includes(f))) return { ok: false, columns: [], rows: [], msg: `fake error near '${failOn[0]}'` };
    let m;
    if ((m = s.match(/^SELECT type FROM sqlite_master WHERE name='(\w+)'/))) {
      const t = relations[m[1]];
      return { ok: true, columns: ["type"], rows: t ? [[t]] : [], msg: "" };
    }
    if ((m = s.match(/^CREATE (TABLE|VIEW) (\w+)/i))) { relations[m[2]] = m[1].toLowerCase(); return { ok: true, columns: [], rows: [], msg: "" }; }
    if ((m = s.match(/^DROP (TABLE|VIEW) IF EXISTS (\w+)/i))) { delete relations[m[2]]; return { ok: true, columns: [], rows: [], msg: "" }; }
    if (/^select count\(\*\) as failures/i.test(s)) {
      const hit = Object.entries(testFailures).find(([frag]) => s.includes(frag));
      return { ok: true, columns: ["failures"], rows: [[hit ? hit[1] : 0]], msg: "" };
    }
    return { ok: true, columns: [], rows: [], msg: "" };
  };
  return { exec, relations, sqlLog };
}

const VFS = {
  "dbt_project.yml": `name: punksql_project
version: '1.0.0'
vars:
  active_only: false
models:
  punksql_project:
    staging:
      +materialized: view
    mart:
      +materialized: table
`,
  "models/sources.yml": `version: 2
sources:
  - name: raw
    tables:
      - name: orders
      - name: sales
        identifier: raw_sales
`,
  "models/staging/schema.yml": `version: 2
models:
  - name: stg_orders
    description: Cleaned orders
    columns:
      - name: order_id
        tests:
          - not_null
          - unique
      - name: status
        tests:
          - accepted_values:
              values: ['completed', 'shipped', 'pending']
`,
  "models/staging/stg_orders.sql": `{{ config(materialized='view') }}
select
  id as order_id,
  customer_id,
  cast(total_amount as real) as amount,
  status
from {{ source('raw', 'orders') }}
{% if var('active_only') %}
where status != 'cancelled'
{% endif %}`,
  "models/staging/int_big_orders.sql": `{{ config(materialized='ephemeral') }}
select * from {{ ref('stg_orders') }} where amount > 100`,
  "models/mart/fct_revenue.sql": `select status, sum(amount) as revenue
from {{ ref('int_big_orders') }}
group by status`,
  "tests/assert_positive_revenue.sql": `select * from fct_revenue where revenue < 0`,
  "seeds/country_codes.csv": `code,country\nBR,Brazil\nUS,"United, States"\nJP,Japan`,
};

// ── YAML ──────────────────────────────────────────────────────
test("parseYamlLite: nested maps, lists of maps, nested tests", () => {
  const doc = parseYamlLite(VFS["models/staging/schema.yml"]);
  assert.equal(doc.version, 2);
  assert.equal(doc.models[0].name, "stg_orders");
  assert.equal(doc.models[0].columns.length, 2);
  assert.deepEqual(doc.models[0].columns[0].tests, ["not_null", "unique"]);
  const av = doc.models[0].columns[1].tests[0];
  assert.deepEqual(av.accepted_values.values, ["completed", "shipped", "pending"]);
});

test("parseYamlLite: dbt_project vars and +materialized", () => {
  const doc = parseYamlLite(VFS["dbt_project.yml"]);
  assert.equal(doc.vars.active_only, false);
  assert.equal(doc.models.punksql_project.staging["+materialized"], "view");
  assert.equal(doc.models.punksql_project.mart["+materialized"], "table");
});

// ── Jinja ─────────────────────────────────────────────────────
test("renderModel: ref/source/config collection and substitution", () => {
  const r = renderModel(VFS["models/staging/stg_orders.sql"], {
    modelName: "stg_orders",
    vars: { active_only: false },
    resolveRef: (x) => x,
    resolveSource: (s, t) => (t === "sales" ? "raw_sales" : t),
  });
  assert.deepEqual(r.sources, ["raw.orders"]);
  assert.equal(r.config.materialized, "view");
  assert.ok(r.sql.includes("from orders"));
  assert.ok(!r.sql.includes("{{"));
  assert.ok(!r.sql.includes("where status"), "if-branch with false var must be dropped");
});

test("renderModel: if branch taken when var is true", () => {
  const r = renderModel(VFS["models/staging/stg_orders.sql"], {
    modelName: "stg_orders", vars: { active_only: true },
    resolveRef: (x) => x, resolveSource: (s, t) => t,
  });
  assert.ok(r.sql.includes("where status != 'cancelled'"));
});

test("renderModel: for loop with loop.last, set, var default, this", () => {
  const src = `{% set cols = ['a', 'b', 'c'] %}
select {% for c in cols %}{{ c }}{% if not loop.last %}, {% endif %}{% endfor %}
from {{ this }} -- v{{ var('missing', 9) }}`;
  const r = renderModel(src, { modelName: "m1", vars: {}, resolveRef: (x) => x, resolveSource: (s, t) => t });
  assert.ok(r.sql.includes("select a, b, c"));
  assert.ok(r.sql.includes("from m1"));
  assert.ok(r.sql.includes("v9"));
});

test("renderModel: is_incremental gate", () => {
  const src = `select * from {{ ref('up') }} {% if is_incremental() %}where id > (select max(id) from {{ this }}){% endif %}`;
  const cold = renderModel(src, { modelName: "m", resolveRef: (x) => x, isIncremental: false });
  const warm = renderModel(src, { modelName: "m", resolveRef: (x) => x, isIncremental: true });
  assert.ok(!cold.sql.includes("where id >"));
  assert.ok(warm.sql.includes("where id > (select max(id) from m)"));
});

test("renderModel: errors on unsupported tags and unknown vars", () => {
  assert.throws(() => renderModel("{% macro x() %}{% endmacro %}", { modelName: "m" }), /unsupported tag/);
  assert.throws(() => renderModel("{{ var('nope') }}", { modelName: "m", vars: {} }), /not defined/);
  assert.throws(() => renderModel("{% if true %}x", { modelName: "m" }), /unclosed/);
});

// ── Manifest + compile ────────────────────────────────────────
test("buildManifest: models, sources with identifier, tests, seeds, singular tests", () => {
  const man = buildManifest(VFS);
  assert.deepEqual(man.errors, []);
  assert.ok(man.models.stg_orders && man.models.fct_revenue && man.models.int_big_orders);
  assert.equal(man.sources["raw.sales"].identifier, "raw_sales");
  assert.equal(man.genericTests.length, 3);
  assert.equal(man.singularTests[0].name, "assert_positive_revenue");
  assert.ok(man.seeds.country_codes);
  assert.equal(man.vars.active_only, false);
});

test("compileProject: DAG, topo order, folder materialization fallback", () => {
  const p = compileProject(VFS);
  assert.deepEqual(p.errors, []);
  assert.deepEqual(p.dag.fct_revenue, ["int_big_orders"]);
  assert.deepEqual(p.dag.int_big_orders, ["stg_orders"]);
  assert.ok(p.order.indexOf("stg_orders") < p.order.indexOf("int_big_orders"));
  assert.ok(p.order.indexOf("int_big_orders") < p.order.indexOf("fct_revenue"));
  // fct_revenue has no config() — falls back to mart +materialized: table
  assert.equal(p.compiled.fct_revenue.materialized, "table");
  assert.equal(p.compiled.int_big_orders.materialized, "ephemeral");
});

test("compileProject: unknown ref and cycles are reported", () => {
  const bad = { ...VFS, "models/mart/broken.sql": "select * from {{ ref('ghost') }}" };
  const p1 = compileProject(bad);
  assert.ok(p1.errors.some((e) => e.includes("ref('ghost')")));

  const cyc = {
    "models/a.sql": "select * from {{ ref('b') }}",
    "models/b.sql": "select * from {{ ref('a') }}",
  };
  const p2 = compileProject(cyc);
  assert.ok(p2.errors.some((e) => e.includes("cycle")));
});

test("withEphemeralCtes: ephemeral model inlined as CTE", () => {
  const p = compileProject(VFS);
  const sql = withEphemeralCtes("fct_revenue", p);
  assert.ok(sql.startsWith("with int_big_orders as ("));
  assert.ok(sql.includes("from int_big_orders"));
});

// ── run / test / seed ─────────────────────────────────────────
test("runProject: materializes in order, view + table, skips ephemeral", () => {
  const eng = fakeEngine();
  const p = compileProject(VFS);
  const logs = [];
  const r = runProject(p, eng.exec, (l) => logs.push(l));
  assert.equal(r.ok, true);
  assert.equal(eng.relations.stg_orders, "view");
  assert.equal(eng.relations.fct_revenue, "table");
  assert.ok(!("int_big_orders" in eng.relations), "ephemeral must not materialize");
  assert.ok(eng.sqlLog.some((s) => s.includes("SAVEPOINT dbt_")));
  assert.ok(logs.some((l) => l.text.includes("OK created sql view model main.stg_orders")));
  assert.ok(logs.some((l) => l.text.includes("Completed successfully")));
});

test("runProject: failure rolls back model and SKIPs descendants", () => {
  const eng = fakeEngine({ failOn: ["CREATE VIEW stg_orders"] });
  const p = compileProject(VFS);
  const logs = [];
  const r = runProject(p, eng.exec, (l) => logs.push(l));
  assert.equal(r.ok, false);
  const byName = Object.fromEntries(r.results.map((x) => [x.name, x.status]));
  assert.equal(byName.stg_orders, "error");
  assert.equal(byName.fct_revenue, "skip");
  assert.ok(eng.sqlLog.some((s) => s.startsWith("ROLLBACK TO SAVEPOINT dbt_")));
});

test("runProject: incremental → CREATE first, INSERT INTO on second run", () => {
  const vfs = {
    "models/inc_events.sql": `{{ config(materialized='incremental') }}
select 1 as id {% if is_incremental() %}where 1 > (select max(id) from {{ this }}){% endif %}`,
  };
  const eng = fakeEngine();
  runProject(compileProject(vfs), eng.exec, () => {});
  assert.equal(eng.relations.inc_events, "table");
  const before = eng.sqlLog.length;
  runProject(compileProject(vfs), eng.exec, () => {});
  const second = eng.sqlLog.slice(before);
  assert.ok(second.some((s) => s.startsWith("INSERT INTO inc_events")));
  assert.ok(second.some((s) => s.includes("where 1 > (select max(id) from inc_events)")));
});

test("compileGenericTest: assertion SQL for all four generic tests", () => {
  assert.match(compileGenericTest({ type: "not_null", model: "m", column: "c", params: {} }), /where c is null/);
  assert.match(compileGenericTest({ type: "unique", model: "m", column: "c", params: {} }), /having count\(\*\) > 1/);
  assert.match(
    compileGenericTest({ type: "accepted_values", model: "m", column: "c", params: { values: ["a", 1] } }),
    /not in \('a', 1\)/,
  );
  assert.match(
    compileGenericTest({ type: "relationships", model: "m", column: "c", params: { to: "ref('p')", field: "id" } }),
    /left join p/,
  );
});

test("testProject: real pass/fail with failing-row counts, singular tests", () => {
  const eng = fakeEngine({ testFailures: { "from stg_orders where order_id is null": 3 } });
  const p = compileProject(VFS);
  const logs = [];
  const r = testProject(p, eng.exec, (l) => logs.push(l));
  assert.equal(r.ok, false);
  const nn = r.results.find((x) => x.name === "not_null_stg_orders_order_id");
  assert.equal(nn.status, "fail");
  assert.equal(nn.failures, 3);
  assert.equal(r.results.filter((x) => x.status === "pass").length, 3); // unique + accepted_values + singular
  assert.ok(logs.some((l) => /FAIL 3 not_null_stg_orders_order_id/.test(l.text)));
});

test("seedProject: CSV → typed CREATE TABLE + INSERTs (quoted comma survives)", () => {
  const eng = fakeEngine();
  const p = compileProject(VFS);
  const r = seedProject(p, eng.exec, () => {});
  assert.equal(r.ok, true);
  assert.ok(eng.sqlLog.some((s) => s === "CREATE TABLE country_codes (code TEXT, country TEXT)"));
  assert.ok(eng.sqlLog.some((s) => s.includes("'United, States'")));
});

// ── selection + CLI ───────────────────────────────────────────
test("selectNodes: name, name+ (descendants), +name (ancestors)", () => {
  const p = compileProject(VFS);
  assert.deepEqual([...selectNodes(p, "stg_orders").set].sort(), ["stg_orders"]);
  assert.deepEqual([...selectNodes(p, "stg_orders+").set].sort(), ["fct_revenue", "int_big_orders", "stg_orders"]);
  assert.deepEqual([...selectNodes(p, "+fct_revenue").set].sort(), ["fct_revenue", "int_big_orders", "stg_orders"]);
  assert.ok(selectNodes(p, "nope").error);
});

test("runDbtCommand: run --select limits scope; build = run + test; unknown verb errors", () => {
  const eng = fakeEngine();
  const logs = [];
  const r1 = runDbtCommand("dbt run --select stg_orders", VFS, eng.exec, (l) => logs.push(l));
  assert.equal(r1.ok, true);
  assert.ok(eng.relations.stg_orders);
  assert.ok(!eng.relations.fct_revenue, "--select must exclude fct_revenue");

  const eng2 = fakeEngine();
  const r2 = runDbtCommand("dbt build", VFS, eng2.exec, () => {});
  assert.equal(r2.ok, true);
  assert.ok(eng2.relations.fct_revenue);

  const logs3 = [];
  const r3 = runDbtCommand("dbt frobnicate", VFS, fakeEngine().exec, (l) => logs3.push(l));
  assert.equal(r3.ok, false);
  assert.ok(logs3[0].text.includes("Unknown command"));
});

test("runDbtCommand: compilation errors block run", () => {
  const bad = { ...VFS, "models/mart/broken.sql": "select * from {{ ref('ghost') }}" };
  const eng = fakeEngine();
  const logs = [];
  const r = runDbtCommand("dbt run", bad, eng.exec, (l) => logs.push(l));
  assert.equal(r.ok, false);
  assert.ok(logs.some((l) => l.text.includes("Compilation Error")));
  assert.ok(!eng.sqlLog.some((s) => s.startsWith("CREATE")), "nothing may materialize on compile errors");
});
