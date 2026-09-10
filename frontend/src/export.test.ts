import { describe, expect, it } from "vitest";
import type {
  Article,
  ExportRecord,
  SyndicationSettings,
  SyndicationStatusResponse,
} from "./types";

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

  it("test_syndication_settings_interface: validates SyndicationSettings typing and configuration state", () => {
    const settings: SyndicationSettings = {
      devto_api_key: "devto_test_key",
      hashnode_api_key: "hashnode_test_token",
      hashnode_publication_id: "pub_123",
      publish_as_draft: true,
    };

    expect(settings.devto_api_key).toBe("devto_test_key");
    expect(settings.hashnode_api_key).toBe("hashnode_test_token");
    expect(settings.hashnode_publication_id).toBe("pub_123");
    expect(settings.publish_as_draft).toBe(true);

    const status: SyndicationStatusResponse = {
      devto_configured: true,
      devto_key_preview: "..._key",
      hashnode_configured: true,
      hashnode_key_preview: "...oken",
      hashnode_publication_id: "pub_123",
      publish_as_draft: true,
    };

    expect(status.devto_configured).toBe(true);
    expect(status.hashnode_configured).toBe(true);
    expect(status.devto_key_preview).toBe("..._key");
  });

  it("test_export_record_with_external_url: verifies export records with remote URLs and published status", () => {
    const devtoExport: ExportRecord = {
      channel: "Dev.to",
      exported_at: new Date().toISOString(),
      target_path: "https://dev.to/ivy/scaling-autonomous-agents-with-worktrees",
      status: "Published",
    };

    expect(devtoExport.channel).toBe("Dev.to");
    expect(devtoExport.status).toBe("Published");
    expect(devtoExport.target_path?.startsWith("https://")).toBe(true);
    expect(devtoExport.target_path).toContain("dev.to/ivy");

    const hashnodeExport: ExportRecord = {
      channel: "Hashnode",
      exported_at: new Date().toISOString(),
      target_path: "https://blog.ivy.interactive/15-minute-issue-to-pr",
      status: "Published",
    };

    expect(hashnodeExport.channel).toBe("Hashnode");
    expect(hashnodeExport.status).toBe("Published");
    expect(hashnodeExport.target_path?.startsWith("https://")).toBe(true);
  });
});
