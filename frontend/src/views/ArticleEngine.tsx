import React, { useState } from "react";
import type { Article } from "../types";
import { Sparkles, BookOpen, Send, Copy, Check, Filter, Wand2, Globe } from "lucide-react";

interface ArticleEngineProps {
  articles: Article[];
  onGenerateArticle: (feature: string, angle: string, channel: string, extra: string) => void;
  onSelectArticle: (article: Article) => void;
  onUpdateStatus: (id: string, status: "Draft" | "Ready" | "Published") => void;
}

export const ArticleEngine: React.FC<ArticleEngineProps> = ({
  articles,
  onGenerateArticle,
  onSelectArticle,
  onUpdateStatus,
}) => {
  const [selectedFeature, setSelectedFeature] = useState("Worktrees");
  const [selectedAngle, setSelectedAngle] = useState("Architecture");
  const [selectedChannel, setSelectedChannel] = useState("Website");
  const [extraContext, setExtraContext] = useState("");
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
  ];

  const channels = ["Website", "Dev.to", "Hashnode", "Medium", "Substack", "XThread", "Reddit"];

  const filteredArticles = articles.filter((art) => {
    const matchesFeature = filterFeature === "all" || art.feature.includes(filterFeature);
    const matchesStatus = filterStatus === "all" || art.status === filterStatus;
    return matchesFeature && matchesStatus;
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateArticle(selectedFeature, selectedAngle, selectedChannel, extraContext);
    setExtraContext("");
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
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Wand2 className="w-4 h-4" />
            <span>10x Content Generator // Antigravity Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Draft Authority Articles with Built-in Citations & Backlinks
          </h2>
          <p className="text-xs text-slate-400">
            Select a core Tendril capability. Antigravity will draft an engineering-grade post
            citing official docs and inserting natural backlink anchors to the Tendril repo.
          </p>

          <form onSubmit={handleGenerate} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Feature Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tendril Feature</label>
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
                <label className="block text-slate-300 font-semibold mb-1">Target Channel</label>
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
                <span>Auto-inserts: 3+ Authority Citations + Tendril Backlinks</span>
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
              Aim for 10 articles per day across developer publishing platforms to saturate organic
              search intent.
            </p>

            <div className="mt-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Drafted Articles:</span>
                <span className="font-bold text-slate-200">{articles.length}</span>
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
            Tip: Dev.to and Hashnode syndicate canonical URLs back to Ivy-Tendril website to
            transfer SEO equity.
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <div className="flex items-center space-x-3 text-xs">
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

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredArticles.length} of {articles.length} articles
        </span>
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {filteredArticles.map((article) => (
          <div
            key={article.id}
            onClick={() => onSelectArticle(article)}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-emerald-500/40 cursor-pointer transition-all group shadow-sm hover:shadow-md gap-4"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  {article.feature}
                </span>
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
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
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
        ))}
      </div>
    </div>
  );
};
