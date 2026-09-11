# SpaceCorps // GrowthHack 🚀

> Autonomous Growth Cockpit for **Ivy-Tendril** powered by local **Antigravity (`agy`)** agents, built with **Rust (`axum`)** and **Vite+ (`vp`)**.

`SpaceCorps/GrowthHack` is an engineering-grade growth hacking platform designed to scale [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) from ~175 to 100,000 GitHub stars through real developer adoption, automated 10x technical publishing, multi-directory submission blitzes, and real-time trend hijacking.

---

## Architecture Overview

```
SpaceCorps/GrowthHack/
├── backend/                    # High-performance Rust Backend (Axum + Tokio)
│   ├── src/
│   │   ├── main.rs             # Axum server entry point (Port 4200)
│   │   ├── config.rs           # Autodetects local agy.exe & environment
│   │   ├── db/mod.rs           # Data persistence (Issues, Articles, Trends, Listings)
│   │   ├── agent/              # Local Antigravity CLI runner & SSE stream broadcaster
│   │   └── api/                # REST API endpoints
│   └── Cargo.toml
├── frontend/                   # Modern Cockpit Frontend (Vite+ / vp, React 19, Tailwind)
│   ├── src/
│   │   ├── views/              # IssuesHub, ArticleEngine, TrendRadar, ListingBlitz, AgentConsole
│   │   ├── components/         # Navigation, LiveTerminal, ArticleModal
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

---

## The 10 Direct-Action Growth Issues

1. **[ISSUE-01] Daily 10x Feature Article Engine (10 articles/day)**: Rotates through core Tendril capabilities (Worktrees, Multi-Agent, Issue-to-PR, Verification Gates, Voice, Tunneling) across 6 content archetypes with mandatory 3+ external authority citations and Tendril backlinks.
2. **[ISSUE-02] Ecosystem Listing & Awesome-Repo Blitz (50+ targets)**: Automated submission tracking and PR blurb generator for `awesome-ai-agents`, `awesome-devtools`, `AlternativeTo`, `OpenAlternative`, `DevHunt`, and software factory catalogs.
3. **[ISSUE-03] VS Code & Cursor Companion Extension**: Bridges developers directly from their active editor into Tendril background agent worktrees.
4. **[ISSUE-04] Package Manager & One-Line Install Blitz**: Homebrew, winget, scoop, and `npx @ivy-interactive/tendril` for <60s onboarding.
5. **[ISSUE-05] "Built with Tendril" Pull Request Badge Flywheel**: GitHub Action and PR templates embedding verification badges and viral backlinks on every PR generated. Includes fork-safe error handling for open-source repositories where `GITHUB_TOKEN` is read-only on fork pull requests, supporting both single-workflow graceful fallback (suppressing 403 errors with actionable warning notices) and a companion `workflow_run` pattern (`tendril-comment.yml`) that securely posts verification comments on external fork PRs with write permissions. Features automated companion workflow validation and dry-run simulation in CI (`tendril-verify.yml`) along with on-demand manual testing via `workflow_dispatch`.
6. **[ISSUE-06] Real-Time Social Radar & Technical Discussion Monitor**: Scans Hacker News, Reddit (`r/LocalLLaMA`, `r/programming`), and X for agent complaints and auto-drafts helpful technical solutions.
7. **[ISSUE-07] Public Daily "State of Coding Agents" Benchmark Matrix**: Automated daily benchmarks of Claude Code vs Codex vs Gemini vs OpenCode in Tendril worktrees (the #1 backlink magnet for tech newsletters).
8. **[ISSUE-08] Ready-to-Run Workflow Pack & Recipe Hub**: 1-click community recipes (`bugfixer`, `dependency-upgrader`, `test-generator`).
9. **[ISSUE-09] Daily Tech Radar & Trend Synthesizer (GitHub, Reddit, LinkedIn Trending → Website Posts)**: Autonomous scout that finds hot developer trends and synthesizes them into high-authority website posts with customizable Tendril tie-ins (Direct, Subtle, or Pure Tech Commentary).
10. **[ISSUE-10] Feature Video Demos & LinkedIn/Social Blitz (SpaceCorps/web-demo-generator)**: Generates 15-45 second animated UI video demos using `SpaceCorps/web-demo-generator` (Playwright headless browser + Claude + H.264 video recorder), paired with high-converting LinkedIn post scripts and video storyboards.

---

## Getting Started

### Prerequisites
- **Rust & Cargo** (1.95+)
- **Node.js** (v24+) & **Vite+** (`vp` CLI)
- **Antigravity CLI** (`agy`) installed at `C:\Users\<user>\AppData\Local\agy\bin\agy.exe` (or in `PATH`)

### Running the App

#### 1. Start the Rust Backend
```bash
cd backend
cargo run
```
Backend will start on `http://127.0.0.1:4200` with real-time SSE streaming.

#### 2. Start the Vite+ Frontend
```bash
cd frontend
vp dev
```
Open `http://localhost:5173` to access the interactive Cockpit.

Or run production mode where the Rust backend serves the compiled frontend assets directly from `frontend/dist`.

---

## License
SpaceCorps / Ivy-Interactive Internal.
