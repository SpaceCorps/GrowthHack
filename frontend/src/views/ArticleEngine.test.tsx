import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleEngine } from "./ArticleEngine";
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
});
