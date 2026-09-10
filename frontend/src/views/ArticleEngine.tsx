import React, { useState } from "react";
import type { Article } from "../types";
import {
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Filter,
  Wand2,
  Globe,
  Flame,
  Send,
  ExternalLink,
} from "lucide-react";

export interface ArticleEngineProps {
  articles: Article[];
  onGenerateArticle: (feature: string, angle: string, channel: string, extra: string) => void;
  onGenerateSpotlight?: (payload: {
    project_name: string;
    repo_url: string;
    tagline: string;
    key_features: string[];
    target_channel: string;
    extra_notes?: string;
  }) => void;
  onSelectArticle: (article: Article) => void;
  onUpdateStatus: (id: string, status: "Draft" | "Ready" | "Published") => void;
}

export const ArticleEngine: React.FC<ArticleEngineProps> = ({
  articles,
  onGenerateArticle,
  onGenerateSpotlight,
  onSelectArticle,
  onUpdateStatus,
}) => {
  const [mode, setMode] = useState<"feature" | "spotlight">("feature");

  // Feature Article Form State
  const [selectedFeature, setSelectedFeature] = useState("Worktrees");
  const [selectedAngle, setSelectedAngle] = useState("Architecture");
  const [selectedChannel, setSelectedChannel] = useState("Website");
  const [extraContext, setExtraContext] = useState("");

  // Project Spotlight Form State
  const [projectName, setProjectName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [spotlightChannel, setSpotlightChannel] = useState("LinkedIn");
  const [extraNotes, setExtraNotes] = useState("");

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
    onGenerateArticle(selectedFeature, selectedAngle, selectedChannel, extraContext);
    setExtraContext("");
  };

  const handleGenerateSpotlight = (e: React.FormEvent) => {
    e.preventDefault();
    const splitFeatures = keyFeatures
      .split(/[\n,]+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const payload = {
      project_name: projectName,
      repo_url: repoUrl,
      tagline,
      key_features:
        splitFeatures.length > 0 ? splitFeatures : ["Zero configuration", "Open source"],
      target_channel: spotlightChannel,
      extra_notes: extraNotes || undefined,
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
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950"
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

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Auto-inserts: 3+ Primary Citations + 2 Tendril Backlinks</span>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all hover:scale-[1.02]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate with Antigravity</span>
                  </button>
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
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Tip: All generated drafts route to the Review Queue before multi-channel syndication.
          </div>
        </div>
      </div>

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
              </div>

              {/* Quick Actions */}
              <div className="flex items-center space-x-2 shrink-0">
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(article.id, "Published");
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
