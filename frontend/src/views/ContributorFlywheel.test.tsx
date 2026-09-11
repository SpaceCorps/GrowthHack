import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ContributorFlywheel } from "./ContributorFlywheel";
import type {
  ContributorIssue,
  ContributingGuideResponse,
  AllContributorsResponse,
} from "../types";

const mockIssues: ContributorIssue[] = [
  {
    id: "cf-issue-1",
    title: "Add CLI shell completion for zsh",
    description: "Implement zsh completion generator in the CLI completions module.",
    category: "CLI",
    difficulty: "Good First Issue",
    estimated_minutes: 15,
    affected_files: ["src/cli/completions.rs", "Cargo.toml"],
    reproduction_steps: ["Run cargo run -- completion --help", "Observe missing zsh generator"],
    mentor: "@rorychatt",
    claimed: false,
  },
  {
    id: "cf-issue-2",
    title: "Add loopback host check validator in server startup",
    description: "Ensure server socket binding restricts to 127.0.0.1 or localhost in dev mode.",
    category: "Backend",
    difficulty: "Good First Issue",
    estimated_minutes: 15,
    affected_files: ["backend/src/main.rs"],
    reproduction_steps: ["Inspect socket binding in main.rs"],
    mentor: "@alex-spacecorps",
    claimed: false,
  },
  {
    id: "cf-issue-3",
    title: "Improve empty state message on Plan Review view",
    description: "Display an intuitive empty state illustration and quick action buttons.",
    category: "Frontend",
    difficulty: "Good First Issue",
    estimated_minutes: 20,
    affected_files: ["frontend/src/views/ReviewQueue.tsx"],
    reproduction_steps: ["Open Approval Deck with zero pending items"],
    mentor: "@sarah-ui",
    claimed: true,
    claimed_by: "@test-dev",
    claimed_at: "2026-09-10T12:00:00Z",
  },
];

const mockGuide: ContributingGuideResponse = {
  filename: "CONTRIBUTING.md",
  content: "# Contributing to SpaceCorps GrowthHack\n\nPrerequisites: Rust 1.95+, Node 24+",
};

const mockContributors: AllContributorsResponse = {
  contributors: [
    {
      name: "Rory Chatt",
      avatar_url: "https://github.com/rorychatt.png",
      profile_url: "https://github.com/rorychatt",
      contributions: ["code", "architecture"],
    },
    {
      name: "Sarah Jenkins",
      avatar_url: "https://avatars.githubusercontent.com/u/10002?v=4",
      profile_url: "https://github.com/sarah-ui",
      contributions: ["design", "frontend"],
    },
  ],
  markdown_table: "| Contributor | Profile |\n| Rory Chatt | https://github.com/rorychatt |",
  html_grid:
    "<!-- ALL-CONTRIBUTORS-LIST:START --><table><tbody><tr></tr></tbody></table><!-- ALL-CONTRIBUTORS-LIST:END -->",
  badge_markdown:
    "[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg)](#contributors)",
};

describe("ContributorFlywheel View", () => {
  beforeEach(() => {
    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
      configurable: true,
      writable: true,
    });

    // Mock fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/contributors/issues") && !url.includes("/claim")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIssues),
        });
      }
      if (url.includes("/api/contributors/contributing-md")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGuide),
        });
      }
      if (url.includes("/api/contributors/all-contributors")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockContributors),
        });
      }
      if (url.includes("/claim")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockIssues[0],
              claimed: true,
              claimed_by: "@test-claimer",
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders metrics, onboarding checklist, issues board, and contributors grid", async () => {
    render(<ContributorFlywheel />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText("Contributor Flywheel & Onboarding Pipeline")).toBeDefined();
    });

    // Check metric cards
    expect(screen.getByTestId("unclaimed-count").textContent).toBe("2");
    expect(screen.getByText("<15m")).toBeDefined();

    // Check Onboarding checklist
    expect(screen.getByText("Step 1: Clone Repository & Install Prerequisites")).toBeDefined();
    expect(screen.getByText("Step 2: Run Local Verification Gates")).toBeDefined();

    // Check Issues board
    expect(screen.getByText("Add CLI shell completion for zsh")).toBeDefined();
    expect(screen.getByText("Add loopback host check validator in server startup")).toBeDefined();
    expect(screen.getByText("Improve empty state message on Plan Review view")).toBeDefined();

    // Check CONTRIBUTING.md preview
    expect(screen.getByText(/Prerequisites: Rust 1.95\+/)).toBeDefined();

    // Check contributor avatars
    expect(screen.getByText("Rory Chatt")).toBeDefined();
    expect(screen.getByText("Sarah Jenkins")).toBeDefined();
  });

  it("handles onboarding checklist toggle and command copy", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("checkbox-step-1")).toBeDefined();
    });

    const checkbox = screen.getByTestId("checkbox-step-1") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const copyCmdBtn = screen.getByTestId("copy-btn-step-1");
    fireEvent.click(copyCmdBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("git clone https://github.com/SpaceCorps/GrowthHack.git"),
    );
  });

  it("filters issues by category and status", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByText("Add CLI shell completion for zsh")).toBeDefined();
    });

    // Filter by CLI
    const cliFilter = screen.getByTestId("filter-cat-cli");
    fireEvent.click(cliFilter);

    expect(screen.getByText("Add CLI shell completion for zsh")).toBeDefined();
    expect(screen.queryByText("Add loopback host check validator in server startup")).toBeNull();

    // Filter by Unclaimed status
    const statusSelect = screen.getByTestId("status-filter-select");
    fireEvent.change(statusSelect, { target: { value: "unclaimed" } });

    // Switch category back to All
    const allFilter = screen.getByTestId("filter-cat-all");
    fireEvent.click(allFilter);

    expect(screen.getByText("Add CLI shell completion for zsh")).toBeDefined();
    expect(screen.getByText("Add loopback host check validator in server startup")).toBeDefined();
    expect(screen.queryByText("Improve empty state message on Plan Review view")).toBeNull();
  });

  it("opens claim modal and successfully claims an issue", async () => {
    const onIssueClaimed = vi.fn();
    render(<ContributorFlywheel onIssueClaimed={onIssueClaimed} />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    const claimBtn = screen.getByTestId("claim-btn-cf-issue-1");
    fireEvent.click(claimBtn);

    // Verify modal rendered
    expect(screen.getByText("Claim Good First Issue")).toBeDefined();

    const nameInput = screen.getByTestId("claim-name-input");
    const handleInput = screen.getByTestId("claim-handle-input");
    fireEvent.change(nameInput, { target: { value: "Jane Developer" } });
    fireEvent.change(handleInput, { target: { value: "@janedev" } });

    const submitBtn = screen.getByTestId("submit-claim-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/contributors/issues/cf-issue-1/claim",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            contributor_name: "Jane Developer",
            github_handle: "@janedev",
          }),
        }),
      );
      expect(onIssueClaimed).toHaveBeenCalled();
    });
  });

  it("copies contributing markdown, badge snippet, and html grid to clipboard", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("copy-contributing-btn")).toBeDefined();
    });

    // Copy contributing guide
    const copyGuideBtn = screen.getByTestId("copy-contributing-btn");
    fireEvent.click(copyGuideBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockGuide.content);

    // Copy badge markdown
    const copyBadgeBtn = screen.getByTestId("copy-badge-md-btn");
    fireEvent.click(copyBadgeBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockContributors.badge_markdown);

    // Copy HTML grid
    const copyGridBtn = screen.getByTestId("copy-grid-html-btn");
    fireEvent.click(copyGridBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockContributors.html_grid);
  });
});
