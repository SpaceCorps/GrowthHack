import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleEngine } from "./ArticleEngine";
import { ArticleModal } from "../components/ArticleModal";
import type { Article } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const setInputValue = (input: HTMLInputElement, value: string) => {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("ArticleEngine Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string, _options?: RequestInit) => {
      if (typeof url === "string" && url.includes("/api/articles/engagement-history")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ snapshots: [], velocity: null }),
        });
      }
      if (typeof url === "string" && url.includes("/api/articles/alerts/acknowledge-all")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
      }
      if (
        typeof url === "string" &&
        url.includes("/api/articles/alerts/") &&
        url.includes("/acknowledge")
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
      }
      if (typeof url === "string" && url.includes("/api/articles/alerts")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      if (typeof url === "string" && url.includes("/api/articles/sync-metrics")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, updated_count: 0 }),
        });
      }
      if (typeof url === "string" && url.includes("/api/articles/reset-engagement")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            reset_count: 2,
            message:
              "Reset all article engagement metrics, milestone alerts, and global snapshots to zero.",
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;
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
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders both mode tabs ("10x Feature Articles" and "Cool Project Spotlight")', async () => {
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    expect(container!.textContent).toContain("10x Feature Articles (Issue #1)");
    expect(container!.textContent).toContain("Cool Project Spotlight (Issue #17)");
  });

  it('switching to "Cool Project Spotlight" displays the project spotlight input fields', async () => {
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const spotlightTab = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Cool Project Spotlight"),
    );
    expect(spotlightTab).toBeDefined();

    await act(async () => {
      spotlightTab!.click();
    });

    expect(container!.textContent).toContain("Project Name");
    expect(container!.textContent).toContain("GitHub Repository URL");
    expect(container!.textContent).toContain("Opening Hook / Differentiator");
    expect(container!.textContent).toContain("Stanislav Beliaev Format Anatomy");
  });

  it("submitting feature article form calls onGenerateArticle with selected feature and archetype", async () => {
    const onGenerate = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={onGenerate}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const selects = container!.querySelectorAll("select");
    const featureSelect = selects[0] as HTMLSelectElement;
    const angleSelect = selects[1] as HTMLSelectElement;

    await act(async () => {
      featureSelect.value = "Verification Gates";
      featureSelect.dispatchEvent(new Event("change", { bubbles: true }));
      angleSelect.value = "Benchmark";
      angleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const form = container!.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerate).toHaveBeenCalledWith("Verification Gates", "Benchmark", "Website", "");
  });

  it("submitting spotlight form calls the spotlight generation handler with repository URL and project details", async () => {
    const onGenerateSpotlight = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onGenerateSpotlight={onGenerateSpotlight}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const spotlightTab = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Cool Project Spotlight"),
    );
    await act(async () => {
      spotlightTab!.click();
    });

    const inputs = container!.querySelectorAll("input");
    await act(async () => {
      setInputValue(inputs[0], "OpenBot");
      setInputValue(inputs[1], "https://github.com/openbot-ai/openbot");
      setInputValue(inputs[2], "Autonomous robotics in 50 lines of Rust");
      setInputValue(inputs[3], "Zero config, local inference");
    });

    const form = container!.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerateSpotlight).toHaveBeenCalledWith(
      expect.objectContaining({
        project_name: "OpenBot",
        repo_url: "https://github.com/openbot-ai/openbot",
        tagline: "Autonomous robotics in 50 lines of Rust",
        key_features: ["Zero config", "local inference"],
        target_channel: "LinkedIn",
      }),
    );
  });

  it("submitting feature article form with custom timeout calls onGenerateArticle with timeoutSecs", async () => {
    const onGenerate = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={onGenerate}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const inputs = container!.querySelectorAll("input");
    await act(async () => {
      setInputValue(inputs[0] as HTMLInputElement, "Extra context notes");
      setInputValue(inputs[1] as HTMLInputElement, "180");
    });

    const form = container!.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerate).toHaveBeenCalledWith(
      "Worktrees",
      "Architecture",
      "Website",
      "Extra context notes",
      180,
    );
  });

  it("submitting spotlight form with custom timeout calls onGenerateSpotlight with timeout_secs", async () => {
    const onGenerateSpotlight = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onGenerateSpotlight={onGenerateSpotlight}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const spotlightTab = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Cool Project Spotlight"),
    );
    await act(async () => {
      spotlightTab!.click();
    });

    const inputs = container!.querySelectorAll("input");
    await act(async () => {
      setInputValue(inputs[0], "OpenBot");
      setInputValue(inputs[1], "https://github.com/openbot-ai/openbot");
      setInputValue(inputs[2], "Autonomous robotics in 50 lines of Rust");
      setInputValue(inputs[3], "Zero config, local inference");
      setInputValue(inputs[4], "Optional benchmark notes");
      setInputValue(inputs[5], "240");
    });

    const form = container!.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerateSpotlight).toHaveBeenCalledWith(
      expect.objectContaining({
        project_name: "OpenBot",
        repo_url: "https://github.com/openbot-ai/openbot",
        tagline: "Autonomous robotics in 50 lines of Rust",
        key_features: ["Zero config", "local inference"],
        target_channel: "LinkedIn",
        extra_notes: "Optional benchmark notes",
        timeout_secs: 240,
      }),
    );
  });

  it("enforces min=10 and max=3600 on feature and spotlight timeout inputs", async () => {
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const featureTimeoutInput = Array.from(container!.querySelectorAll("input")).find((input) =>
      input.placeholder?.includes("Default (300s)"),
    );
    expect(featureTimeoutInput).toBeDefined();
    expect(featureTimeoutInput?.getAttribute("min")).toBe("10");
    expect(featureTimeoutInput?.getAttribute("max")).toBe("3600");

    const spotlightTab = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Cool Project Spotlight"),
    );
    await act(async () => {
      spotlightTab!.click();
    });

    const spotlightTimeoutInput = Array.from(container!.querySelectorAll("input")).find((input) =>
      input.placeholder?.includes("Default (300s)"),
    );
    expect(spotlightTimeoutInput).toBeDefined();
    expect(spotlightTimeoutInput?.getAttribute("min")).toBe("10");
    expect(spotlightTimeoutInput?.getAttribute("max")).toBe("3600");
  });

  it("submitting feature article form with out-of-bounds timeout ignores timeout override", async () => {
    const onGenerate = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={onGenerate}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const inputs = container!.querySelectorAll("input");
    const form = container!.querySelector("form") as HTMLFormElement;

    // Timeout below 10 (e.g. 5)
    await act(async () => {
      setInputValue(inputs[0] as HTMLInputElement, "Extra context notes");
      setInputValue(inputs[1] as HTMLInputElement, "5");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerate).toHaveBeenCalledWith(
      "Worktrees",
      "Architecture",
      "Website",
      "Extra context notes",
    );
    expect(onGenerate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      5,
    );

    onGenerate.mockClear();

    // Timeout above 3600 (e.g. 5000)
    await act(async () => {
      setInputValue(inputs[0] as HTMLInputElement, "Extra context notes 2");
      setInputValue(inputs[1] as HTMLInputElement, "5000");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerate).toHaveBeenCalledWith(
      "Worktrees",
      "Architecture",
      "Website",
      "Extra context notes 2",
    );
    expect(onGenerate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      5000,
    );
  });

  it("submitting spotlight form with out-of-bounds timeout ignores timeout override", async () => {
    const onGenerateSpotlight = vi.fn();
    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onGenerateSpotlight={onGenerateSpotlight}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    const spotlightTab = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Cool Project Spotlight"),
    );
    await act(async () => {
      spotlightTab!.click();
    });

    const inputs = container!.querySelectorAll("input");
    const form = container!.querySelector("form") as HTMLFormElement;

    // Set timeout to 9 (below min 10)
    await act(async () => {
      setInputValue(inputs[0], "OpenBot");
      setInputValue(inputs[1], "https://github.com/openbot-ai/openbot");
      setInputValue(inputs[2], "Autonomous robotics in 50 lines of Rust");
      setInputValue(inputs[3], "Zero config, local inference");
      setInputValue(inputs[4], "Optional benchmark notes");
      setInputValue(inputs[5], "9");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerateSpotlight).toHaveBeenCalledWith(
      expect.objectContaining({
        project_name: "OpenBot",
        repo_url: "https://github.com/openbot-ai/openbot",
      }),
    );
    expect(onGenerateSpotlight.mock.calls[0][0].timeout_secs).toBeUndefined();

    onGenerateSpotlight.mockClear();

    // Set timeout to 4000 (above max 3600)
    await act(async () => {
      setInputValue(inputs[0], "OpenBot");
      setInputValue(inputs[1], "https://github.com/openbot-ai/openbot");
      setInputValue(inputs[2], "Autonomous robotics in 50 lines of Rust");
      setInputValue(inputs[3], "Zero config, local inference");
      setInputValue(inputs[4], "Optional benchmark notes");
      setInputValue(inputs[5], "4000");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onGenerateSpotlight).toHaveBeenCalledWith(
      expect.objectContaining({
        project_name: "OpenBot",
        repo_url: "https://github.com/openbot-ai/openbot",
      }),
    );
    expect(onGenerateSpotlight.mock.calls[0][0].timeout_secs).toBeUndefined();
  });

  it("articles list displays all 10 archetypes and spotlight badges properly", async () => {
    const archetypes = [
      "Architecture",
      "Benchmark",
      "Comparison",
      "Tutorial",
      "Postmortem",
      "Ecosystem",
      "Migration",
      "Security",
      "TokenEconomics",
      "Manifesto",
    ];

    const sampleArticles: Article[] = [
      ...archetypes.map((angle, idx) => ({
        id: `art-${idx}`,
        title: `Article on ${angle}`,
        feature: "Worktrees",
        channel: "Dev.to",
        angle,
        summary: `Summary of ${angle}`,
        content: `Content of ${angle}`,
        backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
        outbound_citations: ["https://git-scm.com/docs/git-worktree"],
        status: "Draft" as const,
        created_at: new Date().toISOString(),
      })),
      {
        id: "art-spotlight",
        title: "Spotlight on OpenBot",
        feature: "Open Source Spotlight",
        channel: "LinkedIn",
        angle: "Project Spotlight",
        summary: "Spotlight summary",
        content: "Spotlight content",
        backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
        outbound_citations: ["https://github.com/openbot-ai/openbot"],
        status: "Draft" as const,
        created_at: new Date().toISOString(),
      },
    ];

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={sampleArticles}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    for (const archetype of archetypes) {
      expect(container!.textContent).toContain(archetype);
    }

    const badges = Array.from(container!.querySelectorAll("span"));
    const spotlightBadge = badges.find((s) => s.textContent === "Project Spotlight");
    expect(spotlightBadge).toBeDefined();
    expect(spotlightBadge?.className).toContain("text-amber-300");
  });

  it("renders aggregate reader engagement metrics in content authority dashboard", async () => {
    const testArticles: Article[] = [
      {
        id: "art-eng-1",
        title: "Worktree Mastery",
        feature: "Worktrees",
        channel: "Dev.to",
        angle: "Architecture",
        summary: "Worktree deep dive",
        content: "Content",
        backlinks: [],
        outbound_citations: [],
        status: "Published",
        created_at: new Date().toISOString(),
        engagement: {
          views: 1200,
          reactions: 85,
          comments: 14,
          last_synced_at: "2026-09-10T12:00:00Z",
        },
      },
      {
        id: "art-eng-2",
        title: "Autonomous Coding",
        feature: "Multi-Agent Orchestration",
        channel: "Hashnode",
        angle: "Tutorial",
        summary: "Coding tutorial",
        content: "Content",
        backlinks: [],
        outbound_citations: [],
        status: "Published",
        created_at: new Date().toISOString(),
        engagement: {
          views: 450,
          reactions: 32,
          comments: 6,
          last_synced_at: "2026-09-10T14:30:00Z",
        },
      },
    ];

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={testArticles}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    expect(container!.textContent).toContain("Reader Engagement");
    expect(container!.textContent).toContain("Total Views");
    expect(container!.textContent).toContain("1650");
    expect(container!.textContent).toContain("Total Reactions");
    expect(container!.textContent).toContain("117");
    expect(container!.textContent).toContain("Total Comments");
    expect(container!.textContent).toContain("20");
  });

  it("renders per-channel engagement chips on article cards", async () => {
    const testArticles: Article[] = [
      {
        id: "art-exported-1",
        title: "Syndicated Article",
        feature: "Worktrees",
        channel: "Website",
        angle: "Architecture",
        summary: "Summary",
        content: "Content",
        backlinks: [],
        outbound_citations: [],
        status: "Published",
        created_at: new Date().toISOString(),
        exports: [
          {
            channel: "Dev.to",
            exported_at: new Date().toISOString(),
            target_path: "https://dev.to/article/123",
            status: "Success",
            external_id: "123",
            engagement: {
              views: 350,
              reactions: 42,
              comments: 8,
              last_synced_at: new Date().toISOString(),
            },
          },
          {
            channel: "Hashnode",
            exported_at: new Date().toISOString(),
            target_path: "https://hashnode.com/post/456",
            status: "Success",
            external_id: "456",
            engagement: {
              views: 180,
              reactions: 15,
              comments: 2,
              last_synced_at: new Date().toISOString(),
            },
          },
        ],
      },
    ];

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={testArticles}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    expect(container!.textContent).toContain("Dev.to: 350 views • 42 reactions • 8 comments");
    expect(container!.textContent).toContain("Hashnode: 180 views • 15 reactions • 2 comments");
  });

  it("sync metrics button triggers sync and displays loading state", async () => {
    let resolveSync!: () => void;
    const syncPromise = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });
    const onSyncMetrics = vi.fn().mockImplementation(() => syncPromise);

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
          onSyncMetrics={onSyncMetrics}
        />,
      );
    });

    const syncButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Sync Metrics"),
    );
    expect(syncButton).toBeDefined();

    await act(async () => {
      syncButton!.click();
    });

    expect(onSyncMetrics).toHaveBeenCalled();
    expect(syncButton!.textContent).toContain("Syncing...");
    expect(syncButton!.disabled).toBe(true);

    await act(async () => {
      resolveSync();
    });

    expect(syncButton!.textContent).toContain("Sync Metrics");
    expect(syncButton!.disabled).toBe(false);
  });

  it("renders engagement velocity statistics and trend trajectory badge when history is loaded", async () => {
    const mockHistory = {
      snapshots: [
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          views: 100,
          reactions: 10,
          comments: 2,
        },
        {
          timestamp: new Date().toISOString(),
          views: 350,
          reactions: 35,
          comments: 8,
        },
      ],
      velocity: {
        views_24h: 250,
        reactions_24h: 25,
        comments_24h: 6,
        views_per_day: 250.0,
        reactions_per_day: 25.0,
        comments_per_day: 6.0,
        trend: "Accelerating",
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/articles/engagement-history")) {
        return Promise.resolve(new Response(JSON.stringify(mockHistory), { status: 200 }));
      }
      if (typeof url === "string" && url.includes("/api/articles/alerts")) {
        return Promise.resolve(new Response("[]", { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    // Wait for fetch effect
    await act(async () => {
      await Promise.resolve();
    });

    expect(container!.textContent).toContain("+250.0/day");
    expect(container!.textContent).toContain("Trend Trajectory:");
    expect(container!.textContent).toContain("Accelerating");
    expect(container!.textContent).toContain("+250 views, +25 reacts, +6 comments");

    fetchSpy.mockRestore();
  });

  it("renders engagement velocity chart with pure SVG elements and timeframe buttons", async () => {
    const mockHistory = {
      snapshots: [
        {
          timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
          views: 50,
          reactions: 5,
          comments: 1,
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          views: 120,
          reactions: 15,
          comments: 3,
        },
        {
          timestamp: new Date().toISOString(),
          views: 300,
          reactions: 40,
          comments: 10,
        },
      ],
      velocity: {
        views_24h: 180,
        reactions_24h: 25,
        comments_24h: 7,
        views_per_day: 180.0,
        reactions_per_day: 25.0,
        comments_per_day: 7.0,
        trend: "Accelerating",
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/articles/engagement-history")) {
        return Promise.resolve(new Response(JSON.stringify(mockHistory), { status: 200 }));
      }
      if (typeof url === "string" && url.includes("/api/articles/alerts")) {
        return Promise.resolve(new Response("[]", { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container!.textContent).toContain("Global Engagement Velocity & Trend Trajectory");
    const svgEl = container!.querySelector("svg");
    expect(svgEl).toBeDefined();

    // Verify timeframe buttons
    const timeframeButtons = Array.from(container!.querySelectorAll("button")).filter((b) =>
      ["24h", "7d", "30d", "All"].includes(b.textContent || ""),
    );
    expect(timeframeButtons.length).toBe(4);

    // Switch to 24h
    const btn24h = timeframeButtons.find((b) => b.textContent === "24h");
    expect(btn24h).toBeDefined();

    await act(async () => {
      btn24h!.click();
    });

    // Verify 24h is now selected
    expect(btn24h!.className).toContain("bg-indigo-950");

    fetchSpy.mockRestore();
  });

  it("renders engagement milestone badges on article card", async () => {
    const article: Article = {
      id: "art-1",
      title: "Worktree Magic",
      feature: "Worktrees",
      channel: "Dev.to",
      angle: "Tutorial",
      summary: "Worktree tutorial",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: ["100+ Views", "25+ Reactions"],
    };

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[article]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    expect(container!.textContent).toContain("100+ Views");
    expect(container!.textContent).toContain("25+ Reactions");
  });

  it("renders active engagement milestone alerts banner and handles acknowledge", async () => {
    const alerts = [
      {
        id: "alert-1",
        article_id: "art-1",
        article_title: "Worktree Magic",
        milestone_type: "views",
        threshold: 100,
        message: "'Worktree Magic' reached 100+ Views!",
        badge_awarded: "100+ Views",
        triggered_at: new Date().toISOString(),
        acknowledged: false,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/articles/alerts?unacknowledged=true")) {
        return new Response(JSON.stringify(alerts), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/articles/alerts/alert-1/acknowledge")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/articles/engagement-history")) {
        return new Response(JSON.stringify({ snapshots: [], velocity: null }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    expect(container!.textContent).toContain("Milestone Achievement Alerts");
    expect(container!.textContent).toContain("Worktree Magic");
    expect(container!.textContent).toContain("100+ Views");

    const ackButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Acknowledge"),
    );
    expect(ackButton).toBeDefined();

    await act(async () => {
      ackButton!.click();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/articles/alerts/alert-1/acknowledge",
      expect.objectContaining({ method: "POST" }),
    );

    fetchSpy.mockRestore();
  });

  it("displays unlocked milestones in article modal engagement tab", async () => {
    const article: Article = {
      id: "art-modal-test",
      title: "Worktree Deep Dive",
      feature: "Worktrees",
      channel: "Dev.to",
      angle: "Tutorial",
      summary: "Summary",
      content: "Content",
      backlinks: [],
      outbound_citations: [],
      status: "Published",
      created_at: new Date().toISOString(),
      engagement_badges: ["100+ Views", "25+ Reactions"],
      milestone_alerts: [
        {
          id: "alert-1",
          article_id: "art-modal-test",
          article_title: "Worktree Deep Dive",
          milestone_type: "views",
          threshold: 100,
          message: "Reached 100+ Views!",
          badge_awarded: "100+ Views",
          triggered_at: new Date().toISOString(),
          acknowledged: false,
        },
      ],
    };

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

    expect(container!.textContent).toContain("Engagement Milestones");
    expect(container!.textContent).toContain("100+ Views");
    expect(container!.textContent).toContain("25+ Reactions");
    expect(container!.textContent).toContain("Milestone Achievement History");
    expect(container!.textContent).toContain("100");
  });

  it("fetches engagement history and active alerts on mount and updates state cleanly", async () => {
    const alerts = [
      {
        id: "alert-mount-1",
        article_id: "art-1",
        article_title: "Automated Growth Hack",
        milestone_type: "views",
        threshold: 50,
        message: "'Automated Growth Hack' reached 50+ Views!",
        badge_awarded: "50+ Views",
        triggered_at: new Date().toISOString(),
        acknowledged: false,
      },
    ];

    const history = {
      snapshots: [],
      velocity: {
        views_24h: 42,
        reactions_24h: 5,
        comments_24h: 1,
        views_per_day: 42.0,
        reactions_per_day: 5.0,
        comments_per_day: 1.0,
        trend: "Stable",
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/articles/alerts?unacknowledged=true")) {
        return new Response(JSON.stringify(alerts), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/articles/engagement-history")) {
        return new Response(JSON.stringify(history), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );
    });

    // Wait for fetch effects to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/articles/engagement-history");
    expect(fetchSpy).toHaveBeenCalledWith("/api/articles/alerts?unacknowledged=true");
    expect(container!.textContent).toContain("Milestone Achievement Alerts");
    expect(container!.textContent).toContain("Automated Growth Hack");
    expect(container!.textContent).toContain("+42.0/day");

    fetchSpy.mockRestore();
  });

  it("reset all metrics button calls reset API, triggers onResetEngagement, shows loading state, and displays feedback banner", async () => {
    let resolveReset!: () => void;
    const resetPromise = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>(
      (resolve) => {
        resolveReset = () =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              reset_count: 2,
              message:
                "Reset all article engagement metrics, milestone alerts, and global snapshots to zero.",
            }),
          });
      },
    );

    const onResetEngagement = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, _options) => {
      if (typeof url === "string" && url.includes("/api/articles/reset-engagement")) {
        return resetPromise as unknown as Response;
      }
      if (typeof url === "string" && url.includes("/api/articles/engagement-history")) {
        return new Response(JSON.stringify({ snapshots: [], velocity: null }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/articles/alerts")) {
        return new Response("[]", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    await act(async () => {
      root!.render(
        <ArticleEngine
          articles={[]}
          onGenerateArticle={vi.fn()}
          onSelectArticle={vi.fn()}
          onUpdateStatus={vi.fn()}
          onResetEngagement={onResetEngagement}
        />,
      );
    });

    const resetButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Reset All Metrics"),
    );
    expect(resetButton).toBeDefined();
    expect(resetButton?.title).toBe(
      "Reset all workspace engagement metrics, snapshots, and badges to zero",
    );

    await act(async () => {
      resetButton!.click();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/articles/reset-engagement",
      expect.objectContaining({ method: "POST" }),
    );
    expect(resetButton!.textContent).toContain("Resetting...");
    expect(resetButton!.disabled).toBe(true);

    await act(async () => {
      resolveReset();
    });

    expect(onResetEngagement).toHaveBeenCalled();
    expect(resetButton!.textContent).toContain("Reset All Metrics");
    expect(resetButton!.disabled).toBe(false);
    expect(container!.textContent).toContain(
      "Reset all article engagement metrics, milestone alerts, and global snapshots to zero.",
    );

    fetchSpy.mockRestore();
  });
});
