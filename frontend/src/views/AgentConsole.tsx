import React, { useState } from "react";
import type { AgentStatus } from "../types";
import { Terminal, Play, Cpu, Sparkles } from "lucide-react";
import { ActionButton } from "../components/ActionButton";

interface AgentConsoleProps {
  agentStatus: AgentStatus | null;
  onRunCustomPrompt: (prompt: string) => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({ agentStatus, onRunCustomPrompt }) => {
  const [prompt, setPrompt] = useState("");

  const quickPrompts = [
    {
      label: "Draft 10x Worktrees Article",
      text: "Write an authoritative 10x technical article about Ivy-Tendril Git Worktree isolation for Claude Code and Codex with benchmark comparisons and outbound citations.",
    },
    {
      label: "Scout Trending Discussions",
      text: "Search and analyze what is currently trending on GitHub, Reddit (r/LocalLLaMA, r/programming), and LinkedIn in coding agents today.",
    },
    {
      label: "Awesome-AI-Agents PR Blurb",
      text: "Generate a GitHub Pull Request description to add Ivy-Tendril to e2b-dev/awesome-ai-agents conforming to the repo style and guidelines.",
    },
    {
      label: "VS Code Extension Architecture",
      text: "Outline the technical architecture and commands for an Ivy-Tendril VS Code companion extension that bridges to the background agent daemon.",
    },
    {
      label: "Hacker News Show HN Pitch",
      text: 'Draft a high-authenticity Show HN post announcing Ivy-Tendril: "Show HN: We automated issue-to-verified PRs using multi-agent Git worktrees".',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onRunCustomPrompt(prompt);
    setPrompt("");
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Bar */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">Local Antigravity Agent Runtime</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Ready
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-xl">
                Executable: {agentStatus?.agy_path || "Auto-detected"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Process Runner: Active</span>
          </div>
        </div>

        {/* Quick Command Launcher */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Quick Growth Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(qp.text)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white text-xs transition-all text-left"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Prompt Form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <label className="block text-xs font-semibold text-slate-300">
            Execute Custom Agent Instruction
          </label>
          <div className="flex gap-2">
            <textarea
              rows={3}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Give Antigravity an instruction (e.g., 'Draft 5 comparison tweets between Cline and Tendril', 'Scan Reddit for worktree complaints')..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            />
            <ActionButton
              type="submit"
              size="md"
              icon={<Play className="w-4 h-4 fill-current" />}
              className="shrink-0 self-end hover:scale-[1.02]"
            >
              Launch
            </ActionButton>
          </div>
        </form>
      </div>

      {/* Guide Card */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
        <h4 className="text-white font-bold flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-emerald-400" />
          How Antigravity Automation Works in GrowthHack
        </h4>
        <p>
          Every action triggered in GrowthHack directly calls <code>agy --print</code> in the
          background via the Rust <code>axum</code> backend. Real-time execution logs are broadcast
          over Server-Sent Events (SSE) directly into the terminal interface.
        </p>
      </div>
    </div>
  );
};
