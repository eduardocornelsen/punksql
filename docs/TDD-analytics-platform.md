# TDD — PunkSQL Analytics Engineering Platform

**Status:** Draft / Brainstorm
**Author:** Staff Eng (architecture)
**Date:** 2026-06-23
**Scope:** Feature 1 — "Free Explore" Sandbox · Feature 2 — Interactive dbt Learning Module
(execution, materialization, object browser, data lineage, tests, challenges & tutorials)

---

## 0. Context & Guiding Constraint

This TDD is written against the **actual** PunkSQL codebase, not a greenfield. The single most
important architectural fact is this:

> **PunkSQL already runs a real SQLite engine in the browser** via `sql.js` (WASM), loaded from
> CDN into a module-global `globalDB`, with a `runSQL(db, sql) → {ok, columns, rows, ms, msg}`
> primitive and a **SAVEPOINT-based isolation pattern** (`SAVEPOINT sp_user` … `ROLLBACK TO` …
> `RELEASE`) already used for DML/DDL challenge validation.
> _See `src/components/PunkSQL.jsx` (`getDB`, `runSQL`, `validateSQL`)._

The engine is **already paid for**. The result shape the REPL needs (`columns`/`rows`/`ms`) already
exists. Isolation primitives already exist. This collapses most of the "WASM vs. backend" debate
for Feature 1 before it starts, and it gives Feature 2 a high-fidelity execution target for free.

**Optimization target (per the brief):** solo developer, **low/zero server cost**, **high portfolio
impact**. Every recommendation below is filtered through "what makes the best demo with the least
operational surface for one person to maintain."

Current stack (verified from `package.json`): Next.js 16, React 19, Zustand 5, Supabase (auth +
progress), `sql.js` 1.10.3 (CDN), Tone.js, deployed on Vercel. The UI lives almost entirely in one
~4,000-line `PunkSQL.jsx` TUI component.

---

## 1. Trade-off Analysis

### 1.1 Feature 1 — Sandbox: In-Browser WASM vs. Backend API

| Dimension | **In-Browser (reuse `sql.js`)** | Backend API (read-only Postgres/DuckDB) |
|---|---|---|
| **Marginal cost to build** | ~Zero engine work — reuse `getDB()`/`runSQL()` | New service, roles, container, connection pool |
| **Server cost** | **$0** (static, runs on user's CPU) | Always-on or cold-start serverless + DB hosting |
| **Latency** | Sub-ms to low-ms, no network | Network RTT + query + rate-limit gating |
| **Security surface** | None — sandboxed in the user's tab | Must enforce read-only role, statement timeout, rate limit, SQLi-by-design exposure |
| **Offline / portfolio demo** | Works on a plane, on a phone, with no keys | Breaks the moment the free tier sleeps |
| **SQL fidelity** | SQLite dialect only | Can offer real Postgres/DuckDB analytics dialect |
| **Dataset size** | Bounded by browser memory (fine for ≤ tens of MB) | Unbounded |

**Recommendation: In-browser, reuse the existing `sql.js` engine. Do not build a backend for
the sandbox.** A backend buys us only (a) a richer SQL dialect and (b) large datasets — neither is
on the critical path for a teaching sandbox, and both cost a solo dev real money and a permanent
security/ops liability (the entire value proposition of a SQL sandbox API is "execute arbitrary
user SQL," which is the thing you spend your life hardening). The browser engine is faster, free,
offline-capable, and already battle-tested in the challenge flow.

**One caveat worth designing for now:** SQLite ≠ the analytics dialects our Senior/AE audience
actually uses. If dialect realism becomes a portfolio differentiator later, the **upgrade path is
still client-side**: swap `sql.js` for **DuckDB-WASM**, which speaks a Postgres-flavored, window-
function-rich, analytics-grade dialect and reads Parquet/CSV directly — all still at $0 server cost.
We therefore **abstract the engine behind an interface now** (§3.3) so this swap is a one-file change.

### 1.2 Feature 2 — dbt Module: Simulation vs. Client WASM (Pyodide) vs. Serverless

| Dimension | **Simulation** (JS Jinja/DAG compiler) | Client WASM (Pyodide + dbt-core + DuckDB) | Serverless (Cloud Run dbt) |
|---|---|---|---|
| **Initial payload** | ~tens of KB of JS | **~50–150 MB+** (Pyodide + wheels) cold download | None (server-side) |
| **Cold start** | Instant | 10–40s+ first load, heavy memory | Container cold start + spin-up |
| **Server cost** | **$0** | **$0** | $ per execution, plus idle/cold-start |
| **Fidelity** | High for a teaching subset; not 100% dbt | **100%** (it _is_ dbt-core) | **100%** (it _is_ dbt-core) |
| **Ops/maintenance** | Pure frontend, no infra | Brittle wheel/version pinning, big bundle | Containers, auth, abuse limits, logging |
| **Mobile viability** | Excellent | Poor (memory/download on phones) | Good (thin client) |
| **Portfolio story** | "I built a dbt compiler" — strong | "I shipped dbt in a browser tab" — flashy but fragile | "I built infra" — costs money to keep alive |

**Recommendation: Build a "compile-accurate simulator," but make it _execute for real_ against the
existing `sql.js`/DuckDB-WASM engine.** This is a deliberate hybrid that beats all three pure options
for our constraints:

1. We **reimplement the teaching-relevant slice of dbt-core in JS**: parse `{{ ref('x') }}`,
   `{{ source('s','t') }}`, `{{ config(materialized=...) }}`, and a small macro set; build the model
   **DAG**; topologically sort it; and **compile each model's Jinja into plain SQL** (resolving
   `ref()` to a relation name).
2. We then **run the compiled SQL through the engine we already own** — `CREATE VIEW`/`CREATE TABLE
   AS` per materialization, in dependency order, inside a SAVEPOINT scratch schema. `dbt test`
   becomes generated assertion queries (`unique`/`not_null`/`accepted_values`/`relationships`) that
   return failing-row counts.

This means `dbt run` **actually materializes models** and `dbt test` **actually passes or fails on
the user's data** — real behavior, real logs derived from real outcomes — with **$0 server cost, no
Pyodide download, and no container to babysit.** The logs aren't "hardcoded fakes" (option 1 as
posed); they're rendered from genuine compile + execute results, which is what makes the feature
defensible as a portfolio piece *and* pedagogically honest.

