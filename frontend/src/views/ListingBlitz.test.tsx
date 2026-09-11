import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ListingBlitz } from "./ListingBlitz";
import type { Listing } from "../types";

const mockListings: Listing[] = [
  {
    id: "list-1",
    name: "awesome-ai-agents (e2b-dev)",
    category: "Awesome Repo",
    url: "https://github.com/e2b-dev/awesome-ai-agents",
    status: "PR Submitted",
    pr_url: "https://github.com/e2b-dev/awesome-ai-agents/pull/412",
    submission_blurb:
      "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory.",
    notes: "High authority repo (18k+ stars).",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-2",
    name: "AlternativeTo (Cursor / Cline)",
    category: "Dev Directory",
    url: "https://alternativeto.net/software/cursor/",
    status: "Live",
    pr_url: undefined,
    submission_blurb:
      "Ivy-Tendril is an open-source multi-agent software factory that automates issue-to-verified PR workflows.",
    notes: "Listed on AlternativeTo.",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-3",
    name: "SWE-bench Leaderboard / Registry",
    category: "Software Factory",
    url: "https://www.swebench.com/",
    status: "Targeted",
    pr_url: undefined,
    submission_blurb:
      "Ivy-Tendril autonomous agent factory: verified evaluations on SWE-bench benchmark.",
    notes: "SWE-bench official directory.",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-4",
    name: "Homebrew Core & Tap",
    category: "Package Manager",
    url: "https://github.com/Homebrew/homebrew-core",
    status: "Targeted",
    pr_url: undefined,
    submission_blurb:
      "brew install ivy-tendril - Formula for installing Ivy-Tendril CLI across macOS and Linux.",
    notes: "Homebrew formula.",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-5",
    name: "Reddit r/LocalLLaMA Tool Showcase",
    category: "Community",
    url: "https://reddit.com/r/LocalLLaMA",
    status: "Targeted",
    pr_url: undefined,
    submission_blurb:
      "Show LocalLLaMA: Ivy-Tendril - How we solved agent workspace collisions using Git worktrees.",
    notes: "Showcase thread.",
    updated_at: "2026-09-10T12:00:00Z",
  },
];

