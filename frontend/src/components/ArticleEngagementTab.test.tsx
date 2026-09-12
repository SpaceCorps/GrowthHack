import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleEngagementTab } from "./ArticleEngagementTab";
import type { Article } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ArticleEngagementTab Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const originalFetch = globalThis.fetch;

  const mockArticle: Article = {
    id: "art-eng-1",
    title: "Metrics Engine Architecture",
    feature: "Metrics",
    channel: "Website",
    angle: "Architecture",
    summary: "Realtime velocity and engagement analytics.",
    content: "Content",
    backlinks: [],
    outbound_citations: [],
    status: "Published",
    created_at: new Date().toISOString(),
    views: 500,
    reactions: 30,
    comments: 10,
    engagement_badges: ["100+ Views", "25+ Reactions"],
    milestone_alerts: [
      {
        id: "alert-1",
        article_id: "art-eng-1",
        article_title: "Metrics Engine Architecture",
        milestone_type: "views",
        threshold: 100,
        message: "Reached 100+ views",
        badge_awarded: "100+ Views",
        triggered_at: new Date().toISOString(),
        acknowledged: false,
      },
    ],
    engagement_snapshots: [
      {
        timestamp: new Date().toISOString(),
        views: 500,
        reactions: 30,
        comments: 10,
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      container.remove();
      container = null;
      root = null;
    }
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders fetched velocity and 24h delta metrics cards", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/engagement-history")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              snapshots: [
                {
                  timestamp: new Date().toISOString(),
                  views: 500,
                  reactions: 30,
                  comments: 10,
                },
              ],
              velocity: {
                views_per_day: 142.5,
                reactions_per_day: 12.3,
                comments_per_day: 4.8,
                views_24h: 120,
                reactions_24h: 15,
                comments_24h: 6,
                trend: "Accelerating",
                channels: {},
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleEngagementTab article={mockArticle} />);
    });

    expect(container!.textContent).toContain("+142.5/d");
    expect(container!.textContent).toContain("+120 (24h)");
    expect(container!.textContent).toContain("+12.3/d");
    expect(container!.textContent).toContain("+15 (24h)");
    expect(container!.textContent).toContain("+4.8/d");
    expect(container!.textContent).toContain("+6 (24h)");
    expect(container!.textContent).toContain("Accelerating");
  });

  it("triggers API call and displays success banner on Seed Demo Engagement click", async () => {
    const onArticleUpdated = vi.fn();

    const seededArticle: Article = {
      ...mockArticle,
      views: 1250,
      reactions: 65,
      comments: 18,
      engagement_badges: [
        "100+ Views",
        "500+ Views",
        "1K+ Views",
        "25+ Reactions",
        "50+ Reactions",
        "10+ Comments",
      ],
      milestone_alerts: [
        {
          id: "alert-2",
          article_id: "art-eng-1",
          article_title: "Metrics Engine Architecture",
          milestone_type: "views",
          threshold: 500,
          message: "Reached 500+ views",
          badge_awarded: "500+ Views",
          triggered_at: new Date().toISOString(),
          acknowledged: false,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/engagement-history")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              snapshots: [],
              velocity: {
                views_per_day: 0,
                reactions_per_day: 0,
                comments_per_day: 0,
                views_24h: 0,
                reactions_24h: 0,
                comments_24h: 0,
                trend: "Flat",
                channels: {},
              },
            }),
        });
      }
      if (url.includes("/seed-engagement")) {
        expect(init?.method).toBe("POST");
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              article: seededArticle,
              new_alerts_count: 5,
              velocity: {
                views_per_day: 125.0,
                reactions_per_day: 6.5,
                comments_per_day: 1.8,
                views_24h: 438,
                reactions_24h: 23,
                comments_24h: 7,
                trend: "Accelerating",
                channels: {},
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(
        <ArticleEngagementTab article={mockArticle} onArticleUpdated={onArticleUpdated} />,
      );
    });

    const seedBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Seed Demo Engagement"),
    );
    expect(seedBtn).toBeDefined();

    await act(async () => {
      seedBtn!.click();
    });

    expect(onArticleUpdated).toHaveBeenCalledWith(seededArticle);
    expect(container!.textContent).toContain("Seeded demo engagement metrics!");
    expect(container!.textContent).toContain("Awarded 6 milestone badges and triggered 5 alerts.");
  });

  it("opens confirmation modal on Reset Engagement click and resets snapshots to zero on Confirm Reset", async () => {
    const onArticleUpdated = vi.fn();

    const resetArticle: Article = {
      ...mockArticle,
      views: 0,
      reactions: 0,
      comments: 0,
      engagement_badges: [],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    let resetPayload: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/engagement-history")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              snapshots: mockArticle.engagement_snapshots,
              velocity: {
                views_per_day: 10,
                reactions_per_day: 1,
                comments_per_day: 0,
                views_24h: 10,
                reactions_24h: 1,
                comments_24h: 0,
                trend: "Flat",
                channels: {},
              },
            }),
        });
      }
      if (url.includes("/seed-engagement")) {
        expect(init?.method).toBe("POST");
        resetPayload = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              article: resetArticle,
              velocity: {
                views_per_day: 0,
                reactions_per_day: 0,
                comments_per_day: 0,
                views_24h: 0,
                reactions_24h: 0,
                comments_24h: 0,
                trend: "Flat",
                channels: {},
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(
        <ArticleEngagementTab article={mockArticle} onArticleUpdated={onArticleUpdated} />,
      );
    });

    // Confirmation dialog is not initially visible
    expect(container!.textContent).not.toContain("Reset Article Engagement?");

    // Click Reset Engagement button
    const resetBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn!.click();
    });

    // Confirmation dialog is now open
    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(container!.textContent).toContain(
      'Are you sure you want to reset all reader engagement metrics for "Metrics Engine Architecture"?',
    );

    // Click Confirm Reset button
    const confirmBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Confirm Reset"),
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn!.click();
    });

    expect(resetPayload).toEqual({
      views: 0,
      reactions: 0,
      comments: 0,
      channels: {},
      generate_history_days: 0,
      reset_badges: true,
    });
    expect(onArticleUpdated).toHaveBeenCalledWith(resetArticle);
    expect(container!.textContent).toContain(
      "Reset article engagement metrics, snapshots, and badges to initial zero state.",
    );
    // Modal is closed
    expect(container!.textContent).not.toContain(
      "Are you sure you want to reset all reader engagement metrics",
    );
  });
});
