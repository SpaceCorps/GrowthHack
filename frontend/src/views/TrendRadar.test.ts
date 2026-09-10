import { describe, it, expect } from "vite-plus/test";
import type { Article, TrendTopic } from "../types";
import { getEngagementTier } from "./TrendRadar";

describe("TrendRadar Data Logic and Approval Queue", () => {
  it("filters articles for the human approval queue", () => {
    const articles: Article[] = [
      {
        id: "art-1",
        title: "Published Article",
        feature: "Worktrees",
        channel: "Website",
        angle: "Architecture",
        summary: "Summary 1",
        content: "Content 1",
        backlinks: [],
        outbound_citations: [],
        status: "Published",
        created_at: new Date().toISOString(),
      },
      {
        id: "art-2",
        title: "Ready Trend Article",
        feature: "Trend Analysis",
        channel: "Website",
        angle: "Trend Radar",
        summary: "Summary 2",
        content: "Content 2",
        backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
        outbound_citations: ["https://reddit.com/r/LocalLLaMA"],
        status: "Ready",
        created_at: new Date().toISOString(),
      },
      {
        id: "art-3",
        title: "Draft Discussion Article",
        feature: "Trend Analysis",
        channel: "LinkedIn",
        angle: "Trend Radar",
        summary: "Summary 3",
        content: "Content 3",
        backlinks: [],
        outbound_citations: ["https://news.ycombinator.com"],
        status: "Draft",
        created_at: new Date().toISOString(),
      },
    ];

    const pendingArticles = articles.filter((a) => a.status === "Ready" || a.status === "Draft");

    expect(pendingArticles).toHaveLength(2);
    expect(pendingArticles[0].id).toBe("art-2");
    expect(pendingArticles[0].status).toBe("Ready");
    expect(pendingArticles[1].id).toBe("art-3");
    expect(pendingArticles[1].status).toBe("Draft");
  });

  it("handles 1-click tie-in actions and defaults", () => {
    const trend: TrendTopic = {
      id: "trend-test-1",
      source: "Reddit",
      topic: "Claude Code worktree isolation complaints",
      url: "https://reddit.com/r/LocalLLaMA/comments/xyz",
      engagement: "500 upvotes",
      summary: "Developers struggling with shared state",
      tendril_tie_in: "direct",
      status: "Scouted",
      created_at: new Date().toISOString(),
    };

    const presetTieIns: Array<"direct" | "subtle" | "none"> = ["direct", "subtle", "none"];

    expect(presetTieIns).toContain(trend.tendril_tie_in);
    expect(trend.status).toBe("Scouted");
  });

  it("correctly categorizes engagement metrics into tiers", () => {
    expect(getEngagementTier("Trending #1 worldwide, 3.2k stars today")).toBe("viral");
    expect(getEngagementTier("1,450 reactions, 180 reposts")).toBe("viral");
    expect(getEngagementTier("612 upvotes, 284 comments")).toBe("viral");
    expect(getEngagementTier("500 upvotes")).toBe("viral");
    expect(getEngagementTier("450 upvotes, 120 comments")).toBe("active");
    expect(getEngagementTier("120 comments")).toBe("active");
    expect(getEngagementTier("45 upvotes")).toBe("emerging");
    expect(getEngagementTier("Newly discovered topic")).toBe("emerging");
  });

  it("filters scouted trends by source and engagement tier", () => {
    const trends: TrendTopic[] = [
      {
        id: "t-1",
        source: "GitHub",
        topic: "OpenCode surpasses 200k stars",
        url: "https://github.com/trending",
        engagement: "3.2k stars today",
        summary: "CLI trend",
        tendril_tie_in: "direct",
        status: "Scouted",
        created_at: new Date().toISOString(),
      },
      {
        id: "t-2",
        source: "Reddit",
        topic: "LocalLLaMA agent discussion",
        url: "https://reddit.com/r/LocalLLaMA",
        engagement: "612 upvotes",
        summary: "Discussion on worktrees",
        tendril_tie_in: "direct",
        status: "Scouted",
        created_at: new Date().toISOString(),
      },
      {
        id: "t-3",
        source: "LinkedIn",
        topic: "Software Factories in 2026",
        url: "https://linkedin.com/feed",
        engagement: "1,450 reactions",
        summary: "Enterprise adoption",
        tendril_tie_in: "subtle",
        status: "Scouted",
        created_at: new Date().toISOString(),
      },
      {
        id: "t-4",
        source: "Hacker News",
        topic: "Show HN: Git worktree manager for coding agents",
        url: "https://news.ycombinator.com/item?id=123",
        engagement: "180 comments",
        summary: "HN debate on workspace collisions",
        tendril_tie_in: "none",
        status: "Scouted",
        created_at: new Date().toISOString(),
      },
      {
        id: "t-5",
        source: "Reddit",
        topic: "Early thoughts on agent sandboxes",
        url: "https://reddit.com/r/ClaudeAI",
        engagement: "25 comments",
        summary: "Emerging thread",
        tendril_tie_in: "subtle",
        status: "Scouted",
        created_at: new Date().toISOString(),
      },
    ];

    // Source filtering
    const githubTrends = trends.filter((t) => t.source === "GitHub");
    expect(githubTrends).toHaveLength(1);
    expect(githubTrends[0].id).toBe("t-1");

    const hnTrends = trends.filter((t) => t.source === "Hacker News");
    expect(hnTrends).toHaveLength(1);
    expect(hnTrends[0].id).toBe("t-4");

    const redditTrends = trends.filter((t) => t.source === "Reddit");
    expect(redditTrends).toHaveLength(2);

    // Tier filtering
    const viralTrends = trends.filter((t) => getEngagementTier(t.engagement) === "viral");
    expect(viralTrends).toHaveLength(3); // t-1 (3.2k), t-2 (612), t-3 (1,450)

    const activeTrends = trends.filter((t) => getEngagementTier(t.engagement) === "active");
    expect(activeTrends).toHaveLength(1); // t-4 (180 comments)

    const emergingTrends = trends.filter((t) => getEngagementTier(t.engagement) === "emerging");
    expect(emergingTrends).toHaveLength(1); // t-5 (25 comments)
  });
});