**Why not pure Pyodide?** It's the most impressive party trick but the worst product for a mobile-
first app: a 100 MB+ cold download and heavy memory footprint contradicts "mobile-first," and the
wheel/version maintenance is a real tax on a solo dev. Keep it as a documented "Phase 4 stretch"
for a desktop-only "real dbt" lab if the appetite appears.

**Why not Serverless?** It's the only option that costs money to merely *exist*, introduces auth +
abuse-limiting work (running arbitrary user dbt projects server-side is a sandbox-escape target),
and adds the exact ops surface we're trying to avoid. Reserve as Phase 4 alt-path if we ever need
100% dbt parity (e.g. advanced macros/packages) for a premium tier.

> **Honesty boundary (call this out in the UI):** the JS simulator covers `ref`/`source`/`config`/
> common tests/basic macros + `{% if %}`/`{% for %}`. It is explicitly *not* full Jinja/Python.
> A visible `[ sim ]` badge and a short "what's supported" panel keeps it credible and avoids the
> "but real dbt does X" support burden.

---

## 2. Capabilities & Scope (what users can actually do)

This section answers the concrete "can I…?" questions and draws the honesty boundary. Everything
here runs client-side on the existing engine at **$0 server cost**; the only nuances are two
SQLite-specific caveats (schemas, and binary persistence) called out explicitly.

### 2.1 Free Explore — a mini DBeaver in the browser

SQLite exposes its own catalog, so a real object browser is just queries against it:

| User capability | How it works on `sql.js` / SQLite | Status |
|---|---|---|
| See all tables anywhere | `SELECT name FROM sqlite_master WHERE type='table'` | ✅ Easy |
| See columns & types | `PRAGMA table_info(<table>)` | ✅ |
| See views I created | `sqlite_master WHERE type='view'` | ✅ |
| **Create tables** (`CREATE TABLE`, `CREATE TABLE AS SELECT`) | Native SQLite DDL | ✅ |
| **Create / save views** (`CREATE VIEW`) | Native SQLite DDL | ✅ |
| **Join any tables together** | Single DB → just `JOIN`, no setup | ✅ Fully |
| **Multiple databases** | `ATTACH DATABASE` → reference as `db.table` | ✅ (this is "multiple DBs") |
| Postgres-style **schemas** | ⚠️ SQLite has none — the equivalent unit is an *attached database* | ⚠️ Emulated via ATTACH |
| DBeaver-style **object tree** | Render the catalog queries above as a navigable tree | ✅ `<ObjectBrowser>` |
| **Data lineage** of my objects | Parse `sqlite_master.sql` (stored DDL) → dependency graph | ✅ See §2.3 |

