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
  };

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
});
