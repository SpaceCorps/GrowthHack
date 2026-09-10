import React, { useState } from "react";
import type { Article, TrendTopic } from "../types";
import {
  Radio,
  Sparkles,
  ExternalLink,
  Send,
  Flame,
  MessageSquare,
  Globe,
  Sliders,
  CheckCircle2,
  Zap,
  Lightbulb,
  BookOpen,
  ChevronDown,
  Copy,
  Check,
  Eye,
  Clock,
  CheckCircle,
} from "lucide-react";

interface TrendRadarProps {
  trends: TrendTopic[];
  articles: Article[];
  onScoutTrends: (mode?: "general" | "discussions") => void;
  onSynthesizeTrend: (id: string, tieIn: "direct" | "subtle" | "none", channel: string) => void;
  onSelectArticle: (article: Article) => void;
  onUpdateArticleStatus: (id: string, status: "Draft" | "Ready" | "Published") => void;
}

export const TrendRadar: React.FC<TrendRadarProps> = ({
  trends,
  articles,
  onScoutTrends,
  onSynthesizeTrend,
  onSelectArticle,
  onUpdateArticleStatus,
}) => {
  const [selectedTieIn, setSelectedTieIn] = useState<Record<string, "direct" | "subtle" | "none">>(
    {},
  );
  const [selectedChannel, setSelectedChannel] = useState<Record<string, string>>({});
  const [expandedCustom, setExpandedCustom] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getTieIn = (id: string) => selectedTieIn[id] || "direct";
  const getChannel = (id: string) => selectedChannel[id] || "Website";

  const toggleCustomOptions = (id: string) => {
    setExpandedCustom((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyMarkdown = (e: React.MouseEvent, art: Article) => {
    e.stopPropagation();
    navigator.clipboard.writeText(art.content);
    setCopiedId(art.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter articles awaiting human review (Ready or Draft)
  const pendingArticles = articles.filter((a) => a.status === "Ready" || a.status === "Draft");

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "GitHub":
        return (
          <svg className="w-4 h-4 text-purple-400 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        );
      case "Reddit":
        return <MessageSquare className="w-4 h-4 text-orange-400" />;
      case "LinkedIn":
        return (
          <svg className="w-4 h-4 text-sky-400 fill-current" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
        );
      default:
        return <Globe className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Dual Scouting Controls */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Multi-Source Trend Radar & Discussion Harvester // Issues #9 & #6</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Autonomous Trend Radar & Social Harvester
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Scans GitHub Trending, Reddit discussions, and tech debates across r/LocalLLaMA,
            r/programming, and r/ClaudeAI. Antigravity synthesizes viral topics into authoritative
            articles streaming directly into the Human Approval Queue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-auto">
          <button
            onClick={() => onScoutTrends("general")}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 transition-all hover:scale-[1.02]"
            title="Scout GitHub Trending, Reddit, and LinkedIn narratives"
          >
            <Sparkles className="w-4 h-4" />
            <span>Scout Today's Trends</span>
          </button>

          <button
            onClick={() => onScoutTrends("discussions")}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950 transition-all hover:scale-[1.02]"
            title="Harvest developer complaints around worktrees, merge collisions & sandboxes (Issue #6)"
          >
            <Flame className="w-4 h-4 text-amber-200" />
            <span>Harvester: Discussions (Issue #6)</span>
          </button>
        </div>
      </div>

      {/* Human Approval Queue Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800/80 text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">Human Approval Queue</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {pendingArticles.length} awaiting review
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Newly synthesized trend articles queued for editorial approval before public
                syndication.
              </p>
            </div>
          </div>
        </div>

        {pendingArticles.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center space-y-1">
            <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
            <p className="text-xs font-medium text-slate-300">Approval Queue is Clear</p>
            <p className="text-[11px] text-slate-500">
              Click any 1-Click Synthesis pill below to generate an article directly into this
              queue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingArticles.map((art) => (
              <div
                key={art.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                      {art.feature}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {art.channel}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-400">
                      {art.angle}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {art.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white truncate">{art.title}</h4>

                  <p className="text-xs text-slate-400 line-clamp-1">{art.summary}</p>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
                    <span>Backlinks: {art.backlinks.length}</span>
                    <span>•</span>
                    <span>Citations: {art.outbound_citations.length}</span>
                  </div>
                </div>

                {/* 1-Click Actions for Human Approval Queue */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onSelectArticle(art)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                    title="Quick review article content"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Quick Review</span>
                  </button>

                  <button
                    onClick={(e) => handleCopyMarkdown(e, art)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                    title="Copy Markdown for syndication"
                  >
                    {copiedId === art.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{copiedId === art.id ? "Copied" : "Copy MD"}</span>
                  </button>

                  <button
                    onClick={() => onUpdateArticleStatus(art.id, "Published")}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 transition-all hover:scale-[1.02]"
                    title="Approve and mark article published"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>1-Click Approve & Publish</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strategy Explainer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Direct Tendril Tie-In
          </span>
          <p className="text-slate-400 leading-relaxed">
            Explains specifically how Tendril's Git worktree isolation, multi-agent concurrency, and
            verification test gates solve developer collisions.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="font-bold text-amber-400 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            Subtle Mention
          </span>
          <p className="text-slate-400 leading-relaxed">
            Objective technical narrative mentioning Tendril as an emerging open-source reference
            for worktree-based agent execution.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="font-bold text-cyan-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            Pure Tech Commentary
          </span>
          <p className="text-slate-400 leading-relaxed">
            Pure developer commentary and architectural depth with zero product pitch, focused on
            building domain authority and citations.
          </p>
        </div>
      </div>

      {/* Trends List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Active Scouted Trends ({trends.length})</span>
          <span>Updated via Antigravity Agent</span>
        </div>

        <div className="space-y-4">
          {trends.map((trend) => (
            <div
              key={trend.id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                    {getSourceIcon(trend.source)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {trend.source} Trend
                    </span>
                    <h3 className="text-base font-bold text-white leading-snug">{trend.topic}</h3>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-amber-300 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {trend.engagement}
                  </span>

                  <a
                    href={trend.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    title="View source thread"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Context Summary */}
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/60">
                {trend.summary}
              </p>

              {/* 1-Click Synthesis Action Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onSynthesizeTrend(trend.id, "direct", "Website")}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 hover:bg-emerald-900/80 text-emerald-200 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02]"
                    title="1-Click: Synthesize with direct Tendril tie-in"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>⚡ Direct Tie-In</span>
                  </button>

                  <button
                    onClick={() => onSynthesizeTrend(trend.id, "subtle", "Website")}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-700/60 hover:bg-amber-900/80 text-amber-200 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02]"
                    title="1-Click: Synthesize with subtle industry reference"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>💡 Subtle Mention</span>
                  </button>

                  <button
                    onClick={() => onSynthesizeTrend(trend.id, "none", "Website")}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 hover:bg-cyan-900/80 text-cyan-200 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02]"
                    title="1-Click: Synthesize pure developer commentary with no pitch"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>📖 Pure Tech Commentary</span>
                  </button>

                  <button
                    onClick={() => toggleCustomOptions(trend.id)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    <span>Custom Options</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        expandedCustom[trend.id] ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {trend.status === "Published" && (
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 self-start sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Synthesized
                  </span>
                )}
              </div>

              {/* Expandable Custom Settings */}
              {expandedCustom[trend.id] && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400">Custom Angle:</span>
                      <select
                        value={getTieIn(trend.id)}
                        onChange={(e) =>
                          setSelectedTieIn((prev) => ({
                            ...prev,
                            [trend.id]: e.target.value as any,
                          }))
                        }
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="direct">Direct Tendril Solution</option>
                        <option value="subtle">Subtle Industry Reference</option>
                        <option value="none">Pure Tech Commentary (No Pitch)</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400">Custom Channel:</span>
                      <select
                        value={getChannel(trend.id)}
                        onChange={(e) =>
                          setSelectedChannel((prev) => ({
                            ...prev,
                            [trend.id]: e.target.value,
                          }))
                        }
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Website">Website Blog Post</option>
                        <option value="LinkedIn">LinkedIn Thought Leadership</option>
                        <option value="Reddit">Reddit Community Discussion</option>
                        <option value="Dev.to">Dev.to Engineering Article</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      onSynthesizeTrend(trend.id, getTieIn(trend.id), getChannel(trend.id))
                    }
                    className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Synthesize with Custom Settings</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