**Caveat 1 — "schemas":** SQLite's namespacing unit is the *attached database*, not a Postgres
schema. We give the *appearance* of multiple schemas/databases by `ATTACH`-ing several in-memory DBs
(`ATTACH ':memory:' AS analytics`) and referencing `analytics.fct_orders`. **Cross-database joins
work perfectly.** True `CREATE SCHEMA` fidelity is one of the things the **DuckDB-WASM** upgrade
(§1.1) would unlock — DuckDB has real schemas — still at $0 server.

So yes: the Sandbox can ship as a **left-side object explorer (databases → tables/views → columns)
+ REPL**, joins across everything, and a live view of every object you've created.

### 2.2 Creating & saving objects — persistence tiers

`CREATE TABLE`/`CREATE VIEW`/`CTAS` all work *today* because it's a real engine. The only design
choice is *how long they survive*. Note this is the **database binary**, persisted separately from
the dbt VFS JSON (§3.2):

| Tier | Survives | Cost | Mechanism |
|---|---|---|---|
| **Session (in-memory)** | Until tab refresh | $0, already the default | `globalDB` rebuilt each load |
| **Local persistent** | Across refresh, same device | $0 | `db.export()` → `Uint8Array` → **IndexedDB**; rehydrate on boot |
| **Cloud (logged-in)** | Across devices | ~$0 | Store the exported blob per user in Supabase |

> **Important:** `localStorage` cannot hold the DB binary (string-only, ~5 MB cap). The correct store
> for a saved database is **IndexedDB**. localStorage stays reserved for small JSON (history, VFS).

**Decision:** ship **session** first (free, instant), then **IndexedDB-local** as the persistence
target — a "Save workspace" button so created tables/views survive a refresh on the same device.
**Cloud (Supabase) sync is deferred** and only revisited if cross-device demand appears; no server
work is in scope for persistence.

### 2.3 Two kinds of data lineage

PunkSQL ends up with **two** lineage features, both buildable cheaply:

1. **dbt lineage (the classic DAG)** — built from `{{ ref() }}` edges in the model graph, topologically
   sorted (we already build this to *order* the run). Renders the iconic
   `raw_orders → stg_orders → fct_orders` picture. One of the strongest portfolio screenshots in the
   whole app. → `<DagView>` (§5.3).
2. **Free-Explore lineage (bonus)** — SQLite stores each object's defining SQL in `sqlite_master.sql`.
   We **parse those `CREATE VIEW` / `CTAS` definitions to extract upstream table/view dependencies**
   and draw a lineage graph of the user's *own* created objects — "this view came from these two
   tables." Works for anything *materialized*; a one-off un-saved `SELECT` has nothing persisted to
   trace, which is the expected limit. → `<LineageView>` (§5.2).

### 2.4 dbt feature matrix — what's in, what's out

`dbt run` **materializes for real** (the core of the §1.2 recommendation): it issues
`CREATE VIEW` / `CREATE TABLE AS` into the engine, so after a run your models are **real, queryable
relations** you can `SELECT` from in the same workspace.

| dbt feature | Supported | Notes |
|---|---|---|
| `{{ ref() }}`, `{{ source() }}` | ✅ | Drives the DAG |
| `{{ config(materialized=...) }}` | ✅ | |
| Materialization `view` / `table` | ✅ | Real `CREATE VIEW` / `CREATE TABLE AS` |
| Materialization `ephemeral` | ✅ | Inlined as a CTE |
| Materialization `incremental` | ⚠️ Partial | Teachable `is_incremental()` simulation, not full strategies |
| Seeds (CSV → table) | ✅ | |
| Generic tests: `not_null`, `unique`, `accepted_values`, `relationships` | ✅ | Compiled to assertion SQL → **real pass/fail + failing-row counts** |
| Singular tests (custom `.sql`) | ✅ | Passes if the query returns 0 rows |
| DAG / data lineage | ✅ | From `ref()` edges (§2.3) |
| `schema.yml` docs / descriptions | ✅ | Renderable in model/column panels |
| Jinja: `{% if %}`, `{% for %}`, `{% set %}`, `{% macro %}`, `var()` | ✅ subset | Teaching subset, **not** full Python/Jinja |
| Snapshots, exposures, packages (`dbt deps`), hooks, full `dbt docs serve` site | ❌ Out of scope | The honesty boundary — surfaced via the `[ sim ]` "what's supported" panel |

