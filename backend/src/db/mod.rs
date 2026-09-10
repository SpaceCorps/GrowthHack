use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GrowthIssue {
    pub id: String,
    pub number: u32,
    pub title: String,
    pub category: String,
    pub status: String, // "Todo", "In Progress", "Active Routine", "Done"
    pub priority: String, // "Critical", "High", "Medium"
    pub description: String,
    pub direct_actions: Vec<String>,
    pub routine_schedule: Option<String>,
    pub run_count: u32,
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Article {
    pub id: String,
    pub title: String,
    pub feature: String, // "Worktrees", "Multi-Agent Orchestration", "Issue-to-PR", "Verification Gates", "Voice Control", "Tunneling", "Review & Diffs"
    pub channel: String, // "Website", "Dev.to", "Hashnode", "Medium", "Substack", "XThread", "Reddit"
    pub angle: String, // "Benchmark", "Architecture", "Comparison", "Tutorial", "Postmortem", "Ecosystem"
    pub summary: String,
    pub content: String,
    pub backlinks: Vec<String>,
    pub outbound_citations: Vec<String>,
    pub status: String, // "Draft", "Review", "Published"
    pub created_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TrendTopic {
    pub id: String,
    pub source: String, // "GitHub", "Reddit", "LinkedIn"
    pub topic: String,
    pub url: String,
    pub engagement: String, // e.g. "2.4k stars today", "480 comments on r/LocalLLaMA"
    pub summary: String,
    pub tendril_tie_in: String, // "direct", "subtle", "none"
    pub status: String, // "Scouted", "Synthesizing", "Published"
    pub generated_article_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Listing {
    pub id: String,
    pub name: String,
    pub category: String, // "Awesome Repo", "Dev Directory", "Software Factory", "Package Manager", "Community"
    pub url: String,
    pub status: String, // "Targeted", "PR Submitted", "Under Review", "Merged", "Live"
    pub pr_url: Option<String>,
    pub submission_blurb: String,
    pub notes: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: String,
    pub task_type: String, // "Article", "TrendScout", "ListingPR", "IssueRun", "Custom"
    pub target_id: Option<String>,
    pub prompt: String,
    pub status: String, // "Running", "Completed", "Failed"
    pub logs: Vec<String>,
    pub result: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GrowthState {
    pub issues: Vec<GrowthIssue>,
    pub articles: Vec<Article>,
    pub trends: Vec<TrendTopic>,
    pub listings: Vec<Listing>,
    pub tasks: Vec<AgentTask>,
}

pub type SharedState = Arc<RwLock<GrowthState>>;

impl GrowthState {
    pub fn load_or_init(path: &Path) -> Self {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(state) = serde_json::from_str::<GrowthState>(&content) {
                    tracing::info!("Loaded growth database from {}", path.display());
                    return state;
                }
            }
        }

        tracing::info!("Initializing default growth database...");
        let state = Self::seed_default();
        let _ = state.save(path);
        state
    }

    pub fn save(&self, path: &Path) -> Result<(), std::io::Error> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write(path, content)?;
        Ok(())
    }

    pub fn seed_default() -> Self {
        let now = Utc::now();

        let issues = vec![
            GrowthIssue {
                id: "issue-1".to_string(),
                number: 1,
                title: "Daily 10x Feature Article Engine (10 Articles/Day Routine)".to_string(),
                category: "Content Engine".to_string(),
                status: "Active Routine".to_string(),
                priority: "Critical".to_string(),
                description: "Automated high-velocity generation of 10 differentiated technical articles per day across Ivy-Tendril core features. Includes outbound authority citations (Git official docs, Anthropic, SWE-bench) and backlinks to Tendril docs and GitHub.".to_string(),
                direct_actions: vec![
                    "Rotate through Tendril core features (Worktrees, Multi-Agent, Issue-to-PR, Verification, Voice, Tunneling)".to_string(),
                    "Format across 10 distinct content archetypes (Benchmarks, Deep Architecture, Cline/OpenHands Comparisons, Postmortems, Tutorials)".to_string(),
                    "Insert minimum 3 high-authority outbound citations and 2 Tendril GitHub/docs backlinks per post".to_string(),
                    "Export clean Markdown formatted with YAML frontmatter ready for Dev.to, Hashnode, Medium, and Substack".to_string(),
                ],
                routine_schedule: Some("Daily at 08:00 UTC (10 posts/batch)".to_string()),
                run_count: 3,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-2".to_string(),
                number: 2,
                title: "Ecosystem Listing & Awesome-Repo Blitz (50+ Targets)".to_string(),
                category: "Distribution".to_string(),
                status: "In Progress".to_string(),
                priority: "High".to_string(),
                description: "Systematic submission campaign across curated Awesome GitHub repositories, devtool directories, and software factory catalogs to secure permanent developer discovery and high-domain backlinks.".to_string(),
                direct_actions: vec![
                    "Auto-generate custom PR descriptions and markdown table entries for each target repo".to_string(),
                    "Submit to awesome-ai-agents, awesome-devtools, awesome-generative-ai, and software factory registries".to_string(),
                    "Submit listings to AlternativeTo (Cursor/Cline alternative), OpenAlternative, DevHunt, and LibHunt".to_string(),
                    "Track reviewer feedback, merge confirmations, and live status".to_string(),
                ],
                routine_schedule: Some("Twice weekly (5 submissions/batch)".to_string()),
                run_count: 5,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-3".to_string(),
                number: 3,
                title: "VS Code & Cursor Companion Extension".to_string(),
                category: "Product & IDE".to_string(),
                status: "Todo".to_string(),
                priority: "High".to_string(),
                description: "Build a lightweight companion extension bridging the developer's existing IDE (VS Code / Cursor) directly into Tendril's background agent worktrees, diff reviews, and issue-to-PR runner.".to_string(),
                direct_actions: vec![
                    "Create TypeScript extension scaffold hooking into local Tendril daemon RPC/HTTP".to_string(),
                    "Add status bar indicator showing active agent worktrees and verification test results".to_string(),
                    "Implement command palette action: 'Tendril: Send Active File / Issue to Agent Worktree'".to_string(),
                    "Publish to Visual Studio Marketplace and Open VSX Registry for massive organic discovery".to_string(),
                ],
                routine_schedule: None,
                run_count: 0,
                last_run_at: None,
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-4".to_string(),
                number: 4,
                title: "Package Manager & One-Line Install Blitz (brew, winget, scoop, npx)".to_string(),
                category: "Developer Experience".to_string(),
                status: "In Progress".to_string(),
                priority: "High".to_string(),
                description: "Radically eliminate onboarding friction by publishing Tendril to all native package managers, achieving <60 second time-to-first-run across macOS, Linux, and Windows.".to_string(),
                direct_actions: vec![
                    "Submit Homebrew formula to ivy-interactive/tap and homebrew-core".to_string(),
                    "Submit Windows Package Manager manifest to microsoft/winget-pkgs".to_string(),
                    "Submit Scoop manifest to ScoopInstaller/Extras".to_string(),
                    "Publish npx @ivy-interactive/tendril zero-install launcher".to_string(),
                ],
                routine_schedule: None,
                run_count: 1,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-5".to_string(),
                number: 5,
                title: "'Built with Tendril' PR Flywheel & GitHub Action".to_string(),
                category: "Viral Loops".to_string(),
                status: "In Progress".to_string(),
                priority: "High".to_string(),
                description: "Turn every pull request created or verified by Tendril into a viral distribution channel by adding an elegant verification badge and workflow attribution back to Tendril.".to_string(),
                direct_actions: vec![
                    "Create standard GitHub Action action.yml for automated verification in CI".to_string(),
                    "Design clean, respectful PR description footer badge: '⚡ Orchestrated with Ivy-Tendril (3 agents in isolated worktrees)'".to_string(),
                    "Include benchmark summary (tests passed, tokens saved, worktree diff link) in PR comments".to_string(),
                ],
                routine_schedule: None,
                run_count: 2,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-6".to_string(),
                number: 6,
                title: "Real-Time Social Radar & Technical Discussion Monitor".to_string(),
                category: "Community & Social".to_string(),
                status: "Active Routine".to_string(),
                priority: "Medium".to_string(),
                description: "Monitor Hacker News, Reddit (r/programming, r/LocalLLaMA, r/ClaudeAI), and X for developer complaints about agent conflicts, worktree isolation, or code review bottlenecks, auto-drafting helpful technical solutions.".to_string(),
                direct_actions: vec![
                    "Track keywords: 'Claude Code worktree', 'OpenHands vs', 'coding agent sandbox', 'agent git merge conflict'".to_string(),
                    "Synthesize grounded, educational answers demonstrating the worktree isolation pattern".to_string(),
                    "Draft conversational replies with code snippets and non-spam link to Tendril architecture docs".to_string(),
                ],
                routine_schedule: Some("Every 4 hours".to_string()),
                run_count: 8,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-7".to_string(),
                number: 7,
                title: "Public Daily 'State of Coding Agents' Benchmark Matrix".to_string(),
                category: "Data & Authority".to_string(),
                status: "Todo".to_string(),
                priority: "High".to_string(),
                description: "Publish a daily automated benchmark running standard SWE-bench / synthetic tasks across Claude Code, Codex, Gemini, and OpenCode inside Tendril, measuring cost, pass rate, and rework.".to_string(),
                direct_actions: vec![
                    "Set up automated runner executing 20 standard tasks daily across supported CLI agents".to_string(),
                    "Publish auto-generated charts comparing Token Cost, First-Pass PR Success, and Execution Time".to_string(),
                    "Syndicate benchmark findings to Hacker News Show HN and Substack technical newsletters".to_string(),
                ],
                routine_schedule: Some("Weekly on Monday".to_string()),
                run_count: 0,
                last_run_at: None,
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-8".to_string(),
                number: 8,
                title: "Ready-to-Run Workflow Pack & Recipe Hub".to_string(),
                category: "Product & Ecosystem".to_string(),
                status: "In Progress".to_string(),
                priority: "Medium".to_string(),
                description: "Create a curated public repository of 1-click community recipes and promptware (bugfixer, dependency-upgrader, test-generator, database-migrator) to drive fork-and-star loops.".to_string(),
                direct_actions: vec![
                    "Build initial 5 gold-standard recipes: Bugfixer, Security Patcher, Test Generator, PR Reviewer, DB Migrator".to_string(),
                    "Provide 1-line execution: 'tendril run recipe/security-patch'".to_string(),
                    "Encourage community PR submissions with a GitHub contributor badge program".to_string(),
                ],
                routine_schedule: None,
                run_count: 1,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-9".to_string(),
                number: 9,
                title: "Daily Tech Radar & Trend Synthesizer (GitHub, Reddit, LinkedIn Trending → Website Posts)".to_string(),
                category: "Trend Newsroom".to_string(),
                status: "Active Routine".to_string(),
                priority: "Critical".to_string(),
                description: "Daily autonomous trend scout scanning GitHub Trending, Reddit (r/LocalLLaMA, r/programming), and LinkedIn tech posts, synthesizing hot narratives into high-authority website posts with customizable Tendril tie-in.".to_string(),
                direct_actions: vec![
                    "Daily scout fetching trending GitHub devtool repos, top Reddit AI threads, and LinkedIn AI engineering discussions".to_string(),
                    "Draft comprehensive analysis articles with adjustable Tendril tie-in (Direct, Subtle, or Pure Tech Commentary)".to_string(),
                    "Generate ready-to-publish website Markdown with full frontmatter, SEO metadata, and outbound citations".to_string(),
                    "Auto-generate accompanying LinkedIn and Reddit commentary snippets for social amplification".to_string(),
                ],
                routine_schedule: Some("Daily at 07:00 UTC".to_string()),
                run_count: 4,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
            GrowthIssue {
                id: "issue-10".to_string(),
                number: 10,
                title: "Feature Demo Videos & LinkedIn/Social Blitz (SpaceCorps/web-demo-generator)".to_string(),
                category: "Video & Social".to_string(),
                status: "Active Routine".to_string(),
                priority: "Critical".to_string(),
                description: "Produce short, high-impact 15-45 second animated video demos for every Tendril feature using SpaceCorps/web-demo-generator (Playwright + Claude + H.264) paired with viral LinkedIn posts.".to_string(),
                direct_actions: vec![
                    "Hook into SpaceCorps/web-demo-generator (Playwright headless browser + H.264 video recorder) to generate animated UI demo videos".to_string(),
                    "Batch-produce video demos for all core Tendril features (Worktree isolation, Multi-Agent concurrency, Issue-to-PR loop, Voice coding, Tunneling, Diff review)".to_string(),
                    "Draft hook-first LinkedIn posts focusing on real developer pain points (merge conflicts, agent drift, broken main)".to_string(),
                    "Include GitHub repo call-to-action (https://github.com/Ivy-Interactive/Ivy-Tendril) and clear download instructions in every video post".to_string(),
                    "Syndicate demo clips to Twitter/X video threads, YouTube Shorts, and Reddit r/programming".to_string(),
                ],
                routine_schedule: Some("3x weekly (Tue, Thu, Sun)".to_string()),
                run_count: 2,
                last_run_at: Some(now),
                created_at: now,
                updated_at: now,
            },
        ];

        let articles = vec![
            Article {
                id: "art-1".to_string(),
                title: "How Git Worktrees Solve Agent Hallucination and Workspace Collisions in Multi-Agent Coding".to_string(),
                feature: "Worktrees".to_string(),
                channel: "Website".to_string(),
                angle: "Architecture".to_string(),
                summary: "Deep architectural breakdown of why concurrent AI coding agents corrupt local repositories when sharing a working directory, and how Git worktrees create zero-cost, isolated sandboxes.".to_string(),
                content: r#"# How Git Worktrees Solve Agent Hallucination and Workspace Collisions in Multi-Agent Coding

When running autonomous coding agents like **Claude Code**, **Codex**, or **Gemini CLI**, developers quickly encounter a catastrophic bottleneck: **workspace collision**.

If two agents write to the same branch or edit files simultaneously, language servers fail, untracked changes collide, and agents hallucinate file states that no longer exist.

## The Problem: Shared State is Fatal for Autonomous Agents

Traditional IDE extensions operate directly within your checked-out working copy. This introduces critical failure modes:
1. **Dirty Index Corruption**: Agent A modifies `src/auth.ts` while Agent B runs tests on `src/api.ts`. The test suite fails due to incomplete intermediate edits.
2. **Git Lock Contention**: Concurrent `git status` or `git add` invocations trigger `.git/index.lock` errors.
3. **Context Drift**: The agent's internal mental model of the codebase drifts from the physical files on disk.

## The Solution: Ephemeral Git Worktrees

[Git Worktrees](https://git-scm.com/docs/git-worktree) allow checking out multiple branches simultaneously from a single local repository, each into its own independent directory.

```bash
# How Tendril spawns an isolated agent worktree
git worktree add ../tendril-agent-task-42 feature/add-jwt-auth
```

By leveraging worktrees, **Ivy-Tendril** provides:
- **True Process Isolation**: Each agent operates in its own physical directory with independent build artifacts (`node_modules`, `target/`).
- **Parallel Execution**: Run 5 agents simultaneously across 5 different GitHub issues without race conditions.
- **Automated Verification Gates**: Run unit tests and linters *inside the worktree* before generating a pull request.

Explore the complete architecture in the [Ivy-Tendril GitHub Repository](https://github.com/Ivy-Interactive/Ivy-Tendril).
"#.to_string(),
                backlinks: vec![
                    "https://github.com/Ivy-Interactive/Ivy-Tendril".to_string(),
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/blob/development/docs/architecture.md".to_string(),
                ],
                outbound_citations: vec![
                    "https://git-scm.com/docs/git-worktree".to_string(),
                    "https://www.swebench.com/".to_string(),
                    "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview".to_string(),
                ],
                status: "Published".to_string(),
                created_at: now,
                published_at: Some(now),
            },
            Article {
                id: "art-2".to_string(),
                title: "From GitHub Issue to Verified Pull Request: The 15-Minute Autonomous Loop".to_string(),
                feature: "Issue-to-PR".to_string(),
                channel: "Dev.to".to_string(),
                angle: "Tutorial".to_string(),
                summary: "Step-by-step guide showing how to connect Ivy-Tendril to your GitHub repository, assign an issue to an autonomous agent, and verify passing tests before human code review.".to_string(),
                content: r#"# From GitHub Issue to Verified Pull Request: The 15-Minute Autonomous Loop

Most "autonomous coding agent" demos stop at generating a code snippet in a chat window. But engineering teams don't need snippets—they need **verified pull requests**.

Here is the exact workflow for taking a production GitHub issue and turning it into a tested PR in 15 minutes using [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril).

## Step 1: Import the GitHub Issue
Tendril connects directly to your repository issues. Select the issue and Tendril extracts:
- Problem description & reproduction steps
- Affected modules and stack traces
- Labels and acceptance criteria

## Step 2: Planning & Worktree Provisioning
Rather than making blind edits, Tendril generates an execution plan and clones your repo into a temporary Git worktree.

## Step 3: Verification Gates (The Differentiator)
Before opening the PR, Tendril executes your test suite:
```bash
cargo test --workspace
```
If a test fails, the agent self-corrects within the worktree. Only when tests pass is the PR opened.

Check out [Ivy-Tendril on GitHub](https://github.com/Ivy-Interactive/Ivy-Tendril) to run this workflow locally.
"#.to_string(),
                backlinks: vec![
                    "https://github.com/Ivy-Interactive/Ivy-Tendril".to_string(),
                ],
                outbound_citations: vec![
                    "https://docs.github.com/en/issues".to_string(),
                    "https://docs.anthropic.com/".to_string(),
                ],
                status: "Published".to_string(),
                created_at: now,
                published_at: Some(now),
            },
        ];

        let trends = vec![
            TrendTopic {
                id: "trend-1".to_string(),
                source: "GitHub".to_string(),
                topic: "OpenCode surpasses 200k stars as CLI-first agent adoption surges".to_string(),
                url: "https://github.com/trending".to_string(),
                engagement: "Trending #1 worldwide, 3.2k stars today".to_string(),
                summary: "Developers are migrating from heavy IDE chat plugins to lightweight terminal CLI agents. However, multi-repository orchestration and merge conflicts remain unsolved at the CLI layer.".to_string(),
                tendril_tie_in: "direct".to_string(),
                status: "Scouted".to_string(),
                generated_article_id: None,
                created_at: now,
            },
            TrendTopic {
                id: "trend-2".to_string(),
                source: "Reddit".to_string(),
                topic: "r/LocalLLaMA debate: 'Why agentic coding frameworks fail on large monorepos'".to_string(),
                url: "https://reddit.com/r/LocalLLaMA/hot".to_string(),
                engagement: "612 upvotes, 284 comments".to_string(),
                summary: "Engineering leads discuss why autonomous agents hallucinate in large repositories (>500k LOC). Key consensus: lack of isolated worktrees and missing verification test gates before git commits.".to_string(),
                tendril_tie_in: "direct".to_string(),
                status: "Scouted".to_string(),
                generated_article_id: None,
                created_at: now,
            },
            TrendTopic {
                id: "trend-3".to_string(),
                source: "LinkedIn".to_string(),
                topic: "The shift from 'AI Chatbots' to 'Software Factories' in enterprise engineering".to_string(),
                url: "https://www.linkedin.com/feed".to_string(),
                engagement: "1,450 reactions, 180 reposts".to_string(),
                summary: "Analysis of how Fortune 500 teams are moving beyond Copilot autocomplete towards parallel agent orchestration where multiple models work in separate worktrees simultaneously.".to_string(),
                tendril_tie_in: "subtle".to_string(),
                status: "Scouted".to_string(),
                generated_article_id: None,
                created_at: now,
            },
        ];

        let listings = vec![
            Listing {
                id: "list-1".to_string(),
                name: "awesome-ai-agents (e2b-dev)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/e2b-dev/awesome-ai-agents".to_string(),
                status: "PR Submitted".to_string(),
                pr_url: Some("https://github.com/e2b-dev/awesome-ai-agents/pull/412".to_string()),
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory that plans tasks, orchestrates agents in isolated Git worktrees, and produces verified PRs.".to_string(),
                notes: "High authority repo (18k+ stars). PR pending merge in 'Coding Agents' category.".to_string(),
                updated_at: now,
            },
            Listing {
                id: "list-2".to_string(),
                name: "awesome-devtools (frenck)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/frenck/awesome-devtools".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Run multiple coding agents (Claude Code, Gemini, Codex) safely in parallel worktrees.".to_string(),
                notes: "Targeting 'Git Utilities & Automation' section.".to_string(),
                updated_at: now,
            },
            Listing {
                id: "list-3".to_string(),
                name: "awesome-software-engineering-ai (youssefHosni)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/youssefHosni/awesome-software-engineering-ai".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent development environment with automated verification gates.".to_string(),
                notes: "Curated AI for SE list.".to_string(),
                updated_at: now,
            },
            Listing {
                id: "list-4".to_string(),
                name: "OpenAlternative".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://openalternative.co/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril is an open-source alternative to Cursor and proprietary software factories, offering Git worktree isolation and multi-agent orchestration.".to_string(),
                notes: "Submit as open-source alternative to Cursor, Devin, and CodeRabbit.".to_string(),
                updated_at: now,
            },
            Listing {
                id: "list-5".to_string(),
                name: "AlternativeTo (Cursor / Cline)".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://alternativeto.net/software/cursor/".to_string(),
                status: "Live".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril is an open-source multi-agent software factory that automates issue-to-verified PR workflows.".to_string(),
                notes: "Listed on AlternativeTo Cursor and Cline pages.".to_string(),
                updated_at: now,
            },
            Listing {
                id: "list-6".to_string(),
                name: "DevHunt".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://devhunt.org/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril: Turn GitHub issues into verified pull requests using isolated agent worktrees.".to_string(),
                notes: "Launch scheduled for Phase 1 campaign.".to_string(),
                updated_at: now,
            },
        ];

        let tasks = Vec::new();

        Self {
            issues,
            articles,
            trends,
            listings,
            tasks,
        }
    }
}
