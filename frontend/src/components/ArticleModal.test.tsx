import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleModal } from "./ArticleModal";
import type { Article } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ArticleModal Component - Dev Seed Engagement", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const originalFetch = globalThis.fetch;

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

  it("renders the 'Seed Demo Engagement' button in the engagement tab", async () => {
    const article: Article = {
      id: "art-seed-test-1",
      title: "Dev Seed Test Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for seed test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
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
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    expect(container!.textContent).toContain("Seed Demo Engagement");
  });

  it("calls seed-engagement API on button click, updates article, and shows success banner", async () => {
    const article: Article = {
      id: "art-seed-test-2",
      title: "Dev Seed Click Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for seed test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const seededArticle: Article = {
      ...article,
      engagement: {
        views: 1250,
        reactions: 65,
        comments: 18,
        last_synced_at: new Date().toISOString(),
      },
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
          id: "alert-seeded-1",
          article_id: "art-seed-test-2",
          article_title: "Dev Seed Click Article",
          milestone_type: "views",
          threshold: 100,
          message: "'Dev Seed Click Article' reached 100+ Views!",
          badge_awarded: "100+ Views",
          triggered_at: new Date().toISOString(),
          acknowledged: false,
        },
      ],
      engagement_snapshots: [
        {
          timestamp: new Date().toISOString(),
          views: 1250,
          reactions: 65,
          comments: 18,
        },
      ],
    };

    const onArticleUpdatedMock = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/seed-engagement")) {
        expect(init?.method).toBe("POST");
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              article: seededArticle,
              new_alerts: seededArticle.milestone_alerts,
              new_alerts_count: 6,
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
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
          onArticleUpdated={onArticleUpdatedMock}
          initialTab="engagement"
        />,
      );
    });

    const seedButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Seed Demo Engagement"),
    );
    expect(seedButton).toBeDefined();

    await act(async () => {
      seedButton!.click();
    });

    expect(onArticleUpdatedMock).toHaveBeenCalledWith(seededArticle);
    expect(container!.textContent).toContain("Seeded demo engagement metrics!");
    expect(container!.textContent).toContain("Awarded 6 milestone badges");
  });
});
