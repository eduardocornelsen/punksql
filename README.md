# QueryQuest — Learn SQL Like a Game

> 80 SQL challenges · 8 modules · Real in-browser execution · Cyberpunk CLI aesthetic

## Quick Deploy

### Option A: Vercel (recommended, 2 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Test locally
npm run dev
# Open http://localhost:3000

# 3. Deploy to Vercel
npx vercel
# Follow prompts, done!
```

### Option B: GitHub Pages (free, 5 minutes)

```bash
# 1. Create repo on GitHub: github.com/YOUR_USER/queryquest

# 2. Push code
git init
git add .
git commit -m "QueryQuest v1.0"
git remote add origin https://github.com/YOUR_USER/queryquest.git
git push -u origin main

# 3. On GitHub: Settings > Pages > Source: GitHub Actions
# Or connect to Vercel for auto-deploy on push
```

### Option C: Any static host

```bash
npm install
npm run build
# Upload the .next/out folder (after adding `output: 'export'` to next.config.js)
```

## Features

- **80 SQL Challenges** across 8 modules (SELECT → CTEs)
- **Real SQL Execution** — sql.js (SQLite WASM) runs in-browser
- **Mobile-First Editor** — swipe cursor, keyword buttons, focus mode
- **Gamification** — 20 levels, 10 achievements, XP system
- **Sound Effects** — Tone.js synth for correct/wrong/levelup
- **Bilingual** — English + Portuguese (PT-BR)
- **PWA Ready** — installable as mobile app
- **Persistent Storage** — progress saved across sessions
- **$0/month** — no backend needed, everything runs client-side

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 |
| UI | React 18, CSS-in-JS |
| SQL Engine | sql.js (SQLite compiled to WASM) |
| Sound | Tone.js |
| Font | Share Tech Mono (Google Fonts) |
| Storage | Browser localStorage / window.storage API |
| Deploy | Vercel / Any static host |

## Content

| Type | Count |
|------|-------|
| SQL Challenges | 80 |
| Quiz Questions | 48 |
| Flashcards | 34 |
| Achievements | 10 |
| Levels | 20 |
| Modules | 8 |

## License

MIT