**Test results display:** every test streams into the `stdout` log dbt-style (`PASS`/`FAIL` + failing
row count), **and** a compact `<TestResultsPanel>` shows green/red per test at a glance. Because tests
run real SQL against materialized models, results are genuine, not mocked.

---

## 3. State Management & Data Flow

### 3.1 Two new Zustand slices (keep the engine global, like today)

The existing pattern is a single `useGameStore` (Zustand) plus a module-global `globalDB`. We extend,
not replace. Add two slices — keep them in separate files for tree-shaking and sanity, compose if
desired:

- `useSandboxStore` — REPL command history (already have `queryHistory` infra we can mirror),
  scrollback buffer of rendered output blocks, current input, last result.
- `useDbtStore` — the **Virtual File System (VFS)**, active file, compiled artifacts, run/test logs,
  and DAG.

### 3.2 The dbt Virtual File System (the core data structure)

Model the project as a **flat path-keyed map**, not a nested tree. Flat maps are trivial to
serialize (localStorage / Supabase JSONB), diff, and reason about; render the tree as a derived view.

```js
// useDbtStore (zustand)
{
  vfs: {
    "dbt_project.yml":            { type: "yaml", content: "..." },
    "models/staging/schema.yml":  { type: "yaml", content: "..." },
    "models/staging/stg_orders.sql": { type: "model", content: "select ... {{ ref('raw_orders') }}" },
    "models/marts/fct_orders.sql":   { type: "model", content: "..." },
    "macros/cents_to_dollars.sql":   { type: "macro", content: "{% macro ... %}" },
  },
  activeFile: "models/staging/stg_orders.sql",
  dirty: { /* path -> bool */ },          // for the [*] modified indicator

  // Derived/compiled artifacts (rebuilt on `dbt compile`/`run`)
  manifest: { nodes: {...}, sources: {...} },  // mini dbt manifest
  dag: { "fct_orders": ["stg_orders"], ... },   // adjacency, for ordering + viz
  compiled: { /* path -> compiled SQL string */ },

  // Execution
  runStatus: "idle" | "running" | "success" | "error",
  logs: [],                                // append-only stdout stream (see §5.3)

  // actions
  writeFile, deleteFile, setActive, compile, run, test, build, seed, reset
}
```

**Persistence tiers:**
1. **Working state** → `localStorage` (debounced), mirroring the existing `punksql-query-history`
   pattern. Survives refresh, zero backend.
2. **Saved projects** (logged-in users) → Supabase `dbt_projects` table, one JSONB column holding
   the `vfs` map, keyed by user. Reuses the existing Supabase + `useProgress` plumbing; no new infra.
3. **Curated lesson seeds** → ship as **static JS fixtures** (same approach as the 112 challenges
   already embedded in `PunkSQL.jsx`), loaded into the VFS when a lesson starts.

### 3.3 The execution data flow (the heart of Feature 2)

Introduce a small `SqlEngine` interface so both the Sandbox and dbt module depend on an abstraction,
not on `sql.js` directly (this is the DuckDB-WASM escape hatch from §1.1):

```
SqlEngine = {
  ready(): Promise<void>,
  exec(sql): { ok, columns, rows, ms, msg },          // wraps existing runSQL()
  withScratch(fn): result,                             // SAVEPOINT/ROLLBACK wrapper (exists!)
}
```

`dbt run` pipeline (all client-side, all synchronous-feeling):

```
VFS (raw .sql + .yml)
  │  ① parse: extract ref()/source()/config() refs per model  → manifest
  │  ② resolve: source('s','t') → real seed table; ref('m') → m's relation name
  │  ③ DAG: build adjacency from refs → topological sort
  │  ④ compile: render Jinja → plain SQL (templating subset) → store in `compiled`
  │  ⑤ execute in order, inside withScratch():
  │        view  → CREATE VIEW {model} AS {compiled}
  │        table → CREATE TABLE {model} AS {compiled}
  │  ⑥ emit logs per node (success/error/rows) as they run  → stream to UI
  ▼
logs[] + materialized relations live in the engine for the user to query
```

