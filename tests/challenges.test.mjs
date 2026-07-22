// Content sweep: every challenge definition in PunkSQL.jsx must actually
// work against the real schema — validate (and verify) SQL executes, and
// every challenge carries bilingual copy, a hint and an explanation.
// Runs each statement inside a rolled-back SAVEPOINT so DML/DDL challenges
// never contaminate later ones.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import initSqlJs from "sql.js";

const src = fs.readFileSync(new URL("../src/components/PunkSQL.jsx", import.meta.url), "utf8");

function extract(name, closer = "\n];") {
  const start = src.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `${name} not found`);
  const open = src.indexOf("=", start) + 1;
  const end = src.indexOf(closer, open);
  return src.slice(open, end + closer.length - 1).trim();
}

const CHALLENGES_DB = eval(extract("CHALLENGES_DB"));
const SOLUTION_EXPLANATIONS = eval("(" + extract("SOLUTION_EXPLANATIONS", "\n};") + ")");
const DB_SCHEMA = src.match(/const DB_SCHEMA = `([\s\S]*?)`;/)[1];

let db;
before(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run(DB_SCHEMA);
});

function tryExec(sql) {
  db.exec("SAVEPOINT sweep");
  try {
    const r = db.exec(sql);
    return { ok: true, rows: r.length ? r[0].values.length : 0 };
  } catch (e) {
    return { ok: false, msg: e.message };
  } finally {
    db.exec("ROLLBACK TO SAVEPOINT sweep");
    db.exec("RELEASE SAVEPOINT sweep");
  }
}

test("challenge set shape: 122 unique ids across 11 modules", () => {
  assert.equal(CHALLENGES_DB.length, 122);
  assert.equal(new Set(CHALLENGES_DB.map(c => c.id)).size, 122);
  assert.equal(new Set(CHALLENGES_DB.map(c => c.mod)).size, 11);
});

test("every challenge has bilingual copy, hint and schema", () => {
  for (const c of CHALLENGES_DB) {
    for (const field of ["title", "desc_en", "desc_pt", "hint", "validate", "schema"]) {
      assert.ok(c[field] && String(c[field]).trim().length > 0, `challenge ${c.id} missing ${field}`);
    }
  }
});

test("every challenge has a solution explanation (EN + PT)", () => {
  for (const c of CHALLENGES_DB) {
    const ex = SOLUTION_EXPLANATIONS[c.id];
    assert.ok(ex, `challenge ${c.id} (${c.title}) has no SOLUTION_EXPLANATIONS entry`);
    assert.ok(ex.en?.length > 20 && ex.pt?.length > 20, `challenge ${c.id} explanation too short`);
  }
});

for (const c of CHALLENGES_DB.filter(c => c.type !== "text")) {
  test(`challenge ${c.id} (${c.title}): validate SQL executes`, () => {
    const r = tryExec(c.validate);
    assert.ok(r.ok, `validate failed: ${r.msg}\nSQL: ${c.validate}`);
    if (!c.verify && !/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|SAVEPOINT|BEGIN)/i.test(c.validate)) {
      assert.ok(r.rows > 0, `validate returned 0 rows — unverifiable challenge?\nSQL: ${c.validate}`);
    }
  });
  if (c.verify) {
    test(`challenge ${c.id} (${c.title}): verify runs after validate`, () => {
      db.exec("SAVEPOINT sweep2");
      try {
        db.exec(c.validate);
        const r = db.exec(c.verify);
        assert.ok(true, "verify executed");
        void r;
      } catch (e) {
        assert.fail(`validate+verify failed: ${e.message}`);
      } finally {
        db.exec("ROLLBACK TO SAVEPOINT sweep2");
        db.exec("RELEASE SAVEPOINT sweep2");
      }
    });
  }
}

test("text challenges (dbt module) have validate patterns", () => {
  for (const c of CHALLENGES_DB.filter(c => c.type === "text")) {
    assert.ok(c.validate.length > 3, `text challenge ${c.id} validate too short`);
  }
});
