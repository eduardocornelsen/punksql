// Grader tests against REAL sql.js (devDependency) — the same engine the
// browser uses. Validates the whole curriculum: every mission's solution
// passes, every unmodified seed fails, and grading never mutates the DB.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { gradeDbtChallenge } from "../src/lib/dbtGrader.js";
import { DBT_MISSIONS } from "../src/data/dbtChallenges.js";

// mirror of the sandbox dataset (subset used by missions)
const SCHEMA = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT, city TEXT, country TEXT, signup_date TEXT);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL, stock INTEGER);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, order_date TEXT, total_amount REAL, status TEXT);
CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, quantity INTEGER, unit_price REAL);
CREATE TABLE raw_sales (id INTEGER PRIMARY KEY, product_id INTEGER, quantity INTEGER, unit_price REAL, discount REAL, sale_date TEXT, customer_name TEXT);
INSERT INTO customers VALUES (1,'Ana Silva','ana@mail.com','São Paulo','Brazil','2023-01-15'),(2,'John Smith','john@mail.com','New York','USA','2023-02-20'),(3,'Maria Garcia','maria@mail.com','Madrid','Spain','2023-03-10');
INSERT INTO products VALUES (1,'Laptop Pro','Electronics',1299.99,45),(2,'Wireless Mouse','Electronics',29.99,200),(3,'Coffee Beans','Food',18.50,500),(4,'Running Shoes','Sports',89.99,120);
INSERT INTO orders VALUES (1,1,'2024-01-05',1329.98,'completed'),(2,2,'2024-01-12',89.99,'completed'),(3,3,'2024-01-20',64.49,'pending');
INSERT INTO order_items VALUES (1,1,1,1,1299.99),(2,1,2,1,29.99),(3,2,4,1,89.99),(4,3,3,2,18.50);
INSERT INTO raw_sales VALUES (1,1,2,49.99,0.10,'2024-01-10','Alice'),(2,2,-3,15.00,0.00,'2024-01-11','Bob'),(3,3,1,NULL,0.05,'2024-01-12','Carol'),(4,4,0,89.99,0.00,'2024-01-13',NULL);
`;

let db, exec;
before(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run(SCHEMA);
  exec = (sql) => {
    try {
      const r = db.exec(sql);
      if (!r.length) return { ok: true, columns: [], rows: [], msg: "0 rows" };
      return { ok: true, columns: r[0].columns, rows: r[0].values, msg: `${r[0].values.length} rows` };
    } catch (e) {
      return { ok: false, columns: [], rows: [], msg: e.message };
    }
  };
});

const objectCount = () => exec("SELECT count(*) FROM sqlite_master").rows[0][0];

for (const mission of DBT_MISSIONS) {
  test(`mission ${mission.id} (${mission.title}): solution passes, grading leaves no trace`, () => {
    const beforeCount = objectCount();
    const r = gradeDbtChallenge(mission, mission.solution, exec);
    assert.equal(r.pass, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
    assert.equal(objectCount(), beforeCount, "grader must roll back everything");
  });

  test(`mission ${mission.id} (${mission.title}): unmodified seed fails`, () => {
    const r = gradeDbtChallenge(mission, mission.seed, exec);
    assert.equal(r.pass, false, "starter project must not pass as-is");
  });
}

test("m1: wrong output (missing column) fails on the right check", () => {
  const vfs = {
    ...DBT_MISSIONS[0].solution,
    "models/staging/stg_products.sql": "select id as product_id, name, category, price from {{ source('raw', 'products') }}",
  };
  const r = gradeDbtChallenge(DBT_MISSIONS[0], vfs, exec);
  assert.equal(r.pass, false);
  const out = r.checks.find((c) => c.id === "output");
  assert.equal(out.ok, false);
  assert.match(out.detail, /columns differ/);
});

test("m1: alternate but equivalent SQL passes (graded on output, not text)", () => {
  const vfs = {
    ...DBT_MISSIONS[0].solution,
    "models/staging/stg_products.sql":
      "{{ config(materialized='view') }}\nSELECT p.id AS product_id, p.name, p.category, p.price, p.stock FROM {{ source('raw', 'products') }} p WHERE 1=1",
  };
  const r = gradeDbtChallenge(DBT_MISSIONS[0], vfs, exec);
  assert.equal(r.pass, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
});

test("m3: declaring only one of two required tests fails on declaration", () => {
  const vfs = {
    ...DBT_MISSIONS[2].solution,
    "models/staging/schema.yml": `version: 2
models:
  - name: stg_customers
    columns:
      - name: customer_id
        tests:
          - not_null
`,
  };
  const r = gradeDbtChallenge(DBT_MISSIONS[2], vfs, exec);
  assert.equal(r.pass, false);
  const decl = r.checks.find((c) => c.id === "test_decl_unique_stg_customers_customer_id");
  assert.equal(decl.ok, false);
});

test("m5: seed fails at compile with the broken ref named", () => {
  const r = gradeDbtChallenge(DBT_MISSIONS[4], DBT_MISSIONS[4].seed, exec);
  const compile = r.checks.find((c) => c.id === "compile");
  assert.equal(compile.ok, false);
  assert.match(compile.detail, /stg_order/);
});

test("m6: materializing the intermediate as a view fails the ephemeral assertion", () => {
  const vfs = {
    ...DBT_MISSIONS[5].solution,
    "models/intermediate/int_electronics.sql":
      "{{ config(materialized='view') }}\nselect * from {{ ref('stg_products') }} where category = 'Electronics'",
  };
  const r = gradeDbtChallenge(DBT_MISSIONS[5], vfs, exec);
  assert.equal(r.pass, false);
  assert.equal(r.checks.find((c) => c.id === "mat_int_electronics").ok, false);
});

test("m7: missing is_incremental() gate fails the structural check", () => {
  const vfs = {
    ...DBT_MISSIONS[6].solution,
    "models/mart/inc_orders_log.sql":
      "{{ config(materialized='incremental') }}\nselect id as order_id, customer_id, total_amount, order_date from {{ source('raw', 'orders') }}",
  };
  const r = gradeDbtChallenge(DBT_MISSIONS[6], vfs, exec);
  assert.equal(r.pass, false);
  assert.equal(r.checks.find((c) => c.id === "raw").ok, false);
});
