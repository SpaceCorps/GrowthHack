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

    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();
    const backdrop = dialog!.parentElement;
    expect(backdrop).toBeDefined();

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
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

    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();

    await act(async () => {
      dialog!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container!.textContent).toContain("Reset Article Engagement?");
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

    // Try dismissing via backdrop click
    const dialog = container!.querySelector('div[role="dialog"]');
    expect(dialog).toBeDefined();
    const backdrop = dialog!.parentElement;
    expect(backdrop).toBeDefined();

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container!.textContent).toContain("Reset Article Engagement?");

    // Resolve promise to clean up
    await act(async () => {
      resolveSeed!({
        ok: true,
        json: () => Promise.resolve({ success: true, article }),
      });
    });

    expect(container!.textContent).not.toContain("Reset Article Engagement?");
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
});