describe("ListingBlitz View", () => {
  const defaultProps = {
    listings: mockListings,
    onGenerateBlurb: vi.fn(),
    onUpdateStatus: vi.fn(),
    onCreateListing: vi.fn(),
    onBatchGenerateBlurbs: vi.fn().mockResolvedValue({ targeted_count: 5 }),
    onVerifyBacklink: vi.fn().mockResolvedValue({ verified: true, message: "Backlink verified!" }),
    githubStatus: { configured: true, username: "testuser", message: "ok" },
  };

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/submissions/github-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: false,
            message: "GitHub token not configured. Set GITHUB_TOKEN environment variable.",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("renders metric cards and listing cards correctly", () => {
    render(<ListingBlitz {...defaultProps} />);

    // Metrics cards
    expect(screen.getByText("Total Targets:")).toBeDefined();
    expect(screen.getByText("PRs Submitted:")).toBeDefined();
    expect(screen.getByText("Merged PRs:")).toBeDefined();
    expect(screen.getByText("Live Backlinks:")).toBeDefined();

    // Listing cards
    expect(screen.getByText("awesome-ai-agents (e2b-dev)")).toBeDefined();
    expect(screen.getByText("AlternativeTo (Cursor / Cline)")).toBeDefined();
    expect(screen.getByText("SWE-bench Leaderboard / Registry")).toBeDefined();
  });

  it("renders interactive category pill bar with counts", () => {
    render(<ListingBlitz {...defaultProps} />);

    expect(screen.getByTestId("pill-all")).toBeDefined();
    expect(screen.getByTestId("pill-awesome-repo")).toBeDefined();
    expect(screen.getByTestId("pill-dev-directory")).toBeDefined();
    expect(screen.getByTestId("pill-software-factory")).toBeDefined();
    expect(screen.getByTestId("pill-package-manager")).toBeDefined();
    expect(screen.getByTestId("pill-community")).toBeDefined();
  });

  it("filters listings when clicking category pill", () => {
    render(<ListingBlitz {...defaultProps} />);

    // Click Dev Directory pill
    fireEvent.click(screen.getByTestId("pill-dev-directory"));

    expect(screen.getByText("AlternativeTo (Cursor / Cline)")).toBeDefined();
    expect(screen.queryByText("awesome-ai-agents (e2b-dev)")).toBeNull();
    expect(screen.queryByText("SWE-bench Leaderboard / Registry")).toBeNull();

    // Click All pill to restore
    fireEvent.click(screen.getByTestId("pill-all"));
    expect(screen.getByText("awesome-ai-agents (e2b-dev)")).toBeDefined();
  });

  it("filters listings by status dropdown", () => {
    render(<ListingBlitz {...defaultProps} />);

    const statusFilter = screen.getByTestId("status-filter");
    fireEvent.change(statusFilter, { target: { value: "Live" } });

    expect(screen.getByText("AlternativeTo (Cursor / Cline)")).toBeDefined();
    expect(screen.queryByText("awesome-ai-agents (e2b-dev)")).toBeNull();
  });

  it("filters listings by search query input", () => {
    render(<ListingBlitz {...defaultProps} />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Homebrew" } });

    expect(screen.getByText("Homebrew Core & Tap")).toBeDefined();
    expect(screen.queryByText("awesome-ai-agents (e2b-dev)")).toBeNull();
  });

  it("triggers 1-click PR copy actions and writes to clipboard", async () => {
    render(<ListingBlitz {...defaultProps} />);

    const copyMarkdownBtn = screen.getByTestId("copy-markdown-list-1");
    fireEvent.click(copyMarkdownBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory.",
    );

    const copyTitleBtn = screen.getByTestId("copy-title-list-1");
    fireEvent.click(copyTitleBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "Add Ivy-Tendril to Coding Agents & Developer Tools",
    );

    const copyPrBtn = screen.getByTestId("copy-pr-list-1");
    fireEvent.click(copyPrBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("toggles gh pr create CLI drawer and copies snippet", () => {
    render(<ListingBlitz {...defaultProps} />);

    expect(screen.queryByTestId("cli-drawer-list-1")).toBeNull();

    const toggleCliBtn = screen.getByTestId("toggle-cli-list-1");
    fireEvent.click(toggleCliBtn);

    expect(screen.getByTestId("cli-drawer-list-1")).toBeDefined();
    expect(screen.getByText(/gh pr create --repo e2b-dev\/awesome-ai-agents/)).toBeDefined();

    const copyCliBtn = screen.getByTestId("copy-cli-list-1");
    fireEvent.click(copyCliBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("triggers batch runner with selected category", async () => {
    const onBatchGenerateBlurbs = vi.fn().mockResolvedValue({ targeted_count: 5 });
    render(<ListingBlitz {...defaultProps} onBatchGenerateBlurbs={onBatchGenerateBlurbs} />);

    const batchSelect = screen.getByTestId("batch-category-select");
    fireEvent.change(batchSelect, { target: { value: "Awesome Repo" } });

    const batchBtn = screen.getByTestId("batch-generate-btn");
    fireEvent.click(batchBtn);

    expect(onBatchGenerateBlurbs).toHaveBeenCalledWith("Awesome Repo");
  });

  it("triggers backlink verification and displays verified chip", async () => {
    const onVerifyBacklink = vi.fn().mockResolvedValue({
      verified: true,
      status: "Live",
      message: "Backlink verified! Status updated to Live.",
    });
    const onUpdateStatus = vi.fn();

    render(
      <ListingBlitz
        {...defaultProps}
        onVerifyBacklink={onVerifyBacklink}
        onUpdateStatus={onUpdateStatus}
      />,
    );

    const verifyBtn = screen.getByTestId("verify-backlink-list-1");
    fireEvent.click(verifyBtn);

    expect(onVerifyBacklink).toHaveBeenCalledWith("list-1");

    // Wait for promise resolution
    const badge = await screen.findByTestId("backlink-badge-list-1");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Verified Live");
    expect(onUpdateStatus).toHaveBeenCalledWith("list-1", "Live");
  });

  it("fetches GitHub status on mount when githubStatus prop is not provided", async () => {
    const { githubStatus: _, ...propsWithoutStatus } = defaultProps;
    render(<ListingBlitz {...propsWithoutStatus} />);

    expect(global.fetch).toHaveBeenCalledWith("/api/submissions/github-status");

    const banner = await screen.findByTestId("github-status-banner");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain(
      "GitHub token not configured. Set GITHUB_TOKEN environment variable.",
    );
  });

  it("renders GitHub status banner when unconfigured and connected badge when configured", () => {
    // Unconfigured
    const { unmount } = render(
      <ListingBlitz
        {...defaultProps}
        githubStatus={{
          configured: false,
          message: "Set GITHUB_TOKEN or GITHUB_PAT environment variable.",
        }}
      />,
    );
    expect(screen.getByTestId("github-status-banner")).toBeDefined();
    expect(screen.queryByTestId("github-status-badge")).toBeNull();
    unmount();

    // Configured
    render(
      <ListingBlitz
        {...defaultProps}
        githubStatus={{
          configured: true,
          username: "octocat",
          message: "Authenticated as GitHub user @octocat",
        }}
      />,
    );
    expect(screen.queryByTestId("github-status-banner")).toBeNull();
    const badge = screen.getByTestId("github-status-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("@octocat");
  });

  it("renders Submit Upstream PR button on eligible GitHub listings and triggers onSubmitUpstream", async () => {
    const onSubmitUpstream = vi.fn().mockResolvedValue({ task_id: "task-123" });
    const onUpdateStatus = vi.fn();

    render(
      <ListingBlitz
        {...defaultProps}
        onSubmitUpstream={onSubmitUpstream}
        onUpdateStatus={onUpdateStatus}
      />,
    );

    // list-4 (Homebrew/homebrew-core) is GitHub with status Targeted
    const submitBtn = screen.getByTestId("submit-upstream-list-4");
    expect(submitBtn).toBeDefined();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submitBtn);

    expect(onSubmitUpstream).toHaveBeenCalledWith("list-4");
    // Should update status to PR Submitted after trigger
    await vi.waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith("list-4", "PR Submitted");
    });
  });

  it("does not render Submit Upstream PR button on non-GitHub targets", () => {
    render(<ListingBlitz {...defaultProps} />);

    // list-2 (AlternativeTo), list-3 (swebench.com), list-5 (reddit) are not GitHub repos
    expect(screen.queryByTestId("submit-upstream-list-2")).toBeNull();
    expect(screen.queryByTestId("submit-upstream-list-3")).toBeNull();
    expect(screen.queryByTestId("submit-upstream-list-5")).toBeNull();
  });

  it("disables Submit Upstream PR button when status is already submitted or live", () => {
    render(<ListingBlitz {...defaultProps} />);

    // list-1 is GitHub repo but status is PR Submitted
    const submitBtn = screen.getByTestId("submit-upstream-list-1");
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("triggers batch upstream PR submission with selected category", async () => {
    const onBatchSubmitUpstream = vi.fn().mockResolvedValue({ targeted_count: 3 });

    render(<ListingBlitz {...defaultProps} onBatchSubmitUpstream={onBatchSubmitUpstream} />);

    const batchCategorySelect = screen.getByTestId("batch-category-select");
    fireEvent.change(batchCategorySelect, { target: { value: "Package Manager" } });

    const batchSubmitBtn = screen.getByTestId("batch-submit-btn");
    fireEvent.click(batchSubmitBtn);

    expect(onBatchSubmitUpstream).toHaveBeenCalledWith("Package Manager");
  });

  it("renders View PR link for listings with PR submitted", () => {
    render(<ListingBlitz {...defaultProps} />);

    const prLink = screen.getByTestId("view-pr-list-1");
    expect(prLink).toBeDefined();
    expect(prLink.getAttribute("href")).toBe(
      "https://github.com/e2b-dev/awesome-ai-agents/pull/412",
    );
  });

  it("renders Sync PR Status button in Batch Runner and updates status to Live upon successful sync", async () => {
    const onSyncAllPrs = vi.fn().mockResolvedValue({
      checked_count: 2,
      merged_count: 1,
      transitioned_ids: ["list-1"],
      message: "Checked 2 listings: 1 merged PRs transitioned to Live",
    });
    const onUpdateStatus = vi.fn();

    render(
      <ListingBlitz
        {...defaultProps}
        onSyncAllPrs={onSyncAllPrs}
        onUpdateStatus={onUpdateStatus}
      />,
    );

    const syncBtn = screen.getByTestId("sync-all-prs-btn");
    expect(syncBtn).toBeDefined();
    expect(syncBtn.textContent).toContain("Sync PR Status");

    fireEvent.click(syncBtn);

    expect(onSyncAllPrs).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith("list-1", "Live");
      const msg = screen.getByTestId("sync-prs-message");
      expect(msg.textContent).toContain("1 merged PRs transitioned to Live");
    });
  });

  it("renders Check PR Status button on submitted listings and transitions to Live when merged", async () => {
    const onSyncSinglePr = vi.fn().mockResolvedValue({
      id: "list-1",
      pr_url: "https://github.com/e2b-dev/awesome-ai-agents/pull/412",
      state: "closed",
      merged: true,
      status: "Live",
      message: "Pull request merged! Listing transitioned to Live.",
    });
    const onUpdateStatus = vi.fn();

    render(
      <ListingBlitz
        {...defaultProps}
        onSyncSinglePr={onSyncSinglePr}
        onUpdateStatus={onUpdateStatus}
      />,
    );

    const checkBtn = screen.getByTestId("check-pr-list-1");
    expect(checkBtn).toBeDefined();
    expect(checkBtn.textContent).toContain("Check PR Status");

    fireEvent.click(checkBtn);

    expect(onSyncSinglePr).toHaveBeenCalledWith("list-1");
    await vi.waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith("list-1", "Live");
      const badge = screen.getByTestId("check-pr-badge-list-1");
      expect(badge.textContent).toContain("Pull request merged! Listing transitioned to Live.");
    });
  });
});
