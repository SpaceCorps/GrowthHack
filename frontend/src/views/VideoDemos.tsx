import React, { useState } from "react";
import {
  Video,
  Sparkles,
  Play,
  Copy,
  Check,
  Share2,
  Layers,
  Cpu,
  Clapperboard,
  CheckCircle2,
  FolderGit2,
  ExternalLink,
  Mic,
  GitBranch,
  ShieldCheck,
  Eye,
} from "lucide-react";

interface VideoDemosProps {
  onGenerateDemo: (feature: string, platform: string, duration: number) => void;
}

export const VideoDemos: React.FC<VideoDemosProps> = ({ onGenerateDemo }) => {
  const [selectedFeature, setSelectedFeature] = useState("Git Worktrees");
  const [selectedPlatform, setSelectedPlatform] = useState("LinkedIn");
  const [duration, setDuration] = useState(30);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const features = [
    {
      id: "Git Worktrees",
      title: "Git Worktree Isolation",
      hook: "How to run 5 agents simultaneously without .git/index.lock collisions",
      icon: GitBranch,
      asset: "worktrees.gif",
      duration: "30s",
      painPoint: "Agent race conditions and dirty index corruption in shared branches",
      premadeScript: {
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
      },
    },
    {
      id: "Issue to Verified PR",
      title: "GitHub Issue to Verified PR",
      hook: "From production bug report to tested pull request in 15 minutes",
      icon: ShieldCheck,
      asset: "github.gif",
      duration: "45s",
      painPoint: "Chatbot demos that output raw code snippets instead of verified pull requests",
      premadeScript: {
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
      },
    },
    {
      id: "Multi-Agent Orchestration",
      title: "Multi-Agent Concurrency",
      hook: "Claude Code vs Codex vs Gemini executing concurrently on the same codebase",
      icon: Cpu,
      asset: "main.gif",
      duration: "35s",
      painPoint: "Being locked into a single model or running one task at a time",
      premadeScript: {
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
      },
    },
    {
      id: "Voice Control",
      title: "Voice-Driven Agent Coding",
      hook: "Coding at the speed of thought: hands-free agent delegation",
      icon: Mic,
      asset: "voice.gif",
      duration: "25s",
      painPoint: "Typing lengthy prompts in small terminal windows",
      premadeScript: {
        headline: "Look Ma, No Hands: Hands-Free Voice Coding with Ivy-Tendril 🎙️",
        body: `Typing 500-word prompt context in terminal windows slows down flow state.

Ivy-Tendril has built-in voice intelligence:
Speak your architectural intent, and Tendril translates speech into structured worktree plans and launches the CLI agent automatically.

Watch this 25-second walkthrough ⬇️

Star us on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril

#VoiceAI #Productivity #DeveloperExperience #CodingTools #OpenSource`,
        storyboard: `00:00 - 00:05: Developer speaking task instruction into mic.
00:05 - 00:15: Real-time speech-to-plan transformation in Tendril UI.
00:15 - 00:25: Agent executes task and opens diff review.`,
      },
    },
    {
      id: "Tunneling & Preview",
      title: "Instant Web Preview & Tunneling",
      hook: "Instant public HTTPS tunnel to preview agent web changes on mobile",
      icon: Eye,
      asset: "tunneling.gif",
      duration: "20s",
      painPoint: "Testing agent UI changes requires manual port forwarding or deploying to staging",
      premadeScript: {
        headline: "Instant Live Previews for AI-Generated Web Features 🌐",
        body: `When an agent builds a web component, reviewing it locally isn't enough. You want to test it on your phone and share it with teammates.

Ivy-Tendril creates instant, secure HTTPS tunnels directly to the agent's worktree server with one click.

See how it works in 20 seconds ⬇️

GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril

#WebDev #FullStack #Staging #DevTools #ProductDesign`,
        storyboard: `00:00 - 00:05: Agent finishes web UI change.
00:05 - 00:12: Click "Tunnel" -> instant public URL generated.
00:12 - 00:20: Live interactive preview loaded on mobile and desktop.`,
      },
    },
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateDemo(selectedFeature, selectedPlatform, duration);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Clapperboard className="w-4 h-4" />
            <span>Feature Video Demos & LinkedIn Blitz // ISSUE-10</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Produce Short Animated Demos & Viral LinkedIn Posts
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Generate 15-45s animated UI video clips for every Tendril capability using{" "}
            <strong className="text-rose-300">SpaceCorps/web-demo-generator</strong> (Playwright +
            H.264 video recorder), paired with high-converting LinkedIn post scripts.
          </p>
        </div>

        {/* Engine Status Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5 font-mono shrink-0">
          <div className="flex items-center space-x-2 text-rose-400 font-bold">
            <Video className="w-4 h-4" />
            <span>web-demo-generator</span>
          </div>
          <p className="text-[11px] text-slate-400">Path: SpaceCorps/web-demo-generator</p>
          <div className="flex items-center space-x-2 text-[10px] text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Playwright + H.264 Ready</span>
          </div>
        </div>
      </div>

      {/* Generator Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            Generate Custom Video Storyboard & LinkedIn Post
          </h3>
          <span className="text-xs text-slate-400">Powered by Antigravity</span>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Feature</label>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Platform</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              <option value="LinkedIn">LinkedIn Post</option>
              <option value="X/Twitter">X/Twitter Video Thread</option>
              <option value="YouTube Shorts">YouTube Shorts / TikTok</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Video Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-rose-500"
            >
              <option value={15}>15 Seconds (Rapid Fire)</option>
              <option value={30}>30 Seconds (Recommended)</option>
              <option value={45}>45 Seconds (Deep Walkthrough)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md shadow-rose-950"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Package</span>
            </button>
          </div>
        </form>
      </div>

      {/* Feature Showcase Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Ready-to-Post Feature Demo Packages ({features.length})</span>
          <span>Click to copy post text or video storyboard</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                          Video Demo ({f.duration})
                        </span>
                        <h4 className="text-base font-bold text-white leading-snug">{f.title}</h4>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      Asset: {f.asset}
                    </span>
                  </div>

                  {/* Hook */}
                  <p className="text-xs text-rose-300/90 font-medium">&ldquo;{f.hook}&rdquo;</p>

                  {/* Post Preview */}
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 relative group">
                    <div className="font-bold text-white mb-2">{f.premadeScript.headline}</div>
                    <div className="whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto text-[11px] text-slate-300">
                      {f.premadeScript.body}
                    </div>
                  </div>

                  {/* Video Storyboard */}
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                      <Clapperboard className="w-3 h-3 text-rose-400" />
                      web-demo-generator Storyboard Timeline:
                    </div>
                    <p className="font-mono whitespace-pre-wrap leading-relaxed text-slate-300">
                      {f.premadeScript.storyboard}
                    </p>
                  </div>
                </div>

                {/* Copy Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-500">
                    Engine: <code className="text-slate-400">web-demo-generator</code>
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(`sb-${f.id}`, f.premadeScript.storyboard)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      title="Copy Storyboard"
                    >
                      {copiedId === `sb-${f.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Storyboard</span>
                    </button>

                    <button
                      onClick={() =>
                        handleCopy(
                          `post-${f.id}`,
                          `${f.premadeScript.headline}\n\n${f.premadeScript.body}`,
                        )
                      }
                      className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-sm"
                      title="Copy LinkedIn Post"
                    >
                      {copiedId === `post-${f.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy LinkedIn Post</span>
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
