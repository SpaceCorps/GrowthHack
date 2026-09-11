use crate::api::demo::{get_sample_scenarios, DemoScenario};
use crate::api::packages::ReleaseInfo;
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
    pub status: String,   // "Todo", "In Progress", "Active Routine", "Done"
    pub priority: String, // "Critical", "High", "Medium"
    pub description: String,
    pub direct_actions: Vec<String>,
    pub routine_schedule: Option<String>,
    pub run_count: u32,
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct EngagementMetrics {
    #[serde(default)]
    pub reactions: u32,
    #[serde(default)]
    pub comments: u32,
    #[serde(default)]
    pub views: u32,
    #[serde(default)]
    pub last_synced_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExportRecord {
    pub channel: String, // "ivy-web", "Dev.to", "Hashnode", "Medium", "Substack", "LinkedIn", "XThread"
    pub exported_at: DateTime<Utc>,
    pub target_path: Option<String>,
    pub status: String, // "Success", "Copied"
    #[serde(default)]
    pub external_id: Option<String>,
    #[serde(default)]
    pub engagement: Option<EngagementMetrics>,
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
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub exports: Vec<ExportRecord>,
    #[serde(default)]
    pub engagement: Option<EngagementMetrics>,
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
    pub status: String,         // "Scouted", "Synthesizing", "Published"
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
    #[serde(default)]
    pub blurb_status: Option<String>, // "Pending", "Approved", "Rejected"
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

fn default_publish_as_draft() -> bool {
    true
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SyndicationSettings {
    #[serde(default)]
    pub devto_api_key: Option<String>,
    #[serde(default)]
    pub hashnode_api_key: Option<String>,
    #[serde(default)]
    pub hashnode_publication_id: Option<String>,
    #[serde(default)]
    pub github_token: Option<String>,
    #[serde(default = "default_publish_as_draft")]
    pub publish_as_draft: bool,
}

impl Default for SyndicationSettings {
    fn default() -> Self {
        Self {
            devto_api_key: None,
            hashnode_api_key: None,
            hashnode_publication_id: None,
            github_token: None,
            publish_as_draft: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VideoDemo {
    pub id: String,
    pub feature: String,
    pub target_platform: String,
    pub duration_seconds: u32,
    pub headline: String,
    pub body: String,
    pub storyboard: String,
    pub status: String, // "Pending", "Approved", "Rejected", "Published"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackageManagerTarget {
    pub id: String,
    pub target_key: String,    // "homebrew", "winget", "scoop", "npx"
    pub name: String, // "Homebrew (tap & core)", "Windows Package Manager (winget)", "Scoop (Extras)", "npx Zero-Install"
    pub os: String,   // "macOS / Linux", "Windows", "Cross-Platform"
    pub registry_repo: String, // "ivy-interactive/homebrew-tap", "microsoft/winget-pkgs", "ScoopInstaller/Extras", "npm"
    pub package_id: String,    // "tendril", "Ivy.Tendril", "@ivy-interactive/tendril"
    pub install_command: String,
    pub status: String, // "Targeted", "PR Submitted", "Under Review", "Merged", "Live"
    pub pr_url: Option<String>,
    pub manifest_filename: String, // "tendril.rb", "Ivy.Tendril.yaml", "tendril.json", "package.json"
    pub notes: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct OnboardingMetrics {
    pub first_run_completed: bool,
    pub demo_completed_count: u32,
    pub diagnostic_runs_count: u32,
    pub time_to_first_pr_seconds: Option<f64>,
    pub github_starred: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RecipeParameter {
    pub name: String,
    pub description: String,
    pub default_value: String,
    pub required: bool,
    pub param_type: String, // "string", "number", "boolean", "select"
    #[serde(default)]
    pub options: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Recipe {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub category: String, // "Maintenance", "Security", "Testing", "Code Quality", "Database"
    pub author: String,
    #[serde(default)]
    pub author_avatar: Option<String>,
    pub version: String,
    pub tags: Vec<String>,
    pub promptware_template: String,
    pub parameters: Vec<RecipeParameter>,
    pub cli_snippet: String,
    pub forks_count: u32,
    pub stars_count: u32,
    pub is_official: bool,
    #[serde(default)]
    pub badge: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ContributorIssue {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String, // "Documentation", "CLI", "Frontend", "Backend", "Tests"
    pub difficulty: String, // "Good First Issue", "Help Wanted"
    pub estimated_minutes: u32,
    pub affected_files: Vec<String>,
    pub reproduction_steps: Vec<String>,
    pub mentor: String,
    pub claimed: bool,
    pub claimed_by: Option<String>,
    pub claimed_at: Option<DateTime<Utc>>,
    pub pr_url: Option<String>,
    #[serde(default)]
    pub github_issue_number: Option<u64>,
    #[serde(default)]
    pub github_repo: Option<String>,
    #[serde(default)]
    pub github_sync_status: Option<String>,
    #[serde(default)]
    pub github_sync_message: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ContributorRecord {
    pub name: String,
    pub avatar_url: String,
    pub profile_url: String,
    pub contributions: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GrowthState {
    pub issues: Vec<GrowthIssue>,
    pub articles: Vec<Article>,
    pub trends: Vec<TrendTopic>,
    pub listings: Vec<Listing>,
    pub tasks: Vec<AgentTask>,
    #[serde(default)]
    pub video_demos: Vec<VideoDemo>,
    #[serde(default)]
    pub syndication_settings: SyndicationSettings,
    #[serde(default)]
    pub packages: Vec<PackageManagerTarget>,
    #[serde(default)]
    pub latest_release: Option<ReleaseInfo>,
    #[serde(default)]
    pub recipes: Vec<Recipe>,
    #[serde(default)]
    pub onboarding_metrics: OnboardingMetrics,
    #[serde(default)]
    pub contributor_issues: Vec<ContributorIssue>,
    #[serde(default)]
    pub contributors: Vec<ContributorRecord>,
    #[serde(default)]
    pub demo_scenarios: Vec<DemoScenario>,
}

pub type SharedState = Arc<RwLock<GrowthState>>;

impl GrowthState {
    pub fn load_or_init(path: &Path) -> Self {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(mut state) = serde_json::from_str::<GrowthState>(&content) {
                    if state.video_demos.is_empty() {
                        let default = Self::seed_default();
                        state.video_demos = default.video_demos;
                        let _ = state.save(path);
                    }
                    tracing::info!("Loaded growth database from {}", path.display());
                    if state.packages.is_empty() {
                        state.packages = Self::seed_packages(Utc::now());
                        let _ = state.save(path);
                    }
                    if state.recipes.is_empty() {
                        state.recipes = Self::seed_recipes(Utc::now());
                        let _ = state.save(path);
                    }
                    if !state.issues.iter().any(|i| i.number == 11) {
                        state.issues.push(Self::seed_issue_11(Utc::now()));
                        let _ = state.save(path);
                    }
                    if state.contributor_issues.is_empty() {
                        state.contributor_issues = Self::seed_contributor_issues(Utc::now());
                        let _ = state.save(path);
                    }
                    if state.contributors.is_empty() {
                        state.contributors = Self::seed_contributors();
                        let _ = state.save(path);
                    }
                    if state.demo_scenarios.is_empty() {
                        state.demo_scenarios = get_sample_scenarios();
                        let _ = state.save(path);
                    }
                    let external_scenarios_path = Path::new("demo_scenarios.json");
                    if external_scenarios_path.exists() {
                        if let Ok(content) = fs::read_to_string(external_scenarios_path) {
                            if let Ok(custom) = serde_json::from_str::<Vec<DemoScenario>>(&content)
                            {
                                if !custom.is_empty() {
                                    state.demo_scenarios = custom;
                                    let _ = state.save(path);
                                }
                            }
                        }
                    }
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
            Self::seed_issue_11(now),
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
                slug: Some("how-git-worktrees-solve-agent-hallucination-and-workspace-collisions-in-multi-agent-coding".to_string()),
                exports: vec![
                    ExportRecord {
                        channel: "ivy-web".to_string(),
                        exported_at: now,
                        target_path: Some("/Users/rorychatt/git/ivy-web/apps/web-new/content/posts/how-git-worktrees-solve-agent-hallucination-and-workspace-collisions-in-multi-agent-coding.mdoc".to_string()),
                        status: "Success".to_string(),
                        external_id: None,
                        engagement: None,
                    },
                ],
                engagement: None,
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
                slug: Some("from-github-issue-to-verified-pull-request-the-15-minute-autonomous-loop".to_string()),
                exports: vec![
                    ExportRecord {
                        channel: "Dev.to".to_string(),
                        exported_at: now,
                        target_path: None,
                        status: "Copied".to_string(),
                        external_id: None,
                        engagement: None,
                    },
                ],
                engagement: None,
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

        let listings = Self::seed_listings(now);

        let tasks = Vec::new();
        let packages = Self::seed_packages(now);
        let recipes = Self::seed_recipes(now);

        let video_demos = vec![
            VideoDemo {
                id: "demo-1".to_string(),
                feature: "Git Worktrees".to_string(),
                target_platform: "LinkedIn".to_string(),
                duration_seconds: 30,
                headline: "🚨 Why your AI coding agents keep breaking each other (and how Git worktrees fix it)".to_string(),
                body: "If you have ever run Claude Code, Codex, or Gemini CLI concurrently on a repository, you know the pain:\n\nDirty index collisions. Hallucinated file states. Broken test runs.\n\nHere is what we do differently in Ivy-Tendril:\nEvery agent gets its own ephemeral Git worktree.\n\n1️⃣ Agent A edits src/auth.ts in /tendril-task-1\n2️⃣ Agent B runs full test suite in /tendril-task-2\n3️⃣ Zero merge collisions. Zero index locks.\n\nWatch the 30-second demo below ⬇️\n\nCheck it out and star the repo: https://github.com/Ivy-Interactive/Ivy-Tendril\n\n#AI #DevTools #SoftwareEngineering #AgenticAI #OpenSource #GitHub".to_string(),
                storyboard: "00:00 - 00:05: Split terminal showing git collision error in traditional setups.\n00:05 - 00:15: Tendril creates 2 isolated worktrees instantly in the background.\n00:15 - 00:25: Both agents work in parallel; tests pass without contention.\n00:25 - 00:30: Verification badge and pull request opened. Tendril GitHub star CTA.".to_string(),
                status: "Pending".to_string(),
                created_at: now,
                updated_at: now,
            },
            VideoDemo {
                id: "demo-2".to_string(),
                feature: "Issue to Verified PR".to_string(),
                target_platform: "LinkedIn".to_string(),
                duration_seconds: 45,
                headline: "From GitHub Issue to Merged Pull Request in 15 Minutes Flat ⚡".to_string(),
                body: "Chatbot coding demos stop at \"here is a snippet.\"\n\nEngineering teams do not need snippets. They need verified pull requests with passing test suites.\n\nWith Ivy-Tendril:\n1. Select any GitHub issue\n2. Tendril spins up an agent in an isolated worktree\n3. The agent edits code AND runs your unit tests\n4. Only when the tests pass does it open the PR\n\nSee the autonomous loop in action in the video below ⬇️\n\nStar the project on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril\n\n#GitHub #CodingAgents #DevOps #CICD #SoftwareTesting #OpenSource".to_string(),
                storyboard: "00:00 - 00:06: Import GitHub issue #184 into Tendril.\n00:06 - 00:20: Agent formulates plan, identifies files, writes fix.\n00:20 - 00:35: Automated test runner executes: cargo test passes.\n00:35 - 00:45: PR created with diff breakdown and verification badge.".to_string(),
                status: "Pending".to_string(),
                created_at: now,
                updated_at: now,
            },
            VideoDemo {
                id: "demo-3".to_string(),
                feature: "Multi-Agent Orchestration".to_string(),
                target_platform: "LinkedIn".to_string(),
                duration_seconds: 35,
                headline: "What happens when you run Claude Code, Codex, and Gemini CLI at the exact same time?".to_string(),
                body: "Single-agent coding is 2024. Multi-agent software factories are 2026.\n\nWith Ivy-Tendril, you don't pick between Claude Code or Codex. You run them side-by-side:\n- Claude Code refactors legacy services\n- Codex updates unit test coverage\n- Gemini drafts migration documentation\n\nAll isolated. All verified before git commit.\n\nCheck out the demo ⬇️\n\nGitHub repo: https://github.com/Ivy-Interactive/Ivy-Tendril\n\n#MultiAgent #ClaudeCode #Gemini #OpenCode #AIProgramming #DevTools".to_string(),
                storyboard: "00:00 - 00:05: Tendril dashboard launching 3 agent tasks concurrently.\n00:05 - 00:20: Live terminal views showing Claude and Codex executing simultaneously.\n00:20 - 00:30: Individual worktree diffs consolidating into verified commits.\n00:30 - 00:35: Outro with Tendril architecture link.".to_string(),
                status: "Pending".to_string(),
                created_at: now,
                updated_at: now,
            },
            VideoDemo {
                id: "demo-4".to_string(),
                feature: "Voice Control".to_string(),
                target_platform: "LinkedIn".to_string(),
                duration_seconds: 25,
                headline: "Look Ma, No Hands: Hands-Free Voice Coding with Ivy-Tendril 🎙️".to_string(),
                body: "Typing 500-word prompt context in terminal windows slows down flow state.\n\nIvy-Tendril has built-in voice intelligence:\nSpeak your architectural intent, and Tendril translates speech into structured worktree plans and launches the CLI agent automatically.\n\nWatch this 25-second walkthrough ⬇️\n\nStar us on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril\n\n#VoiceAI #Productivity #DeveloperExperience #CodingTools #OpenSource".to_string(),
                storyboard: "00:00 - 00:05: Developer speaking task instruction into mic.\n00:05 - 00:15: Real-time speech-to-plan transformation in Tendril UI.\n00:15 - 00:25: Agent executes task and opens diff review.".to_string(),
                status: "Pending".to_string(),
                created_at: now,
                updated_at: now,
            },
            VideoDemo {
                id: "demo-5".to_string(),
                feature: "Tunneling & Preview".to_string(),
                target_platform: "LinkedIn".to_string(),
                duration_seconds: 20,
                headline: "Instant Live Previews for AI-Generated Web Features 🌐".to_string(),
                body: "When an agent builds a web component, reviewing it locally isn't enough. You want to test it on your phone and share it with teammates.\n\nIvy-Tendril creates instant, secure HTTPS tunnels directly to the agent's worktree server with one click.\n\nSee how it works in 20 seconds ⬇️\n\nGitHub: https://github.com/Ivy-Interactive/Ivy-Tendril\n\n#WebDev #FullStack #Staging #DevTools #ProductDesign".to_string(),
                storyboard: "00:00 - 00:05: Agent finishes web UI change.\n00:05 - 00:12: Click \"Tunnel\" -> instant public URL generated.\n00:12 - 00:20: Live interactive preview loaded on mobile and desktop.".to_string(),
                status: "Pending".to_string(),
                created_at: now,
                updated_at: now,
            },
        ];

        let contributor_issues = Self::seed_contributor_issues(now);
        let contributors = Self::seed_contributors();

        Self {
            issues,
            articles,
            trends,
            listings,
            tasks,
            video_demos,
            syndication_settings: SyndicationSettings::default(),
            packages,
            latest_release: None,
            recipes,
            onboarding_metrics: OnboardingMetrics::default(),
            contributor_issues,
            contributors,
            demo_scenarios: get_sample_scenarios(),
        }
    }

    pub fn seed_issue_11(now: DateTime<Utc>) -> GrowthIssue {
        GrowthIssue {
            id: "issue-11".to_string(),
            number: 11,
            title: "tendril doctor & Replayable Zero-Config Demo Mode".to_string(),
            category: "Developer Experience".to_string(),
            status: "In Progress".to_string(),
            priority: "Critical".to_string(),
            description: "Eliminate onboarding dropoff with an interactive diagnostic checklist (git, agent CLIs, API keys, ports) and a replayable, simulated 4-step workflow stepper completing a verifiable PR in under 60 seconds.".to_string(),
            direct_actions: vec![
                "Build system diagnostic engine verifying git worktrees, agent CLIs, API keys, and loopback ports".to_string(),
                "Implement 1-click remediation command copying for quick developer fix execution".to_string(),
                "Create replayable zero-config demo simulator modeling intake, isolated worktree, verification gates, and PR diff".to_string(),
                "Add celebration modal with GitHub star call-to-action on successful first-run completion".to_string(),
            ],
            routine_schedule: None,
            run_count: 1,
            last_run_at: Some(now),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn seed_listings(now: DateTime<Utc>) -> Vec<Listing> {
        vec![
            // Awesome Repo (20 targets)
            Listing {
                id: "list-1".to_string(),
                name: "awesome-ai-agents (e2b-dev)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/e2b-dev/awesome-ai-agents".to_string(),
                status: "PR Submitted".to_string(),
                pr_url: Some("https://github.com/e2b-dev/awesome-ai-agents/pull/412".to_string()),
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory that plans tasks, orchestrates agents in isolated Git worktrees, and produces verified PRs.".to_string(),
                notes: "High authority repo (18k+ stars). PR pending merge in 'Coding Agents' category.".to_string(),
                blurb_status: Some("Pending".to_string()),
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
                blurb_status: Some("Pending".to_string()),
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
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-4".to_string(),
                name: "awesome-generative-ai (steven2358)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/steven2358/awesome-generative-ai".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous software factory implementing tasks through autonomous agents and verification gates.".to_string(),
                notes: "Curated Generative AI list.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-5".to_string(),
                name: "awesome-chatgpt (humanloop)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/humanloop/awesome-chatgpt".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent coding orchestration with isolated Git worktrees.".to_string(),
                notes: "Developer tools and coding agents section.".to_string(),
                blurb_status: Some("Approved".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-6".to_string(),
                name: "awesome-copilot (github)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/github/awesome-copilot".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Issue-to-PR workflow automation with automated build and test gates.".to_string(),
                notes: "Ecosystem extension and coding agent tools.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-7".to_string(),
                name: "awesome-developer-first (akash13s)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/akash13s/awesome-developer-first".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Developer-first autonomous software factory orchestrating agents in worktrees.".to_string(),
                notes: "Developer tooling and infrastructure.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-8".to_string(),
                name: "awesome-devops (jondot)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/jondot/awesome-devops".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Automated issue triage, plan creation, and branch verification pipeline.".to_string(),
                notes: "Automation and CI/CD tools section.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-9".to_string(),
                name: "awesome-cli (agarrharr)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/agarrharr/awesome-cli".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Command-line interface for managing plans, running agents, and verifying worktrees.".to_string(),
                notes: "Development CLI utilities.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-10".to_string(),
                name: "awesome-rust (rust-unofficial)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/rust-unofficial/awesome-rust".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - High performance plan execution and agent orchestration runtime.".to_string(),
                notes: "Development tools and workflows.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-11".to_string(),
                name: "awesome-mac (dkhamsing)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/dkhamsing/awesome-mac".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Developer productivity suite for autonomous software engineering.".to_string(),
                notes: "Developer utilities on macOS.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-12".to_string(),
                name: "awesome-python (vinta)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/vinta/awesome-python".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Full-lifecycle software factory integrating Python linters and test suites.".to_string(),
                notes: "Development environments.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-13".to_string(),
                name: "awesome (sindresorhus)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/sindresorhus/awesome".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - The root awesome directory listing for autonomous AI software factories.".to_string(),
                notes: "Primary entry point for awesome list submission.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-14".to_string(),
                name: "awesome-slack (matiassingers)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/matiassingers/awesome-slack".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Slack notification hooks and human-in-the-loop review actions.".to_string(),
                notes: "Integrations and bots section.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-15".to_string(),
                name: "awesome-linux (inputsh)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/inputsh/awesome-linux".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Linux-compatible background daemon and CLI orchestration.".to_string(),
                notes: "Linux developer utilities.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-16".to_string(),
                name: "static-analysis (analysis-tools-dev)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/analysis-tools-dev/static-analysis".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Automated multi-language verification gates including Clippy, ESLint, and oxlint.".to_string(),
                notes: "Automated code review and static analysis.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-17".to_string(),
                name: "awesome-selfhosted (awesome-selfhosted)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/awesome-selfhosted/awesome-selfhosted".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Self-hosted autonomous software engineering factory with local SQLite and git.".to_string(),
                notes: "Self-hosted developer platforms.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-18".to_string(),
                name: "awesome-software-architecture (flettre)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/flettre/awesome-software-architecture".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Architecture for multi-agent coordination, immutable plans, and ephemeral worktrees.".to_string(),
                notes: "Architectural patterns for AI systems.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-19".to_string(),
                name: "awesome-swe-bench (rohit-lakhotia)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/rohit-lakhotia/awesome-swe-bench".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous issue resolution engine benchmarked on real-world repository challenges.".to_string(),
                notes: "SWE-bench agent implementations.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-20".to_string(),
                name: "awesome-test-automation (punkpeye)".to_string(),
                category: "Awesome Repo".to_string(),
                url: "https://github.com/punkpeye/awesome-test-automation".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Pre-commit and post-execution verification gates with screenshot capture.".to_string(),
                notes: "Testing and verification automation.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },

            // Dev Directory (12 targets)
            Listing {
                id: "list-21".to_string(),
                name: "AlternativeTo (Cursor / Cline)".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://alternativeto.net/software/cursor/".to_string(),
                status: "Live".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril is an open-source multi-agent software factory that automates issue-to-verified PR workflows.".to_string(),
                notes: "Listed on AlternativeTo Cursor and Cline pages.".to_string(),
                blurb_status: Some("Approved".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-22".to_string(),
                name: "OpenAlternative".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://openalternative.co/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril is an open-source alternative to Cursor and proprietary software factories, offering Git worktree isolation and multi-agent orchestration.".to_string(),
                notes: "Submit as open-source alternative to Cursor, Devin, and CodeRabbit.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-23".to_string(),
                name: "DevHunt".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://devhunt.org/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril: Turn GitHub issues into verified pull requests using isolated agent worktrees.".to_string(),
                notes: "Launch scheduled for Phase 1 campaign.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-24".to_string(),
                name: "LibHunt".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://www.libhunt.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril: Autonomous plan management and multi-agent orchestration engine.".to_string(),
                notes: "Developer tool discovery catalog.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-25".to_string(),
                name: "ProductHunt".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://www.producthunt.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril is an autonomous engineering software factory that writes code, runs tests, and opens PRs.".to_string(),
                notes: "Product Hunt upcoming launch.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-26".to_string(),
                name: "SaaSHub".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://www.saashub.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril compares favorably to closed-source coding agents by offering self-hosted Git worktree isolation.".to_string(),
                notes: "SaaS directory alternative index.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-27".to_string(),
                name: "Slant".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://www.slant.co/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "What are the best open source coding agents? Ivy-Tendril features isolated worktrees and automated verification.".to_string(),
                notes: "Recommendation voting community.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-28".to_string(),
                name: "StackShare".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://stackshare.io/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril in Developer Tools: Autonomous agent orchestration and execution verification.".to_string(),
                notes: "Tech stack tracker and registry.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-29".to_string(),
                name: "SourceForge".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://sourceforge.net/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril Open Source Project: Multi-agent software factory for GitHub repositories.".to_string(),
                notes: "Open source directory index.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-30".to_string(),
                name: "Alternative.me".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://alternative.me/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Best alternatives to Devin and Cursor: Ivy-Tendril provides local execution and verification gates.".to_string(),
                notes: "Software alternatives portal.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-31".to_string(),
                name: "Toolify.ai".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://www.toolify.ai/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril - AI Coding Agent and Autonomous Software Factory.".to_string(),
                notes: "AI tool discovery platform.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-32".to_string(),
                name: "Futurepedia".to_string(),
                category: "Dev Directory".to_string(),
                url: "https://www.futurepedia.io/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril: The largest open-source agentic software development system.".to_string(),
                notes: "Comprehensive AI tool encyclopedia.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },

            // Software Factory & Coding Agent Registries (8 targets)
            Listing {
                id: "list-33".to_string(),
                name: "SWE-bench Leaderboard / Registry".to_string(),
                category: "Software Factory".to_string(),
                url: "https://www.swebench.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril autonomous agent factory: verified evaluations on SWE-bench benchmark.".to_string(),
                notes: "SWE-bench official directory.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-34".to_string(),
                name: "OpenHands Integrations".to_string(),
                category: "Software Factory".to_string(),
                url: "https://github.com/All-Hands-AI/OpenHands".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril connector for OpenHands: orchestrate OpenHands inside isolated git worktrees.".to_string(),
                notes: "OpenHands ecosystem partner directory.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-35".to_string(),
                name: "CodeRabbit Community Catalog".to_string(),
                category: "Software Factory".to_string(),
                url: "https://coderabbit.ai/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril integration with CodeRabbit: automated PR reviews coupled with agent worktree fixes.".to_string(),
                notes: "Code review ecosystem catalog.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-36".to_string(),
                name: "Aider Partner Extensions".to_string(),
                category: "Software Factory".to_string(),
                url: "https://github.com/paul-gauthier/aider".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Tendril orchestration runner for Aider: coordinate multiple Aider sessions across parallel plans.".to_string(),
                notes: "Aider tools and extensions list.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-37".to_string(),
                name: "Continue.dev Hub".to_string(),
                category: "Software Factory".to_string(),
                url: "https://github.com/continuedev/continue".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril backend for Continue.dev: trigger autonomous background plans directly from IDE.".to_string(),
                notes: "Continue extension registry.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-38".to_string(),
                name: "Devin Alternative Tracker".to_string(),
                category: "Software Factory".to_string(),
                url: "https://github.com/cognition-labs/devin-alternatives".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril: The open-source, self-hosted alternative to Devin with full verification gates.".to_string(),
                notes: "Devin comparison tracker.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-39".to_string(),
                name: "Agentic Workflows Directory".to_string(),
                category: "Software Factory".to_string(),
                url: "https://agenticworkflows.org/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Task -> Plan -> Execution -> Verification -> PR: The Ivy-Tendril autonomous workflow pattern.".to_string(),
                notes: "Agentic design pattern repository.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-40".to_string(),
                name: "LangChain Agent Ecosystem".to_string(),
                category: "Software Factory".to_string(),
                url: "https://github.com/langchain-ai/langchain".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril multi-agent system built for production code manipulation and tool execution.".to_string(),
                notes: "LangChain ecosystem integrations.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },

            // Package Manager & Installer Registries (6 targets)
            Listing {
                id: "list-41".to_string(),
                name: "Homebrew Core & Tap".to_string(),
                category: "Package Manager".to_string(),
                url: "https://github.com/Homebrew/homebrew-core".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "brew install ivy-tendril - Formula for installing Ivy-Tendril CLI across macOS and Linux.".to_string(),
                notes: "Homebrew official tap / core formula.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-42".to_string(),
                name: "Scoop Extras".to_string(),
                category: "Package Manager".to_string(),
                url: "https://github.com/ScoopInstaller/Extras".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "scoop install ivy-tendril - Windows package manager manifest for Ivy-Tendril CLI.".to_string(),
                notes: "Scoop extras bucket.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-43".to_string(),
                name: "Windows Package Manager (winget-pkgs)".to_string(),
                category: "Package Manager".to_string(),
                url: "https://github.com/microsoft/winget-pkgs".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "winget install Ivy.Tendril - Microsoft Winget submission for Windows developer workstations.".to_string(),
                notes: "Winget community repository.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-44".to_string(),
                name: "Arch AUR".to_string(),
                category: "Package Manager".to_string(),
                url: "https://aur.archlinux.org/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "yay -S ivy-tendril-bin - Arch User Repository PKGBUILD for Tendril binary distribution.".to_string(),
                notes: "Arch Linux AUR catalog.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-45".to_string(),
                name: "Crates.io".to_string(),
                category: "Package Manager".to_string(),
                url: "https://crates.io/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "cargo install tendril-cli - Rust crate distribution for high-performance agent orchestration.".to_string(),
                notes: "Rust package registry.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-46".to_string(),
                name: "npm Registry".to_string(),
                category: "Package Manager".to_string(),
                url: "https://www.npmjs.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "npx @ivy/tendril - Zero-install CLI runner for Ivy-Tendril plan execution.".to_string(),
                notes: "Node.js npm registry.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },

            // Community Platforms (6 targets)
            Listing {
                id: "list-47".to_string(),
                name: "Reddit r/LocalLLaMA Tool Showcase".to_string(),
                category: "Community".to_string(),
                url: "https://reddit.com/r/LocalLLaMA".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Show LocalLLaMA: Ivy-Tendril - How we solved agent workspace collisions using Git worktrees.".to_string(),
                notes: "Bi-weekly community tool showcase thread.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-48".to_string(),
                name: "Hacker News Show HN Directory".to_string(),
                category: "Community".to_string(),
                url: "https://news.ycombinator.com/show".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Show HN: Ivy-Tendril – Open-source autonomous software factory with verification gates.".to_string(),
                notes: "Show HN submission tracking.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-49".to_string(),
                name: "Dev.to Tool Directory".to_string(),
                category: "Community".to_string(),
                url: "https://dev.to/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril: An autonomous coding agent factory you can run on your local machine.".to_string(),
                notes: "Dev.to tool spotlight articles.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-50".to_string(),
                name: "Hashnode AI Hackers".to_string(),
                category: "Community".to_string(),
                url: "https://hashnode.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Building software factories with Ivy-Tendril: From GitHub issues to merged pull requests.".to_string(),
                notes: "Hashnode AI hacker publication.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-51".to_string(),
                name: "Twitter/X AI Agent Curators".to_string(),
                category: "Community".to_string(),
                url: "https://x.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "Ivy-Tendril launch announcement: Parallel agent orchestration with zero git collisions.".to_string(),
                notes: "AI engineering influencer outreach list.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
            Listing {
                id: "list-52".to_string(),
                name: "Indie Hackers Tech Stack".to_string(),
                category: "Community".to_string(),
                url: "https://www.indiehackers.com/".to_string(),
                status: "Targeted".to_string(),
                pr_url: None,
                submission_blurb: "How we built an open source software factory: Ivy-Tendril product stack.".to_string(),
                notes: "Indie Hackers product directory.".to_string(),
                blurb_status: Some("Pending".to_string()),
                updated_at: now,
            },
        ]
    }

    pub fn seed_packages(now: DateTime<Utc>) -> Vec<PackageManagerTarget> {
        vec![
            PackageManagerTarget {
                id: "pkg-homebrew".to_string(),
                target_key: "homebrew".to_string(),
                name: "Homebrew (tap & core)".to_string(),
                os: "macOS / Linux".to_string(),
                registry_repo: "ivy-interactive/homebrew-tap".to_string(),
                package_id: "tendril".to_string(),
                install_command: "brew install ivy-interactive/tap/tendril".to_string(),
                status: "PR Submitted".to_string(),
                pr_url: Some("https://github.com/ivy-interactive/homebrew-tap/pull/1".to_string()),
                manifest_filename: "tendril.rb".to_string(),
                notes: "Official tap formula with dual arm64/x86_64 bottles and shell completions. homebrew-core submission pending 50 stars.".to_string(),
                updated_at: now,
            },
            PackageManagerTarget {
                id: "pkg-winget".to_string(),
                target_key: "winget".to_string(),
                name: "Windows Package Manager (winget)".to_string(),
                os: "Windows".to_string(),
                registry_repo: "microsoft/winget-pkgs".to_string(),
                package_id: "Ivy.Tendril".to_string(),
                install_command: "winget install Ivy.Tendril".to_string(),
                status: "PR Submitted".to_string(),
                pr_url: Some("https://github.com/microsoft/winget-pkgs/pull/189204".to_string()),
                manifest_filename: "Ivy.Tendril.yaml".to_string(),
                notes: "Singleton manifest schema v1.6.0 with MSIX/portable zip installers.".to_string(),
                updated_at: now,
            },
            PackageManagerTarget {
                id: "pkg-scoop".to_string(),
                target_key: "scoop".to_string(),
                name: "Scoop (Extras)".to_string(),
                os: "Windows".to_string(),
                registry_repo: "ScoopInstaller/Extras".to_string(),
                package_id: "tendril".to_string(),
                install_command: "scoop bucket add extras && scoop install tendril".to_string(),
                status: "Under Review".to_string(),
                pr_url: Some("https://github.com/ScoopInstaller/Extras/pull/14522".to_string()),
                manifest_filename: "tendril.json".to_string(),
                notes: "Submitted to Scoop Extras bucket with autoupdate checkver hashes.".to_string(),
                updated_at: now,
            },
            PackageManagerTarget {
                id: "pkg-npx".to_string(),
                target_key: "npx".to_string(),
                name: "npx Zero-Install".to_string(),
                os: "Cross-Platform".to_string(),
                registry_repo: "npm".to_string(),
                package_id: "@ivy-interactive/tendril".to_string(),
                install_command: "npx @ivy-interactive/tendril".to_string(),
                status: "Live".to_string(),
                pr_url: None,
                manifest_filename: "package.json".to_string(),
                notes: "Sub-60-second time-to-first-run zero-install launcher published on npm.".to_string(),
                updated_at: now,
            },
        ]
    }

    pub fn seed_recipes(now: DateTime<Utc>) -> Vec<Recipe> {
        vec![
            Recipe {
                id: "recipe-bugfixer".to_string(),
                slug: "bugfixer".to_string(),
                name: "Bugfixer".to_string(),
                description: "Autonomous issue reproduction script generation, isolated worktree test creation, and targeted bug repair.".to_string(),
                category: "Maintenance".to_string(),
                author: "Tendril Core Team".to_string(),
                author_avatar: None,
                version: "1.0.0".to_string(),
                tags: vec![
                    "bugfix".to_string(),
                    "git-worktrees".to_string(),
                    "reproduction".to_string(),
                    "automated-repair".to_string(),
                ],
                promptware_template: r#"name: Bugfixer
version: 1.0.0
description: Autonomous issue reproduction and targeted bug repair
steps:
  - id: reproduce
    action: Generate isolated reproduction script or test case
    gate: Verification/ReproductionTest
  - id: fix
    action: Implement targeted bug fix in isolated worktree
    gate: Verification/PreExecution
  - id: verify
    action: Execute project test suite and formatting gates
    gate: Verification/AllTests
"#.to_string(),
                parameters: vec![
                    RecipeParameter {
                        name: "issue_id".to_string(),
                        description: "Target GitHub issue ID or bug description".to_string(),
                        default_value: "42".to_string(),
                        required: true,
                        param_type: "string".to_string(),
                        options: None,
                    },
                    RecipeParameter {
                        name: "test_first".to_string(),
                        description: "Generate failing reproduction test before implementing fix".to_string(),
                        default_value: "true".to_string(),
                        required: false,
                        param_type: "boolean".to_string(),
                        options: None,
                    },
                ],
                cli_snippet: "tendril run recipe/bugfixer --issue=<issue_id>".to_string(),
                forks_count: 142,
                stars_count: 580,
                is_official: true,
                badge: Some("Core Team".to_string()),
                created_at: now,
                updated_at: now,
            },
            Recipe {
                id: "recipe-security-patcher".to_string(),
                slug: "security-patcher".to_string(),
                name: "Security Patcher".to_string(),
                description: "Automated CVE dependency auditing, breaking-change risk analysis, and automated version bump PRs.".to_string(),
                category: "Security".to_string(),
                author: "Tendril Core Team".to_string(),
                author_avatar: None,
                version: "1.0.0".to_string(),
                tags: vec![
                    "security".to_string(),
                    "cve".to_string(),
                    "audit".to_string(),
                    "dependencies".to_string(),
                ],
                promptware_template: r#"name: Security Patcher
version: 1.0.0
description: Automated CVE dependency auditing and security upgrade PRs
steps:
  - id: audit
    action: Scan dependencies for CVE vulnerabilities
    gate: Verification/SecurityAudit
  - id: patch
    action: Upgrade vulnerable package versions and resolve breaking changes
    gate: Verification/CargoClippy
  - id: test
    action: Run regression test suite
    gate: Verification/RegressionTests
"#.to_string(),
                parameters: vec![
                    RecipeParameter {
                        name: "cve_id".to_string(),
                        description: "Target CVE identifier or dependency advisory".to_string(),
                        default_value: "CVE-2026-1042".to_string(),
                        required: true,
                        param_type: "string".to_string(),
                        options: None,
                    },
                    RecipeParameter {
                        name: "severity_threshold".to_string(),
                        description: "Minimum vulnerability severity level to trigger auto-patching".to_string(),
                        default_value: "High".to_string(),
                        required: false,
                        param_type: "select".to_string(),
                        options: Some(vec![
                            "Critical".to_string(),
                            "High".to_string(),
                            "Medium".to_string(),
                            "Low".to_string(),
                        ]),
                    },
                ],
                cli_snippet: "tendril run recipe/security-patcher --cve=<cve_id>".to_string(),
                forks_count: 89,
                stars_count: 412,
                is_official: true,
                badge: Some("Core Team".to_string()),
                created_at: now,
                updated_at: now,
            },
            Recipe {
                id: "recipe-test-generator".to_string(),
                slug: "test-generator".to_string(),
                name: "Test Generator".to_string(),
                description: "Differential coverage analysis and edge-case unit and integration test synthesis with mock verification.".to_string(),
                category: "Testing".to_string(),
                author: "Tendril Core Team".to_string(),
                author_avatar: None,
                version: "1.0.0".to_string(),
                tags: vec![
                    "testing".to_string(),
                    "coverage".to_string(),
                    "unit-tests".to_string(),
                    "edge-cases".to_string(),
                ],
                promptware_template: r#"name: Test Generator
version: 1.0.0
description: Differential coverage analysis and edge-case unit and integration test synthesis
steps:
  - id: analyze_coverage
    action: Calculate uncovered branches and public interface edges
    gate: Verification/CoverageMap
  - id: synthesize_tests
    action: Write comprehensive unit and mock integration tests
    gate: Verification/TestExecution
"#.to_string(),
                parameters: vec![
                    RecipeParameter {
                        name: "test_scope".to_string(),
                        description: "Target file, module, or test scope path".to_string(),
                        default_value: "src/api/recipes.rs".to_string(),
                        required: true,
                        param_type: "string".to_string(),
                        options: None,
                    },
                    RecipeParameter {
                        name: "framework".to_string(),
                        description: "Testing framework adapter".to_string(),
                        default_value: "auto".to_string(),
                        required: false,
                        param_type: "select".to_string(),
                        options: Some(vec![
                            "auto".to_string(),
                            "cargo-test".to_string(),
                            "vitest".to_string(),
                            "pytest".to_string(),
                        ]),
                    },
                ],
                cli_snippet: "tendril run recipe/test-generator --scope=<test_scope>".to_string(),
                forks_count: 215,
                stars_count: 890,
                is_official: true,
                badge: Some("Core Team".to_string()),
                created_at: now,
                updated_at: now,
            },
            Recipe {
                id: "recipe-pr-reviewer".to_string(),
                slug: "pr-reviewer".to_string(),
                name: "PR Reviewer".to_string(),
                description: "Deep architectural analysis, code smell detection, and constructive review comment synthesis on open PRs.".to_string(),
                category: "Code Quality".to_string(),
                author: "Tendril Core Team".to_string(),
                author_avatar: None,
                version: "1.0.0".to_string(),
                tags: vec![
                    "code-quality".to_string(),
                    "pr-review".to_string(),
                    "architecture".to_string(),
                    "diff-analysis".to_string(),
                ],
                promptware_template: r#"name: PR Reviewer
version: 1.0.0
description: Deep architectural analysis and constructive review comment synthesis
steps:
  - id: diff_analysis
    action: Inspect PR changes against default branch
    gate: Verification/DiffAudit
  - id: review_comments
    action: Synthesize architectural and code quality feedback
    gate: Verification/ReviewOutput
"#.to_string(),
                parameters: vec![
                    RecipeParameter {
                        name: "pr_number".to_string(),
                        description: "Pull request number or GitHub URL".to_string(),
                        default_value: "105".to_string(),
                        required: true,
                        param_type: "string".to_string(),
                        options: None,
                    },
                    RecipeParameter {
                        name: "strictness".to_string(),
                        description: "Review strictness and feedback depth".to_string(),
                        default_value: "Standard".to_string(),
                        required: false,
                        param_type: "select".to_string(),
                        options: Some(vec![
                            "Standard".to_string(),
                            "Strict".to_string(),
                            "Lenient".to_string(),
                        ]),
                    },
                ],
                cli_snippet: "tendril run recipe/pr-reviewer --pr=<pr_number>".to_string(),
                forks_count: 178,
                stars_count: 670,
                is_official: true,
                badge: Some("Core Team".to_string()),
                created_at: now,
                updated_at: now,
            },
            Recipe {
                id: "recipe-db-migrator".to_string(),
                slug: "db-migrator".to_string(),
                name: "DB Migrator".to_string(),
                description: "Schema diff detection, safe migration script generation (up and down), and backward compatibility verification.".to_string(),
                category: "Database".to_string(),
                author: "Tendril Core Team".to_string(),
                author_avatar: None,
                version: "1.0.0".to_string(),
                tags: vec![
                    "database".to_string(),
                    "migration".to_string(),
                    "schema".to_string(),
                    "sql".to_string(),
                ],
                promptware_template: r#"name: DB Migrator
version: 1.0.0
description: Schema diff detection, migration script synthesis, and rollback verification
steps:
  - id: diff_schema
    action: Detect changes between models and current database schema
    gate: Verification/SchemaDiff
  - id: generate_migrations
    action: Generate reversible up and down migration scripts
    gate: Verification/MigrationDryRun
"#.to_string(),
                parameters: vec![
                    RecipeParameter {
                        name: "schema_target".to_string(),
                        description: "Target table, model, or migration name".to_string(),
                        default_value: "add_recipes_table".to_string(),
                        required: true,
                        param_type: "string".to_string(),
                        options: None,
                    },
                    RecipeParameter {
                        name: "engine".to_string(),
                        description: "Database dialect or ORM".to_string(),
                        default_value: "postgres".to_string(),
                        required: false,
                        param_type: "select".to_string(),
                        options: Some(vec![
                            "postgres".to_string(),
                            "mysql".to_string(),
                            "sqlite".to_string(),
                        ]),
                    },
                ],
                cli_snippet: "tendril run recipe/db-migrator --name=<schema_target>".to_string(),
                forks_count: 64,
                stars_count: 320,
                is_official: true,
                badge: Some("Core Team".to_string()),
                created_at: now,
                updated_at: now,
            },
        ]
    }

    pub fn seed_contributor_issues(_now: DateTime<Utc>) -> Vec<ContributorIssue> {
        vec![
            ContributorIssue {
                id: "cf-issue-1".to_string(),
                title: "Add CLI shell completion for zsh".to_string(),
                description: "Implement zsh completion generator in the CLI completions module to allow tab completion for commands and flags.".to_string(),
                category: "CLI".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 15,
                affected_files: vec!["src/cli/completions.rs".to_string(), "Cargo.toml".to_string()],
                reproduction_steps: vec![
                    "Run cargo run -- completion --help".to_string(),
                    "Observe missing zsh completion script generator".to_string(),
                    "Add clap_complete zsh target generation".to_string(),
                ],
                mentor: "@rorychatt".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                github_issue_number: Some(14),
                github_repo: Some("SpaceCorps/GrowthHack".to_string()),
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-2".to_string(),
                title: "Add loopback host check validator in server startup".to_string(),
                description: "Ensure server socket binding restricts to 127.0.0.1 or localhost in dev mode to prevent sandbox EPERM errors.".to_string(),
                category: "Backend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 15,
                affected_files: vec!["backend/src/main.rs".to_string(), "backend/src/config.rs".to_string()],
                reproduction_steps: vec![
                    "Inspect server socket binding in main.rs".to_string(),
                    "Ensure binding restricts to 127.0.0.1 or localhost".to_string(),
                    "Log error if 0.0.0.0 is configured in sandboxed dev mode".to_string(),
                ],
                mentor: "@alex-spacecorps".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                github_issue_number: Some(15),
                github_repo: Some("SpaceCorps/GrowthHack".to_string()),
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-3".to_string(),
                title: "Improve empty state message on Plan Review view".to_string(),
                description: "Display an intuitive empty state illustration and quick action buttons when no items are pending review.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 20,
                affected_files: vec!["frontend/src/views/ReviewQueue.tsx".to_string()],
                reproduction_steps: vec![
                    "Open Approval Deck with zero pending review items".to_string(),
                    "Observe generic no items text".to_string(),
                    "Add an illustration and quick action link to generate sample articles".to_string(),
                ],
                mentor: "@sarah-ui".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-4".to_string(),
                title: "Add keyboard shortcut ? to open navigation hotkeys modal".to_string(),
                description: "Add a global keydown handler for '?' to open a modal describing navigation and quick action hotkeys.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 20,
                affected_files: vec!["frontend/src/components/Navigation.tsx".to_string(), "frontend/src/App.tsx".to_string()],
                reproduction_steps: vec![
                    "Press ? on keyboard in any view".to_string(),
                    "No shortcut modal opens".to_string(),
                    "Add global keydown listener and hotkey overview overlay".to_string(),
                ],
                mentor: "@sarah-ui".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-5".to_string(),
                title: "Add copy-as-curl action to API error alerts".to_string(),
                description: "Add a convenient Copy as cURL button to error banners and alerts in the terminal console.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 15,
                affected_files: vec!["frontend/src/components/LiveTerminal.tsx".to_string()],
                reproduction_steps: vec![
                    "Trigger a failed API request or simulated error".to_string(),
                    "Notice lack of copyable curl command".to_string(),
                    "Render a Copy as cURL button using navigator.clipboard".to_string(),
                ],
                mentor: "@dev-elena".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-6".to_string(),
                title: "Add format filter dropdown in ArticleEngine".to_string(),
                description: "Allow users to filter generated articles by channel (Website, Dev.to, Medium, etc.) or angle.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 25,
                affected_files: vec!["frontend/src/views/ArticleEngine.tsx".to_string()],
                reproduction_steps: vec![
                    "Navigate to 10x Content Engine".to_string(),
                    "Articles list lacks quick filtering by channel or archetype".to_string(),
                    "Add filter select dropdown above article grid".to_string(),
                ],
                mentor: "@sarah-ui".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-7".to_string(),
                title: "Add badge markdown preview tab in PR Flywheel".to_string(),
                description: "Provide a tab toggle showing the raw Markdown badge snippet alongside rendered preview.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 20,
                affected_files: vec!["frontend/src/views/PrFlywheel.tsx".to_string()],
                reproduction_steps: vec![
                    "Open PR Flywheel view".to_string(),
                    "Observe single preview mode for GitHub badges".to_string(),
                    "Add raw Markdown and HTML tab toggle with syntax highlighting".to_string(),
                ],
                mentor: "@alex-spacecorps".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-8".to_string(),
                title: "Normalize repository URL trailing slashes in database loader".to_string(),
                description: "Strip trailing slashes from repository and listing URLs during database load to avoid duplicate comparisons.".to_string(),
                category: "Backend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 15,
                affected_files: vec!["backend/src/db/mod.rs".to_string()],
                reproduction_steps: vec![
                    "Add a listing or repo with trailing slash e.g. https://github.com/foo/bar/".to_string(),
                    "Query comparisons fail due to trailing slash mismatch".to_string(),
                    "Trim trailing slashes in normalization helper".to_string(),
                ],
                mentor: "@rorychatt".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-9".to_string(),
                title: "Add test coverage for trend topic tie-in serialization".to_string(),
                description: "Add comprehensive unit and integration tests verifying serde serialization for trend topics.".to_string(),
                category: "Tests".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 20,
                affected_files: vec!["backend/tests/trends_test.rs".to_string(), "backend/src/db/mod.rs".to_string()],
                reproduction_steps: vec![
                    "Inspect tests in backend/tests/trends_test.rs".to_string(),
                    "Notice missing serde roundtrip test for direct, subtle, and none tie-in values".to_string(),
                    "Add test validating JSON serialization".to_string(),
                ],
                mentor: "@dev-elena".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-10".to_string(),
                title: "Add dark mode contrast test helper for buttons".to_string(),
                description: "Add automated contrast ratio assertions to verify button accessibility compliance in dark mode.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 25,
                affected_files: vec!["frontend/src/views/IssuesHub.tsx".to_string(), "frontend/src/index.css".to_string()],
                reproduction_steps: vec![
                    "Audit color contrast for low-emphasis action buttons".to_string(),
                    "Notice some borders blend into dark slate background".to_string(),
                    "Add high-contrast focus rings and test helper".to_string(),
                ],
                mentor: "@sarah-ui".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-11".to_string(),
                title: "Add uptime and memory usage metrics to Agent Status response".to_string(),
                description: "Extend GET /api/agent/status with process uptime and approximate memory consumption statistics.".to_string(),
                category: "Backend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 30,
                affected_files: vec!["backend/src/api/agent.rs".to_string()],
                reproduction_steps: vec![
                    "Invoke GET /api/agent/status".to_string(),
                    "Response only contains is_available and agy_path".to_string(),
                    "Add uptime_seconds and process memory metrics to payload".to_string(),
                ],
                mentor: "@rorychatt".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-12".to_string(),
                title: "Add JSON export action to Direct Action Issues table".to_string(),
                description: "Add a button to export all Direct Action issues as a downloadable formatted JSON file.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 20,
                affected_files: vec!["frontend/src/views/IssuesHub.tsx".to_string()],
                reproduction_steps: vec![
                    "Navigate to Direct Action Issues".to_string(),
                    "Notice no batch export button".to_string(),
                    "Add Export JSON button that triggers browser download".to_string(),
                ],
                mentor: "@dev-elena".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-13".to_string(),
                title: "Add validation error banner on empty listing PR blurb submit".to_string(),
                description: "Display an explicit error alert when attempting to submit an empty listing PR blurb.".to_string(),
                category: "Frontend".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 15,
                affected_files: vec!["frontend/src/views/ListingBlitz.tsx".to_string()],
                reproduction_steps: vec![
                    "Open Listing Blitz submission modal".to_string(),
                    "Submit with empty submission blurb".to_string(),
                    "Show user-friendly inline alert rather than silent rejection".to_string(),
                ],
                mentor: "@sarah-ui".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-14".to_string(),
                title: "Add dry-run flag to package manager manifest generator".to_string(),
                description: "Support ?dry_run=true parameter on manifest generator routes to validate target schemas without state changes.".to_string(),
                category: "Backend".to_string(),
                difficulty: "Help Wanted".to_string(),
                estimated_minutes: 25,
                affected_files: vec!["backend/src/api/packages.rs".to_string()],
                reproduction_steps: vec![
                    "Call manifest generation API".to_string(),
                    "Notice no validation-only dry-run option".to_string(),
                    "Accept ?dry_run=true query flag and validate without side effects".to_string(),
                ],
                mentor: "@alex-spacecorps".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
            ContributorIssue {
                id: "cf-issue-15".to_string(),
                title: "Add contributor guide link to bottom footer".to_string(),
                description: "Add a direct link in the application footer pointing to the Contributor Flywheel onboarding guide.".to_string(),
                category: "Documentation".to_string(),
                difficulty: "Good First Issue".to_string(),
                estimated_minutes: 15,
                affected_files: vec!["frontend/src/App.tsx".to_string()],
                reproduction_steps: vec![
                    "Scroll to bottom of application".to_string(),
                    "Notice absence of quick contributor guide link".to_string(),
                    "Add link navigating directly to Contributor Flywheel view".to_string(),
                ],
                mentor: "@rorychatt".to_string(),
                claimed: false,
                claimed_by: None,
                claimed_at: None,
                pr_url: None,
                ..Default::default()
            },
        ]
    }

    pub fn seed_contributors() -> Vec<ContributorRecord> {
        vec![
            ContributorRecord {
                name: "Rory Chatt".to_string(),
                avatar_url: "https://github.com/rorychatt.png".to_string(),
                profile_url: "https://github.com/rorychatt".to_string(),
                contributions: vec![
                    "code".to_string(),
                    "architecture".to_string(),
                    "review".to_string(),
                ],
            },
            ContributorRecord {
                name: "Alex Vance".to_string(),
                avatar_url: "https://avatars.githubusercontent.com/u/10001?v=4".to_string(),
                profile_url: "https://github.com/alex-spacecorps".to_string(),
                contributions: vec![
                    "code".to_string(),
                    "backend".to_string(),
                    "test".to_string(),
                ],
            },
            ContributorRecord {
                name: "Sarah Jenkins".to_string(),
                avatar_url: "https://avatars.githubusercontent.com/u/10002?v=4".to_string(),
                profile_url: "https://github.com/sarah-ui".to_string(),
                contributions: vec![
                    "design".to_string(),
                    "frontend".to_string(),
                    "a11y".to_string(),
                ],
            },
            ContributorRecord {
                name: "Elena Rostova".to_string(),
                avatar_url: "https://avatars.githubusercontent.com/u/10003?v=4".to_string(),
                profile_url: "https://github.com/dev-elena".to_string(),
                contributions: vec![
                    "code".to_string(),
                    "doc".to_string(),
                    "maintenance".to_string(),
                ],
            },
            ContributorRecord {
                name: "Marcus Chen".to_string(),
                avatar_url: "https://avatars.githubusercontent.com/u/10004?v=4".to_string(),
                profile_url: "https://github.com/marcus-cli".to_string(),
                contributions: vec!["cli".to_string(), "package".to_string(), "test".to_string()],
            },
        ]
    }
}
