import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleModal } from "./ArticleModal";
import { setupMockBlobUrl } from "../test";
import type { MockBlobUrlController } from "../test";
import type { Article } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ArticleModal Component - Dev Seed Engagement", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let mockBlobUrl: MockBlobUrlController | null = null;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockBlobUrl = setupMockBlobUrl();
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
    if (mockBlobUrl) {
      mockBlobUrl.restore();
      mockBlobUrl = null;
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

  it("renders the 'Reset Engagement' button in the engagement tab", async () => {
    const article: Article = {
      id: "art-reset-test-1",
      title: "Dev Reset Test Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: ["100+ Views"],
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

    expect(container!.textContent).toContain("Reset Engagement");
  });

  it("calls seed-engagement API with zero payload on 'Reset Engagement' click, updates article, and shows success banner", async () => {
    const article: Article = {
      id: "art-reset-test-2",
      title: "Dev Reset Click Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 1250,
        reactions: 65,
        comments: 18,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views", "25+ Reactions"],
      milestone_alerts: [],
      engagement_snapshots: [
        {
          timestamp: new Date().toISOString(),
          views: 1250,
          reactions: 65,
          comments: 18,
        },
      ],
    };

    const resetArticle: Article = {
      ...article,
      engagement: {
        views: 0,
        reactions: 0,
        comments: 0,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: [],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    const onArticleUpdatedMock = vi.fn();
    let sentPayload: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/seed-engagement")) {
        expect(init?.method).toBe("POST");
        sentPayload = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              article: resetArticle,
              new_alerts: [],
              new_alerts_count: 0,
              velocity: {
                views_per_day: 0.0,
                reactions_per_day: 0.0,
                comments_per_day: 0.0,
                views_24h: 0,
                reactions_24h: 0,
                comments_24h: 0,
                trend: "Flat",
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

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    // Clicking "Reset Engagement" opens confirmation modal and does not dispatch API immediately
    expect(sentPayload).toBeNull();
    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(container!.textContent).toContain(
      "Are you sure you want to reset all reader engagement metrics",
    );

    // Clicking "Confirm Reset" in confirmation modal dispatches seed-engagement API
    const confirmButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Confirm Reset"),
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton!.click();
    });

    expect(sentPayload).toEqual({
      views: 0,
      reactions: 0,
      comments: 0,
      channels: {},
      generate_history_days: 0,
      reset_badges: true,
    });
    expect(onArticleUpdatedMock).toHaveBeenCalledWith(resetArticle);
    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(container!.textContent).toContain(
      "Reset article engagement metrics, snapshots, and badges to initial zero state.",
    );
  });

  it("cancels reset confirmation dialog without calling seed-engagement API", async () => {
    const article: Article = {
      id: "art-reset-cancel-test",
      title: "Dev Reset Cancel Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset cancel test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    let fetchCalled = false;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/seed-engagement")) {
        fetchCalled = true;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
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

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(fetchCalled).toBe(false);

    const cancelButton = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Cancel",
    );
    expect(cancelButton).toBeDefined();

    await act(async () => {
      cancelButton!.click();
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(fetchCalled).toBe(false);

    // Also test dismissing via the close X button
    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");

    const closeButton = container!.querySelector(
      'button[aria-label="Close confirmation dialog"]',
    ) as HTMLButtonElement | null;
    expect(closeButton).toBeDefined();

    await act(async () => {
      closeButton!.click();
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(fetchCalled).toBe(false);
  });

  it("dismisses the reset confirmation dialog when Escape key is pressed", async () => {
    const article: Article = {
      id: "art-reset-escape-test",
      title: "Dev Reset Escape Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset escape test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");

    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe("reset-dialog-title");
    expect(container!.querySelector("#reset-dialog-title")?.textContent).toBe(
      "Reset Article Engagement?",
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismisses the reset confirmation dialog when clicking the backdrop overlay", async () => {
    const article: Article = {
      id: "art-reset-backdrop-test",
      title: "Dev Reset Backdrop Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset backdrop test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");

    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();
    const backdrop = dialog!.parentElement;
    expect(backdrop).toBeDefined();

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not dismiss the reset confirmation dialog when clicking inside the dialog card", async () => {
    const article: Article = {
      id: "art-reset-card-test",
      title: "Dev Reset Card Click Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset card click test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");

    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();

    await act(async () => {
      dialog!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not dismiss the reset confirmation dialog via Escape or backdrop click when isResettingEngagement is true", async () => {
    const article: Article = {
      id: "art-reset-in-flight-test",
      title: "Dev Reset In Flight Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for reset in flight test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    let resolveSeed: ((val: any) => void) | null = null;
    const seedPromise = new Promise((resolve) => {
      resolveSeed = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/seed-engagement")) {
        return seedPromise;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");

    const confirmButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Confirm Reset"),
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton!.click();
    });

    // Now isResettingEngagement is true
    expect(container!.textContent).toContain("Resetting...");

    // Try dismissing via Escape key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();

    // Try dismissing via backdrop click
    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();
    const backdrop = dialog!.parentElement;
    expect(backdrop).toBeDefined();

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();

    // Resolve promise to clean up
    await act(async () => {
      resolveSeed!({
        ok: true,
        json: () => Promise.resolve({ success: true, article }),
      });
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed and no nested dialog is open", async () => {
    const article: Article = {
      id: "art-modal-escape-test",
      title: "Modal Escape Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for modal escape test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const onClose = vi.fn();
    await act(async () => {
      root!.render(<ArticleModal article={article} onClose={onClose} onUpdateStatus={vi.fn()} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when a non-Escape key is pressed", async () => {
    const article: Article = {
      id: "art-modal-nonescape-test",
      title: "Modal Non-Escape Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for modal non-escape test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const onClose = vi.fn();
    await act(async () => {
      root!.render(<ArticleModal article={article} onClose={onClose} onUpdateStatus={vi.fn()} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when clicking the overlay backdrop", async () => {
    const article: Article = {
      id: "art-modal-backdrop-test",
      title: "Modal Backdrop Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for modal backdrop test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const onClose = vi.fn();
    await act(async () => {
      root!.render(<ArticleModal article={article} onClose={onClose} onUpdateStatus={vi.fn()} />);
    });

    const overlay = container!.firstElementChild as HTMLElement;
    expect(overlay).toBeDefined();

    await act(async () => {
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal card", async () => {
    const article: Article = {
      id: "art-modal-card-click-test",
      title: "Modal Card Click Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for modal card click test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const onClose = vi.fn();
    await act(async () => {
      root!.render(<ArticleModal article={article} onClose={onClose} onUpdateStatus={vi.fn()} />);
    });

    const title = Array.from(container!.querySelectorAll("h2")).find(
      (h) => h.textContent === article.title,
    );
    expect(title).toBeDefined();

    await act(async () => {
      title!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes only the nested reset confirmation on Escape, leaving the parent modal open", async () => {
    const article: Article = {
      id: "art-modal-nested-escape-test",
      title: "Modal Nested Escape Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for nested escape test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose via Escape while a reset is in flight, even after the nested dialog would otherwise close", async () => {
    const article: Article = {
      id: "art-modal-nested-inflight-test",
      title: "Modal Nested In Flight Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for nested in-flight test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement: {
        views: 500,
        reactions: 30,
        comments: 10,
        last_synced_at: new Date().toISOString(),
      },
      engagement_badges: ["100+ Views"],
      milestone_alerts: [],
      engagement_snapshots: [],
    };

    let resolveSeed: ((val: any) => void) | null = null;
    const seedPromise = new Promise((resolve) => {
      resolveSeed = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/seed-engagement")) {
        return seedPromise;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    const onClose = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleModal
          article={article}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          initialTab="engagement"
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset Engagement"),
    );
    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton!.click();
    });

    const confirmButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Confirm Reset"),
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton!.click();
    });

    expect(container!.textContent).toContain("Resetting...");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolveSeed!({
        ok: true,
        json: () => Promise.resolve({ success: true, article }),
      });
    });
  });

  it("stops listening for Escape after unmount", async () => {
    const article: Article = {
      id: "art-modal-unmount-test",
      title: "Modal Unmount Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for modal unmount test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const onClose = vi.fn();
    await act(async () => {
      root!.render(<ArticleModal article={article} onClose={onClose} onUpdateStatus={vi.fn()} />);
    });

    await act(async () => {
      root!.unmount();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();

    // Root is already unmounted; clean up directly so afterEach doesn't double-unmount.
    container!.remove();
    container = null;
    root = null;
  });

  it("renders action buttons with expected variants and sets aria-busy='true' during loading states", async () => {
    const article: Article = {
      id: "art-export-test",
      title: "Action Button Modal Test",
      feature: "Worktrees",
      channel: "Dev.to",
      angle: "Architecture",
      summary: "Summary for action button test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Draft",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    let exportResolve: ((val: any) => void) | null = null;
    let syncHeroResolve: ((val: any) => void) | null = null;
    let publishResolve: ((val: any) => void) | null = null;

    const exportPromise = new Promise((resolve) => {
      exportResolve = resolve;
    });
    const syncHeroPromise = new Promise((resolve) => {
      syncHeroResolve = resolve;
    });
    const publishPromise = new Promise((resolve) => {
      publishResolve = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              devto_configured: true,
              hashnode_configured: true,
              publish_as_draft: false,
            }),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              formatted_content: "Formatted markdown content for Dev.to",
              preview_type: "markdown",
            }),
        });
      }
      if (url.includes("/export/ivy-web")) {
        return exportPromise;
      }
      if (url.includes("/sync-assets")) {
        return syncHeroPromise;
      }
      if (url.includes("/publish/")) {
        return publishPromise;
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
          initialTab="export"
        />,
      );
    });

    // Allow initial useEffect (syndication settings fetch) to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // 1. Export to Ivy Web button (variant="cyan", size="md")
    const exportBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Export to Ivy Web"),
    );
    expect(exportBtn).toBeDefined();
    expect(exportBtn!.className).toContain("bg-cyan-600");
    expect(exportBtn!.getAttribute("aria-busy")).toBeNull();

    act(() => {
      exportBtn!.click();
    });
    expect(exportBtn!.getAttribute("aria-busy")).toBe("true");
    expect(exportBtn!.textContent).toContain("Exporting...");
    expect(exportBtn!.querySelector(".animate-spin")).not.toBeNull();

    // 2. Sync Hero Asset button (variant="secondary", size="sm")
    const syncHeroBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Sync Hero Asset"),
    );
    expect(syncHeroBtn).toBeDefined();
    expect(syncHeroBtn!.className).toContain("bg-slate-800");
    expect(syncHeroBtn!.getAttribute("aria-busy")).toBeNull();

    act(() => {
      syncHeroBtn!.click();
    });
    expect(syncHeroBtn!.getAttribute("aria-busy")).toBe("true");
    expect(syncHeroBtn!.textContent).toContain("Syncing Asset...");
    expect(syncHeroBtn!.querySelector(".animate-spin")).not.toBeNull();

    // 3. Publish to Channel button (variant="indigo", size="md")
    const publishBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Publish to Dev.to"),
    );
    expect(publishBtn).toBeDefined();
    expect(publishBtn!.className).toContain("bg-indigo-600");
    expect(publishBtn!.getAttribute("aria-busy")).toBeNull();

    act(() => {
      publishBtn!.click();
    });
    expect(publishBtn!.getAttribute("aria-busy")).toBe("true");
    expect(publishBtn!.textContent).toContain("Publishing to Dev.to...");
    expect(publishBtn!.querySelector(".animate-spin")).not.toBeNull();

    // Resolve pending promises to cleanly tear down
    await act(async () => {
      exportResolve!({
        ok: true,
        json: () => Promise.resolve({ success: true, file_path: "path", record: {} }),
      });
      syncHeroResolve!({
        ok: true,
        json: () => Promise.resolve({ success: true, image_path: "path" }),
      });
      publishResolve!({
        ok: true,
        json: () => Promise.resolve({ success: true, url: "url", record: {} }),
      });
    });
  });

  it("renders ActionButton in credential warning callouts when syndication API credentials are unconfigured", async () => {
    const article: Article = {
      id: "art-cred-warning-test",
      title: "Credential Warning Modal Test",
      feature: "Worktrees",
      channel: "Dev.to",
      angle: "Architecture",
      summary: "Summary for credential warning test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Draft",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              devto_configured: false,
              hashnode_configured: false,
              publish_as_draft: true,
            }),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              formatted_content: "Formatted markdown content",
              preview_type: "markdown",
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
          initialTab="export"
        />,
      );
    });

    // Allow initial useEffect (syndication settings fetch) to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // 1. Verify Dev.to warning callout renders ActionButton with variant="secondary" and size="xs"
    const devtoBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Configure Dev.to Key"),
    );
    expect(devtoBtn).toBeDefined();
    expect(devtoBtn!.className).toContain("bg-slate-800");
    expect(devtoBtn!.className).toContain("text-slate-200");
    expect(devtoBtn!.className).toContain("px-2.5");
    expect(devtoBtn!.className).toContain("py-1");

    // Clicking it opens the configuration drawer
    expect(container!.textContent).not.toContain("Syndication API Credentials & Settings");
    await act(async () => {
      devtoBtn!.click();
    });
    expect(container!.textContent).toContain("Syndication API Credentials & Settings");

    // Close the drawer for the next check
    const closeConfigBtn = Array.from(container!.querySelectorAll("button")).find(
      (btn) => btn.querySelector("svg.lucide-x") !== null,
    );
    if (closeConfigBtn) {
      await act(async () => {
        closeConfigBtn.click();
      });
    }

    // 2. Switch to Hashnode channel
    const hashnodeTabBtn = Array.from(container!.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Hashnode",
    );
    expect(hashnodeTabBtn).toBeDefined();
    await act(async () => {
      hashnodeTabBtn!.click();
      await Promise.resolve();
    });

    // Verify Hashnode warning callout renders ActionButton with variant="secondary" and size="xs"
    const hashnodeBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Configure Hashnode Token"),
    );
    expect(hashnodeBtn).toBeDefined();
    expect(hashnodeBtn!.className).toContain("bg-slate-800");
    expect(hashnodeBtn!.className).toContain("text-slate-200");
    expect(hashnodeBtn!.className).toContain("px-2.5");
    expect(hashnodeBtn!.className).toContain("py-1");

    // Clicking it opens the configuration drawer
    await act(async () => {
      hashnodeBtn!.click();
    });
    expect(container!.textContent).toContain("Syndication API Credentials & Settings");
  });

  it("standardizes channel selector and hero format selector with SegmentedControl", async () => {
    const article: Article = {
      id: "art-channel-select-test",
      title: "Channel Selector Modal Test",
      feature: "Worktrees",
      channel: "Dev.to",
      angle: "Architecture",
      summary: "Summary for channel selector test",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Draft",
      created_at: new Date().toISOString(),
      engagement_badges: [],
      milestone_alerts: [],
    };

    const formattedCalls: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              devto_configured: true,
              hashnode_configured: true,
              publish_as_draft: false,
            }),
        });
      }
      if (url.includes("/format/")) {
        formattedCalls.push(url);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              formatted_content: `Formatted content for ${url.split("/").pop()}`,
              preview_type: "markdown",
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
          initialTab="export"
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    // 1. Verify syndication channel selector has radiogroup accessibility semantics
    const channelGroup = container!.querySelector(
      'div[role="radiogroup"][aria-label="Syndication channel selector"]',
    );
    expect(channelGroup).toBeDefined();

    const devtoRadio = channelGroup!.querySelector('button[role="radio"][aria-checked="true"]');
    expect(devtoRadio?.textContent).toContain("Dev.to");
    expect(devtoRadio?.className).toContain("bg-emerald-500/20");

    // 2. Select Medium channel
    const mediumRadio = Array.from(channelGroup!.querySelectorAll('button[role="radio"]')).find(
      (btn) => btn.textContent?.trim() === "Medium",
    );
    expect(mediumRadio).toBeDefined();
    expect(mediumRadio?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      mediumRadio!.click();
      await Promise.resolve();
    });

    expect(mediumRadio?.getAttribute("aria-checked")).toBe("true");
    expect(mediumRadio?.className).toContain("bg-emerald-500/20");
    expect(formattedCalls.some((call) => call.includes("Medium"))).toBe(true);

    // 3. Verify hero asset format selector has radiogroup semantics and switches formats
    const heroGroup = container!.querySelector(
      'div[role="radiogroup"][aria-label="Hero asset format selector"]',
    );
    expect(heroGroup).toBeDefined();

    const dualRadio = Array.from(heroGroup!.querySelectorAll('button[role="radio"]')).find((btn) =>
      btn.textContent?.includes("Dual"),
    );
    expect(dualRadio?.getAttribute("aria-checked")).toBe("true");
    expect(dualRadio?.className).toContain("bg-cyan-500/20");

    const svgRadio = Array.from(heroGroup!.querySelectorAll('button[role="radio"]')).find((btn) =>
      btn.textContent?.includes("Vector SVG"),
    );
    expect(svgRadio).toBeDefined();
    expect(svgRadio?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      svgRadio!.click();
      await Promise.resolve();
    });

    expect(svgRadio?.getAttribute("aria-checked")).toBe("true");
    expect(svgRadio?.className).toContain("bg-cyan-500/20");
  });

  it("renders primary modal navigation with tablist and switches tabs via click and keyboard", async () => {
    const article: Article = {
      id: "art-nav-tabs-test",
      title: "Modal Navigation Tabs Test Article",
      feature: "Worktrees",
      channel: "Dev.to",
      angle: "Architecture",
      summary: "Summary for navigation tabs test",
      content: "# Heading\nTest content for modal",
      backlinks: ["https://example.com/source"],
      outbound_citations: ["https://example.com/ref"],
      status: "Draft",
      created_at: new Date().toISOString(),
      exports: [
        {
          id: "exp-1",
          article_id: "art-nav-tabs-test",
          channel: "Dev.to",
          export_type: "syndication",
          created_at: new Date().toISOString(),
          status: "Success",
        },
      ],
      engagement_snapshots: [
        {
          timestamp: new Date().toISOString(),
          views: 100,
          reactions: 10,
          comments: 2,
        },
      ],
      engagement_badges: [],
      milestone_alerts: [],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              devto_configured: true,
              hashnode_configured: true,
              publish_as_draft: false,
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
          initialTab="content"
        />,
      );
    });

    // 1. Verify primary modal navigation renders role="tablist" with 5 tabs
    const tablist = container!.querySelector('div[role="tablist"][aria-label="Article view tabs"]');
    expect(tablist).toBeDefined();

    const tabs = Array.from(tablist!.querySelectorAll('button[role="tab"]'));
    expect(tabs).toHaveLength(5);

    const [contentTab, rawTab, backlinksTab, exportTab, engagementTab] = tabs;

    expect(contentTab.getAttribute("aria-selected")).toBe("true");
    expect(contentTab.textContent).toContain("Article Reading View");

    expect(rawTab.getAttribute("aria-selected")).toBe("false");
    expect(rawTab.textContent).toContain("Raw Markdown");

    expect(backlinksTab.getAttribute("aria-selected")).toBe("false");
    expect(backlinksTab.textContent).toContain("Backlinks & Citations (2)");

    expect(exportTab.getAttribute("aria-selected")).toBe("false");
    expect(exportTab.textContent).toContain("Export & Syndicate (1)");

    expect(engagementTab.getAttribute("aria-selected")).toBe("false");
    expect(engagementTab.textContent).toContain("Engagement & Velocity (1)");

    // Initially active tab is "content", displays article reading content
    expect(container!.textContent).toContain("Test content for modal");

    // 2. Click "raw" tab to switch to Raw Markdown view
    await act(async () => {
      rawTab.click();
    });

    expect(rawTab.getAttribute("aria-selected")).toBe("true");
    expect(contentTab.getAttribute("aria-selected")).toBe("false");
    const textarea = container!.querySelector("textarea");
    expect(textarea).toBeDefined();
    expect(textarea?.value).toBe(article.content);

    // 3. Switch tabs via keyboard navigation (ArrowRight from rawTab goes to backlinks)
    await act(async () => {
      tablist!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    expect(backlinksTab.getAttribute("aria-selected")).toBe("true");
    expect(container!.textContent).toContain("https://example.com/source");

    // 4. Click export tab and verify syndication view is displayed
    await act(async () => {
      exportTab.click();
    });

    expect(exportTab.getAttribute("aria-selected")).toBe("true");
    expect(container!.textContent).toContain("Export to Ivy Web");
  });

  it("downloads a vector SVG hero banner from the export tab's Download SVG button", async () => {
    const article: Article = {
      id: "art-svg-download-test",
      title: "SVG Download Export Test Article",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Summary for SVG download test",
      content: "Content for SVG download test",
      backlinks: [],
      outbound_citations: [],
      status: "Draft",
      created_at: new Date().toISOString(),
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              devto_configured: false,
              hashnode_configured: false,
              publish_as_draft: true,
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
          initialTab="export"
        />,
      );
    });

    const clickedDownloads: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    };

    try {
      const downloadSvgBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
        btn.textContent?.includes("Download SVG"),
      );
      expect(downloadSvgBtn).toBeDefined();

      await act(async () => {
        downloadSvgBtn!.click();
      });

      expect(mockBlobUrl!.createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = mockBlobUrl!.createObjectURL.mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect((blob as Blob).type).toBe("image/svg+xml;charset=utf-8");
      expect(await (blob as Blob).text()).toContain("<svg");
      expect(mockBlobUrl!.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      expect(mockBlobUrl!.getCreatedUrls()).toEqual(["blob:mock-url"]);
      expect(mockBlobUrl!.getRevokedUrls()).toEqual(["blob:mock-url"]);

      expect(clickedDownloads.some((name) => name.endsWith("-hero.svg"))).toBe(true);
      expect(container!.textContent).toContain("Downloaded vector SVG!");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});
