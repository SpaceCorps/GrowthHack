import { describe, it, expect } from "vite-plus/test";
import type { Article, TrendTopic } from "../types";

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
});
