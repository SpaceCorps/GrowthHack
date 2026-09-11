import React, { useState, useEffect } from "react";
import type {
  LaunchCampaignState,
  BetaTester,
  SyndicationChecklistItem,
  AuthenticityAnalysis,
} from "../types";
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Users,
  Sparkles,
  Clock,
  Send,
  Image as ImageIcon,
  Share2,
} from "lucide-react";

export interface LaunchCampaignProps {
  initialCampaign?: LaunchCampaignState;
  onCampaignUpdated?: () => void;
}

type LaunchTab = "timeline" | "show_hn" | "product_hunt" | "testers" | "syndication";

const SHOW_HN_TEMPLATES = [
  {
    name: "Technical Deep-Dive",
    title:
      "Show HN: Ivy-Tendril – Autonomous coding agents in isolated Git worktrees with verification gates",
    comment:
      "Hi HN! We built Ivy-Tendril because running autonomous coding agents directly in shared working copies triggers merge collisions, git index locks, and context drift.\n\nTendril provisions an ephemeral, isolated Git worktree for every agent task, runs strict verification test gates (build, clippy, unit tests) before creating pull requests, and orchestrates Claude Code, Codex, and Gemini CLI in parallel.\n\nEverything is open source Rust (Axum/Tokio) and React 19. Would love your brutal feedback on our worktree isolation architecture and benchmark reproducible results!\n\nRepo: https://github.com/Ivy-Interactive/Ivy-Tendril",
  },
  {
    name: "Architecture Trade-Offs",
    title: "Show HN: Why shared working copies break multi-agent coding (and how worktrees fix it)",
    comment:
      "Hi HN! Running multiple LLM coding agents concurrently fails in practice because shared directories create index collisions, broken build artifacts, and context drift.\n\nWe built Tendril to isolate each agent in its own Git worktree with reproducible verification gates and Axum-powered event streaming. We chose Git worktrees over Docker containers because worktrees cost zero disk duplication and zero startup latency.\n\nCheck out the architecture benchmarks and code: https://github.com/Ivy-Interactive/Ivy-Tendril",
  },
  {
    name: "Open Source Story",
    title: "Show HN: Ivy-Tendril – Open-source software factory orchestrator for CLI coding agents",
    comment:
      "Hi HN! Most agentic coding demos stop at chat snippets. We wanted an autonomous issue-to-PR pipeline that actually runs test suites and linters in isolated worktrees before touching main.\n\nEverything is open source under MIT. We built the core daemon in Rust and the UI in React 19 / Vite+. Would love to hear how you handle multi-repo agent isolation!\n\nGitHub: https://github.com/Ivy-Interactive/Ivy-Tendril",
  },
];