`dbt test` compiles `schema.yml` tests into assertion SQL, e.g.
`not_null` → `SELECT count(*) FROM {model} WHERE {col} IS NULL` → **PASS if 0**, else FAIL with the
count. Same streaming-log treatment.

**Critical isolation rule:** dbt materializations run in a **scratch namespace** wrapped in the
existing SAVEPOINT pattern (or a dedicated in-memory `sql.js` DB instance) so the dbt lab never
mutates the challenge/sandbox database. This directly reuses the `SAVEPOINT sp_user … ROLLBACK …`
machinery already proven in `validateSQL`.

---

## 4. dbt Learning System: Tutorials & Challenges

**Yes — dbt should have its own gamified track, mirroring the existing 112-challenge SQL system.**
This is the highest-leverage idea in this round: it reuses *three* things we already have — (a) the
dbt simulator (§1.2/§3.3) as the grader, (b) the existing **row-comparison logic** from `validateSQL`
as the pass/fail check, and (c) the existing **gamification spine** (`useProgress`, XP, levels, skill
tree, achievements). A whole "Analytics Engineering" curriculum drops in with almost no new infra.

### 4.1 Two complementary formats

| Format | Feel | Grading | Mirrors today's |
|---|---|---|---|
| **dbt Tutorial** | Guided, multi-step walkthrough with narrative between steps; can pre-fill files | Light per-step checkpoints (advisory) | Flashcards / quizzes (teach first) |
| **dbt Challenge** | A single graded task on a seeded project | Strict — run + compare, like SQL challenges | The 112 SQL challenges (prove mastery) |

Tutorials **teach and let you explore your data** at low pressure; challenges **make you level up**.
Both live in a new **"dbt" track in the skill tree** with progressive unlocking, exactly like the
10 existing SQL modules.

### 4.2 Challenge data model (mirror the existing challenge object)

The current challenges are static, bilingual (`desc_en`/`desc_pt`), with `validate`/`verify`/`hint`.
A dbt challenge extends that shape — the difference is the unit of work is a *project*, not one query:

```js
{
  id: 201, track: "dbt", mod: 1, diff: "MED",
  title: "stg_orders", desc_en: "Create models/staging/stg_orders.sql that selects from the
    raw_orders source, renames id→order_id, and casts amount to a number.", desc_pt: "...",
  hint: "{{ source('raw','orders') }} ... select id as order_id, cast(amount as real) ...",

  seed:     { /* starter VFS: sources, raw seeds, partially-done files */ },
  solution: { /* reference VFS that the grader runs to derive expected output */ },

  validate: {
    target: "stg_orders",                 // model whose SELECT * we compare to the solution's
    mustMaterialize: { stg_orders: "view" },   // structural assertion (check sqlite_master)
    mustUseRef:      [],                        // e.g. ["stg_orders"] for a downstream challenge
    mustPassTests:   ["not_null_stg_orders_order_id"],
  },
  explanation_en: "...", explanation_pt: "...",
}
```

### 4.3 Grading strategy (reuses what already exists)

Grading a dbt challenge is the dbt simulator + the *same* comparison primitive used for SQL challenges:

```
① run the USER's project in a scratch DB     → materialize target model
② run the SOLUTION's project in a scratch DB → materialize expected
③ SELECT * FROM <target> in both, sort rows, compare  ← identical to validateSQL row-compare
④ run structural assertions: materialization type (sqlite_master), required refs (parse),
   required tests pass (run them)
⑤ PASS only if output matches AND all assertions hold  → award XP via useProgress
```

This means a dbt challenge is graded on **real materialized output**, not string-matching the user's
SQL — so there are many valid solutions, just like the SQL challenges today. No new grading engine.

### 4.4 Challenge archetypes (the curriculum)

