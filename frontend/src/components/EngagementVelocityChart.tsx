import React, { useState, useMemo } from "react";
import type { EngagementSnapshot, EngagementVelocity } from "../types";
import { TrendingUp, TrendingDown, Minus, Activity, Calendar, RefreshCw } from "lucide-react";

export interface EngagementVelocityChartProps {
  snapshots: EngagementSnapshot[];
  velocity?: EngagementVelocity;
  onSyncTrigger?: () => void;
  isSyncing?: boolean;
  compact?: boolean;
  title?: string;
}

export type ViewMode = "aggregate" | "channels";
type TimeFrame = "24h" | "7d" | "30d" | "All";
type MetricFilter = "all" | "views" | "reactions" | "comments";
export type ChannelMetric = "views" | "reactions" | "comments";

export interface ChannelConfig {
  id: string;
  name: string;
  color: string;
  gradId: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const CHANNELS: ChannelConfig[] = [
  {
    id: "Dev.to",
    name: "Dev.to",
    color: "#818cf8",
    gradId: "devtoGrad",
    badgeBg: "bg-indigo-950/80",
    badgeBorder: "border-indigo-800",
    badgeText: "text-indigo-300",
  },
  {
    id: "Hashnode",
    name: "Hashnode",
    color: "#38bdf8",
    gradId: "hashnodeGrad",
    badgeBg: "bg-sky-950/80",
    badgeBorder: "border-sky-800",
    badgeText: "text-sky-300",
  },
  {
    id: "Medium",
    name: "Medium",
    color: "#34d399",
    gradId: "mediumGrad",
    badgeBg: "bg-emerald-950/80",
    badgeBorder: "border-emerald-800",
    badgeText: "text-emerald-300",
  },
];

export const EngagementVelocityChart: React.FC<EngagementVelocityChartProps> = ({
  snapshots = [],
  velocity,
  onSyncTrigger,
  isSyncing = false,
  compact = false,
  title = "Engagement Velocity & Trend Trajectory",
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("aggregate");
  const [timeframe, setTimeframe] = useState<TimeFrame>("All");
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("all");
  const [channelMetric, setChannelMetric] = useState<ChannelMetric>("views");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sort snapshots chronologically
  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [snapshots]);

  // Filter snapshots based on selected timeframe
  const filteredSnapshots = useMemo(() => {
    if (sortedSnapshots.length === 0) return [];
    if (timeframe === "All") return sortedSnapshots;

    const latestTime = new Date(sortedSnapshots[sortedSnapshots.length - 1].timestamp).getTime();
    let durationMs = 24 * 60 * 60 * 1000;
    if (timeframe === "7d") durationMs = 7 * 24 * 60 * 60 * 1000;
    if (timeframe === "30d") durationMs = 30 * 24 * 60 * 60 * 1000;

    const cutoff = latestTime - durationMs;
    const filtered = sortedSnapshots.filter((s) => new Date(s.timestamp).getTime() >= cutoff);

    // If filter results in fewer than 2 points but original had >= 2, include previous baseline point
    if (filtered.length < 2 && sortedSnapshots.length >= 2) {
      return sortedSnapshots.slice(-2);
    }
    return filtered;
  }, [sortedSnapshots, timeframe]);

  // Chart dimensions
  const width = compact ? 500 : 640;
  const height = compact ? 160 : 220;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Max value calculation for Y scale
  const { maxVal, points } = useMemo(() => {
    if (filteredSnapshots.length === 0) {
      return { maxVal: 10, points: [] };
    }

    let highest = 0;
    if (viewMode === "aggregate") {
      for (const s of filteredSnapshots) {
        if (metricFilter === "all" || metricFilter === "views") {
          highest = Math.max(highest, s.views);
        }
        if (metricFilter === "all" || metricFilter === "reactions") {
          highest = Math.max(highest, s.reactions);
        }
        if (metricFilter === "all" || metricFilter === "comments") {
          highest = Math.max(highest, s.comments);
        }
      }
    } else {
      for (const s of filteredSnapshots) {
        for (const ch of CHANNELS) {
          const val = s.channels?.[ch.id]?.[channelMetric] ?? 0;
          highest = Math.max(highest, val);
        }
      }
    }
    const safeMax = highest > 0 ? Math.ceil(highest * 1.15) : 10;

    const startTime = new Date(filteredSnapshots[0].timestamp).getTime();
    const endTime = new Date(filteredSnapshots[filteredSnapshots.length - 1].timestamp).getTime();
    const timeSpan = Math.max(1, endTime - startTime);

    const calculatedPoints = filteredSnapshots.map((s, idx) => {
      const t = new Date(s.timestamp).getTime();
      const x =
        filteredSnapshots.length === 1
          ? padding.left + innerWidth / 2
          : padding.left + ((t - startTime) / timeSpan) * innerWidth;

      const yViews = padding.top + innerHeight - (s.views / safeMax) * innerHeight;
      const yReactions = padding.top + innerHeight - (s.reactions / safeMax) * innerHeight;
      const yComments = padding.top + innerHeight - (s.comments / safeMax) * innerHeight;

      const yChannels: Record<string, number> = {};
      for (const ch of CHANNELS) {
        const chVal = s.channels?.[ch.id]?.[channelMetric] ?? 0;
        yChannels[ch.id] = padding.top + innerHeight - (chVal / safeMax) * innerHeight;
      }

      return {
        snapshot: s,
        x,
        yViews,
        yReactions,
        yComments,
        yChannels,
        idx,
      };
    });

    return { maxVal: safeMax, points: calculatedPoints };
  }, [
    filteredSnapshots,
    viewMode,
    metricFilter,
    channelMetric,
    innerWidth,
    innerHeight,
    padding.left,
    padding.top,
  ]);

  // Path generators
  const generateLinePath = (yKey: "yViews" | "yReactions" | "yComments") => {
    if (points.length < 2) return "";
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x},${pt[yKey]}` : `${acc} L ${pt.x},${pt[yKey]}`;
    }, "");
  };

  const generateAreaPath = (yKey: "yViews" | "yReactions" | "yComments") => {
    if (points.length < 2) return "";
    const bottomY = padding.top + innerHeight;
    const linePart = generateLinePath(yKey);
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${linePart} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  const generateChannelLinePath = (channelId: string) => {
    if (points.length < 2) return "";
    return points.reduce((acc, pt, i) => {
      const y = pt.yChannels[channelId] ?? padding.top + innerHeight;
      return i === 0 ? `M ${pt.x},${y}` : `${acc} L ${pt.x},${y}`;
    }, "");
  };

  const generateChannelAreaPath = (channelId: string) => {
    if (points.length < 2) return "";
    const bottomY = padding.top + innerHeight;
    const linePart = generateChannelLinePath(channelId);
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${linePart} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  const trend = velocity?.trend || "Flat";
  const trendBadge = useMemo(() => {
    if (trend === "Accelerating") {
      return {
        label: "Accelerating",
        icon: TrendingUp,
        bg: "bg-emerald-950/80 text-emerald-300 border-emerald-800",
      };
    }
    if (trend === "Decelerating") {
      return {
        label: "Decelerating",
        icon: TrendingDown,
        bg: "bg-amber-950/80 text-amber-300 border-amber-800",
      };
    }
    if (trend === "Steady") {
      return {
        label: "Steady",
        icon: Activity,
        bg: "bg-cyan-950/80 text-cyan-300 border-cyan-800",
      };
    }
    return {
      label: "Flat",
      icon: Minus,
      bg: "bg-slate-900 text-slate-400 border-slate-800",
    };
  }, [trend]);

  const TrendIcon = trendBadge.icon;

  // Fallback when fewer than 2 snapshots exist
  if (sortedSnapshots.length < 2) {
    return (
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>{title}</span>
          </div>
          {velocity?.trend && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${trendBadge.bg}`}
            >
              <TrendIcon className="w-3 h-3" />
              <span>Trend: {trendBadge.label}</span>
            </span>
          )}
        </div>

        <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800/80 text-center space-y-2.5">
          <div className="w-10 h-10 rounded-full bg-cyan-950/80 border border-cyan-800 flex items-center justify-center mx-auto text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-200">
            Historical Velocity Graph Awaiting Data
          </h4>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            At least 2 historical snapshots are required to graph velocity and growth trajectories.
            Trigger a sync to record your first data points.
          </p>
          {onSyncTrigger && (
            <button
              type="button"
              onClick={onSyncTrigger}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Metrics Now"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div
      data-testid="engagement-velocity-chart"
      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
    >
      {/* Header with Title and Velocity Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">{title}</span>
        </div>

        {/* Velocity Summary Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {viewMode === "aggregate"
            ? velocity && (
                <>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${trendBadge.bg}`}
                  >
                    <TrendIcon className="w-3 h-3" />
                    <span>Trend: {trendBadge.label}</span>
                  </span>

                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                    +{velocity.views_per_day} views/day
                  </span>

                  {velocity.reactions_per_day > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-pink-950/80 text-pink-300 border border-pink-800">
                      +{velocity.reactions_per_day} reactions/day
                    </span>
                  )}

                  {velocity.views_delta_24h !== 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-300 bg-slate-900 border border-slate-800">
                      24h:{" "}
                      {velocity.views_delta_24h > 0
                        ? `+${velocity.views_delta_24h}`
                        : velocity.views_delta_24h}{" "}
                      views
                    </span>
                  )}
                </>
              )
            : CHANNELS.map((ch) => {
                const chVel = velocity?.channels?.[ch.id];
                const vpd =
                  channelMetric === "views"
                    ? (chVel?.views_per_day ?? 0)
                    : channelMetric === "reactions"
                      ? (chVel?.reactions_per_day ?? 0)
                      : (chVel?.comments_per_day ?? 0);
                const chTrend = chVel?.trend ?? "Flat";
                return (
                  <span
                    key={ch.id}
                    data-testid={`channel-pill-${ch.id}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${ch.badgeBg} ${ch.badgeBorder} ${ch.badgeText}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: ch.color }}
                    />
                    <span>
                      {ch.name}: +{vpd}/d ({chTrend})
                    </span>
                  </span>
                );
              })}
        </div>
      </div>

      {/* Controls: Mode Switcher, Metric Selectors, Timeframe */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left Controls: View Mode & Metric Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("aggregate")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                viewMode === "aggregate"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Aggregate View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("channels")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                viewMode === "channels"
                  ? "bg-indigo-950 text-indigo-300 border border-indigo-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Channel Comparison (Dev.to vs Hashnode vs Medium)
            </button>
          </div>

          {/* Metric Selector based on mode */}
          {viewMode === "aggregate" ? (
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setMetricFilter("all")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  metricFilter === "all"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All Metrics
              </button>
              <button
                type="button"
                onClick={() => setMetricFilter("views")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  metricFilter === "views"
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Views
              </button>
              <button
                type="button"
                onClick={() => setMetricFilter("reactions")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  metricFilter === "reactions"
                    ? "bg-pink-950 text-pink-300 border border-pink-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Reactions
              </button>
              <button
                type="button"
                onClick={() => setMetricFilter("comments")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  metricFilter === "comments"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Comments
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-500 font-semibold px-1">Metric:</span>
              <button
                type="button"
                onClick={() => setChannelMetric("views")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  channelMetric === "views"
                    ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Views
              </button>
              <button
                type="button"
                onClick={() => setChannelMetric("reactions")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  channelMetric === "reactions"
                    ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Reactions
              </button>
              <button
                type="button"
                onClick={() => setChannelMetric("comments")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  channelMetric === "comments"
                    ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Comments
              </button>
            </div>
          )}
        </div>

        {/* Timeframe Selectors */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <Calendar className="w-3 h-3 text-slate-500 ml-1 mr-0.5" />
          {(["24h", "7d", "30d", "All"] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                timeframe === tf
                  ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full rounded-xl bg-slate-900/60 border border-slate-800/80 p-2 overflow-hidden shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none overflow-visible"
        >
          <defs>
            {/* Cyan gradient for Views */}
            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            {/* Pink gradient for Reactions */}
            <linearGradient id="reactionsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
            </linearGradient>
            {/* Emerald gradient for Comments */}
            <linearGradient id="commentsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            {/* Channel Gradients */}
            <linearGradient id="devtoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="hashnodeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="mediumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((pct) => {
            const y = padding.top + innerHeight - pct * innerHeight;
            const val = Math.round(pct * maxVal);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + innerWidth}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={pct === 0 ? "none" : "3,3"}
                  opacity={pct === 0 ? 0.7 : 0.35}
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* X Axis line */}
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={padding.left + innerWidth}
            y2={padding.top + innerHeight}
            stroke="#475569"
            strokeWidth="1.5"
          />

          {/* X Axis timestamps (first and last) */}
          {points.length > 0 && (
            <>
              <text
                x={points[0].x}
                y={padding.top + innerHeight + 18}
                textAnchor="start"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                {new Date(points[0].snapshot.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </text>
              {points.length > 1 && (
                <text
                  x={points[points.length - 1].x}
                  y={padding.top + innerHeight + 18}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {new Date(points[points.length - 1].snapshot.timestamp).toLocaleDateString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </text>
              )}
            </>
          )}

          {/* Aggregate Mode Areas & Lines */}
          {viewMode === "aggregate" && (
            <>
              {(metricFilter === "all" || metricFilter === "views") && (
                <path d={generateAreaPath("yViews")} fill="url(#viewsGrad)" />
              )}
              {(metricFilter === "all" || metricFilter === "reactions") && (
                <path d={generateAreaPath("yReactions")} fill="url(#reactionsGrad)" />
              )}
              {(metricFilter === "all" || metricFilter === "comments") && (
                <path d={generateAreaPath("yComments")} fill="url(#commentsGrad)" />
              )}

              {(metricFilter === "all" || metricFilter === "views") && (
                <path
                  d={generateLinePath("yViews")}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {(metricFilter === "all" || metricFilter === "reactions") && (
                <path
                  d={generateLinePath("yReactions")}
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {(metricFilter === "all" || metricFilter === "comments") && (
                <path
                  d={generateLinePath("yComments")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </>
          )}

          {/* Channel Comparison Mode Areas & Lines */}
          {viewMode === "channels" &&
            CHANNELS.map((ch) => (
              <React.Fragment key={ch.id}>
                <path d={generateChannelAreaPath(ch.id)} fill={`url(#${ch.gradId})`} />
                <path
                  data-channel={ch.id}
                  data-testid={`channel-line-${ch.id}`}
                  d={generateChannelLinePath(ch.id)}
                  fill="none"
                  stroke={ch.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </React.Fragment>
            ))}

          {/* Data Points */}
          {points.map((pt) => {
            const isHovered = hoveredIndex === pt.idx;
            return (
              <g key={pt.idx}>
                {/* Vertical hover indicator line */}
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={padding.top}
                    x2={pt.x}
                    y2={padding.top + innerHeight}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                )}

                {/* Aggregate Mode Dots */}
                {viewMode === "aggregate" && (
                  <>
                    {(metricFilter === "all" || metricFilter === "views") && (
                      <circle
                        cx={pt.x}
                        cy={pt.yViews}
                        r={isHovered ? 5 : 3}
                        fill="#06b6d4"
                        stroke="#020617"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredIndex(pt.idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}
                    {(metricFilter === "all" || metricFilter === "reactions") && (
                      <circle
                        cx={pt.x}
                        cy={pt.yReactions}
                        r={isHovered ? 4.5 : 2.5}
                        fill="#ec4899"
                        stroke="#020617"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredIndex(pt.idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}
                    {(metricFilter === "all" || metricFilter === "comments") && (
                      <circle
                        cx={pt.x}
                        cy={pt.yComments}
                        r={isHovered ? 4.5 : 2.5}
                        fill="#10b981"
                        stroke="#020617"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredIndex(pt.idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}
                  </>
                )}

                {/* Channel Comparison Mode Dots */}
                {viewMode === "channels" &&
                  CHANNELS.map((ch) => {
                    const cy = pt.yChannels[ch.id] ?? padding.top + innerHeight;
                    return (
                      <circle
                        key={ch.id}
                        cx={pt.x}
                        cy={cy}
                        r={isHovered ? 5 : 3}
                        fill={ch.color}
                        stroke="#020617"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredIndex(pt.idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    );
                  })}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-3 right-3 p-2.5 rounded-lg bg-slate-950/95 border border-slate-700 shadow-xl text-[11px] font-mono space-y-1 pointer-events-none z-10">
            {viewMode === "aggregate" ? (
              <>
                <div className="text-slate-400 pb-1 border-b border-slate-800">
                  {new Date(hoveredPoint.snapshot.timestamp).toLocaleString()}
                </div>
                <div className="flex items-center justify-between gap-4 text-cyan-400 font-bold">
                  <span>Views:</span>
                  <span>{hoveredPoint.snapshot.views}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-pink-400 font-bold">
                  <span>Reactions:</span>
                  <span>{hoveredPoint.snapshot.reactions}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-emerald-400 font-bold">
                  <span>Comments:</span>
                  <span>{hoveredPoint.snapshot.comments}</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-slate-400 pb-1 border-b border-slate-800 flex items-center justify-between gap-4">
                  <span>{new Date(hoveredPoint.snapshot.timestamp).toLocaleString()}</span>
                  <span className="capitalize text-slate-400 text-[10px]">({channelMetric})</span>
                </div>
                {CHANNELS.map((ch) => {
                  const val = hoveredPoint.snapshot.channels?.[ch.id]?.[channelMetric] ?? 0;
                  const chVel = velocity?.channels?.[ch.id];
                  const rate =
                    channelMetric === "views"
                      ? chVel?.views_per_day
                      : channelMetric === "reactions"
                        ? chVel?.reactions_per_day
                        : chVel?.comments_per_day;
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between gap-4 font-bold"
                      style={{ color: ch.color }}
                    >
                      <span>{ch.name}:</span>
                      <span>
                        {val}
                        {rate !== undefined && (
                          <span className="text-[10px] opacity-80 ml-1 font-normal font-mono">
                            (+{rate}/d)
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        {viewMode === "aggregate" ? (
          <div className="flex items-center space-x-4 font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-cyan-300">Views</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
              <span className="text-pink-300">Reactions</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300">Comments</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-4 font-semibold">
            {CHANNELS.map((ch) => (
              <span key={ch.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                <span style={{ color: ch.color }}>{ch.name}</span>
              </span>
            ))}
          </div>
        )}

        <span className="text-slate-500 font-mono">
          {filteredSnapshots.length} data point{filteredSnapshots.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
};
