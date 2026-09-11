import React, { useState, useEffect } from "react";
import {
  Video,
  Sparkles,
  Copy,
  Check,
  Clapperboard,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Cpu,
  Mic,
  Eye,
  ChevronDown,
  ChevronUp,
  Share2,
  Layers,
  Clock,
} from "lucide-react";

import type { VideoDemo, StoryboardScene } from "../types";
import { LiveTerminal } from "../components/LiveTerminal";

interface VideoDemosProps {
  onGenerateDemo?: (
    feature: string,
    platform: string,
    duration: number,
    transcodeFormat?: string,
  ) => void;
  demos?: VideoDemo[];
}

const DEFAULT_PRESET_DEMOS: VideoDemo[] = [
  {
    id: "demo-1",
    feature: "Git Worktrees",
    target_platform: "LinkedIn",
    duration_seconds: 30,
    headline:
      "🚨 Why your AI coding agents keep breaking each other (and how Git worktrees fix it)",
    body: `If you have ever run Claude Code, Codex, or Gemini CLI concurrently on a repository, you know the pain:

Dirty index collisions. Hallucinated file states. Broken test runs.

Here is what we do differently in Ivy-Tendril:
Every agent gets its own ephemeral Git worktree.

1️⃣ Agent A edits src/auth.ts in /tendril-task-1
2️⃣ Agent B runs full test suite in /tendril-task-2
3️⃣ Zero merge collisions. Zero index locks.

Watch the 30-second demo below ⬇️

Check it out and star the repo: https://github.com/Ivy-Interactive/Ivy-Tendril

#AI #DevTools #SoftwareEngineering #AgenticAI #OpenSource #GitHub`,
    storyboard: `00:00 - 00:05: Split terminal showing git collision error in traditional setups.
00:05 - 00:15: Tendril creates 2 isolated worktrees instantly in the background.
00:15 - 00:25: Both agents work in parallel; tests pass without contention.
00:25 - 00:30: Verification badge and pull request opened. Tendril GitHub star CTA.`,
    status: "Pending",
    created_at: "2026-09-11T05:00:00Z",
    updated_at: "2026-09-11T05:00:00Z",
    scenes: [
      {
        stage: "Hook",
        start_second: 0,
        end_second: 5,
        title: "Git Index Collision",
        visual_action:
          "Split terminal showing git index lock collision error during concurrent agent runs.",
        playwright_action:
          "await page.goto('/terminal'); await page.click('[data-testid=\"conflict-demo\"]');",
      },
      {
        stage: "WorktreeIsolation",
        start_second: 5,
        end_second: 15,
        title: "Worktree Provisioning",
        visual_action:
          "Tendril spins up two isolated git worktrees concurrently in the background.",
        playwright_action:
          "await page.click('#spawn-worktree'); await page.waitForSelector('.worktree-active');",
      },
      {
        stage: "TestVerification",
        start_second: 15,
        end_second: 25,
        title: "Parallel Test Suite",
        visual_action:
          "Parallel test verification running across both worktrees with green checkmarks.",
        playwright_action:
          "await page.click('#run-tests'); await page.waitForSelector('.test-pass');",
      },
      {
        stage: "PrBadgeOutro",
        start_second: 25,
        end_second: 30,
        title: "Verified PR Outro",
        visual_action: "Verified PR created badge with GitHub star call to action and link.",
        playwright_action:
          "await page.waitForSelector('.pr-badge'); await page.screenshot({ path: 'outro.png' });",
      },
    ],
    platform_copy: {
      linkedin_post: `🚨 Why your AI coding agents keep breaking each other (and how Git worktrees fix it)

Dirty index collisions. Hallucinated file states. Broken test runs.

Here is what we do differently in Ivy-Tendril:
Every agent gets its own ephemeral Git worktree.

1️⃣ Agent A edits src/auth.ts in /tendril-task-1
2️⃣ Agent B runs full test suite in /tendril-task-2
3️⃣ Zero merge collisions. Zero index locks.

Watch the 30-second demo below ⬇️

Check it out and star the repo: https://github.com/Ivy-Interactive/Ivy-Tendril

#AI #DevTools #SoftwareEngineering #AgenticAI #OpenSource #GitHub`,
      twitter_thread: [
        "1/4 🚨 Why your AI coding agents keep breaking each other (and how Git worktrees fix it) 🧵",
        "2/4 Concurrent agents on the same working tree corrupt index state, race on lock files, and break CI.",
        "3/4 In @IvyTendril, every task runs in an isolated ephemeral worktree with dedicated verification gates.",
        "4/4 Zero locks. Zero collisions. Parallel agent factories: https://github.com/Ivy-Interactive/Ivy-Tendril #DevTools",
      ],
      youtube_shorts_caption:
        "Stop AI coding agents from fighting over git lock files! Watch Tendril isolate agents with git worktrees ⚡ Star on GitHub #Shorts #Coding #AI",
    },
    automation_config: {
      generator_path: "/Users/rorychatt/git/web-demo-generator",
      playwright_script: `import { test } from '@playwright/test';\ntest('worktrees demo', async ({ page }) => {\n  await page.goto('http://localhost:5173');\n  await page.click('[data-testid="worktree-demo"]');\n});`,
      transcode_format: "mp4",
    },
  },
  {
    id: "demo-2",
    feature: "Issue to Verified PR",
    target_platform: "LinkedIn",
    duration_seconds: 45,
    headline: "From GitHub Issue to Merged Pull Request in 15 Minutes Flat ⚡",
    body: `Chatbot coding demos stop at "here is a snippet."

Engineering teams do not need snippets. They need verified pull requests with passing test suites.

With Ivy-Tendril:
1. Select any GitHub issue
2. Tendril spins up an agent in an isolated worktree
3. The agent edits code AND runs your unit tests
4. Only when the tests pass does it open the PR

See the autonomous loop in action in the video below ⬇️

Star the project on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril

#GitHub #CodingAgents #DevOps #CICD #SoftwareTesting #OpenSource`,
    storyboard: `00:00 - 00:06: Import GitHub issue #184 into Tendril.
00:06 - 00:20: Agent formulates plan, identifies files, writes fix.
00:20 - 00:35: Automated test runner executes: cargo test passes.
00:35 - 00:45: PR created with diff breakdown and verification badge.`,
    status: "Pending",
    created_at: "2026-09-11T05:00:00Z",
    updated_at: "2026-09-11T05:00:00Z",
    scenes: [
      {
        stage: "Hook",
        start_second: 0,
        end_second: 6,
        title: "Issue Intake & Bug Triage",
        visual_action:
          "Import GitHub issue #184 into Tendril dashboard with reproduction test failure.",
        playwright_action: "await page.goto('/issues'); await page.click('#issue-184');",
      },
      {
        stage: "WorktreeIsolation",
        start_second: 6,
        end_second: 20,
        title: "Autonomous Implementation",
        visual_action:
          "Agent formulates execution plan and edits codebase in dedicated git worktree.",
        playwright_action:
          "await page.click('#execute-plan'); await page.waitForSelector('.executing-badge');",
      },
      {
        stage: "TestVerification",
        start_second: 20,
        end_second: 35,
        title: "Verification Suite Pass",
        visual_action: "Automated test runner executes: cargo test passes with 100% green suites.",
        playwright_action: "await page.waitForSelector('.verification-pass');",
      },
      {
        stage: "PrBadgeOutro",
        start_second: 35,
        end_second: 45,
        title: "Verified PR Submission",
        visual_action: "PR created with diff breakdown, verification badge, and GitHub star CTA.",
        playwright_action: "await page.waitForSelector('.pr-link');",
      },
    ],
    platform_copy: {
      linkedin_post: `From GitHub Issue to Merged Pull Request in 15 Minutes Flat ⚡\n\nChatbot coding demos stop at snippets. Engineering teams need verified pull requests.\n\nWith Ivy-Tendril:\n1. Select any GitHub issue\n2. Tendril launches in an isolated worktree\n3. The agent edits code AND runs tests\n4. Only when tests pass does it open the PR\n\nStar the project on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril #GitHub #DevOps`,
      twitter_thread: [
        "1/4 From GitHub Issue to Merged Pull Request in 15 Minutes Flat ⚡",
        "2/4 Chatbot demos stop at code snippets. Ivy-Tendril gives you verified PRs with passing test suites.",
        "3/4 Agents plan, implement in worktrees, and pass verification before ever pushing code.",
        "4/4 Check the autonomous loop & star us: https://github.com/Ivy-Interactive/Ivy-Tendril #DevOps #CICD",
      ],
      youtube_shorts_caption:
        "Turn GitHub issues into verified pull requests autonomously with Ivy-Tendril 🚀 #DevTools #GitHub #Coding",
    },
    automation_config: {
      generator_path: "/Users/rorychatt/git/web-demo-generator",
      playwright_script: `import { test } from '@playwright/test';\ntest('issue to pr demo', async ({ page }) => {\n  await page.goto('http://localhost:5173');\n  await page.click('#issue-to-pr');\n});`,
      transcode_format: "mp4",
    },
  },
  {
    id: "demo-3",
    feature: "Multi-Agent Orchestration",
    target_platform: "LinkedIn",
    duration_seconds: 35,
    headline:
      "What happens when you run Claude Code, Codex, and Gemini CLI at the exact same time?",
    body: `Single-agent coding is 2024. Multi-agent software factories are 2026.

With Ivy-Tendril, you don't pick between Claude Code or Codex. You run them side-by-side:
- Claude Code refactors legacy services
- Codex updates unit test coverage
- Gemini drafts migration documentation

All isolated. All verified before git commit.

Check out the demo ⬇️

GitHub repo: https://github.com/Ivy-Interactive/Ivy-Tendril

#MultiAgent #ClaudeCode #Gemini #OpenCode #AIProgramming #DevTools`,
    storyboard: `00:00 - 00:05: Tendril dashboard launching 3 agent tasks concurrently.
00:05 - 00:20: Live terminal views showing Claude and Codex executing simultaneously.
00:20 - 00:30: Individual worktree diffs consolidating into verified commits.
00:30 - 00:35: Outro with Tendril architecture link.`,
    status: "Pending",
    created_at: "2026-09-11T05:00:00Z",
    updated_at: "2026-09-11T05:00:00Z",
    scenes: [
      {
        stage: "Hook",
        start_second: 0,
        end_second: 5,
        title: "Multi-Agent Launch",
        visual_action:
          "Tendril dashboard launching Claude Code, Codex, and Gemini tasks concurrently.",
        playwright_action: "await page.goto('/tasks'); await page.click('#multi-agent-launch');",
      },
      {
        stage: "WorktreeIsolation",
        start_second: 5,
        end_second: 20,
        title: "Parallel Execution Streams",
        visual_action:
          "Live terminal views showing 3 agents executing simultaneously without conflict.",
        playwright_action: "await page.waitForSelector('.agent-stream-grid');",
      },
      {
        stage: "TestVerification",
        start_second: 20,
        end_second: 30,
        title: "Consolidated Verification",
        visual_action:
          "Individual worktree diffs consolidating into passing verification test suites.",
        playwright_action: "await page.waitForSelector('.all-suites-passed');",
      },
      {
        stage: "PrBadgeOutro",
        start_second: 30,
        end_second: 35,
        title: "Software Factory Outro",
        visual_action: "Outro with Tendril architecture link and GitHub star call to action.",
        playwright_action: "await page.waitForSelector('.outro-card');",
      },
    ],
    platform_copy: {
      linkedin_post: `What happens when you run Claude Code, Codex, and Gemini CLI at the exact same time?\n\nMulti-agent software factories are here with Ivy-Tendril.\n\nRun them side-by-side without collisions in isolated worktrees.\n\nGitHub repo: https://github.com/Ivy-Interactive/Ivy-Tendril #MultiAgent #AIProgramming`,
      twitter_thread: [
        "1/4 What happens when you run Claude Code, Codex, and Gemini CLI simultaneously? 🧵",
        "2/4 Single-agent coding is bottlenecked. Multi-agent software factories run models concurrently.",
        "3/4 Claude handles refactors, Codex writes tests, Gemini documents. All isolated in Tendril worktrees.",
        "4/4 Scale your dev team 10x: https://github.com/Ivy-Interactive/Ivy-Tendril #AI",
      ],
      youtube_shorts_caption:
        "Running Claude Code and Codex side by side without git collisions! Watch Ivy-Tendril orchestrate multi-agent factories 🤖 #AI #Shorts",
    },
    automation_config: {
      generator_path: "/Users/rorychatt/git/web-demo-generator",
      playwright_script: `import { test } from '@playwright/test';\ntest('multi agent demo', async ({ page }) => {\n  await page.goto('http://localhost:5173');\n  await page.click('#multi-agent-demo');\n});`,
      transcode_format: "mp4",
    },
  },
];

