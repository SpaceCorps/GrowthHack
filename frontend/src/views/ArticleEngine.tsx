import React, { useState, useEffect } from "react";
import type { Article, EngagementHistoryResponse, EngagementMilestoneAlert } from "../types";
import {
  Sparkles,
  BookOpen,
  Share2,
  Send,
  Copy,
  Check,
  Filter,
  Wand2,
  Globe,
  Flame,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Award,
  Trophy,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { EngagementVelocityChart } from "../components/EngagementVelocityChart";
import { ActionButton } from "../components/ActionButton";

export interface ArticleEngineProps {
  articles: Article[];
  onGenerateArticle: (
    feature: string,
    angle: string,
    channel: string,
    extra: string,
    timeoutSecs?: number,
  ) => void;
  onGenerateSpotlight?: (payload: {
    project_name: string;
    repo_url: string;
    tagline: string;
    key_features: string[];
    target_channel: string;
    extra_notes?: string;
    timeout_secs?: number;
  }) => void;
  onSelectArticle: (
    article: Article,
    initialTab?: "content" | "raw" | "backlinks" | "export" | "engagement",
  ) => void;
  onUpdateStatus: (id: string, status: "Draft" | "Ready" | "Published") => void;
  onSyncMetrics?: () => Promise<void> | void;
  onResetEngagement?: () => Promise<void> | void;
}

export const ArticleEngine: React.FC<ArticleEngineProps> = ({
  articles,
  onGenerateArticle,
  onGenerateSpotlight,
  onSelectArticle,
  onUpdateStatus,
  onSyncMetrics,
  onResetEngagement,
}) => {
  const [mode, setMode] = useState<"feature" | "spotlight">("feature");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [resetBanner, setResetBanner] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [globalHistory, setGlobalHistory] = useState<EngagementHistoryResponse | null>(null);
  const [alerts, setAlerts] = useState<EngagementMilestoneAlert[]>([]);
  const [syncCelebration, setSyncCelebration] = useState<string | null>(null);

  const fetchGlobalHistory = async () => {
    try {
      const res = await fetch("/api/articles/engagement-history");
      if (res.ok) {
        const data: EngagementHistoryResponse = await res.json();
        setGlobalHistory(data);
      }
    } catch {
      // Graceful fallback if endpoint is unreachable or mocked
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/articles/alerts?unacknowledged=true");
      if (res.ok) {
        const data: EngagementMilestoneAlert[] = await res.json();
        setAlerts(data);
      }
    } catch {
      // Graceful fallback if endpoint is unreachable or mocked
    }
  };

  useEffect(() => {
    fetchGlobalHistory();
    fetchAlerts();
  }, []);

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      await fetch(`/api/articles/alerts/${id}/acknowledge`, { method: "POST" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // Graceful fallback
    }
  };

  const handleAcknowledgeAllAlerts = async () => {
    try {
      await fetch("/api/articles/alerts/acknowledge-all", { method: "POST" });
      setAlerts([]);
    } catch {
      // Graceful fallback
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      if (onSyncMetrics) {
        await onSyncMetrics();
      } else {
        const res = await fetch("/api/articles/sync-metrics", { method: "POST" });
        if (!res.ok) {
          throw new Error(`Sync failed with status ${res.status}`);
        }
        try {
          const summary = await res.json();
          if (
            summary &&
            typeof summary.new_alerts_count === "number" &&
            summary.new_alerts_count > 0
          ) {
            setSyncCelebration(
              `${summary.new_alerts_count} new milestone alert${summary.new_alerts_count > 1 ? "s" : ""} triggered! New badges unlocked.`,
            );
          }
        } catch {
          // ignore
        }
      }
      fetchGlobalHistory().catch(() => {});
      fetchAlerts().catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetAllEngagement = async () => {
    setIsResettingAll(true);
    try {
      const res = await fetch("/api/articles/reset-engagement", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Reset failed with status ${res.status}`);
      }
      let msg =
        "Reset all article engagement metrics, milestone alerts, and global snapshots to zero.";
      try {
        const data = await res.json();
        if (data?.message) {
          msg = data.message;
        }
      } catch {
        // ignore
      }
      if (onResetEngagement) {
        await onResetEngagement();
      }
      fetchGlobalHistory().catch(() => {});
      fetchAlerts().catch(() => {});
      setResetBanner(msg);
      setTimeout(() => {
        setResetBanner(null);
      }, 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setResetBanner(`Error: ${msg}`);
      setTimeout(() => {
        setResetBanner(null);
      }, 5000);
    } finally {
      setIsResettingAll(false);
    }
  };

  // Reader Engagement aggregates across all syndicated articles
  const totalViews = articles.reduce((acc, a) => {
    if (a.engagement) return acc + (a.engagement.views || 0);
    const expViews = a.exports?.reduce((sum, e) => sum + (e.engagement?.views || 0), 0) || 0;
    return acc + expViews;
  }, 0);

  const totalReactions = articles.reduce((acc, a) => {
    if (a.engagement) return acc + (a.engagement.reactions || 0);
    const expReactions =
      a.exports?.reduce((sum, e) => sum + (e.engagement?.reactions || 0), 0) || 0;
    return acc + expReactions;
  }, 0);

  const totalComments = articles.reduce((acc, a) => {
    if (a.engagement) return acc + (a.engagement.comments || 0);
    const expComments = a.exports?.reduce((sum, e) => sum + (e.engagement?.comments || 0), 0) || 0;
    return acc + expComments;
  }, 0);

  const latestSyncAt = articles.reduce<string | undefined>((latest, a) => {
    const candidates = [
      a.engagement?.last_synced_at,
      ...(a.exports?.map((e) => e.engagement?.last_synced_at) || []),
    ].filter(Boolean) as string[];
    for (const ts of candidates) {
      if (!latest || ts > latest) {
        latest = ts;
      }
    }
    return latest;
  }, undefined);

  // Feature Article Form State
  const [selectedFeature, setSelectedFeature] = useState("Worktrees");
  const [selectedAngle, setSelectedAngle] = useState("Architecture");
  const [selectedChannel, setSelectedChannel] = useState("Website");
  const [extraContext, setExtraContext] = useState("");
  const [timeoutSecs, setTimeoutSecs] = useState("");

  // Project Spotlight Form State
  const [projectName, setProjectName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [spotlightChannel, setSpotlightChannel] = useState("LinkedIn");
  const [extraNotes, setExtraNotes] = useState("");
  const [spotlightTimeoutSecs, setSpotlightTimeoutSecs] = useState("");

  // Filters State
  const [filterFeed, setFilterFeed] = useState<"all" | "features" | "spotlights">("all");
  const [filterFeature, setFilterFeature] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const features = [
    { id: "Worktrees", label: "Git Worktree Isolation" },
    { id: "Multi-Agent Orchestration", label: "Multi-Agent Orchestration (Claude, Codex, Gemini)" },
    { id: "Issue-to-PR", label: "GitHub Issue to Verified PR" },
    { id: "Verification Gates", label: "Automated Verification Gates & Self-Correction" },
    { id: "Voice Control", label: "Hands-Free Voice-Driven Coding" },
    { id: "Tunneling", label: "Secure Tunneling & Remote Web Preview" },
    { id: "Review & Diffs", label: "Visual Annotations & Diff Inspection" },
  ];

  const angles = [
    { id: "Architecture", label: "Deep Architectural Breakdown" },
    { id: "Benchmark", label: "Empirical Benchmark & Cost Study" },
    { id: "Comparison", label: "Head-to-Head Comparison (vs Cline/OpenHands)" },
    { id: "Tutorial", label: "15-Minute Golden Path Tutorial" },
    { id: "Postmortem", label: "Production Failure Postmortem" },
    { id: "Ecosystem", label: "Open Source Ecosystem Commentary" },
    { id: "Migration", label: "Migration Guide: Copilot to Multi-Agent" },
    { id: "Security", label: "Security & Sandboxing Deep Dive" },
    { id: "TokenEconomics", label: "ROI & Token Economics Analysis" },
    { id: "Manifesto", label: "Engineering Manifesto" },
  ];

  const channels = ["Website", "Dev.to", "Hashnode", "Medium", "Substack", "XThread", "Reddit"];
  const spotlightChannels = ["LinkedIn", "XThread", "Reddit", "Dev.to"];

  const filteredArticles = articles.filter((art) => {
    const isSpotlight =
      art.angle === "Project Spotlight" || art.feature === "Open Source Spotlight";
    if (filterFeed === "features" && isSpotlight) return false;
    if (filterFeed === "spotlights" && !isSpotlight) return false;

    const matchesFeature = filterFeature === "all" || art.feature.includes(filterFeature);
    const matchesStatus = filterStatus === "all" || art.status === filterStatus;
    return matchesFeature && matchesStatus;
  });

  const handleGenerateFeature = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTimeout = timeoutSecs.trim() ? parseInt(timeoutSecs.trim(), 10) : undefined;
    const validTimeout =
      parsedTimeout &&
      Number.isFinite(parsedTimeout) &&
      parsedTimeout >= 10 &&
      parsedTimeout <= 3600
        ? parsedTimeout
        : undefined;
    if (validTimeout !== undefined) {
      onGenerateArticle(
        selectedFeature,
        selectedAngle,
        selectedChannel,
        extraContext,
        validTimeout,
      );
    } else {
      onGenerateArticle(selectedFeature, selectedAngle, selectedChannel, extraContext);
    }
    setExtraContext("");
    setTimeoutSecs("");
  };

  const handleGenerateSpotlight = (e: React.FormEvent) => {
    e.preventDefault();
    const splitFeatures = keyFeatures
      .split(/[\n,]+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const parsedTimeout = spotlightTimeoutSecs.trim()
      ? parseInt(spotlightTimeoutSecs.trim(), 10)
      : undefined;
    const validTimeout =
      parsedTimeout &&
      Number.isFinite(parsedTimeout) &&
      parsedTimeout >= 10 &&
      parsedTimeout <= 3600
        ? parsedTimeout
        : undefined;

    const payload = {
      project_name: projectName,
      repo_url: repoUrl,
      tagline,
      key_features:
        splitFeatures.length > 0 ? splitFeatures : ["Zero configuration", "Open source"],
      target_channel: spotlightChannel,
      extra_notes: extraNotes || undefined,
      ...(validTimeout !== undefined ? { timeout_secs: validTimeout } : {}),
    };

    if (onGenerateSpotlight) {
      onGenerateSpotlight(payload);
    } else {
      fetch("/api/articles/generate-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => console.error("Error generating spotlight:", err));
    }

    setProjectName("");
    setRepoUrl("");
    setTagline("");
    setKeyFeatures("");
    setExtraNotes("");
    setSpotlightTimeoutSecs("");
  };

  const handleCopyMarkdown = (e: React.MouseEvent, art: Article) => {
    e.stopPropagation();
    navigator.clipboard.writeText(art.content);
    setCopiedId(art.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Generator Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Form */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          {/* Mode Switcher Tab Bar */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setMode("feature")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === "feature"
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-950/20"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>10x Feature Articles (Issue #1)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("spotlight")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === "spotlight"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-950"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Cool Project Spotlight (Issue #17)</span>
            </button>
          </div>

          {mode === "feature" ? (
            <>
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Wand2 className="w-4 h-4" />
                <span>10x Content Generator // Antigravity Engine</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Draft Authority Articles with Built-in Citations & Backlinks
              </h2>
              <p className="text-xs text-slate-400">
                Select a core Tendril capability and archetype. Antigravity will draft an
                engineering-grade post citing 3+ official docs and inserting natural backlink
                anchors to the Tendril repo.
              </p>

              <form onSubmit={handleGenerateFeature} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Feature Selector */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Tendril Feature
                    </label>
                    <select
                      value={selectedFeature}
                      onChange={(e) => setSelectedFeature(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                    >
                      {features.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Content Angle */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Content Angle</label>
                    <select
                      value={selectedAngle}
                      onChange={(e) => setSelectedAngle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                    >
                      {angles.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Channel */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Target Channel
                    </label>
                    <select
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                    >
                      {channels.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Extra Context */}
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Extra Instructions / Specific Repo URLs (Optional)
                  </label>
                  <input
                    type="text"
                    value={extraContext}
                    onChange={(e) => setExtraContext(e.target.value)}
                    placeholder="e.g. Compare against Claude Code CLI v0.2.29, include SWE-bench verified statistics..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Custom Timeout */}
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Runner Timeout in Seconds (Optional)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    value={timeoutSecs}
                    onChange={(e) => setTimeoutSecs(e.target.value)}
                    placeholder="Default (300s)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Auto-inserts: 3+ Primary Citations + 2 Tendril Backlinks</span>
                  </div>

                  <ActionButton
                    type="submit"
                    size="md"
                    icon={<Sparkles className="w-4 h-4" />}
                    className="hover:scale-[1.02]"
                  >
                    Generate with Antigravity
                  </ActionButton>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Flame className="w-4 h-4" />
                <span>Stanislav Beliaev Style Spotlight // Viral Open-Source Generator</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Craft Punchy Open-Source Spotlights with Tendril Signature Note
              </h2>
              <p className="text-xs text-slate-400">
                Generates high-engagement social posts celebrating exciting developer tools,
                concluding with our signature Ivy-Tendril note.
              </p>

              <form onSubmit={handleGenerateSpotlight} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Project Name</label>
                    <input
                      type="text"
                      required
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. OpenBot, E2B, browser-use"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      GitHub Repository URL
                    </label>
                    <input
                      type="url"
                      required
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/e2b-dev/E2B"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">
                      Opening Hook / Differentiator
                    </label>
                    <input
                      type="text"
                      required
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Runs on your own machine without cloud lock-in"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Target Channel
                    </label>
                    <select
                      value={spotlightChannel}
                      onChange={(e) => setSpotlightChannel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-amber-500"
                    >
                      {spotlightChannels.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Key Highlights / Architecture Notes
                  </label>
                  <input
                    type="text"
                    required
                    value={keyFeatures}
                    onChange={(e) => setKeyFeatures(e.target.value)}
                    placeholder="Isolated containers, CEL policy rules, self-hosted"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Extra Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder="e.g. Include benchmark against traditional Docker sandbox"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Runner Timeout in Seconds (Optional)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    value={spotlightTimeoutSecs}
                    onChange={(e) => setSpotlightTimeoutSecs(e.target.value)}
                    placeholder="Default (300s)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Stanislav Beliaev Format Callout */}
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300/90 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Stanislav Beliaev Format Anatomy</span>
                  </div>
                  <p className="text-slate-400">
                    Includes viral hook (🔥), punchy 1-2 sentence technical breakdowns, &ldquo;MIT
                    licensed, self-hosted, your Postgres...&rdquo; and mandatory Tendril note:
                  </p>
                  <div className="font-mono text-[10px] text-amber-200/80 bg-slate-950/60 p-2 rounded border border-amber-900/40">
                    --
                    <br />
                    P.S. We are building Ivy-Tendril, an autonomous multi-agent coding factory that
                    plans tasks, orchestrates agents in isolated Git worktrees, and produces
                    verified PRs. Try it locally or explore the repo -&gt;
                    https://github.com/Ivy-Interactive/Ivy-Tendril
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Routes directly into Human Approval Review Queue as Draft
                  </span>

                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950 transition-all hover:scale-[1.02]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Spotlight with Antigravity</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Backlink & Stats Card */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
              <BookOpen className="w-4 h-4" />
              <span>Content Authority Metrics</span>
            </div>
            <h3 className="text-lg font-bold text-white">Daily 10x Velocity</h3>
            <p className="text-xs text-slate-400 mt-1">
              Aim for 10 articles and project spotlights per day across developer publishing
              platforms to saturate organic search intent.
            </p>

            <div className="mt-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Drafted Articles:</span>
                <span className="font-bold text-slate-200">{articles.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Project Spotlights:</span>
                <span className="font-bold text-amber-400">
                  {
                    articles.filter(
                      (a) =>
                        a.angle === "Project Spotlight" || a.feature === "Open Source Spotlight",
                    ).length
                  }
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Published to Web:</span>
                <span className="font-bold text-emerald-400">
                  {articles.filter((a) => a.status === "Published").length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Total Backlink Anchors:</span>
                <span className="font-bold text-cyan-300">
                  {articles.reduce((acc, a) => acc + a.backlinks.length, 0)}
                </span>
              </div>
            </div>

            {/* Reader Engagement Section */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Reader Engagement</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={isSyncing || isResettingAll}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    title="Sync reader engagement metrics from Dev.to and Hashnode"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Sync Metrics"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAllEngagement}
                    disabled={isResettingAll || isSyncing}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    title="Reset all workspace engagement metrics, snapshots, and badges to zero"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isResettingAll ? "animate-spin" : ""}`} />
                    <span>{isResettingAll ? "Resetting..." : "Reset All Metrics"}</span>
                  </button>
                </div>
              </div>

              {resetBanner && (
                <div
                  className={`mb-3 p-2 rounded text-[11px] flex items-center justify-between ${
                    resetBanner.startsWith("Error:")
                      ? "bg-rose-950/50 border border-rose-800 text-rose-300"
                      : "bg-emerald-950/50 border border-emerald-800 text-emerald-300"
                  }`}
                >
                  <span>{resetBanner}</span>
                  <button
                    type="button"
                    onClick={() => setResetBanner(null)}
                    className="ml-2 text-slate-400 hover:text-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {syncError && (
                <div className="mb-3 p-2 rounded bg-rose-950/50 border border-rose-800 text-[11px] text-rose-300">
                  {syncError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 font-mono text-xs mb-3">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[10px] text-slate-400 uppercase">Total Views</span>
                  <span className="text-base font-bold text-cyan-400 mt-0.5">{totalViews}</span>
                  {globalHistory?.velocity && (
                    <span
                      className="text-[10px] text-cyan-300 font-mono mt-0.5"
                      title="Daily velocity"
                    >
                      +{globalHistory.velocity.views_per_day.toFixed(1)}/day
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[10px] text-slate-400 uppercase">Total Reactions</span>
                  <span className="text-base font-bold text-pink-400 mt-0.5">{totalReactions}</span>
                  {globalHistory?.velocity && (
                    <span
                      className="text-[10px] text-pink-300 font-mono mt-0.5"
                      title="Daily velocity"
                    >
                      +{globalHistory.velocity.reactions_per_day.toFixed(1)}/day
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[10px] text-slate-400 uppercase">Total Comments</span>
                  <span className="text-base font-bold text-emerald-400 mt-0.5">
                    {totalComments}
                  </span>
                  {globalHistory?.velocity && (
                    <span
                      className="text-[10px] text-emerald-300 font-mono mt-0.5"
                      title="Daily velocity"
                    >
                      +{globalHistory.velocity.comments_per_day.toFixed(1)}/day
                    </span>
                  )}
                </div>
              </div>

              {/* Velocity & Trend Trajectory Summary */}
              {globalHistory?.velocity && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Trend Trajectory:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        globalHistory.velocity.trend === "Accelerating"
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                          : globalHistory.velocity.trend === "Steady"
                            ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                            : globalHistory.velocity.trend === "Decelerating"
                              ? "bg-amber-950/80 text-amber-300 border-amber-800"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {globalHistory.velocity.trend === "Accelerating" && (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      )}
                      {globalHistory.velocity.trend === "Steady" && (
                        <Activity className="w-3 h-3 text-cyan-400" />
                      )}
                      {globalHistory.velocity.trend === "Decelerating" && (
                        <TrendingDown className="w-3 h-3 text-amber-400" />
                      )}
                      {globalHistory.velocity.trend === "Flat" && (
                        <Minus className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{globalHistory.velocity.trend}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60 font-mono">
                    <span>24h Net Delta:</span>
                    <span className="text-slate-200">
                      +{globalHistory.velocity.views_24h} views, +
                      {globalHistory.velocity.reactions_24h} reacts, +
                      {globalHistory.velocity.comments_24h} comments
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Last Synced:</span>
                <span className="font-mono text-slate-300">
                  {latestSyncAt ? new Date(latestSyncAt).toLocaleString() : "Never"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Tip: Dev.to and Hashnode syndicate canonical URLs back to Ivy-Tendril website to
            transfer SEO equity.
          </div>
        </div>
      </div>

      {/* Global Historical Engagement Velocity Chart */}
      <div className="mt-6 mb-2">
        <EngagementVelocityChart
          snapshots={globalHistory?.snapshots || []}
          velocity={globalHistory?.velocity}
          onSyncTrigger={handleSync}
          isSyncing={isSyncing}
          title="Global Engagement Velocity & Trend Trajectory"
        />
      </div>

      {/* Sync Celebration Feedback Banner */}
      {syncCelebration && (
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-950/90 via-cyan-950/80 to-slate-900 border border-emerald-500/50 shadow-lg flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <span className="font-bold text-white block text-sm">
                Engagement Milestone Unlocked!
              </span>
              <span className="text-emerald-200">{syncCelebration}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSyncCelebration(null)}
            className="text-xs px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Milestone Alerts Notification Strip */}
      {alerts.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-slate-900/90 border border-amber-500/40 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Milestone Achievement Alerts ({alerts.length})</span>
            </div>
            <button
              type="button"
              onClick={handleAcknowledgeAllAlerts}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dismiss All</span>
            </button>
          </div>

          <div className="space-y-2">
            {alerts.map((alert) => {
              const lower = alert.badge_awarded.toLowerCase();
              const badgeStyle = lower.includes("view")
                ? "bg-amber-950/80 text-amber-300 border-amber-800"
                : lower.includes("react")
                  ? "bg-pink-950/80 text-pink-300 border-pink-800"
                  : lower.includes("comment")
                    ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                    : "bg-purple-950/80 text-purple-300 border-purple-800";

              return (
                <div
                  key={alert.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs gap-3"
                >
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold border inline-flex items-center gap-1 ${badgeStyle}`}
                    >
                      <Award className="w-2.5 h-2.5" />
                      <span>{alert.badge_awarded}</span>
                    </span>
                    <span className="font-semibold text-white truncate">{alert.article_title}</span>
                    <span className="text-slate-400 truncate hidden md:inline">
                      {alert.message}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] ml-auto whitespace-nowrap">
                      {new Date(alert.triggered_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors self-end sm:self-auto"
                  >
                    <Check className="w-3 h-3" />
                    <span>Acknowledge</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Feed Filter Buttons */}
          <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterFeed("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterFeed === "all"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Articles
            </button>
            <button
              type="button"
              onClick={() => setFilterFeed("features")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterFeed === "features"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              10x Feature Articles
            </button>
            <button
              type="button"
              onClick={() => setFilterFeed("spotlights")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterFeed === "spotlights"
                  ? "bg-amber-950 text-amber-300 border border-amber-800"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Project Spotlights
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterFeature}
              onChange={(e) => setFilterFeature(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Features</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="Published">Published</option>
              <option value="Ready">Ready</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredArticles.length} of {articles.length} articles
        </span>
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {filteredArticles.map((article) => {
          const isSpotlight =
            article.angle === "Project Spotlight" || article.feature === "Open Source Spotlight";

          return (
            <div
              key={article.id}
              onClick={() => onSelectArticle(article)}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-emerald-500/40 cursor-pointer transition-all group shadow-sm hover:shadow-md gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  {isSpotlight ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800">
                      Project Spotlight
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                      {article.feature}
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                    {article.channel}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-400">
                    {article.angle}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      article.status === "Published"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : article.status === "Ready"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {article.status}
                  </span>
                  {article.engagement_badges?.map((badge) => {
                    const lower = badge.toLowerCase();
                    const badgeStyle = lower.includes("view")
                      ? "bg-amber-950/80 text-amber-300 border-amber-800"
                      : lower.includes("react")
                        ? "bg-pink-950/80 text-pink-300 border-pink-800"
                        : lower.includes("comment")
                          ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                          : "bg-purple-950/80 text-purple-300 border-purple-800";
                    return (
                      <span
                        key={badge}
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold border inline-flex items-center gap-1 ${badgeStyle}`}
                      >
                        <Award className="w-2.5 h-2.5" />
                        <span>{badge}</span>
                      </span>
                    );
                  })}
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                  {article.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-1">{article.summary}</p>

                <div className="flex items-center space-x-4 text-[11px] text-slate-500 pt-1 font-mono">
                  <span>Inbound Links: {article.backlinks.length}</span>
                  <span>•</span>
                  <span>Citations: {article.outbound_citations.length}</span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(article.id, "Draft");
                    }}
                    className="text-cyan-400 hover:text-cyan-300 underline font-sans flex items-center space-x-1"
                    title="Send item to human review queue as pending Draft"
                  >
                    <span>Send to Review Queue</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {/* Export Status Indicators */}
                {article.exports && article.exports.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                      Exported:
                    </span>
                    {Array.from(new Set(article.exports.map((e) => e.channel))).map((ch) => {
                      const latestRecord = [...article.exports!]
                        .reverse()
                        .find((e) => e.channel === ch);
                      const remoteUrl =
                        latestRecord?.target_path &&
                        (latestRecord.target_path.startsWith("http://") ||
                          latestRecord.target_path.startsWith("https://"))
                          ? latestRecord.target_path
                          : null;

                      return (
                        <div key={ch} className="inline-flex items-center gap-1.5 flex-wrap">
                          {remoteUrl ? (
                            <a
                              href={remoteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors shadow-sm"
                              title={`Open syndicated post on ${ch}: ${remoteUrl}`}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{ch}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-800/80">
                              <Check className="w-2.5 h-2.5 text-cyan-400" />
                              <span>{ch}</span>
                            </span>
                          )}
                          {latestRecord?.engagement && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-950/80 text-cyan-300 border border-slate-800 shadow-sm"
                              title={`${ch} engagement: ${latestRecord.engagement.views} views, ${latestRecord.engagement.reactions} reactions, ${latestRecord.engagement.comments} comments`}
                            >
                              <span>
                                {ch}: {latestRecord.engagement.views} views •{" "}
                                {latestRecord.engagement.reactions} reactions •{" "}
                                {latestRecord.engagement.comments} comments
                              </span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectArticle(article, "engagement");
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-pink-950/70 hover:bg-pink-900 text-pink-300 border border-pink-800 text-xs font-semibold transition-colors"
                  title="Inspect Historical Engagement & Velocity"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Velocity</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectArticle(article, "export");
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-semibold transition-colors"
                  title="Export & Syndicate"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleCopyMarkdown(e, article)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  title="Copy Markdown"
                >
                  {copiedId === article.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedId === article.id ? "Copied" : "Copy"}</span>
                </button>

                {article.status !== "Published" && (
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(article.id, "Published");
                    }}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    Publish
                  </ActionButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
