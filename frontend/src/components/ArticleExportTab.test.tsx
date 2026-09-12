import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { ArticleExportTab } from "./ArticleExportTab";
import type { Article, ExportPathSettings, SyndicationStatusResponse } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../utils/banner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/banner")>();
  return {
    ...actual,
    rasterizeSvgToPngDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,mockPngData"),
  };
});

describe("ArticleExportTab Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const originalFetch = globalThis.fetch;

  const mockArticle: Article = {
    id: "art-export-1",
    title: "Syndication Architecture",
    feature: "CrossPosting",
    channel: "Dev.to",
    angle: "Architecture",
    summary: "Deep dive into multi-channel syndicated distribution.",
    content: "# Markdown Content",
    backlinks: [],
    outbound_citations: [],
    status: "Ready",
    created_at: new Date().toISOString(),
    exports: [],
  };

  const unconfiguredSettings: SyndicationStatusResponse = {
    devto_configured: false,
    hashnode_configured: false,
    webhook_secret_configured: false,
    publish_as_draft: true,
    devto_key_preview: null,
    hashnode_key_preview: null,
    hashnode_publication_id: null,
    webhook_secret_preview: null,
  };

  const configuredSettings: SyndicationStatusResponse = {
    devto_configured: true,
    hashnode_configured: true,
    webhook_secret_configured: true,
    publish_as_draft: true,
    devto_key_preview: "dev_...1234",
    hashnode_key_preview: "hash_...5678",
    hashnode_publication_id: "pub-123",
    webhook_secret_preview: "sec_...9999",
  };

  const mockExportPaths: ExportPathSettings = {
    content_path: "/srv/ivy-web/content/posts",
    images_path: "/srv/ivy-web/public/site/images",
    content_path_source: "detected",
    images_path_source: "detected",
    content_path_override: null,
    images_path_override: null,
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

  it("updates preview format when switching channel tabs", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/export-paths")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExportPaths),
        });
      }
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unconfiguredSettings),
        });
      }
      if (url.includes("/format/Dev.to")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              formatted_content: "--- title: Dev.to Format ---",
              preview_type: "markdown",
            }),
        });
      }
      if (url.includes("/format/LinkedIn")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              formatted_content: "🚀 LinkedIn post preview content",
              preview_type: "social",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleExportTab article={mockArticle} />);
    });

    const textarea = container!.querySelector("textarea");
    expect(textarea).toBeDefined();
    expect(textarea!.value).toBe("--- title: Dev.to Format ---");

    // Click "LinkedIn" channel button
    const linkedInBtn = Array.from(container!.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "LinkedIn",
    );
    expect(linkedInBtn).toBeDefined();

    await act(async () => {
      linkedInBtn!.click();
    });

    const updatedTextarea = container!.querySelector("textarea");
    expect(updatedTextarea).toBeDefined();
    expect(updatedTextarea!.value).toBe("🚀 LinkedIn post preview content");
  });

  it("handles credential drawer open/close and save submission", async () => {
    let savedSettings: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/settings/export-paths")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExportPaths),
        });
      }
      if (url.includes("/settings/syndication")) {
        if (init?.method === "POST") {
          savedSettings = JSON.parse(init?.body as string);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(configuredSettings),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unconfiguredSettings),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ formatted_content: "Content", preview_type: "markdown" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleExportTab article={mockArticle} />);
    });

    // Drawer is closed initially
    expect(container!.textContent).not.toContain("Syndication API Credentials & Settings");

    // Open drawer
    const configBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Configure API Keys"),
    );
    expect(configBtn).toBeDefined();

    await act(async () => {
      configBtn!.click();
    });

    expect(container!.textContent).toContain("Syndication API Credentials & Settings");

    // Fill Dev.to API key
    const passwordInputs = container!.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2);
    const devtoInput = passwordInputs[0] as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(devtoInput, "my-test-devto-key");
      devtoInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Submit form
    const saveBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Save Credentials"),
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn!.click();
    });

    expect(savedSettings).toBeDefined();
    expect(savedSettings.devto_api_key).toBe("my-test-devto-key");
    expect(container!.textContent).toContain("Credentials saved successfully!");
  });

  it("renders credential warning banners for unconfigured channels", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/export-paths")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExportPaths),
        });
      }
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unconfiguredSettings),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ formatted_content: "Content", preview_type: "markdown" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleExportTab article={mockArticle} />);
    });

    // On Dev.to (default channel), warning is shown
    expect(container!.textContent).toContain(
      "Dev.to API key is not configured for direct publishing.",
    );
    expect(container!.textContent).toContain("Configure Dev.to Key");

    // Switch to Hashnode
    const hashnodeBtn = Array.from(container!.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Hashnode",
    );
    expect(hashnodeBtn).toBeDefined();

    await act(async () => {
      hashnodeBtn!.click();
    });

    expect(container!.textContent).toContain(
      "Hashnode Personal Access Token is not configured for direct publishing.",
    );
    expect(container!.textContent).toContain("Configure Hashnode Token");
  });

  it("dispatches to direct publishing endpoint and updates status on button click", async () => {
    const onArticleUpdated = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/settings/export-paths")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExportPaths),
        });
      }
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(configuredSettings),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ formatted_content: "Content", preview_type: "markdown" }),
        });
      }
      if (url.includes("/publish/devto")) {
        expect(init?.method).toBe("POST");
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              url: "https://dev.to/spacecorps/syndication-architecture",
              record: {
                channel: "Dev.to",
                status: "Published",
                target_path: "https://dev.to/spacecorps/syndication-architecture",
                exported_at: new Date().toISOString(),
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
      root!.render(<ArticleExportTab article={mockArticle} onArticleUpdated={onArticleUpdated} />);
    });

    const publishBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Publish to Dev.to"),
    );
    expect(publishBtn).toBeDefined();

    await act(async () => {
      publishBtn!.click();
    });

    expect(container!.textContent).toContain("Successfully syndicated to Dev.to!");
    expect(container!.textContent).toContain("Open Published Article");
    expect(onArticleUpdated).toHaveBeenCalled();
  });

  it("renders backend-resolved default export paths as placeholders", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/export-paths")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExportPaths),
        });
      }
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unconfiguredSettings),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ formatted_content: "Content", preview_type: "markdown" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleExportTab article={mockArticle} />);
    });

    const inputs = Array.from(
      container!.querySelectorAll("input[type='text']"),
    ) as HTMLInputElement[];
    const placeholders = inputs.map((input) => input.placeholder);

    expect(placeholders.some((p) => p.includes(mockExportPaths.content_path))).toBe(true);
    expect(placeholders.some((p) => p.includes(mockExportPaths.images_path))).toBe(true);
    expect(placeholders.every((p) => !p.includes("rorychatt"))).toBe(true);
    expect(container!.textContent).not.toContain("rorychatt");
  });

  it("saves export path defaults via the Save as Default button and refreshes the displayed default", async () => {
    let savedRequestBody: any = null;
    const savedResponse: ExportPathSettings = {
      ...mockExportPaths,
      content_path: "/custom/override/content",
      content_path_source: "settings",
      content_path_override: "/custom/override/content",
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/settings/export-paths")) {
        if (init?.method === "POST") {
          savedRequestBody = JSON.parse(init?.body as string);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(savedResponse),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExportPaths),
        });
      }
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unconfiguredSettings),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ formatted_content: "Content", preview_type: "markdown" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleExportTab article={mockArticle} />);
    });

    const contentInput = container!.querySelector("input[type='text']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(contentInput, "/custom/override/content");
      contentInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const saveBtn = Array.from(container!.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Save as Default"),
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn!.click();
    });

    expect(savedRequestBody).toBeDefined();
    expect(savedRequestBody.ivy_web_content_path).toBe("/custom/override/content");
    expect(contentInput.placeholder).toContain("/custom/override/content");
  });

  it("falls back to a generic placeholder when the export-paths fetch fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/settings/export-paths")) {
        return Promise.reject(new Error("network error"));
      }
      if (url.includes("/settings/syndication")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(unconfiguredSettings),
        });
      }
      if (url.includes("/format/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ formatted_content: "Content", preview_type: "markdown" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    await act(async () => {
      root!.render(<ArticleExportTab article={mockArticle} />);
    });

    const contentInput = container!.querySelector("input[type='text']") as HTMLInputElement;
    expect(contentInput.placeholder).toBe("Default: resolved by backend");
    expect(container!.textContent).not.toContain("rorychatt");
  });
});