const STAGE_CONFIGS: Record<
  string,
  { label: string; badgeClass: string; barClass: string; defaultRange: string }
> = {
  Hook: {
    label: "Stage 1: Hook",
    badgeClass: "bg-rose-950/80 text-rose-300 border-rose-800",
    barClass: "bg-rose-500",
    defaultRange: "0:00 - 0:05",
  },
  WorktreeIsolation: {
    label: "Stage 2: Worktree Isolation",
    badgeClass: "bg-amber-950/80 text-amber-300 border-amber-800",
    barClass: "bg-amber-500",
    defaultRange: "0:05 - 0:15",
  },
  TestVerification: {
    label: "Stage 3: Automated Test Verification",
    badgeClass: "bg-emerald-950/80 text-emerald-300 border-emerald-800",
    barClass: "bg-emerald-500",
    defaultRange: "0:15 - 0:25",
  },
  PrBadgeOutro: {
    label: "Stage 4: PR Badge Outro",
    badgeClass: "bg-cyan-950/80 text-cyan-300 border-cyan-800",
    barClass: "bg-cyan-500",
    defaultRange: "0:25 - 0:30",
  },
};

const getFeatureIcon = (feature: string) => {
  const f = feature.toLowerCase();
  if (f.contains ? f.contains("worktree") : f.includes("worktree")) return GitBranch;
  if (f.includes("issue") || f.includes("pr") || f.includes("verification")) return ShieldCheck;
  if (f.includes("multi-agent") || f.includes("agent") || f.includes("concurrency")) return Cpu;
  if (f.includes("voice")) return Mic;
  if (f.includes("tunnel") || f.includes("preview")) return Eye;
  return Clapperboard;
};

