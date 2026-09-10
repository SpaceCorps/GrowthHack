import { describe, expect, it } from "vitest";
import type {
  Article,
  ExportRecord,
  UploadHeroImageRequest,
  UploadHeroImageResponse,
} from "./types";
import { BANNER_THEMES, getThemeForCategory, wrapBannerTitle } from "./utils/banner";

describe("Article & Export Pipeline Types", () => {
  it("supports ExportRecord structure with channels and status", () => {
    const record: ExportRecord = {
      channel: "ivy-web",
      exported_at: new Date().toISOString(),
      target_path: "/content/posts/test-post.mdoc",
      status: "Success",
    };

    expect(record.channel).toBe("ivy-web");
    expect(record.status).toBe("Success");
    expect(record.target_path).toContain("test-post.mdoc");
  });

  it("supports Article with slug and exports tracking", () => {
    const article: Article = {
      id: "art-1",
      title: "How Git Worktrees Solve Agent Hallucination",
      feature: "Worktrees",
      channel: "Website",
      angle: "Architecture",
      summary: "Deep architectural breakdown.",
      content: "# Content",
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      outbound_citations: ["https://git-scm.com/docs/git-worktree"],
      status: "Published",
      created_at: new Date().toISOString(),
      slug: "how-git-worktrees-solve-agent-hallucination",
      exports: [
        {
          channel: "ivy-web",
          exported_at: new Date().toISOString(),
          target_path: "/content/posts/how-git-worktrees-solve-agent-hallucination.mdoc",
          status: "Success",
        },
      ],
    };

    expect(article.slug).toBe("how-git-worktrees-solve-agent-hallucination");
    expect(article.exports).toHaveLength(1);
    expect(article.exports?.[0].channel).toBe("ivy-web");
  });

  it("validates supported multi-channel formatters list", () => {
    const channels = ["Dev.to", "Hashnode", "Medium", "Substack", "LinkedIn", "X Thread"];
    expect(channels).toContain("Dev.to");
    expect(channels).toContain("Hashnode");
    expect(channels).toContain("Medium");
    expect(channels).toContain("Substack");
    expect(channels).toContain("LinkedIn");
    expect(channels).toContain("X Thread");
  });

  it("verifies Ivy Web export payload serialization includes sync_hero_image and target_images_dir", () => {
    const payload = {
      target_dir: "/Users/rorychatt/git/ivy-web/apps/web-new/content/posts",
      target_images_dir: "/Users/rorychatt/git/ivy-web/apps/web-new/public/site/images",
      sync_hero_image: true,
    };

    const serialized = JSON.stringify(payload);
    const parsed = JSON.parse(serialized);

    expect(parsed.target_dir).toBe("/Users/rorychatt/git/ivy-web/apps/web-new/content/posts");
    expect(parsed.target_images_dir).toBe(
      "/Users/rorychatt/git/ivy-web/apps/web-new/public/site/images",
    );
    expect(parsed.sync_hero_image).toBe(true);
  });

  it("verifies Ivy Web export response parsing with image_path", () => {
    const rawResponse = {
      success: true,
      file_path: "/content/posts/how-git-worktrees-solve-agent-hallucination.mdoc",
      slug: "how-git-worktrees-solve-agent-hallucination",
      post_content: "---\ntitle: 'Test'\n---\nBody",
      record: {
        channel: "ivy-web",
        exported_at: "2026-09-10T18:00:00Z",
        target_path: "/content/posts/how-git-worktrees-solve-agent-hallucination.mdoc",
        status: "Success",
      },
      image_path: "/public/site/images/blog/how-git-worktrees-solve-agent-hallucination-hero.png",
    };

    expect(rawResponse.success).toBe(true);
    expect(rawResponse.image_path).toBe(
      "/public/site/images/blog/how-git-worktrees-solve-agent-hallucination-hero.png",
    );
    expect(rawResponse.slug).toBe("how-git-worktrees-solve-agent-hallucination");
  });

  it("verifies dedicated sync-assets response parsing with image_path and slug", () => {
    const syncResponse = {
      success: true,
      image_path: "/public/site/images/blog/autonomous-worktrees-hero.png",
      slug: "autonomous-worktrees",
    };

    expect(syncResponse.success).toBe(true);
    expect(syncResponse.image_path).toContain("autonomous-worktrees-hero.png");
    expect(syncResponse.slug).toBe("autonomous-worktrees");
  });

  it("verifies category badge color theme mapping for different article angles", () => {
    expect(getThemeForCategory("Architecture")).toBe("dark-cyan");
    expect(getThemeForCategory("System Design")).toBe("dark-cyan");
    expect(getThemeForCategory("Benchmark")).toBe("midnight-emerald");
    expect(getThemeForCategory("Performance Metrics")).toBe("midnight-emerald");
    expect(getThemeForCategory("Multi-Agent Workflows")).toBe("indigo-violet");
    expect(getThemeForCategory("Ecosystem Integration")).toBe("indigo-violet");
    expect(getThemeForCategory("Tutorial")).toBe("amber-glow");
    expect(getThemeForCategory("How-To Guide")).toBe("amber-glow");

    expect(BANNER_THEMES["dark-cyan"].primaryAccent).toBe("#06b6d4");
    expect(BANNER_THEMES["midnight-emerald"].primaryAccent).toBe("#10b981");
    expect(BANNER_THEMES["indigo-violet"].primaryAccent).toBe("#8b5cf6");
    expect(BANNER_THEMES["amber-glow"].primaryAccent).toBe("#f59e0b");
  });

  it("verifies title word-wrapping logic for 1200x630 social banner layout", () => {
    const shortTitle = "Short Title";
    expect(wrapBannerTitle(shortTitle, 34, 3)).toEqual(["Short Title"]);

    const multiLineTitle =
      "Building Resilient AI Workflows with Autonomous Git Worktrees and Verification Gates";
    const lines = wrapBannerTitle(multiLineTitle, 34, 3);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(38);
    }

    const veryLongTitle =
      "One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen Twenty";
    const cappedLines = wrapBannerTitle(veryLongTitle, 30, 3);
    expect(cappedLines.length).toBe(3);
    expect(cappedLines[2]).toContain("...");
  });

  it("verifies upload hero image payload serialization and response parsing", () => {
    const uploadPayload: UploadHeroImageRequest = {
      image_data:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      target_images_dir: "/site/images",
    };

    const serialized = JSON.stringify(uploadPayload);
    const parsed: UploadHeroImageRequest = JSON.parse(serialized);
    expect(parsed.image_data).toContain("data:image/png;base64,");
    expect(parsed.target_images_dir).toBe("/site/images");

    const rawUploadResponse: UploadHeroImageResponse = {
      success: true,
      image_path: "/site/images/blog/dynamic-hero-banner-hero.png",
      slug: "dynamic-hero-banner",
      bytes_written: 68,
    };

    expect(rawUploadResponse.success).toBe(true);
    expect(rawUploadResponse.image_path).toContain("dynamic-hero-banner-hero.png");
    expect(rawUploadResponse.bytes_written).toBe(68);
  });
});
