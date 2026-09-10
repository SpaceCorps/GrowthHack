import React, { useState } from "react";
import type { TrendTopic } from "../types";
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
  RefreshCw,
} from "lucide-react";

interface TrendRadarProps {
  trends: TrendTopic[];
  onScoutTrends: () => void;
  onSynthesizeTrend: (id: string, tieIn: "direct" | "subtle" | "none", channel: string) => void;
}

export const TrendRadar: React.FC<TrendRadarProps> = ({
  trends,
  onScoutTrends,
  onSynthesizeTrend,
}) => {
  const [selectedTieIn, setSelectedTieIn] = useState<Record<string, "direct" | "subtle" | "none">>(
    {},
  );
  const [selectedChannel, setSelectedChannel] = useState<Record<string, string>>({});

  const getTieIn = (id: string) => selectedTieIn[id] || "direct";
  const getChannel = (id: string) => selectedChannel[id] || "Website";

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
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Multi-Source Trend Radar // Daily Newsroom</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Trend Hijacking & Thought Leadership Engine
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Scans GitHub Trending, Reddit discussions, and LinkedIn narratives. Antigravity
            synthesizes viral topics into authoritative website articles—either connecting to
            Tendril's architecture or providing pure ecosystem thought leadership.
          </p>
        </div>

        <button
          onClick={onScoutTrends}
          className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 transition-all hover:scale-[1.02] shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Scout Today's Trends</span>
        </button>
      </div>

      {/* Strategy Explainer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Direct Tendril Tie-In
          </span>
          <p className="text-slate-400 leading-relaxed">
            Identifies a specific engineering bottleneck (e.g. CLI agent merge collisions) and
            explains how Tendril's worktrees solve it.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="font-bold text-amber-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Subtle Mention
          </span>
          <p className="text-slate-400 leading-relaxed">
            High-level industry analysis referencing Tendril naturally alongside Cline and OpenHands
            without sounding promotional.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <span className="font-bold text-cyan-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pure Tech Commentary
          </span>
          <p className="text-slate-400 leading-relaxed">
            Zero product mention. Builds pure technical credibility, search volume, and high-domain
            backlinks across developer communities.
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

              {/* Synthesize Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {/* Tie-in Selector */}
                  <div className="flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">Tie-in Angle:</span>
                    <select
                      value={getTieIn(trend.id)}
                      onChange={(e) =>
                        setSelectedTieIn((prev) => ({
                          ...prev,
                          [trend.id]: e.target.value as any,
                        }))
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="direct">Direct Tendril Solution</option>
                      <option value="subtle">Subtle Industry Reference</option>
                      <option value="none">Pure Tech Commentary (No Pitch)</option>
                    </select>
                  </div>

                  {/* Channel Selector */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400">Channel:</span>
                    <select
                      value={getChannel(trend.id)}
                      onChange={(e) =>
                        setSelectedChannel((prev) => ({
                          ...prev,
                          [trend.id]: e.target.value,
                        }))
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Website">Website Blog Post</option>
                      <option value="LinkedIn">LinkedIn Thought Leadership</option>
                      <option value="Reddit">Reddit Community Discussion</option>
                    </select>
                  </div>
                </div>

                {/* Synthesize Trigger */}
                <button
                  onClick={() =>
                    onSynthesizeTrend(trend.id, getTieIn(trend.id), getChannel(trend.id))
                  }
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-950 transition-all hover:scale-[1.02] self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Synthesize to Article</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