const formatSeconds = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export const VideoDemos: React.FC<VideoDemosProps> = ({ onGenerateDemo, demos: propDemos }) => {
  const [liveDemos, setLiveDemos] = useState<VideoDemo[]>([]);
  const [selectedFeature, setSelectedFeature] = useState("Git Worktrees");
  const [selectedPlatform, setSelectedPlatform] = useState("LinkedIn");
  const [duration, setDuration] = useState(30);
  const [transcodeFormat, setTranscodeFormat] = useState("mp4");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTabByDemo, setActiveTabByDemo] = useState<Record<string, string>>({});
  const [expandedScenesByDemo, setExpandedScenesByDemo] = useState<Record<string, boolean>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [terminalTitle, setTerminalTitle] = useState("Antigravity Video Demo Stream");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDemos = async () => {
    try {
      const res = await fetch("/api/demos");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLiveDemos(data);
        }
      }
    } catch {
      // Keep existing or preset demos on error
    }
  };

  useEffect(() => {
    fetchDemos();
  }, []);

  const displayedDemos =
    propDemos && propDemos.length > 0
      ? propDemos
      : liveDemos.length > 0
        ? liveDemos
        : DEFAULT_PRESET_DEMOS;

  const handleCopy = (id: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (onGenerateDemo) {
      onGenerateDemo(selectedFeature, selectedPlatform, duration, transcodeFormat);
    }

    try {
      const res = await fetch("/api/demos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: selectedFeature,
          target_platform: selectedPlatform,
          duration_seconds: duration,
          transcode_format: transcodeFormat,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task_id) {
          setTerminalTitle(`Generating ${selectedFeature} Demo (${selectedPlatform})`);
          setActiveTaskId(data.task_id);
        }
      }
    } catch (err) {
      console.error("Demo generation request error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleScenesExpansion = (demoId: string) => {
    setExpandedScenesByDemo((prev) => ({
      ...prev,
      [demoId]: !prev[demoId],
    }));
  };

  const getActiveTab = (demoId: string) => activeTabByDemo[demoId] || "linkedin";

  const setActiveTab = (demoId: string, tab: string) => {
    setActiveTabByDemo((prev) => ({
      ...prev,
      [demoId]: tab,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Clapperboard className="w-4 h-4" />
            <span>Feature Video Demos & Multi-Platform Social Blitz // ISSUE-10</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Produce Short Motion Demos & Multi-Platform Social Blitz Packages
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Generate 15-45s animated UI clips using{" "}
            <strong className="text-rose-300">SpaceCorps/web-demo-generator</strong> (Playwright +
            H.264/WebM), synchronized with 4-stage storyboards, LinkedIn posts, X/Twitter threads,
            and YouTube Shorts.
          </p>
        </div>

        {/* Engine Status Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5 font-mono shrink-0">
          <div className="flex items-center space-x-2 text-rose-400 font-bold">
            <Video className="w-4 h-4" />
            <span>web-demo-generator</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Path: /Users/rorychatt/git/web-demo-generator
          </p>
          <div className="flex items-center space-x-2 text-[10px] text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Playwright + H.264 / WebM Ready</span>
          </div>
        </div>
      </div>

      {/* SSE Live Terminal Stream */}
      {activeTaskId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-rose-400">
              <Sparkles className="w-3.5 h-3.5 animate-spin" /> Live Generation SSE Progress
            </span>
            <button
              onClick={() => setActiveTaskId(null)}
              className="text-slate-500 hover:text-slate-300 text-[11px]"
            >
              Dismiss Terminal
            </button>
          </div>
          <LiveTerminal
            taskId={activeTaskId}
            title={terminalTitle}
            onClose={() => setActiveTaskId(null)}
            onTaskCompleted={() => {
              fetchDemos();
            }}
          />
        </div>
      )}

      {/* Generator Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            Generate Custom Storyboard, Playwright Tour & Social Package
          </h3>
          <span className="text-xs text-slate-400">Powered by Antigravity CLI</span>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Feature</label>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              <option value="Git Worktrees">Git Worktrees</option>
              <option value="Issue to Verified PR">Issue to Verified PR</option>
              <option value="Multi-Agent Orchestration">Multi-Agent Orchestration</option>
              <option value="Voice Control">Voice Control</option>
              <option value="Tunneling & Preview">Tunneling & Preview</option>
              <option value="Verification Gates">Verification Gates</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Target Platform</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              <option value="LinkedIn">LinkedIn Post</option>
              <option value="X/Twitter">X/Twitter Thread</option>
              <option value="YouTube Shorts">YouTube Shorts / TikTok</option>
              <option value="All">All (Multi-Platform Package)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              <option value={15}>15s (Rapid Fire)</option>
              <option value={30}>30s (Recommended)</option>
              <option value={45}>45s (Deep Walkthrough)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Format</label>
            <select
              value={transcodeFormat}
              onChange={(e) => setTranscodeFormat(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              <option value="mp4">H.264 (.mp4)</option>
              <option value="webm">WebM (.webm)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold transition-all shadow-md shadow-rose-950"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Dispatching..." : "Generate Package"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Feature Showcase Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Active Demo Packages ({displayedDemos.length})</span>
          <span>Click tabs to switch platform copy or view Playwright script</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayedDemos.map((demo) => {
            const Icon = getFeatureIcon(demo.feature);
            const status = demo.status || "Pending";
            const activeTab = getActiveTab(demo.id);
            const scenesExpanded = !!expandedScenesByDemo[demo.id];
            const scenes: StoryboardScene[] =
              demo.scenes && demo.scenes.length > 0
                ? demo.scenes
                : [
                    {
                      stage: "Hook",
                      start_second: 0,
                      end_second: Math.round(demo.duration_seconds * 0.17),
                      title: "Developer Friction Hook",
                      visual_action:
                        "Split terminal showing traditional tooling friction and errors.",
                    },
                    {
                      stage: "WorktreeIsolation",
                      start_second: Math.round(demo.duration_seconds * 0.17),
                      end_second: Math.round(demo.duration_seconds * 0.5),
                      title: "Worktree Launch",
                      visual_action: "Tendril spins up isolated git worktrees concurrently.",
                    },
                    {
                      stage: "TestVerification",
                      start_second: Math.round(demo.duration_seconds * 0.5),
                      end_second: Math.round(demo.duration_seconds * 0.83),
                      title: "Test Verification",
                      visual_action: "Parallel test verification runs and passes.",
                    },
                    {
                      stage: "PrBadgeOutro",
                      start_second: Math.round(demo.duration_seconds * 0.83),
                      end_second: demo.duration_seconds,
                      title: "PR Badge & Star CTA",
                      visual_action: "Green verification badge and GitHub star CTA.",
                    },
                  ];

            const linkedinText =
              demo.platform_copy?.linkedin_post || `${demo.headline}\n\n${demo.body}`;
            const twitterText =
              demo.platform_copy?.twitter_thread && demo.platform_copy.twitter_thread.length > 0
                ? demo.platform_copy.twitter_thread.join("\n\n---\n\n")
                : `1/3 🚨 ${demo.feature} in action with @IvyTendril\n\n2/3 ${demo.headline}\n\n3/3 Star the repo: https://github.com/Ivy-Interactive/Ivy-Tendril`;
            const youtubeText =
              demo.platform_copy?.youtube_shorts_caption ||
              `Watch ${demo.feature} in Ivy-Tendril in ${demo.duration_seconds}s! ⚡ Star on GitHub #Shorts #AI`;
            const playwrightCode =
              demo.automation_config?.playwright_script ||
              `import { test } from '@playwright/test';\ntest('${demo.feature} tour', async ({ page }) => {\n  await page.goto('http://localhost:5173');\n});`;

            const fullPackageText = `=== HEADLINE ===\n${demo.headline}\n\n=== LINKEDIN POST ===\n${linkedinText}\n\n=== X/TWITTER THREAD ===\n${twitterText}\n\n=== YOUTUBE SHORTS CAPTION ===\n${youtubeText}\n\n=== 4-STAGE STORYBOARD ===\n${scenes.map((s) => `[${s.stage}] (${formatSeconds(s.start_second)} - ${formatSeconds(s.end_second)}) ${s.title}: ${s.visual_action}`).join("\n")}\n\n=== PLAYWRIGHT SCRIPT ===\n${playwrightCode}`;

            return (
              <div
                key={demo.id}
                data-testid={`demo-card-${demo.id}`}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            {demo.target_platform} Video Demo
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                            {demo.duration_seconds}s
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white leading-snug">
                          {demo.feature}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                          status === "Approved"
                            ? "bg-emerald-950/80 border-emerald-800 text-emerald-400"
                            : status === "Published"
                              ? "bg-purple-950/80 border-purple-800 text-purple-400"
                              : status === "Rejected"
                                ? "bg-red-950/80 border-red-800 text-red-400"
                                : "bg-amber-950/80 border-amber-800 text-amber-400"
                        }`}
                      >
                        {status === "Pending" ? "Pending Review" : status}
                      </span>
                    </div>
                  </div>

                  {/* Headline */}
                  <p className="text-xs text-rose-300 font-medium leading-relaxed">
                    &ldquo;{demo.headline}&rdquo;
                  </p>

                  {/* Interactive 4-Stage Storyboard Timeline Visualizer */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-rose-400" />
                        4-Stage Storyboard Timeline
                      </span>
                      <button
                        onClick={() => toggleScenesExpansion(demo.id)}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <span>{scenesExpanded ? "Hide Actions" : "Show Playwright Steps"}</span>
                        {scenesExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Timeline Segmented Bar */}
                    <div className="grid grid-cols-4 gap-1.5 h-2 rounded-full overflow-hidden bg-slate-900 p-0.5 border border-slate-800">
                      <div className="h-full bg-rose-500 rounded-sm" title="Hook (0:00 - 0:05)" />
                      <div
                        className="h-full bg-amber-500 rounded-sm"
                        title="Worktree Isolation (0:05 - 0:15)"
                      />
                      <div
                        className="h-full bg-emerald-500 rounded-sm"
                        title="Test Verification (0:15 - 0:25)"
                      />
                      <div
                        className="h-full bg-cyan-500 rounded-sm"
                        title="PR Badge Outro (0:25 - 0:30)"
                      />
                    </div>

                    {/* Stage Badges Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      {scenes.map((scene, idx) => {
                        const cfg = STAGE_CONFIGS[scene.stage] || {
                          label: `Stage ${idx + 1}: ${scene.stage}`,
                          badgeClass: "bg-slate-900 text-slate-300 border-slate-800",
                          defaultRange: `${formatSeconds(scene.start_second)} - ${formatSeconds(scene.end_second)}`,
                        };
                        const rangeStr = `${formatSeconds(scene.start_second)} - ${formatSeconds(scene.end_second)}`;

                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border ${cfg.badgeClass} flex flex-col justify-between space-y-1`}
                          >
                            <div className="flex items-center justify-between font-mono font-bold">
                              <span>{cfg.label}</span>
                              <span className="opacity-80">{rangeStr}</span>
                            </div>
                            <p className="text-[11px] font-medium leading-tight text-white line-clamp-1">
                              {scene.title}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expandable Playwright Actions List */}
                    {scenesExpanded && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                        {scenes.map((scene, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1"
                          >
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="font-bold text-slate-200">
                                [{scene.stage}] {scene.title} ({formatSeconds(scene.start_second)} -{" "}
                                {formatSeconds(scene.end_second)})
                              </span>
                            </div>
                            <p className="text-slate-300 font-sans text-xs">
                              {scene.visual_action}
                            </p>
                            {scene.playwright_action && (
                              <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-cyan-300">
                                <code className="truncate">{scene.playwright_action}</code>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      `pw-step-${demo.id}-${idx}`,
                                      scene.playwright_action!,
                                    )
                                  }
                                  className="text-slate-400 hover:text-white shrink-0"
                                  title="Copy Step"
                                >
                                  {copiedId === `pw-step-${demo.id}-${idx}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Multi-Platform Script Selector (Tabs) */}
                  <div className="space-y-2">
                    <div
                      className="flex items-center space-x-1 border-b border-slate-800 text-xs"
                      role="tablist"
                    >
                      <button
                        role="tab"
                        aria-selected={activeTab === "linkedin"}
                        data-testid={`tab-${demo.id}-linkedin`}
                        onClick={() => setActiveTab(demo.id, "linkedin")}
                        className={`px-3 py-1.5 font-medium border-b-2 transition-all ${
                          activeTab === "linkedin"
                            ? "border-rose-500 text-white font-bold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        LinkedIn Post
                      </button>
                      <button
                        role="tab"
                        aria-selected={activeTab === "twitter"}
                        data-testid={`tab-${demo.id}-twitter`}
                        onClick={() => setActiveTab(demo.id, "twitter")}
                        className={`px-3 py-1.5 font-medium border-b-2 transition-all ${
                          activeTab === "twitter"
                            ? "border-rose-500 text-white font-bold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        X/Twitter Thread
                      </button>
                      <button
                        role="tab"
                        aria-selected={activeTab === "youtube"}
                        data-testid={`tab-${demo.id}-youtube`}
                        onClick={() => setActiveTab(demo.id, "youtube")}
                        className={`px-3 py-1.5 font-medium border-b-2 transition-all ${
                          activeTab === "youtube"
                            ? "border-rose-500 text-white font-bold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        YouTube Shorts
                      </button>
                      <button
                        role="tab"
                        aria-selected={activeTab === "playwright"}
                        data-testid={`tab-${demo.id}-playwright`}
                        onClick={() => setActiveTab(demo.id, "playwright")}
                        className={`px-3 py-1.5 font-medium border-b-2 transition-all ${
                          activeTab === "playwright"
                            ? "border-rose-500 text-white font-bold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Playwright & Config
                      </button>
                    </div>

                    {/* Tab Content Box */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 relative group min-h-[140px]">
                      {activeTab === "linkedin" && (
                        <div className="whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto text-[11px] text-slate-300">
                          {linkedinText}
                        </div>
                      )}

                      {activeTab === "twitter" && (
                        <div className="space-y-2 max-h-40 overflow-y-auto text-[11px]">
                          {demo.platform_copy?.twitter_thread &&
                          demo.platform_copy.twitter_thread.length > 0 ? (
                            demo.platform_copy.twitter_thread.map((tweet, tIdx) => (
                              <div
                                key={tIdx}
                                className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 leading-relaxed text-slate-200"
                              >
                                {tweet}
                              </div>
                            ))
                          ) : (
                            <div className="whitespace-pre-wrap leading-relaxed">{twitterText}</div>
                          )}
                        </div>
                      )}

                      {activeTab === "youtube" && (
                        <div className="space-y-2 leading-relaxed text-[11px] text-slate-300 max-h-40 overflow-y-auto">
                          <p className="font-semibold text-rose-300">
                            Shorts / TikTok Video Caption:
                          </p>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                            {youtubeText}
                          </div>
                        </div>
                      )}

                      {activeTab === "playwright" && (
                        <div className="space-y-2 text-[11px] max-h-40 overflow-y-auto">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800">
                            <span>Generator: /Users/rorychatt/git/web-demo-generator</span>
                            <span className="text-cyan-400 uppercase font-bold">
                              Format: {demo.automation_config?.transcode_format || "mp4"}
                            </span>
                          </div>
                          <pre className="text-cyan-300 text-[10px] overflow-x-auto leading-relaxed">
                            {playwrightCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Toolbar: 1-Click Copy Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-800 text-xs">
                  <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>web-demo-generator automated</span>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap">
                    {/* Copy Active Tab Content */}
                    <button
                      onClick={() => {
                        const content =
                          activeTab === "linkedin"
                            ? linkedinText
                            : activeTab === "twitter"
                              ? twitterText
                              : activeTab === "youtube"
                                ? youtubeText
                                : playwrightCode;
                        handleCopy(`active-${demo.id}-${activeTab}`, content);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      title="Copy current active tab content"
                    >
                      {copiedId === `active-${demo.id}-${activeTab}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Copy{" "}
                        {activeTab === "linkedin"
                          ? "Post"
                          : activeTab === "twitter"
                            ? "Thread"
                            : activeTab === "youtube"
                              ? "Shorts"
                              : "Script"}
                      </span>
                    </button>

                    {/* Copy Full Package Button */}
                    <button
                      onClick={() => handleCopy(`full-${demo.id}`, fullPackageText)}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-sm"
                      title="Copy complete release package: Storyboard, LinkedIn, Twitter, Shorts, Playwright script"
                    >
                      {copiedId === `full-${demo.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Full Package</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
