import React, { useState, useEffect } from "react";
import { ActionButton } from "./ActionButton";
import { EngagementVelocityChart } from "./EngagementVelocityChart";
import { useOverlayDismiss } from "../hooks/useOverlayDismiss";
import type { Article, EngagementHistoryResponse } from "../types";
import {
  CheckCircle2,
  X,
  TrendingUp,
  Activity,
  TrendingDown,
  Minus,
  Award,
  RotateCcw,
  Sparkles,
  History,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export interface ArticleEngagementTabProps {
  article: Article;
  onArticleUpdated?: (article: Article) => void;
}

export const ArticleEngagementTab: React.FC<ArticleEngagementTabProps> = ({
  article,
  onArticleUpdated,
}) => {
  const [articleHistory, setArticleHistory] = useState<EngagementHistoryResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isSeedingEngagement, setIsSeedingEngagement] = useState<boolean>(false);
  const [isResettingEngagement, setIsResettingEngagement] = useState<boolean>(false);
  const [seedSuccessBanner, setSeedSuccessBanner] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const { overlayRef: resetOverlayRef, onBackdropClick: onResetBackdropClick } = useOverlayDismiss(
    () => setShowResetConfirm(false),
    { enabled: showResetConfirm, locked: isResettingEngagement, stopPropagation: true },
  );

  useEffect(() => {
    if (!article?.id) {
      setArticleHistory(null);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    fetch(`/api/articles/${article.id}/engagement-history`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("History fetch failed");
      })
      .then((data: EngagementHistoryResponse) => {
        if (isMounted) {
          setArticleHistory(data);
        }
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [article?.id]);

  const handleSeedEngagement = async () => {
    setIsSeedingEngagement(true);
    setSeedSuccessBanner(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/seed-engagement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.article) {
          onArticleUpdated?.(data.article);
        }
        if (data.article?.engagement_snapshots && data.velocity) {
          setArticleHistory({
            snapshots: data.article.engagement_snapshots,
            velocity: data.velocity,
          });
        }
        const badgesCount = data.article?.engagement_badges?.length || 0;
        const alertsCount = data.new_alerts_count ?? (data.new_alerts?.length || 0);
        setSeedSuccessBanner(
          `Seeded demo engagement metrics! Awarded ${badgesCount} milestone badge${
            badgesCount === 1 ? "" : "s"
          } and triggered ${alertsCount} alert${alertsCount === 1 ? "" : "s"}.`,
        );
        setTimeout(() => {
          setSeedSuccessBanner(null);
        }, 5000);
      } else {
        setSeedSuccessBanner(data.error || "Failed to seed demo engagement.");
      }
    } catch (err: any) {
      setSeedSuccessBanner(err.message || "Network error seeding demo engagement.");
    } finally {
      setIsSeedingEngagement(false);
    }
  };

  const handleResetEngagement = async () => {
    setIsResettingEngagement(true);
    setSeedSuccessBanner(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/seed-engagement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          views: 0,
          reactions: 0,
          comments: 0,
          channels: {},
          generate_history_days: 0,
          reset_badges: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.article) {
          onArticleUpdated?.(data.article);
        }
        setArticleHistory({
          snapshots: data.article?.engagement_snapshots || [],
          velocity: data.velocity,
        });
        setSeedSuccessBanner(
          "Reset article engagement metrics, snapshots, and badges to initial zero state.",
        );
        setTimeout(() => {
          setSeedSuccessBanner(null);
        }, 5000);
      } else {
        setSeedSuccessBanner(data.error || "Failed to reset article engagement.");
      }
    } catch (err: any) {
      setSeedSuccessBanner(err.message || "Network error resetting article engagement.");
    } finally {
      setIsResettingEngagement(false);
    }
  };

  return (
    <div className="space-y-6">
      {seedSuccessBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{seedSuccessBanner}</span>
          </div>
          <button
            onClick={() => setSeedSuccessBanner(null)}
            className="text-emerald-400 hover:text-emerald-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Velocity and 24h Delta Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Views Velocity
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-cyan-400">
              +{articleHistory?.velocity?.views_per_day.toFixed(1) || "0.0"}/d
            </span>
            <span className="text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              +{articleHistory?.velocity?.views_24h ?? 0} (24h)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Reactions Velocity
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-pink-400">
              +{articleHistory?.velocity?.reactions_per_day.toFixed(1) || "0.0"}/d
            </span>
            <span className="text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              +{articleHistory?.velocity?.reactions_24h ?? 0} (24h)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Comments Velocity
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-400">
              +{articleHistory?.velocity?.comments_per_day.toFixed(1) || "0.0"}/d
            </span>
            <span className="text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              +{articleHistory?.velocity?.comments_24h ?? 0} (24h)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Trend Trajectory
          </span>
          <div className="mt-2 flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                articleHistory?.velocity?.trend === "Accelerating"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                  : articleHistory?.velocity?.trend === "Steady"
                    ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                    : articleHistory?.velocity?.trend === "Decelerating"
                      ? "bg-amber-950/80 text-amber-300 border-amber-800"
                      : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {articleHistory?.velocity?.trend === "Accelerating" && (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {articleHistory?.velocity?.trend === "Steady" && (
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              )}
              {articleHistory?.velocity?.trend === "Decelerating" && (
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              )}
              {articleHistory?.velocity?.trend === "Flat" && (
                <Minus className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{articleHistory?.velocity?.trend || "Flat"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Engagement Velocity Chart */}
      <EngagementVelocityChart
        snapshots={articleHistory?.snapshots || article.engagement_snapshots || []}
        velocity={articleHistory?.velocity}
        title={`${article.title}: Historical Velocity and Trend`}
      />

      {/* Engagement Milestones Card */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Engagement Milestones ({article.engagement_badges?.length || 0})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              loading={isResettingEngagement}
              disabled={isSeedingEngagement}
              loadingText="Resetting..."
              icon={<RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
              onClick={() => setShowResetConfirm(true)}
              title="Reset engagement metrics, snapshots, and badges to initial zero state"
            >
              Reset Engagement
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              loading={isSeedingEngagement}
              disabled={isResettingEngagement}
              loadingText="Seeding..."
              icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              onClick={handleSeedEngagement}
              title="Seed simulated engagement metrics and milestone alerts for testing"
            >
              Seed Demo Engagement
            </ActionButton>
          </div>
        </div>

        {/* Unlocked milestone badges */}
        <div className="mb-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-2">
            Unlocked Milestone Badges:
          </span>
          {!article.engagement_badges || article.engagement_badges.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-1">
              No milestones unlocked yet. Reach 100+ views, 25+ reactions, or 10+ comments to earn
              badges.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {article.engagement_badges.map((badge) => {
                const lower = badge.toLowerCase();
                const badgeColor = lower.includes("view")
                  ? "bg-amber-950/80 text-amber-300 border-amber-800"
                  : lower.includes("react")
                    ? "bg-pink-950/80 text-pink-300 border-pink-800"
                    : lower.includes("comment")
                      ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                      : "bg-purple-950/80 text-purple-300 border-purple-800";
                return (
                  <span
                    key={badge}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeColor}`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{badge}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Chronological Milestone Alerts History */}
        <div className="pt-3 border-t border-slate-800/80">
          <span className="text-[11px] font-medium text-slate-400 block mb-2">
            Milestone Achievement History:
          </span>
          {!article.milestone_alerts || article.milestone_alerts.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-1">
              No milestone alerts recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="pb-2 font-medium">Triggered At</th>
                    <th className="pb-2 font-medium">Milestone</th>
                    <th className="pb-2 font-medium">Badge</th>
                    <th className="pb-2 font-medium text-right">Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {article.milestone_alerts
                    .slice()
                    .reverse()
                    .map((alert) => (
                      <tr key={alert.id} className="hover:bg-slate-900/40">
                        <td className="py-2 text-slate-300">
                          {new Date(alert.triggered_at).toLocaleString()}
                        </td>
                        <td className="py-2 text-slate-200 capitalize">{alert.milestone_type}</td>
                        <td className="py-2 text-amber-300 font-bold">{alert.badge_awarded}</td>
                        <td className="py-2 text-right text-cyan-400 font-bold">
                          {alert.threshold}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Snapshot Timeline History */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>
              Recorded Snapshot History (
              {articleHistory?.snapshots?.length || article.engagement_snapshots?.length || 0})
            </span>
          </div>
          {isLoadingHistory && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans normal-case">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
              <span>Loading history...</span>
            </div>
          )}
        </h4>
        {(articleHistory?.snapshots || article.engagement_snapshots || []).length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No historical snapshots recorded yet. Sync metrics to begin recording velocity
            checkpoints.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="pb-2 font-medium">Timestamp</th>
                  <th className="pb-2 font-medium text-right">Views</th>
                  <th className="pb-2 font-medium text-right">Reactions</th>
                  <th className="pb-2 font-medium text-right">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {(articleHistory?.snapshots || article.engagement_snapshots || [])
                  .slice()
                  .reverse()
                  .map((snap, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2 text-slate-300">
                        {new Date(snap.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-cyan-400 font-bold">{snap.views}</td>
                      <td className="py-2 text-right text-pink-400 font-bold">{snap.reactions}</td>
                      <td className="py-2 text-right text-emerald-400 font-bold">
                        {snap.comments}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog Modal for Single-Article Reset */}
      {showResetConfirm && (
        <div
          ref={resetOverlayRef}
          data-nested-overlay="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={onResetBackdropClick}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-900/50">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <h3 id="reset-dialog-title" className="text-base font-semibold text-white">
                  Reset Article Engagement?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResettingEngagement}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close confirmation dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-3 text-sm text-slate-300">
              <p className="leading-relaxed text-slate-300">
                {`Are you sure you want to reset all reader engagement metrics for "${article.title}"? This will reset views, reactions, comments, milestone badges, alerts, and historical velocity snapshots back to zero. This action cannot be undone.`}
              </p>

              <div className="grid grid-cols-4 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Views
                  </span>
                  <span className="text-sm font-bold text-cyan-400">
                    {(article.views ?? article.engagement?.views ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Reactions
                  </span>
                  <span className="text-sm font-bold text-pink-400">
                    {(article.reactions ?? article.engagement?.reactions ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Comments
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {(article.comments ?? article.engagement?.comments ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Badges
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    {article.engagement_badges?.length ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResettingEngagement}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleResetEngagement();
                  } finally {
                    setShowResetConfirm(false);
                  }
                }}
                disabled={isResettingEngagement}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-950/30"
              >
                {isResettingEngagement ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Confirm Reset</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
