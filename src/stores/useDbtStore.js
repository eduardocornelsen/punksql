import { create } from "zustand";

const VFS_KEY = "punksql-dbt-vfs-v1";

// ── Seed lesson project (TDD §3.2 tier 3: static fixture) ─────
// Runs against the sandbox dataset. stg_sales is intentionally dirty:
// raw_sales has a NULL unit_price and negative quantities, so `dbt test`
// genuinely fails until the user cleans the model — the Phase 2 demo loop.
export const DBT_SEED_PROJECT = {
  "dbt_project.yml": `name: punksql_project
version: '1.0.0'
config-version: 2

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]

vars:
  completed_statuses: ['completed', 'shipped']

models:
  punksql_project:
    staging:
      +materialized: view
    intermediate:
      +materialized: ephemeral
    mart:
      +materialized: table
`,
  "models/sources.yml": `version: 2

sources:
  - name: raw
    description: Raw tables loaded into the sandbox database
    tables:
      - name: orders
      - name: customers
      - name: sales
        identifier: raw_sales
`,
  "models/staging/stg_orders.sql": `{{ config(materialized='view') }}

select
  id as order_id,
  customer_id,
  cast(total_amount as real) as amount,
  status,
  order_date
from {{ source('raw', 'orders') }}
`,
  "models/staging/stg_customers.sql": `{{ config(materialized='view') }}

select
  id as customer_id,
  name,
  country,
  signup_date
from {{ source('raw', 'customers') }}
`,
  "models/staging/stg_sales.sql": `{{ config(materialized='view') }}

-- ⚠ raw_sales is dirty on purpose: NULL prices, negative quantities,
-- duplicated rows. Run \`dbt test\` to see the failures, then clean
-- this model (filter / deduplicate) until the tests go green.
select
  id as sale_id,
  product_id,
  quantity,
  unit_price,
  sale_date
from {{ source('raw', 'sales') }}
`,
  "models/staging/schema.yml": `version: 2

models:
  - name: stg_orders
    description: One row per order, amounts cast to REAL
    columns:
      - name: order_id
        tests:
          - not_null
          - unique
      - name: status
        tests:
          - accepted_values:
              values: ['completed', 'shipped', 'pending']
      - name: customer_id
        tests:
          - relationships:
              to: ref('stg_customers')
              field: customer_id

  - name: stg_sales
    description: Cleaned sales — tests fail until the model filters bad rows
    columns:
      - name: sale_id
        tests:
          - not_null
          - unique
      - name: unit_price
        tests:
          - not_null
`,
  "models/intermediate/int_completed_orders.sql": `-- ephemeral: inlined as a CTE into downstream models, never materialized
select *
from {{ ref('stg_orders') }}
where status in ({% for s in var('completed_statuses') %}'{{ s }}'{% if not loop.last %}, {% endif %}{% endfor %})
`,
  "models/mart/fct_revenue.sql": `{{ config(materialized='table') }}

select
  c.country,
  count(*) as orders,
  round(sum(o.amount), 2) as revenue
from {{ ref('int_completed_orders') }} o
join {{ ref('stg_customers') }} c on c.customer_id = o.customer_id
group by c.country
`,
  "tests/assert_no_negative_quantities.sql": `-- singular test: passes when this query returns 0 rows
select *
from stg_sales
where quantity < 0
`,
};

function loadVfs() {
  try {
    const raw = localStorage.getItem(VFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved.vfs === "object" && Object.keys(saved.vfs).length) return saved;
    }
  } catch {}
  return { vfs: { ...DBT_SEED_PROJECT }, activeFile: "models/staging/stg_orders.sql" };
}

let _persistTimer = null;
function persist(get) {
  if (typeof window === "undefined") return;
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      const { vfs, activeFile } = get();
      localStorage.setItem(VFS_KEY, JSON.stringify({ vfs, activeFile }));
    } catch {}
  }, 300);
}

let _logId = 1;

const useDbtStore = create((set, get) => ({
  ...(typeof window === "undefined"
    ? { vfs: { ...DBT_SEED_PROJECT }, activeFile: "models/staging/stg_orders.sql" }
    : loadVfs()),

  dirty: {},                  // path -> true since last compile/run
  logs: [],                   // { id, level: info|ok|warn|error, text }
  runStatus: "idle",          // idle | running | success | error
  artifacts: null,            // { compiled, dag, order } from last compile/run

  writeFile: (path, content) => {
    set((s) => ({ vfs: { ...s.vfs, [path]: content }, dirty: { ...s.dirty, [path]: true } }));
    persist(get);
  },

  newFile: (path, content = "") => {
    set((s) => ({
      vfs: { ...s.vfs, [path]: s.vfs[path] ?? content },
      activeFile: path,
      dirty: { ...s.dirty, [path]: true },
    }));
    persist(get);
  },

  deleteFile: (path) => {
    set((s) => {
      const vfs = { ...s.vfs };
      delete vfs[path];
      const remaining = Object.keys(vfs);
      return {
        vfs,
        activeFile: s.activeFile === path ? (remaining.find((p) => p.endsWith(".sql")) || remaining[0] || null) : s.activeFile,
      };
    });
    persist(get);
  },

  setActive: (path) => { set({ activeFile: path }); persist(get); },

  appendLog: (line) => set((s) => ({ logs: [...s.logs, { id: _logId++, ...line }] })),
  clearLogs: () => set({ logs: [] }),
  setRunStatus: (runStatus) => set({ runStatus }),
  setArtifacts: (artifacts) => set({ artifacts, dirty: {} }),

  resetProject: () => {
    set({ vfs: { ...DBT_SEED_PROJECT }, activeFile: "models/staging/stg_orders.sql", dirty: {}, artifacts: null });
    persist(get);
  },
}));

export default useDbtStore;
