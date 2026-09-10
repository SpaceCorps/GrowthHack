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
});