A progression that doubles as an AE portfolio narrative:
- **Build a staging model** (`source()` → rename/cast).
- **Build a mart** (`ref()` two upstreams, join, aggregate) — teaches the DAG.
- **Add tests** (`not_null`/`unique`/`relationships` in `schema.yml`) and make them pass.
- **Fix a failing test** by cleaning data in the model (mirrors today's SAVEPOINT cleanup challenges).
- **Fix a broken `ref()` / compilation error** (debugging skill).
- **Refactor to a macro** (`{% macro cents_to_dollars() %}`) and DRY two models.
- **Convert to `incremental`** with `is_incremental()` (teaching simulation).
- **Read the lineage**: a quiz-style step where the user answers what rebuilds if `stg_orders` changes.

### 4.5 Gamification integration (no new spine)

- New **"dbt" / "Analytics Engineering" module(s)** in the existing skill tree, progressively unlocked.
- **XP + levels**: reuse the existing thresholds/`useProgress` + Supabase progress table; dbt
  challenges grant XP like SQL ones.
- **New achievements**: *First dbt run*, *First passing test*, *Built a 3-model DAG*, *Macro author*,
  *Green build (all tests pass)*, *dbt module complete* — same unlock-condition pattern as today's 12.
- **Tutorials** can grant smaller XP for completion to reward exploration without gating progress.

---

## 5. UI Component Updates

**Hard constraint:** preserve the existing cyberpunk TUI aesthetic and **do not regress the
4,000-line `PunkSQL.jsx`**. New surfaces should be **new route-level screens / components** that
borrow the existing visual tokens (mono font, scanline, accent colors, the keyword-button system),
mounted as new "screens" in the existing screen-switcher rather than woven into the challenge flow.

> **Refactor note:** `PunkSQL.jsx` is already a monolith. These features are the right moment to
> extract shared primitives (`<TerminalFrame>`, color/token constants, the keyboard) into
> `src/components/terminal/` so Sandbox + dbt reuse them instead of copy-pasting. Low-risk, high
> leverage, improves the portfolio code-quality story.

### 5.1 Shared / extracted primitives
- **`<TerminalFrame>`** — the bordered, scanline CRT shell (extracted from current chrome).
- **`<ResultTable>`** — render `{columns, rows}` as an ASCII/box-drawing table. Already implicitly
  exists for challenge output; extract and reuse for both REPL results and `dbt`-materialized previews.
- **`<CustomKeyboard>`** — extend the existing keyword-button system with new **mode toggles**.
- **`<LineageGraph>`** — one ASCII/SVG DAG renderer parameterized by an adjacency map, shared by the
  dbt DAG and the Free-Explore object lineage (§2.3). Build once, use twice.

### 5.2 Sandbox (`Free Explore`) components
- **`<ReplScreen>`** — owns the scrollback + input loop.
- **`<ReplPrompt>`** — the `psql`-style prompt line, e.g. `punksql=#` (and `-#` continuation for
  multi-line). Mobile: reuses swipe-cursor + custom keyboard already built for the editor.
- **`<ReplScrollback>`** — append-only list of `{prompt, command, output}` blocks; new output pushes
  to the bottom and auto-scrolls (mirror the editor's existing auto-scroll-to-cursor behavior).
- **`<ObjectBrowser>`** — the DBeaver-style catalog tree (databases → tables/views → columns), driven
  by `sqlite_master` + `PRAGMA table_info`. Tapping an object can insert its name or run a preview
  `SELECT *`. This is what makes Free Explore feel like a real DB tool. (§2.1)
- **`<LineageView>`** — wraps `<LineageGraph>` with dependencies parsed from `sqlite_master.sql` to
  show lineage of the user's created views/CTAS. (§2.3)
- **Meta-command parser** — intercept backslash commands *before* hitting the engine and translate
  to `sqlite_master` queries:
  - `\dt` → `SELECT name FROM sqlite_master WHERE type='table'`
  - `\dv` → `SELECT name FROM sqlite_master WHERE type='view'`
  - `\d <table>` → `PRAGMA table_info(<table>)`
  - `\l` (attached DBs), `\?`, `\h`, `\clear`, `\history`, `\save` (→ IndexedDB) → handled in JS.
  Everything else falls through to `engine.exec()`.

### 5.3 dbt Module components
- **`<DbtWorkspace>`** — three-pane-on-desktop / tabbed-on-mobile layout: file tree · editor · logs.
- **`<VfsTree>`** — renders the flat VFS map as a collapsible tree; `[*]` dirty markers.
- **`<JinjaEditor>`** — the existing SQL editor + a **Jinja-aware highlight layer**. Implement
  highlighting as a lightweight **tokenizer overlay** (regex/lexer for `{{ … }}`, `{% … %}`,
  `{# … #}`, and `ref`/`source`/`config`), not a full language server — distinct colors for
  delimiters vs. function names vs. strings, layered behind the textarea exactly like a typical
  highlighted-textarea pattern. Keep it CSS-token-driven so it inherits the cyberpunk palette.
- **`<DbtKeyboardToggle>`** — adds the `[ dbt ]` mode to `<CustomKeyboard>`. When active, the
  keyword buttons swap to dbt CLI verbs: `run`, `test`, `build`, `compile`, `seed`, `ls`, plus
  Jinja snippet inserters (`{{ ref('') }}`, `{% macro %}`, `{{ config() }}`).
- **`<StdoutLog>`** — the centerpiece. An **append-only, sequentially-rendered** log pane that mimics
  bash `stdout`:
  - Renders log lines **one at a time with a small stagger** (setTimeout/`requestAnimationFrame`
    queue) so `dbt run` *feels* like a real CLI streaming, not an instant dump.
  - dbt-style line formatting: `HH:MM:SS  N of M OK created view model main.stg_orders ...... [OK in 0.0s]`,
    colorized PASS/WARN/ERROR, with a final `Completed successfully` / `Done. PASS=… WARN=… ERROR=…` summary.
  - Append-only buffer in `useDbtStore.logs`; never re-renders prior lines (stable, terminal-like).
- **`<DagView>`** (high portfolio value) — the dbt lineage DAG via `<LineageGraph>` over `dag`
  adjacency. The iconic `raw → staging → mart` picture; a *very* strong portfolio screenshot. (§2.3)
- **`<TestResultsPanel>`** — compact green/red per-test summary alongside the streaming log, so test
  outcomes are scannable at a glance (counts of PASS/WARN/FAIL + failing rows). (§2.4)

### 5.4 dbt Learning components (Tutorials & Challenges — §4)
- **`<DbtChallengeScreen>`** — reuses the existing challenge chrome (prompt, hint, diff badge, XP),
  but the workspace is `<DbtWorkspace>` and the "Run/Submit" action invokes the §4.3 grader.
- **`<DbtTutorialScreen>`** — guided multi-step walkthrough: narrative + a current step with an
  advisory checkpoint; "Next" advances. Mirrors the flashcard/quiz teaching flow.
- **`<SkillTreeNode>`** (extend existing) — add the **dbt / Analytics Engineering** track nodes with
  progressive unlocking, identical to the 10 SQL modules.

### 5.5 Navigation
Add entries to the existing screen/menu system — **"FREE EXPLORE"**, **"dbt LAB"** (free workspace),
and the **"dbt" track in the skill tree** (tutorials + challenges) — alongside the current modules,
labeled as an "Analytics Engineering" track for the Senior/AE audience. No router overhaul; follow
the existing screen-switch pattern.

---

## 6. Implementation Phasing (roadmap)

A deliberately incremental path: each phase ships something demoable, and each reuses the prior
phase's primitives. Phase 1 de-risks the refactor and delivers the *cheapest* high-value feature.

### **Phase 1 — Extract primitives + ship the Sandbox** _(fastest ROI, lowest risk)_
**Goal:** "Free Explore" live as a mini DB tool, and the shared terminal/engine primitives extracted.
1. Extract `<TerminalFrame>`, `<ResultTable>`, color/token constants, and wrap the engine in the
   `SqlEngine` interface (`ready/exec/withScratch`) around the existing `getDB`/`runSQL`.
2. Build `<ReplScreen>` + `<ReplPrompt>` + `<ReplScrollback>` + `<ObjectBrowser>` and the
   `\dt`/`\dv`/`\d`/`\l` meta-command parser. Reuse `queryHistory` infra for ↑/↓ recall.
3. Support `CREATE TABLE/VIEW/CTAS`, joins, and `ATTACH`-based multi-DB; add **"Save workspace" →
   IndexedDB** so created objects survive refresh.
4. Add the "FREE EXPLORE" screen to the menu. Ship.
**Exit criteria:** user can browse the catalog, `\dt`, run arbitrary SQL, create + save tables/views,
and join across attached DBs in a psql-feel REPL on mobile + desktop. $0 new infra.

### **Phase 2 — dbt VFS + compile/run engine (no fancy UI yet)**
**Goal:** the simulator *works*, proven via logs, before polishing the workspace.
1. Stand up `useDbtStore` + the flat VFS map + localStorage persistence + 1–2 static lesson seeds.
2. Build the JS dbt core: Jinja-subset templating, `ref/source/config` parsing, manifest + DAG +
   topological sort, and `compile`/`run`/`test` executing against `SqlEngine.withScratch()`.
3. Wire a minimal `<DbtWorkspace>` (tree + plain editor + raw log list) and the `[ dbt ]` keyboard
   toggle. Validate `dbt run` materializes models and `dbt test` truly passes/fails.
**Exit criteria:** editing `stg_orders.sql`, hitting `run`, and seeing real models build + a `test`
catch a `not_null` violation — all client-side.

### **Phase 3 — Polish: Jinja highlighting, streaming stdout, lineage, tests, persistence**
**Goal:** make it a portfolio piece.
1. `<JinjaEditor>` highlight overlay (Jinja delimiters + `ref/source/config`).
2. `<StdoutLog>` with staggered sequential rendering + dbt-style colorized formatting & summary line;
   `<TestResultsPanel>` for scannable pass/fail.
3. `<LineageGraph>` shared by `<DagView>` (dbt DAG) **and** `<LineageView>` (Free-Explore object
   lineage). Supabase "save project" for logged-in users; the `[ sim ]` "what's supported" panel.
**Exit criteria:** a screen-recordable "write model → highlighted Jinja → tap `build` → watch
streaming dbt logs → tests go green → DAG renders" loop, plus object lineage in Free Explore. Demo reel.

### **Phase 4 — dbt Learning Track (tutorials + challenges + gamification)** _(§4)_
**Goal:** turn the workspace into a curriculum that levels users up.
1. Define the dbt challenge data model + the §4.3 grader (run user vs. solution project, compare the
   target model's output via the existing row-compare, plus structural assertions).
2. Author the §4.4 archetype curriculum as static seeds; add `<DbtChallengeScreen>` +
   `<DbtTutorialScreen>` reusing the existing challenge/flashcard chrome.
3. Add the **dbt track to the skill tree**, wire XP via `useProgress`, and add the new achievements.
**Exit criteria:** a user completes a guided tutorial, then solves a graded dbt challenge that
materializes a model + passes tests, earning XP and unlocking the next node.

### Phase 5 — _Optional / deferred stretch_ (only if a real need appears)
- **DuckDB-WASM** swap behind `SqlEngine` for analytics-grade dialect + real schemas (still $0 server).
- **Pyodide "real dbt" desktop lab** or **Cloud Run** path for 100% parity / premium — accept the
  cost/ops only if there's demonstrated demand.

---

## 7. Summary of Recommendations

| Decision | Recommendation | One-line rationale |
|---|---|---|
| Sandbox execution | **In-browser, reuse `sql.js`** | Engine already exists; $0, fast, offline, no security surface |
| Sandbox as a DB tool | **`<ObjectBrowser>` + REPL; CREATE/CTAS/VIEW; `ATTACH` for multi-DB** | DBeaver-like browse + join across everything, all client-side |
| "Schemas" caveat | **Emulate via `ATTACH`; real schemas only with DuckDB-WASM** | SQLite has no schemas — attached DBs are the equivalent |
| Saving objects | **Session → IndexedDB-local (`db.export()`); Supabase deferred** | Persist the DB *binary* on-device; localStorage can't hold it |
| Data lineage | **`<LineageGraph>` reused: dbt DAG (refs) + Free-Explore (parsed DDL)** | Two lineage views from one component; top portfolio shots |
| dbt execution | **JS compile-accurate simulator that executes on the real WASM engine** | Real `run`/`test` + materialization, $0 server, mobile-friendly |
| dbt scope | **`ref/source/config`, view/table/ephemeral, generic+singular tests** | Honest teaching subset; snapshots/packages/hooks out of scope |
| dbt learning | **Tutorials + graded challenges in a new skill-tree track** | Reuses the simulator, row-compare grader, and XP/achievements spine |
| Pyodide / Serverless | **Defer (Phase 5)** | Only options that cost money or break mobile; reserve for parity/premium |
| VFS state | **Flat path-keyed map in a `useDbtStore` Zustand slice** | Trivial to persist (localStorage + Supabase JSONB) and diff |
| UI strategy | **Extract shared terminal primitives; add new screens, don't touch the challenge flow** | Preserve the TUI aesthetic and de-risk the monolith |
| Sequencing | **Sandbox → dbt engine → polish → learning track** | Cheapest value first; each phase reuses the last |