export const LaunchCampaign: React.FC<LaunchCampaignProps> = ({
  initialCampaign,
  onCampaignUpdated,
}) => {
  const [campaign, setCampaign] = useState<LaunchCampaignState | null>(initialCampaign || null);
  const [loading, setLoading] = useState<boolean>(!initialCampaign);
  const [activeTab, setActiveTab] = useState<LaunchTab>("timeline");

  // Show HN Studio State
  const [hnTitle, setHnTitle] = useState<string>("");
  const [hnComment, setHnComment] = useState<string>("");
  const [authenticity, setAuthenticity] = useState<AuthenticityAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Product Hunt State
  const [selectedTagline, setSelectedTagline] = useState<string>("");
  const [customTagline, setCustomTagline] = useState<string>("");
  const [phFirstComment, setPhFirstComment] = useState<string>("");

  // Beta Testers State
  const [testerSearch, setTesterSearch] = useState<string>("");
  const [testerPlatformFilter, setTesterPlatformFilter] = useState<string>("All");
  const [testerStatusFilter, setTesterStatusFilter] = useState<string>("All");

  // Copied feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/launch/overview");
      if (res.ok) {
        const data: LaunchCampaignState = await res.json();
        setCampaign(data);
        setHnTitle(data.show_hn.title);
        setHnComment(data.show_hn.maker_comment);
        setAuthenticity(data.show_hn.score_breakdown || null);
        setSelectedTagline(data.product_hunt.selected_tagline);
        setCustomTagline(data.product_hunt.selected_tagline);
        setPhFirstComment(data.product_hunt.first_comment);
      }
    } catch (err) {
      console.error("Failed to load launch campaign", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCampaign) {
      setCampaign(initialCampaign);
      setHnTitle(initialCampaign.show_hn.title);
      setHnComment(initialCampaign.show_hn.maker_comment);
      setAuthenticity(initialCampaign.show_hn.score_breakdown || null);
      setSelectedTagline(initialCampaign.product_hunt.selected_tagline);
      setCustomTagline(initialCampaign.product_hunt.selected_tagline);
      setPhFirstComment(initialCampaign.product_hunt.first_comment);
      setLoading(false);
    } else {
      fetchCampaign();
    }
  }, [initialCampaign]);

  // Authenticity analyzer with debounced API call
  const triggerAnalysis = async (title: string, comment: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/launch/show-hn/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, maker_comment: comment }),
      });
      if (res.ok) {
        const data: AuthenticityAnalysis = await res.json();
        setAuthenticity(data);
      }
    } catch (err) {
      console.error("Failed to analyze Show HN post", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTitleChange = (val: string) => {
    setHnTitle(val);
    triggerAnalysis(val, hnComment);
  };

  const handleCommentChange = (val: string) => {
    setHnComment(val);
    triggerAnalysis(hnTitle, val);
  };

  const applyTemplate = (template: { title: string; comment: string }) => {
    setHnTitle(template.title);
    setHnComment(template.comment);
    triggerAnalysis(template.title, template.comment);
  };

  const copyToClipboard = async (text: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleTimelineTask = async (phaseId: string, taskId: string) => {
    try {
      const res = await fetch(`/api/launch/timeline/${phaseId}/tasks/${taskId}`, {
        method: "PUT",
      });
      if (res.ok) {
        const updatedTask = await res.json();
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            timeline: prev.timeline.map((p) => {
              if (p.id !== phaseId) return p;
              return {
                ...p,
                tasks: p.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
              };
            }),
          };
        });
        onCampaignUpdated?.();
      }
    } catch (err) {
      console.error("Failed to toggle timeline task", err);
    }
  };

  const handleToggleChecklist = async (id: string) => {
    try {
      const res = await fetch(`/api/launch/checklist/${id}`, {
        method: "PUT",
      });
      if (res.ok) {
        const updatedItem: SyndicationChecklistItem = await res.json();
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            syndication_checklist: prev.syndication_checklist.map((item) =>
              item.id === id ? updatedItem : item,
            ),
          };
        });
        onCampaignUpdated?.();
      }
    } catch (err) {
      console.error("Failed to toggle syndication checklist", err);
    }
  };

  const handleTogglePhChecklist = async (id: string) => {
    try {
      const res = await fetch(`/api/launch/product-hunt/checklist/${id}`, {
        method: "PUT",
      });
      if (res.ok) {
        const updatedItem = await res.json();
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            product_hunt: {
              ...prev.product_hunt,
              checklist: prev.product_hunt.checklist.map((item) =>
                item.id === id ? updatedItem : item,
              ),
            },
          };
        });
        onCampaignUpdated?.();
      }
    } catch (err) {
      console.error("Failed to toggle Product Hunt checklist", err);
    }
  };

  const handleUpdateTesterStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/launch/testers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreach_status: status }),
      });
      if (res.ok) {
        const updatedTester: BetaTester = await res.json();
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            beta_testers: prev.beta_testers.map((t) => (t.id === id ? updatedTester : t)),
          };
        });
        onCampaignUpdated?.();
      }
    } catch (err) {
      console.error("Failed to update tester status", err);
    }
  };

  const handleUpdateTesterNotes = async (id: string, notes: string) => {
    try {
      const res = await fetch(`/api/launch/testers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const updatedTester: BetaTester = await res.json();
        setCampaign((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            beta_testers: prev.beta_testers.map((t) => (t.id === id ? updatedTester : t)),
          };
        });
      }
    } catch (err) {
      console.error("Failed to update tester notes", err);
    }
  };

  const handleResetCampaign = async () => {
    if (window.confirm("Reset entire Launch Campaign to initial seeded data?")) {
      try {
        const res = await fetch("/api/launch/reset", { method: "POST" });
        if (res.ok) {
          const data: LaunchCampaignState = await res.json();
          setCampaign(data);
          setHnTitle(data.show_hn.title);
          setHnComment(data.show_hn.maker_comment);
          setAuthenticity(data.show_hn.score_breakdown || null);
          setSelectedTagline(data.product_hunt.selected_tagline);
          setCustomTagline(data.product_hunt.selected_tagline);
          setPhFirstComment(data.product_hunt.first_comment);
          onCampaignUpdated?.();
        }
      } catch (err) {
        console.error("Failed to reset campaign", err);
      }
    }
  };

  if (loading || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading 48-Hour Launch Orchestrator...</p>
        </div>
      </div>
    );
  }

  // Calculate high-level metrics
  const totalTasks = campaign.timeline.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = campaign.timeline.reduce(
    (acc, p) => acc + p.tasks.filter((t) => t.completed).length,
    0,
  );
  const timelineProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const committedTesters = campaign.beta_testers.filter(
    (t) => t.outreach_status === "Committed" || t.outreach_status === "Active on Launch Day",
  ).length;

  const completedSyndications = campaign.syndication_checklist.filter((i) => i.completed).length;

  // Filter beta testers
  const filteredTesters = campaign.beta_testers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(testerSearch.toLowerCase()) ||
      t.handle.toLowerCase().includes(testerSearch.toLowerCase()) ||
      t.specialty.toLowerCase().includes(testerSearch.toLowerCase());

    const matchesPlatform = testerPlatformFilter === "All" || t.platform === testerPlatformFilter;

    const matchesStatus = testerStatusFilter === "All" || t.outreach_status === testerStatusFilter;

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header and Countdown Cockpit */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 rounded-lg text-cyan-400 border border-cyan-500/30 shadow-inner">
                <Rocket className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Coordinated Show HN & Product Hunt Launch
                </h1>
                <p className="text-sm text-slate-400">
                  48-Hour High-Density Launch Campaign Orchestrator (GitHub Issue #12)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Stats */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-slate-400 block">Beta Mobilization</span>
              <span className="text-lg font-bold text-emerald-400">
                {committedTesters} / {campaign.beta_testers.length}
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-slate-400 block">Syndication</span>
              <span className="text-lg font-bold text-cyan-400">
                {completedSyndications} / {campaign.syndication_checklist.length}
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-slate-400 block">Authenticity Score</span>
              <span className="text-lg font-bold text-amber-400">
                {authenticity?.score ?? campaign.show_hn.authenticity_score} / 100
              </span>
            </div>

            <button
              onClick={handleResetCampaign}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
              title="Reset campaign state to defaults"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 48-Hour Timeline Progress Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              48-Hour Execution Progress ({completedTasks} of {totalTasks} milestones completed)
            </span>
            <span className="font-semibold text-cyan-400">{timelineProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${timelineProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === "timeline"
              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>48-Hour Timeline</span>
          <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
            {campaign.timeline.length} Phases
          </span>
        </button>

        <button
          onClick={() => setActiveTab("show_hn")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === "show_hn"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Show HN Studio</span>
          <span className="text-xs bg-amber-500/20 px-1.5 py-0.5 rounded-full text-amber-300">
            {authenticity?.score ?? campaign.show_hn.authenticity_score} Score
          </span>
        </button>

        <button
          onClick={() => setActiveTab("product_hunt")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === "product_hunt"
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Product Hunt Kit</span>
          <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
            Launch Day
          </span>
        </button>

        <button
          onClick={() => setActiveTab("testers")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === "testers"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Beta Mobilization</span>
          <span className="text-xs bg-emerald-500/20 px-1.5 py-0.5 rounded-full text-emerald-300">
            {committedTesters}/20
          </span>
        </button>

        <button
          onClick={() => setActiveTab("syndication")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === "syndication"
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Cross-Channel Syndication</span>
          <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
            {completedSyndications}/5
          </span>
        </button>
      </div>

      {/* Tab 1: 48-Hour Timeline Orchestrator */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaign.timeline.map((phase, idx) => {
              const phaseCompletedCount = phase.tasks.filter((t) => t.completed).length;
              const isAllCompleted = phaseCompletedCount === phase.tasks.length;

              return (
                <div
                  key={phase.id}
                  className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition ${
                    isAllCompleted
                      ? "border-emerald-500/40 bg-emerald-950/10"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        Phase {idx + 1}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {phase.timing}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{phase.phase}</h3>

                    <div className="space-y-3 my-4">
                      {phase.tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex items-start space-x-3 text-xs cursor-pointer group select-none"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTimelineTask(phase.id, task.id)}
                            className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-400"
                          />
                          <div>
                            <span
                              className={`font-medium ${
                                task.completed
                                  ? "line-through text-slate-500"
                                  : "text-slate-200 group-hover:text-white"
                              }`}
                            >
                              {task.title}
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                              {task.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {phaseCompletedCount} of {phase.tasks.length} tasks
                    </span>
                    {isAllCompleted ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : (
                      <span className="text-slate-400">In Progress</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Show HN Studio */}
      {activeTab === "show_hn" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Title & Maker Comment Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Template Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Curated Show HN Presets (Engineered for Hacker News Norms)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SHOW_HN_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    onClick={() => applyTemplate(tmpl)}
                    className="text-left p-3 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-cyan-500/50 transition cursor-pointer group"
                  >
                    <span className="text-xs font-semibold text-cyan-300 block mb-1 group-hover:text-cyan-200">
                      {tmpl.name}
                    </span>
                    <span className="text-[11px] text-slate-400 line-clamp-2">{tmpl.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title Editor */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">
                  Show HN Title (Target: 30 - 100 characters)
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">{hnTitle.length} chars</span>
                  <button
                    onClick={() => copyToClipboard(hnTitle, "title")}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                    title="Copy title"
                  >
                    {copiedKey === "title" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={hnTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Show HN: Ivy-Tendril – Autonomous coding agents in isolated Git worktrees"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Maker Comment Editor */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">
                  First Comment by Maker (The "Why We Built It" Technical Narrative)
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">{hnComment.length} chars</span>
                  <button
                    onClick={() => copyToClipboard(hnComment, "comment")}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                    title="Copy comment"
                  >
                    {copiedKey === "comment" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <textarea
                value={hnComment}
                onChange={(e) => handleCommentChange(e.target.value)}
                rows={10}
                placeholder="Hi HN! We built Ivy-Tendril because..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Right Column: Authenticity Score Analysis */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Authenticity Analyzer</h3>
                  <p className="text-xs text-slate-400">Hacker News Cultural Alignment</p>
                </div>
                {isAnalyzing ? (
                  <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : (
                  <span
                    className={`text-2xl font-black ${
                      (authenticity?.score ?? 0) >= 85
                        ? "text-emerald-400"
                        : (authenticity?.score ?? 0) >= 70
                          ? "text-cyan-400"
                          : (authenticity?.score ?? 0) >= 50
                            ? "text-amber-400"
                            : "text-red-400"
                    }`}
                  >
                    {authenticity?.score ?? 0}
                    <span className="text-xs font-normal text-slate-500">/100</span>
                  </span>
                )}
              </div>

              {/* Rating badge */}
              <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">HN Alignment Rating</span>
                <span className="text-sm font-semibold text-white">
                  {authenticity?.rating ?? "Calculating..."}
                </span>
              </div>

              {/* Technical Keywords Matched */}
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-2">
                  Technical Keywords Matched ({authenticity?.keyword_matches?.length ?? 0})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(authenticity?.keyword_matches || []).map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md"
                    >
                      +{kw}
                    </span>
                  ))}
                  {(!authenticity?.keyword_matches ||
                    authenticity.keyword_matches.length === 0) && (
                    <span className="text-xs text-slate-500 italic">
                      No technical keywords detected
                    </span>
                  )}
                </div>
              </div>

              {/* Penalties / Buzzwords */}
              {(authenticity?.penalty_reasons?.length ?? 0) > 0 && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg space-y-2">
                  <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Marketing Buzzword Penalties
                  </span>
                  <ul className="text-xs text-red-300 space-y-1 list-disc list-inside">
                    {authenticity?.penalty_reasons.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvement Suggestions */}
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Optimization Suggestions
                </span>
                <ul className="text-xs text-slate-400 space-y-2">
                  {(authenticity?.suggestions || []).map((sugg, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      <span>{sugg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Product Hunt Kit */}
      {activeTab === "product_hunt" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Tagline Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Product Hunt Tagline (Max 60 chars)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Crisp, punchy summary for the Product Hunt card
                  </p>
                </div>
                <span
                  className={`text-xs font-mono font-medium ${
                    customTagline.length > 60 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {customTagline.length}/60 chars
                </span>
              </div>

              <div className="space-y-2">
                {campaign.product_hunt.taglines.map((tagline) => (
                  <div
                    key={tagline}
                    onClick={() => {
                      setSelectedTagline(tagline);
                      setCustomTagline(tagline);
                    }}
                    className={`p-3 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                      selectedTagline === tagline
                        ? "border-orange-500/50 bg-orange-500/10 text-white"
                        : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{tagline}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {tagline.length} chars
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="text"
                  value={customTagline}
                  onChange={(e) => setCustomTagline(e.target.value)}
                  placeholder="Custom 60-character tagline"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => copyToClipboard(customTagline, "ph_tagline")}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition cursor-pointer"
                >
                  {copiedKey === "ph_tagline" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Tagline!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Tagline</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Maker First Comment */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Hunter / Maker First Comment</h3>
                  <p className="text-xs text-slate-400">Post immediately upon launch zero</p>
                </div>
                <button
                  onClick={() => copyToClipboard(phFirstComment, "ph_comment")}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  title="Copy first comment"
                >
                  {copiedKey === "ph_comment" ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <textarea
                value={phFirstComment}
                onChange={(e) => setPhFirstComment(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-orange-500 font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Right Column: Asset Specs & Checklist */}
          <div className="space-y-6">
            {/* Asset Specs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-orange-400" />
                Asset Specifications
              </h3>
              <div className="space-y-3">
                {campaign.product_hunt.asset_specs.map((spec) => (
                  <div
                    key={spec.name}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{spec.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300 font-mono">
                        {spec.dimensions}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{spec.requirement}</p>
                    <div className="pt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          spec.status === "Ready"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        Status: {spec.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Checklist */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                PH Readiness Checklist
              </h3>
              <div className="space-y-2">
                {campaign.product_hunt.checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start space-x-2.5 text-xs text-slate-300 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleTogglePhChecklist(item.id)}
                      className="mt-0.5 rounded border-slate-700 text-orange-500 focus:ring-orange-400"
                    />
                    <span className={item.completed ? "line-through text-slate-500" : ""}>
                      {item.task}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: 20-Person Beta Tester Mobilization Tracker */}
      {activeTab === "testers" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  20-Person Technical Beta Tester Mobilization
                </h3>
                <p className="text-xs text-slate-400">
                  Critical early-hour authentic technical discourse mobilization
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search tester, handle, skill..."
                  value={testerSearch}
                  onChange={(e) => setTesterSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                <select
                  value={testerPlatformFilter}
                  onChange={(e) => setTesterPlatformFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Platforms</option>
                  <option value="GitHub">GitHub</option>
                  <option value="HN">HN</option>
                  <option value="X">X</option>
                  <option value="Discord">Discord</option>
                </select>

                <select
                  value={testerStatusFilter}
                  onChange={(e) => setTesterStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Identified">Identified</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Committed">Committed</option>
                  <option value="Feedback Received">Feedback Received</option>
                  <option value="Active on Launch Day">Active on Launch Day</option>
                </select>
              </div>
            </div>

            {/* Tester Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Tester</th>
                    <th className="py-2.5 px-3">Platform</th>
                    <th className="py-2.5 px-3">Specialty</th>
                    <th className="py-2.5 px-3">Outreach Status</th>
                    <th className="py-2.5 px-3">Personalized Angle / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTesters.map((tester) => (
                    <tr key={tester.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 font-medium text-white">
                        <div>{tester.name}</div>
                        <div className="text-[11px] text-slate-500">{tester.handle}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            tester.platform === "GitHub"
                              ? "bg-purple-500/20 text-purple-300"
                              : tester.platform === "HN"
                                ? "bg-orange-500/20 text-orange-300"
                                : tester.platform === "X"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-indigo-500/20 text-indigo-300"
                          }`}
                        >
                          {tester.platform}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{tester.specialty}</td>
                      <td className="py-2.5 px-3">
                        <select
                          value={tester.outreach_status}
                          onChange={(e) => handleUpdateTesterStatus(tester.id, e.target.value)}
                          className={`rounded px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer ${
                            tester.outreach_status === "Active on Launch Day"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : tester.outreach_status === "Committed"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : tester.outreach_status === "Feedback Received"
                                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                  : tester.outreach_status === "Contacted"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          <option value="Identified">Identified</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Committed">Committed</option>
                          <option value="Feedback Received">Feedback Received</option>
                          <option value="Active on Launch Day">Active on Launch Day</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        <input
                          type="text"
                          defaultValue={tester.notes}
                          onBlur={(e) => handleUpdateTesterNotes(tester.id, e.target.value)}
                          placeholder="Add personalized angle..."
                          className="bg-transparent hover:bg-slate-950 focus:bg-slate-950 border-b border-transparent focus:border-emerald-500 px-1.5 py-0.5 text-xs text-slate-300 w-full focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Cross-Channel Syndication */}
      {activeTab === "syndication" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaign.syndication_checklist.map((item) => (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition ${
                  item.completed
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300">
                      {item.platform}
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.blurb, item.id)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                      title="Copy channel blurb"
                    >
                      {copiedKey === item.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-cyan-300/80 mb-3 italic">{item.instructions}</p>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {item.blurb}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleChecklist(item.id)}
                      className="rounded border-slate-700 text-purple-500 focus:ring-purple-400"
                    />
                    <span className={item.completed ? "text-emerald-400 font-medium" : ""}>
                      {item.completed ? "Syndication Dispatched" : "Mark as Dispatched"}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {item.completed ? "Ready" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
