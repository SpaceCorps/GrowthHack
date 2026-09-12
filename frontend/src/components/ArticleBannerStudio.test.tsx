import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleBannerStudio } from "./ArticleBannerStudio";
import type { Article } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../utils/banner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/banner")>();
  return {
    ...actual,
    rasterizeSvgToPngDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,mockPngData"),
  };
});

describe("ArticleBannerStudio Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const originalFetch = globalThis.fetch;

  const mockArticle: Article = {
    id: "art-banner-1",
    title: "Autonomous Agent Orchestration",
    feature: "AgentLoop",
    channel: "Website",
    angle: "Architecture",
    summary: "Exploring multi-agent swarms with Tendril plan orchestration.",
    content: "Body content here",
    backlinks: [],
    outbound_citations: [],
    status: "Draft",
    created_at: new Date().toISOString(),
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

  it("verifies theme selection changes the preview SVG markup", async () => {
    await act(async () => {
      root!.render(
        <ArticleBannerStudio article={mockArticle} currentSlug="autonomous-agent-orchestration" />,
      );
    });

    const previewContainer = container!.querySelector(".aspect-\\[1200\\/630\\]");
    expect(previewContainer).toBeDefined();
    // Default theme for Architecture is dark-cyan (#06b6d4)
    expect(previewContainer!.innerHTML).toContain("#06b6d4");

    // Click "Midnight Emerald" button
    const emeraldBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Midnight Emerald"),
    );
    expect(emeraldBtn).toBeDefined();

    await act(async () => {
      emeraldBtn!.click();
    });

    // Preview SVG now reflects Midnight Emerald (#10b981)
    expect(previewContainer!.innerHTML).toContain("#10b981");
  });

  it("updates title, category, and summary in preview SVG upon input changes", async () => {
    await act(async () => {
      root!.render(
        <ArticleBannerStudio article={mockArticle} currentSlug="autonomous-agent-orchestration" />,
      );
    });

    const previewContainer = container!.querySelector(".aspect-\\[1200\\/630\\]");

    // Title input change
    const titleInput = Array.from(container!.querySelectorAll("input")).find(
      (input) => input.placeholder === mockArticle.title,
    );
    expect(titleInput).toBeDefined();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(titleInput, "Refactored System Pipeline");
      titleInput!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(previewContainer!.innerHTML).toContain("Refactored System Pipeline");

    // Category button click (e.g. "Tutorial")
    const tutorialBtn = Array.from(container!.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Tutorial",
    );
    expect(tutorialBtn).toBeDefined();

    await act(async () => {
      tutorialBtn!.click();
    });

    expect(previewContainer!.innerHTML).toContain("TUTORIAL");

    // Summary input change
    const summaryInput = Array.from(container!.querySelectorAll("input")).find(
      (input) => input.placeholder === mockArticle.summary,
    );
    expect(summaryInput).toBeDefined();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(summaryInput, "New custom summary text");
      summaryInput!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(previewContainer!.innerHTML).toContain("New custom summary text");
  });

  it("triggers anchor download flow on Download PNG and Download SVG button clicks", async () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-svg-url");
    const revokeObjectURLMock = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;

    const clickedDownloads: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    };

    try {
      await act(async () => {
        root!.render(
          <ArticleBannerStudio
            article={mockArticle}
            currentSlug="autonomous-agent-orchestration"
          />,
        );
      });

      // Download SVG click
      const downloadSvgBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
        btn.textContent?.includes("Download SVG"),
      );
      expect(downloadSvgBtn).toBeDefined();

      await act(async () => {
        downloadSvgBtn!.click();
      });

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickedDownloads).toContain("autonomous-agent-orchestration-hero.svg");
      expect(container!.textContent).toContain("Downloaded vector SVG!");

      // Download PNG click
      const downloadPngBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
        btn.textContent?.includes("Download PNG"),
      );
      expect(downloadPngBtn).toBeDefined();

      await act(async () => {
        downloadPngBtn!.click();
      });

      expect(clickedDownloads).toContain("autonomous-agent-orchestration-hero.png");
      expect(container!.textContent).toContain("Downloaded 1200x630 PNG!");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it("dispatches upload request and invokes callbacks on Sync Rendered PNG click", async () => {
    const onArticleUpdated = vi.fn();
    const onAssetSyncResult = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/upload-hero-image")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string);
        expect(body.image_data).toBe("data:image/png;base64,mockPngData");
        expect(body.target_images_dir).toBe("/custom/images/dir");

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              image_path: "/custom/images/dir/hero.png",
              slug: "autonomous-agent-orchestration",
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
        <ArticleBannerStudio
          article={mockArticle}
          currentSlug="autonomous-agent-orchestration"
          ivyTargetImagesDir="/custom/images/dir"
          onArticleUpdated={onArticleUpdated}
          onAssetSyncResult={onAssetSyncResult}
        />,
      );
    });

    const syncBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Sync Rendered PNG"),
    );
    expect(syncBtn).toBeDefined();

    await act(async () => {
      syncBtn!.click();
    });

    expect(onAssetSyncResult).toHaveBeenCalledWith({
      success: true,
      image_path: "/custom/images/dir/hero.png",
    });
    expect(onArticleUpdated).toHaveBeenCalledWith({
      ...mockArticle,
      image_path: "/custom/images/dir/hero.png",
      slug: "autonomous-agent-orchestration",
    });
  });
});
