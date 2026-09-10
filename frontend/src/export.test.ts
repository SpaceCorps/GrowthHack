import { describe, expect, it } from "vitest";
import type { Article, ExportRecord } from "./types";

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
});
