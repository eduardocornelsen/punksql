<div align="center">

# ⟩\_ PunkSQL

### Learn SQL by solving real challenges.

**80 exercises · 8 modules · Real in-browser SQL execution · Cyberpunk CLI aesthetic**

[▶ Play Now](https://punksql.vercel.app) · [Report Bug](https://github.com/eduardocornelsen/punksql/issues) · [Request Feature](https://github.com/eduardocornelsen/punksql/issues)

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![SQLite](https://img.shields.io/badge/SQLite-WASM-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## What is PunkSQL?

PunkSQL is a **mobile-first SQL learning platform** with a cyberpunk terminal aesthetic. It's like Duolingo meets LeetCode — you write real SQL queries that execute in your browser using SQLite compiled to WebAssembly. No backend, no signup, no cost.

Built for career switchers learning SQL from scratch, and for data professionals who want to stay sharp.

<div align="center">

| Home | Editor | Learn | Profile |
|:---:|:---:|:---:|:---:|
| Boot sequence, daily challenge, quests, stats | Mobile SQL editor with swipe cursor & focus mode | 8-module skill tree with progressive unlocking | Level, XP, achievements with expand-to-see details |

</div>

---

## Features

### 🔥 SQL Engine (In-Browser)

Every query runs on a **real SQLite database** loaded via [sql.js](https://github.com/sql-js/sql.js) (WASM). Five tables with e-commerce data inspired by the [Olist Brazilian E-Commerce dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce): `customers`, `products`, `orders`, `order_items`, `reviews`. Your SQL is validated against expected output — column order, row count, values.

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
- **10 achievements** with real unlock conditions (first query, module completion, solve counts, level milestones)
- **Level-up animation** — full-screen number with bounce + glow
- **Badge unlock animation** — spinning icon with achievement name
- **Sound effects** — ascending arpeggio on correct, buzz on wrong, fanfare on level-up (Tone.js)
- **XP only on first solve** — no farming, progress is real
- **Daily challenge** — rotates based on day of year, +100 XP bonus

### 🌍 Bilingual

Full EN/PT-BR support. Every challenge description, quiz question, flashcard, UI element, and achievement has both languages. Toggle with the EN/PT switcher in the top bar.

### 💾 Persistent Progress

XP, solved challenges, and language preference are saved to browser storage and survive page refreshes. No account needed.

---

## Content

| Type | Count | Description |
|------|-------|-------------|
| **SQL Challenges** | 80 | 10 per module, EASY → EXPERT, real SQL execution |
| **Quiz Questions** | 48 | 6 per module, multiple-choice, 15s timer |
| **Flashcards** | 34 | Swipeable cards with 3-life system, per-difficulty stats |
| **Achievements** | 10 | First Query → SQL Master (solve all 80) |
| **Levels** | 20 | Progressive XP curve |
| **Modules** | 8 | SELECT → CTEs, sequential unlocking |

### Learning Path

```
Module 1: first_query     SELECT, FROM, DISTINCT, LIMIT, COUNT
Module 2: filtering       WHERE, AND/OR, IN, LIKE, BETWEEN
Module 3: sorting         ORDER BY, ASC/DESC, multi-column, LIMIT
Module 4: aggregations    COUNT, SUM, AVG, MIN/MAX, GROUP BY, HAVING
Module 5: joins           INNER JOIN, LEFT JOIN, multi-table, ON
Module 6: subqueries      Scalar, NOT IN, EXISTS, correlated
Module 7: window_fn       ROW_NUMBER, RANK, DENSE_RANK, LAG/LEAD, PARTITION BY
Module 8: ctes            WITH, chained CTEs, CASE WHEN, recursive patterns
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------| 
| Framework | [Next.js 14](https://nextjs.org/) | SSR, routing, deployment |
| UI | [React 18](https://react.dev/) | Component framework |
| SQL Engine | [sql.js](https://github.com/sql-js/sql.js) | SQLite compiled to WASM, runs in-browser |
| Sound | [Tone.js](https://tonejs.github.io/) | Synthesized sound effects |
| Font | [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) | Monospace terminal aesthetic |
| Storage | Browser Storage API | Persistent progress across sessions |
| Deploy | [Vercel](https://vercel.com/) | Edge CDN, auto-deploy from GitHub |

**No backend required.** Everything runs client-side. Total infrastructure cost: **$0/month**.

---

## Run Locally

```bash
# Clone
<<<<<<< HEAD
git clone https://github.com/eduardocornelsen/punksql.git
cd punksql
=======
git clone https://github.com/eduardocornelsen/PunkSQL.git
cd PunkSQL
>>>>>>> 4268f8e31b0b79eac270a0c3b06e1512a24be576

# Install
npm install

# Run
npm run dev

# Open
# http://localhost:3000
```

Requires [Node.js 18+](https://nodejs.org/).

---

## Deploy Your Own

### Vercel (recommended)

<<<<<<< HEAD
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eduardocornelsen/punksql)
=======
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eduardocornelsen/PunkSQL)
>>>>>>> 4268f8e31b0b79eac270a0c3b06e1512a24be576

Or manually:

```bash
npx vercel
```

### Any Static Host

```bash
npm run build
# Serve the .next directory
```

---

## Project Structure

```
<<<<<<< HEAD
punksql/
=======
PunkSQL/
>>>>>>> 4268f8e31b0b79eac270a0c3b06e1512a24be576
├── src/
│   ├── app/
│   │   ├── page.js              # Main page (dynamic import, no SSR)
│   │   └── layout.js            # Root layout, SEO metadata, PWA head
│   └── components/
<<<<<<< HEAD
│       └── PunkSQL.jsx          # Complete app (~2000 lines, single file)
=======
│       └── PunkSQL.jsx       # Complete app (~2000 lines, single file)
>>>>>>> 4268f8e31b0b79eac270a0c3b06e1512a24be576
├── public/
│   ├── manifest.json            # PWA manifest (installable as mobile app)
│   └── favicon.svg              # Cyberpunk icon
├── package.json
├── next.config.js
└── README.md
```

The entire app lives in a single `PunkSQL.jsx` file. This is intentional — it's a self-contained artifact that can run inside Claude.ai, as a Next.js page, or be ported to React Native with minimal changes.

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

## Roadmap

- [x] 80 SQL challenges with real execution
- [x] Gamification (levels, achievements, XP)
- [x] Mobile-first editor with swipe cursor
- [x] EN/PT-BR bilingual
- [x] Sound effects
- [x] Persistent storage
- [x] PWA-ready
- [ ] User auth (Supabase — Google/Magic Link)
- [ ] Server-side progress sync
- [ ] Real leaderboard
- [ ] Streak system with daily reset
- [ ] Challenge validation flexibility (column order agnostic)
- [ ] 40 more challenges (total: 120)
- [ ] Interview prep track
- [ ] Python track (Pyodide WASM)
- [ ] React Native mobile app (iOS + Android)

---

## Contributing

Contributions are welcome. Some areas that need help:

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
