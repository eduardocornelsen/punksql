<div align="center">

# ⟩\_ PunkSQL

### Learn SQL by solving real challenges.

**122 exercises · 11 modules · Real in-browser SQL execution · Cyberpunk CLI aesthetic**

[▶ Play Now](https://punksql.vercel.app) · [Report Bug](https://github.com/eduardocornelsen/punksql/issues) · [Request Feature](https://github.com/eduardocornelsen/punksql/issues)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## What is PunkSQL?

PunkSQL is a **mobile-first SQL learning platform** with a cyberpunk terminal aesthetic. It's like Duolingo meets LeetCode — you write real SQL queries that execute in your browser using SQLite compiled to WebAssembly. No signup required, no cost.

Built for career switchers learning SQL from scratch, and for data professionals who want to stay sharp.

> **Screenshots coming soon**

<div align="center">

| Home | Editor | Learn | Profile |
|:---:|:---:|:---:|:---:|
| Boot sequence, daily challenge, FREE_EXPLORE card, stats | Mobile SQL editor with swipe cursor & focus mode | 11-module skill tree with progressive unlocking | Level, XP, 23 achievements with expand-to-see details |

</div>

---

## Features

### 🗺 FREE_EXPLORE Sandbox

A full IDE-like SQL sandbox accessible from the home screen — no lesson, no right answer.

- **SHELL** — interactive SQL terminal with autocomplete, command history (`↑`/`↓`), and meta-commands (`\dt`, `\d <table>`, `\history`, `\resetdb`, `\?`)
- **EDITOR** — `.sql` / `.yaml` file editor with save/load, syntax-aware dbt Jinja token bar
- **VAULT** — file browser and schema explorer with layer hints and file detail panel
- **DAG** — data lineage graph visualizing the SRC → STG → INT → MRT pipeline

The sandbox runs the same SQLite WASM engine as the challenges and comes pre-seeded with the full e-commerce dataset plus `raw_sales` and `employee_salaries`.

---

### 🔥 SQL Engine (In-Browser)

Every query runs on a **real SQLite database** loaded via [sql.js](https://github.com/sql-js/sql.js) (WASM). Seven tables with e-commerce and HR data. Your SQL is validated against expected output — column order, row count, values.

DML and DDL challenges use **SQLite SAVEPOINTs** for isolation: each run executes inside a savepoint, captures the post-operation state via a verify query, then rolls back — so the database is never permanently modified during validation.

### 📱 Mobile-First Editor

The code editor was designed specifically for writing SQL on a phone:

- **Swipe cursor** — swipe anywhere on the editor to move the cursor (no tiny tap targets)
- **Keyword buttons** — collapsible panels for TBL names, COL names, and SQL keywords
- **Focus mode** — hides all chrome to maximize editor space (tap ◉ to toggle)
- **Auto-scroll** — editor follows the cursor as you navigate
- **RESET button** — one tap to clear and start over
- **Desktop shortcuts** — `Cmd+Enter` to run, `Escape` to go back

### 🎮 Gamification

- **20 levels** with progressive XP thresholds (25 → 11,200 XP)
- **23 achievements** with real unlock conditions (first query, module completions, DML/DDL/dbt mastery, solve milestones, level gates, Hero Champion, no-hint solves, persistence, daily streaks)
- **Level-up animation** — full-screen number with bounce + glow
- **Badge unlock animation** — spinning icon with achievement name
- **Sound effects** — ascending arpeggio on correct, buzz on wrong, fanfare on level-up (Tone.js)
- **XP only on first solve** — no farming, progress is real
- **Daily challenge** — rotates based on day of year, +100 XP bonus

### 🃏 Flashcards

Three play modes on top of the standard swipeable deck:

- **Standard** — all difficulties (EASY / MED / HARD / DIALECT), 3 lives; streak bonus multiplier (×1.25 at 3, ×1.50 at 5, ×2.00 at 10)
- **Expert ⚡** — HARD cards only, 3 lives, 8-second timer per card
- **Hero ☠** — HARD cards only, 1 life, 5-second timer; win by getting 10 in a row (streak bar shown)
- **DIALECT tab** — 12 cards comparing PostgreSQL / MySQL / SQLite syntax (LIMIT, dates, concat, booleans, NULL coalescing, etc.)

Per-mode stats (wins, best streak, games played) persist to `localStorage`. Card order is shuffled on each session. Tab progress is tracked independently so switching tabs doesn't reset your current pass.

### 📝 Quiz

- **76 questions** across 11 modules + a HERO round (10 expert questions spanning all topics)
- **20-second timer** per question (green > 13s, amber > 7s, red ≤ 7s)
- **Timeout retry queue** — timed-out questions cycle back for a retry round rather than counting as wrong
- **State persistence** — question order and answer history survive page reloads and tab switches
- **Back navigation** — PREV button to review past answers; ▶ CURRENT to return to the live question
- **Per-tab shuffle** — question order is randomised on first visit and stable thereafter

### 🌍 Bilingual

Full EN/PT-BR support. Every challenge description, quiz question, flashcard, UI element, and achievement has both languages. Toggle with the EN/PT switcher in the top bar.

### 💾 Persistent Progress

XP, solved challenges, and language preference are saved to browser storage and survive page refreshes. When signed in, progress is synced to the cloud via Supabase and accessible across devices.

---

## Content

| Type | Count | Description |
|------|-------|-------------|
| **SQL Challenges** | 122 | EASY → EXPERT, real SQL execution, DML/DDL with savepoint isolation; Module 11 uses text-match for dbt/Jinja |
| **Quiz Questions** | 76 | 6 per module (Modules 1–11) + 10 HERO questions, multiple-choice, 20s timer |
| **Flashcards** | 68 | Swipeable cards with 3-life system; Expert ⚡ and Hero ☠ modes; DIALECT tab |
| **Achievements** | 23 | First Query → SQL Master (all 122) · Hero Champion · dbt Operator · Century · PUNK GOD |
| **Levels** | 20 | Progressive XP curve |
| **Modules** | 11 | SELECT → DDL → dbt, sequential unlocking |

### Learning Path

```
Module 1:  first_query     SELECT, FROM, DISTINCT, LIMIT, COUNT
Module 2:  filtering       WHERE, AND/OR, IN, LIKE, BETWEEN
Module 3:  sorting         ORDER BY, ASC/DESC, multi-column, LIMIT
Module 4:  aggregations    COUNT, SUM, AVG, MIN/MAX, GROUP BY, HAVING
Module 5:  joins           INNER JOIN, LEFT JOIN, multi-table, ON
Module 6:  subqueries      Scalar, NOT IN, EXISTS, correlated
Module 7:  window_fn       ROW_NUMBER, RANK, DENSE_RANK, LAG/LEAD, PARTITION BY
Module 8:  ctes            WITH, chained CTEs, CASE WHEN, recursive patterns
Module 9:  dml             INSERT, UPDATE, DELETE, NULL handling, duplicates,
                           data cleaning (raw_sales + employee_salaries tables)
Module 10: ddl             CREATE TABLE/VIEW/INDEX, ALTER TABLE, DROP,
                           SAVEPOINTs for atomic schema changes
Module 11: dbt             ref(), source(), config(), Jinja ({% if is_incremental() %},
                           {{ this }}), YAML tests (not_null, unique,
                           accepted_values), incremental models
```

Module 11 challenges are **text-match** (not SQL execution) — you type dbt Jinja/YAML snippets and they are validated by pattern against the expected expression.

---

## Database Schema

All queries run against these seven tables, seeded once when the page loads.

### Core tables (e-commerce dataset)

| Table | Columns | Rows |
|-------|---------|------|
| `customers` | `id`, `name`, `email`, `city`, `country`, `signup_date` | 10 |
| `products` | `id`, `name`, `category`, `price`, `stock` | 10 |
| `orders` | `id`, `customer_id`, `order_date`, `total_amount`, `status` | 16 |
| `order_items` | `id`, `order_id`, `product_id`, `quantity`, `unit_price` | 24 |
| `reviews` | `id`, `product_id`, `customer_id`, `rating`, `review_date` | 12 |

### Data-cleaning tables (Modules 9–10)

Two tables with intentionally dirty data for hands-on cleaning practice.

| Table | Columns | Intentional flaws |
|-------|---------|-------------------|
| `raw_sales` | `id`, `product_id`, `quantity`, `unit_price`, `discount`, `sale_date`, `customer_name` | Negative quantities, NULL prices, impossible discounts (>1.0), zero quantities, duplicate records, NULL customer names |
| `employee_salaries` | `id`, `name`, `department`, `salary`, `hire_date` | Negative salaries, NULL names, NULL departments, zero-salary entries |

Challenges cover: exploring dirty data with SELECT, finding duplicates with GROUP BY + HAVING, fixing negatives with UPDATE, filling NULLs with AVG, archiving with INSERT INTO...SELECT, atomic multi-step cleanup with SAVEPOINT, and creating clean snapshots with CREATE TABLE AS SELECT.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------| 
| Framework | [Next.js 16](https://nextjs.org/) | SSR, routing, deployment |
| UI | [React 19](https://react.dev/) | Component framework |
| State | [Zustand](https://zustand-demo.pmnd.rs/) | Client-side game state & query history |
| SQL Engine | [sql.js](https://github.com/sql-js/sql.js) | SQLite compiled to WASM, runs in-browser |
| Auth & Sync | [Supabase](https://supabase.com/) | Optional sign-in + cloud progress sync |
| Sound | [Tone.js](https://tonejs.github.io/) | Synthesized sound effects |
| Font | [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) | Monospace terminal aesthetic |
| Storage | Browser `localStorage` | Progress persistence without an account |
| Deploy | [Vercel](https://vercel.com/) | Edge CDN, auto-deploy from GitHub |

**The SQL engine runs entirely in-browser.** No backend is required to play. Auth and cloud sync are optional features powered by Supabase.

---

## Run Locally

```bash
# Clone
git clone https://github.com/eduardocornelsen/punksql.git
cd punksql

# Install
npm install

# Run
npm run dev

# Open http://localhost:3000
```

Requires [Node.js 18+](https://nodejs.org/).

Other available commands:

```bash
npm run build   # Production build
npm start       # Start production server (after build)
npm run lint    # Run ESLint
```

### Environment variables

The app works without any env vars — all SQL execution runs in-browser. To enable sign-in and cloud progress sync, create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These values come from your [Supabase project settings](https://supabase.com/dashboard). Without them, the app falls back to `localStorage`-only persistence.

---

## Deploy Your Own

### Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eduardocornelsen/punksql)

Or manually:

```bash
npx vercel
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your Vercel project's environment variables if you want auth and cloud sync.

### Self-hosted (Node.js)

PunkSQL uses Next.js API routes for auth and progress sync, so it requires a Node.js runtime — it is not a purely static site.

```bash
npm run build
npm start          # Starts the Node.js server on port 3000
```

---

## Project Structure

```
punksql/
├── src/
│   ├── app/
│   │   ├── page.js              # Main page (dynamic import, no SSR)
│   │   ├── layout.js            # Root layout, SEO metadata, PWA head
│   │   └── api/
│   │       ├── auth/callback/   # Supabase OAuth callback
│   │       ├── progress/        # Cloud progress sync (GET / PUT)
│   │       └── analytics/       # Attempt logging
│   ├── components/
│   │   ├── PunkSQL.jsx          # Core app (~4700 lines): challenges, quiz, cards, profile
│   │   ├── sandbox/
│   │   │   └── SandboxScreen.jsx  # FREE_EXPLORE IDE (SHELL/EDITOR/VAULT/DAG tabs, ~1900 lines)
│   │   └── AuthProvider.jsx     # Supabase auth context
│   ├── hooks/
│   │   └── useProgress.js       # localStorage ↔ Supabase sync logic
│   ├── stores/
│   │   ├── useGameStore.js      # Zustand store (game state, query history)
│   │   └── useSandboxStore.js   # Sandbox state (open files, REPL history, DAG layout)
│   └── lib/
│       ├── sqlEngine.js         # sql.js wrapper: execSQL, IndexedDB persistence, schema helpers
│       └── supabase/            # Supabase client (browser + server)
├── public/
│   ├── manifest.json            # PWA manifest (installable as mobile app)
│   └── favicon.svg              # Cyberpunk icon
├── package.json
├── next.config.js
└── README.md
```

`PunkSQL.jsx` contains challenges, quiz, flashcards, profile, and home screen. The sandbox lives in `SandboxScreen.jsx` and shares the same SQLite WASM engine via `sqlEngine.js`.

---

## Design System

**Cyberpunk CLI** — inspired by terminal aesthetics with neon accents.

| Token | Hex | Usage |
|-------|-----|-------|
| `void` | `#020410` | Background |
| `cyan` | `#00F0FF` | Primary accent, links, active states |
| `green` | `#00FF88` | Success, solved, correct |
| `amber` | `#FFB800` | Warnings, streaks, XP |
| `red` | `#FF3050` | Errors, lives, wrong answers |
| `purple` | `#D0A0FF` | Table names |

Effects: CRT scanlines, vignette overlay, pulse glow, cursor blink, flip card animation, fade-slide transitions.

---

## Competitive Landscape

PunkSQL sits in a crowded space alongside DataLemur, HackerRank, LeetCode, and StrataScratch. Here's how it compares and where it's headed.

### Where PunkSQL already wins

| Feature | PunkSQL | DataLemur | HackerRank | LeetCode | StrataScratch |
|---|---|---|---|---|---|
| Mobile-first | ✅ | ❌ | ❌ | ❌ | ❌ |
| No signup required | ✅ | ❌ | ❌ | ❌ | ❌ |
| Runs fully offline (WASM) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gamification (XP / levels / achievements) | ✅ | partial | partial | partial | ❌ |
| DML + DDL challenges | ✅ | ❌ | ❌ | ❌ | ❌ |
| dbt / Jinja / YAML challenges | ✅ | ❌ | ❌ | ❌ | ❌ |
| Free SQL sandbox (IDE-like) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Flashcards + Expert / Hero modes | ✅ | ❌ | ❌ | ❌ | ❌ |
| PWA installable | ✅ | ❌ | ❌ | ❌ | ❌ |

The **mobile-first + offline + no-signup** combination is a genuine moat — no other SQL learning platform does all three.

### Where competitors win (improvement gaps)

**Real interview question tagging** — DataLemur and StrataScratch brand challenges as "asked at Meta / Airbnb / Stripe". This creates perceived value and urgency. PunkSQL challenges carry company archetype tags (e-commerce / fintech / analytics / social media) but not company-specific branding.

**Account-based persistence + shareable profile** — Progress currently lives in `localStorage`. Users can't show their SQL rank to an employer, and progress is lost on a browser clear. HackerRank certificates are a primary reason people use the platform.

**Per-skill analytics** — StrataScratch shows a radar chart of SQL competency (JOINs, window functions, aggregations). PunkSQL now ships a skills radar on the profile screen; StrataScratch's advantage is that radar data is backed by real interview benchmark data.

**Community solutions** — LeetCode's comment sections are where users learn the most — alternative approaches, gotchas, debate. PunkSQL has no community layer.

**SQL dialect coverage** — HackerRank and StrataScratch support PostgreSQL, MySQL, and MS SQL. PunkSQL is SQLite-only; window function and date syntax differs in production databases.

---

## Roadmap

### Shipped

- [x] 122 SQL challenges with real execution (DML + DDL + dbt text-match)
- [x] Gamification (levels, 23 achievements, XP multipliers, EXP timer)
- [x] Mobile-first editor with swipe cursor
- [x] EN/PT-BR bilingual
- [x] Sound effects
- [x] Persistent storage (localStorage)
- [x] PWA-ready
- [x] DML data cleaning module (DELETE, UPDATE, INSERT INTO SELECT, SAVEPOINT)
- [x] DDL schema module (CREATE TABLE/VIEW/INDEX, ALTER TABLE, DROP, SAVEPOINT)
- [x] **Module 11: dbt** — ref(), source(), config(), Jinja blocks, YAML tests, incremental models
- [x] Supabase auth wiring + cloud progress sync
- [x] Solution explanations — annotated query + plain-English breakdown shown after solve
- [x] 3-level hints — clause hint → skeleton query → fill-in-the-blank, each with a small XP cost
- [x] Company archetype tags — challenges labelled as e-commerce / fintech / analytics / social media interview-style
- [x] Editor refactor — linter upgrades, keyboard remapping (*, `,`, `(`, `)` keys), smart indentation, hamburger fix ([#5](https://github.com/eduardocornelsen/punksql/issues/5))
- [x] **Skills radar** — per-module accuracy chart on profile screen
- [x] **FREE_EXPLORE sandbox** — full IDE: SHELL terminal, EDITOR, VAULT file browser, DAG lineage graph
- [x] **Flashcard Expert ⚡ and Hero ☠ modes** — timed, lives-limited runs; Hero requires 10 correct in a row
- [x] **DIALECT flashcard tab** — 12 cards comparing PostgreSQL / MySQL / SQLite / SQL Server syntax
- [x] **Flashcard scoring multiplier** — streak-based XP bonus (×1.25 / ×1.50 / ×2.00)
- [x] **Quiz improvements** — 20s timer, timeout retry queue, state persistence, PREV navigation

### Prioritized backlog

| Priority | Feature | Effort | Impact | Why it matters |
|---|---|---|---|---|
| 1 | **Shareable profile card** — generate a linkable SQL rank card from the existing auth | Low | High | Lets users prove skills; shareable cards drive organic growth |
| 2 | **Firebase auth migration** — replace Supabase with Firebase; fixes localhost OAuth redirect loop and `file://` origin conflict for Android ([#4](https://github.com/eduardocornelsen/punksql/issues/4)) | Medium | High | Unblocks native Android build; removes SSR auth complexity |
| 3 | **Game mode separation** — split into `SYSTEM_STORY` (linear campaign with narrative hooks) and `BOUNTY_BOARD` (daily rotating challenge with streak tracker) ([#2](https://github.com/eduardocornelsen/punksql/issues/2)) | Medium | High | Gives learners two distinct goals; bounty board drives daily retention |
| 4 | **Native Android app via Capacitor** — wrap Next.js static export as a signed `.aab` for Google Play Store submission ([#3](https://github.com/eduardocornelsen/punksql/issues/3)) | High | High | Reaches users who won't open a browser app; depends on Firebase migration |
| 5 | **SQL Odyssey rebrand + Story Mode** — full rebrand to minimalist terminal aesthetic; 3-campaign text-driven story mode (AI awakening, corporate forensics, deep-space recovery) ([#6](https://github.com/eduardocornelsen/punksql/issues/6)) | Very High | Very High | Major product evolution; replaces cyberpunk theme with a scalable narrative engine |
| 6 | **PGlite migration** — swap sql.js for PGlite (PostgreSQL compiled to WASM) | High | Medium | Real-world dialect accuracy; PostgreSQL is the dominant production DB |
| 7 | **Community solutions feed** — 2–3 curated alternative solutions per challenge | High | High | Addresses the #1 reason people stay on LeetCode |
| 8 | **Premium tier** — gate shareable certificate and advanced analytics | High | High | Sustainability; mirrors DataLemur/StrataScratch monetization model |

### Also planned

- [ ] Streak system with daily reset
- [ ] Challenge validation flexibility (column-order agnostic)
- [ ] Interview prep mode (timed, no hints)
- [ ] Python track (Pyodide WASM)

---

## Contributing

Contributions are welcome. To get started:

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and run `npm run lint` to check for issues
3. Open a pull request with a clear description of what you changed and why

Areas that need help:

- **More SQL challenges** — especially EXPERT-level real-world scenarios
- **Quiz questions** — cover edge cases and SQL gotchas
- **Flashcard content** — advanced topics like indexing, query optimization
- **Accessibility** — screen reader support, keyboard navigation
- **Testing** — automated tests for SQL validation logic
- **Translations** — add more languages beyond EN/PT-BR

---

## Acknowledgments

- SQL data model inspired by the [Olist Brazilian E-Commerce dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)
- Gamification patterns from [Duolingo](https://duolingo.com)
- Challenge format from [LeetCode](https://leetcode.com) and [DataLemur](https://datalemur.com)
- SQL engine: [sql.js](https://github.com/sql-js/sql.js) by the sql.js contributors

---

## License

MIT — use it however you want.

---

<div align="center">

**Built with >_ and ◈ by [Eduardo Cornelsen](https://github.com/eduardocornelsen)**

*Learn SQL. Level up. Ship queries.*

</div>
