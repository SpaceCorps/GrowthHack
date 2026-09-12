import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { ContributorFlywheel } from "./ContributorFlywheel";
import type {
  ContributorIssue,
  ContributingGuideResponse,
  AllContributorsResponse,
} from "../types";
import { setupMockFetch, setupMockClipboard, setupMockBlobUrl } from "../test";
import type { MockFetchController, MockClipboardController, MockBlobUrlController } from "../test";

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
    github_issue_number: 42,
    github_repo: "SpaceCorps/GrowthHack",
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
    github_issue_number: 99,
    github_repo: "SpaceCorps/GrowthHack",
    github_sync_status: "Synced",
    github_sync_message: "Assigned to @test-dev with claimed label",
  },
  {
    id: "cf-issue-4",
    title: "Document webhook endpoints",
    description: "Write developer docs for GitHub webhook endpoints.",
    category: "Documentation",
    difficulty: "Good First Issue",
    estimated_minutes: 10,
    affected_files: ["docs/webhooks.md"],
    reproduction_steps: ["Open docs"],
    mentor: "@alex-spacecorps",
    claimed: false,
    closed: true,
    closed_at: "2026-09-11T00:00:00Z",
    github_issue_number: 105,
    github_repo: "SpaceCorps/GrowthHack",
    github_sync_status: "Closed (Webhook)",
    github_sync_message: "Issue #105 was closed externally on GitHub",
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

const mockRcConfig = {
  projectName: "growthhack",
  projectOwner: "spacecorps",
  repoType: "github",
  repoHost: "https://github.com",
  files: ["README.md"],
  imageSize: 100,
  commit: false,
  commitConvention: "angular",
  contributors: [
    {
      login: "rorychatt",
      name: "Rory Chatt",
      avatar_url: "https://github.com/rorychatt.png",
      profile: "https://github.com/rorychatt",
      contributions: ["code", "architecture"],
    },
    {
      login: "sarah-ui",
      name: "Sarah Jenkins",
      avatar_url: "https://avatars.githubusercontent.com/u/10002?v=4",
      profile: "https://github.com/sarah-ui",
      contributions: ["design", "frontend"],
    },
  ],
  contributorsPerLine: 7,
  linkToUsage: true,
};

const mockAllContributorsRc = {
  filename: ".all-contributorsrc",
  content: JSON.stringify(mockRcConfig, null, 2),
  config: mockRcConfig,
  contributor_count: 2,
};

const mockVerifyResponse = {
  success: true,
  message: "Contributor verified successfully",
  contributor: {
    id: "contrib-test",
    name: "test-dev",
    login: "test-dev",
    email: null,
    points: 100,
    tier: "Rising Star",
    joined_date: "2026-09-10",
    contributions: ["code", "doc"],
    avatar_url: "https://github.com/test-dev.png",
    verified: true,
    verified_at: "2026-09-11T00:00:00Z",
    pr_url: null,
  },
  issue: null,
  pr: {
    branch_name: "all-contributors/add-test-dev",
    pr_url: null,
    pr_title: "docs: add test-dev to .all-contributorsrc [skip ci]",
    cli_commands: [
      "git checkout -b all-contributors/add-test-dev",
      "git add .all-contributorsrc",
      'git commit -m "docs: add test-dev to .all-contributorsrc [skip ci]"',
      "git push origin all-contributors/add-test-dev",
    ],
    updated_config: mockRcConfig,
    instructions: "Run the CLI commands to open a PR.",
  },
};

const mockGitHubUsers = [
  {
    login: "octocat",
    avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
    html_url: "https://github.com/octocat",
  },
  {
    login: "octodog",
    avatar_url: "https://avatars.githubusercontent.com/u/583232?v=4",
    html_url: "https://github.com/octodog",
  },
];

describe("ContributorFlywheel View", () => {
  let mockController: MockFetchController | null = null;
  let mockClipboard: MockClipboardController | null = null;
  let mockBlobUrl: MockBlobUrlController | null = null;

  beforeEach(() => {
    localStorage.clear();

    // Mock clipboard
    mockClipboard = setupMockClipboard();

    // Mock URL object methods for download test
    mockBlobUrl = setupMockBlobUrl();

    // Mock fetch via setupMockFetch
    mockController = setupMockFetch({
      handlers: {
        "/api/contributors/github-users": (url: string) => {
          if (url.includes("error")) {
            return new Response(JSON.stringify({ error: "Rate limit or GitHub API error" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes("empty")) {
            return [];
          }
          return mockGitHubUsers;
        },
        "/api/contributors/verify": mockVerifyResponse,
        "/api/contributors/all-contributorsrc": mockAllContributorsRc,
        "/api/contributors/issues": (url: string) => {
          if (url.includes("/unclaim")) {
            return {
              ...mockIssues[2],
              claimed: false,
              claimed_by: undefined,
              claimed_at: undefined,
              github_sync_status: "Unclaimed",
              github_sync_message: "Claim released manually",
            };
          }
          if (url.includes("/check-timeouts")) {
            return {
              success: true,
              unclaimed_count: 1,
              unclaimed_issue_ids: ["cf-issue-3"],
              message: "Timeouts evaluated",
            };
          }
          if (url.includes("/claim")) {
            return {
              ...mockIssues[0],
              claimed: true,
              claimed_by: "@janedev",
              github_sync_status: "Synced",
              github_sync_message: "Issue #42 assigned to @janedev with 'claimed' label",
            };
          }
          return mockIssues;
        },
        "/api/contributors/contributing-md": mockGuide,
        "/api/contributors/all-contributors": mockContributors,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (mockClipboard) {
      mockClipboard.restore();
      mockClipboard = null;
    }
    if (mockController) {
      mockController.restore();
      mockController = null;
    }
    if (mockBlobUrl) {
      mockBlobUrl.restore();
      mockBlobUrl = null;
    }
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

  it("renders GitHub issue badges and sync status tags", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("github-issue-badge-cf-issue-1")).toBeDefined();
    });

    const badge1 = screen.getByTestId("github-issue-badge-cf-issue-1") as HTMLAnchorElement;
    expect(badge1.href).toBe("https://github.com/SpaceCorps/GrowthHack/issues/42");
    expect(badge1.textContent).toContain("#42");

    // Unlinked issue should not have a badge
    expect(screen.queryByTestId("github-issue-badge-cf-issue-2")).toBeNull();

    // Claimed issue should display sync status tag
    const syncTag = screen.getByTestId("github-sync-status-cf-issue-3");
    expect(syncTag.textContent).toContain("GitHub: Synced");
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

  it("persists the onboarding checklist to localStorage and rehydrates on remount", async () => {
    const { unmount } = render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("checkbox-step-1")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("checkbox-step-1"));

    expect(JSON.parse(localStorage.getItem("growthhack_onboarding_checklist") ?? "{}")).toEqual({
      "step-1": true,
    });

    unmount();
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect((screen.getByTestId("checkbox-step-1") as HTMLInputElement).checked).toBe(true);
    });
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

  it("opens claim modal and successfully claims an issue with GitHub sync", async () => {
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
    const issueNumberInput = screen.getByTestId("claim-issue-number-input") as HTMLInputElement;
    const autoSyncCheckbox = screen.getByTestId("claim-auto-sync-checkbox") as HTMLInputElement;

    expect(issueNumberInput.value).toBe("42");
    expect(autoSyncCheckbox.checked).toBe(true);

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
            github_issue_number: 42,
            auto_sync_github: true,
          }),
        }),
      );
      expect(onIssueClaimed).toHaveBeenCalled();
      expect(screen.getByTestId("claim-feedback-banner")).toBeDefined();
      expect(screen.getByTestId("claim-feedback-sync-status").textContent).toContain("Synced");
    });

    // Close feedback modal
    const doneBtn = screen.getByTestId("claim-modal-done-btn");
    fireEvent.click(doneBtn);
    expect(screen.queryByTestId("claim-feedback-banner")).toBeNull();
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

  it("renders .all-contributorsrc studio, copies JSON, and downloads file", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByText(".all-contributorsrc Studio & PR Generator")).toBeDefined();
    });

    // Check preview renders .all-contributorsrc content
    await waitFor(() => {
      expect(screen.getByTestId("all-contributorsrc-preview").textContent).toContain("growthhack");
    });

    // Copy .all-contributorsrc JSON
    const copyJsonBtn = screen.getByTestId("copy-all-contributorsrc-btn");
    fireEvent.click(copyJsonBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAllContributorsRc.content);

    // Download .all-contributorsrc file
    const downloadBtn = screen.getByTestId("download-all-contributorsrc-btn");
    fireEvent.click(downloadBtn);
    expect(mockBlobUrl!.createObjectURL).toHaveBeenCalled();
    expect(mockBlobUrl!.revokeObjectURL).toHaveBeenCalled();
  });

  it("opens verification modal, submits contributor verification with PR generation, and displays CLI commands", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("verify-issue-btn-cf-issue-3")).toBeDefined();
    });

    // Click "Verify & Generate PR" on the claimed issue (cf-issue-3)
    const verifyBtn = screen.getByTestId("verify-issue-btn-cf-issue-3");
    fireEvent.click(verifyBtn);

    // Check modal rendered with prefilled handle
    expect(screen.getByText("Verify Contributor & Generate PR")).toBeDefined();
    const handleInput = screen.getByTestId("verify-handle-input") as HTMLInputElement;
    expect(handleInput.value).toBe("@test-dev");

    // Toggle a contribution badge (e.g. doc)
    const docBadgeBtn = screen.getByTestId("badge-select-doc");
    fireEvent.click(docBadgeBtn);

    // Submit verification form
    const submitVerifyBtn = screen.getByTestId("submit-verify-btn");
    fireEvent.click(submitVerifyBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/contributors/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            issue_id: "cf-issue-3",
            contributor_name: "test-dev",
            github_handle: "@test-dev",
            contributions: ["code", "doc"],
            auto_generate_pr: true,
          }),
        }),
      );
    });

    // Check verification success and PR commands are shown
    await waitFor(() => {
      expect(screen.getByText(/Contributor verified successfully/i)).toBeDefined();
      expect(screen.getByTestId("generated-branch").textContent).toBe(
        "all-contributors/add-test-dev",
      );
      expect(screen.getByText("CLI Execution Commands")).toBeDefined();
    });

    // Test copying the CLI commands
    const copyCommandsBtn = screen.getByTestId("copy-cli-commands-btn");
    fireEvent.click(copyCommandsBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      mockVerifyResponse.pr.cli_commands.join("\n"),
    );

    // Close modal
    const finishBtn = screen.getByTestId("finish-verify-btn");
    fireEvent.click(finishBtn);
  });

  it("triggers debounced fetch to /api/contributors/github-users when typing into handle input", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("claim-btn-cf-issue-1"));
    expect(screen.getByText("Claim Good First Issue")).toBeDefined();

    const handleInput = screen.getByTestId("claim-handle-input");
    fireEvent.change(handleInput, { target: { value: "octo" } });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith("/api/contributors/github-users?q=octo");
        expect(screen.getByTestId("claim-handle-autocomplete-dropdown")).toBeDefined();
      },
      { timeout: 2000 },
    );
  });

  it("renders matching avatar, login handle, and profile link in user suggestions", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("claim-btn-cf-issue-1"));
    const handleInput = screen.getByTestId("claim-handle-input");
    fireEvent.change(handleInput, { target: { value: "octo" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("claim-handle-autocomplete-dropdown")).toBeDefined();
      },
      { timeout: 2000 },
    );

    const suggestion0 = screen.getByTestId("claim-handle-suggestion-0");
    expect(suggestion0.textContent).toContain("@octocat");

    const img = suggestion0.querySelector("img") as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.src).toBe("https://avatars.githubusercontent.com/u/583231?v=4");

    const link = suggestion0.querySelector("a") as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.href).toBe("https://github.com/octocat");

    const suggestion1 = screen.getByTestId("claim-handle-suggestion-1");
    expect(suggestion1.textContent).toContain("@octodog");
  });

  it("populates handle input and autofills contributorName upon clicking a suggestion", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("claim-btn-cf-issue-1"));
    const nameInput = screen.getByTestId("claim-name-input") as HTMLInputElement;
    const handleInput = screen.getByTestId("claim-handle-input") as HTMLInputElement;

    expect(nameInput.value).toBe("");

    fireEvent.change(handleInput, { target: { value: "octo" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("claim-handle-suggestion-0")).toBeDefined();
      },
      { timeout: 2000 },
    );

    const suggestion0 = screen.getByTestId("claim-handle-suggestion-0");
    fireEvent.click(suggestion0);

    expect(handleInput.value).toBe("@octocat");
    expect(nameInput.value).toBe("octocat");
    expect(screen.queryByTestId("claim-handle-autocomplete-dropdown")).toBeNull();
  });

  it("supports keyboard navigation (ArrowDown, Enter, Escape) in suggestion list", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("claim-btn-cf-issue-1"));
    const handleInput = screen.getByTestId("claim-handle-input") as HTMLInputElement;

    fireEvent.change(handleInput, { target: { value: "octo" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("claim-handle-autocomplete-dropdown")).toBeDefined();
      },
      { timeout: 2000 },
    );

    // ArrowDown once to highlight first item (@octocat)
    fireEvent.keyDown(handleInput, { key: "ArrowDown" });
    const suggestion0 = screen.getByTestId("claim-handle-suggestion-0");
    expect(suggestion0.className).toContain("bg-cyan-600/30");

    // ArrowDown again to highlight second item (@octodog)
    fireEvent.keyDown(handleInput, { key: "ArrowDown" });
    const suggestion1 = screen.getByTestId("claim-handle-suggestion-1");
    expect(suggestion1.className).toContain("bg-cyan-600/30");

    // Enter to select currently highlighted suggestion
    fireEvent.keyDown(handleInput, { key: "Enter" });
    expect(handleInput.value).toBe("@octodog");
    expect(screen.queryByTestId("claim-handle-autocomplete-dropdown")).toBeNull();

    // Type again to reopen and test Escape dismissal
    fireEvent.change(handleInput, { target: { value: "octo" } });
    await waitFor(
      () => {
        expect(screen.getByTestId("claim-handle-autocomplete-dropdown")).toBeDefined();
      },
      { timeout: 2000 },
    );

    fireEvent.keyDown(handleInput, { key: "Escape" });
    expect(screen.queryByTestId("claim-handle-autocomplete-dropdown")).toBeNull();
  });

  it("handles empty or error response gracefully from user search endpoint", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("claim-btn-cf-issue-1"));
    const handleInput = screen.getByTestId("claim-handle-input") as HTMLInputElement;

    // Test query returning empty list
    fireEvent.change(handleInput, { target: { value: "empty" } });
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith("/api/contributors/github-users?q=empty");
      },
      { timeout: 2000 },
    );
    expect(screen.queryByTestId("claim-handle-autocomplete-dropdown")).toBeNull();

    // Test query resulting in endpoint error
    fireEvent.change(handleInput, { target: { value: "error" } });
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith("/api/contributors/github-users?q=error");
      },
      { timeout: 2000 },
    );
    expect(screen.queryByTestId("claim-handle-autocomplete-dropdown")).toBeNull();
  });
  it("renders claim timeout countdown badge on claimed issue and handles timeout due", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-timeout-badge-cf-issue-3")).toBeDefined();
    });

    const badge = screen.getByTestId("claim-timeout-badge-cf-issue-3");
    expect(badge.textContent).toMatch(/(days? left before timeout|Timeout due)/);
  });

  it("handles manual unclaim button click", async () => {
    const onIssueClaimed = vi.fn();
    render(<ContributorFlywheel onIssueClaimed={onIssueClaimed} />);

    await waitFor(() => {
      expect(screen.getByTestId("unclaim-btn-cf-issue-3")).toBeDefined();
    });

    const unclaimBtn = screen.getByTestId("unclaim-btn-cf-issue-3");
    fireEvent.click(unclaimBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/contributors/issues/cf-issue-3/unclaim",
        expect.objectContaining({ method: "POST" }),
      );
      expect(onIssueClaimed).toHaveBeenCalled();
    });
  });

  it("handles Check Timeouts toolbar button click", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("check-timeouts-btn")).toBeDefined();
    });

    const checkBtn = screen.getByTestId("check-timeouts-btn");
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/contributors/issues/check-timeouts",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders closed issue with Closed on GitHub badge and disabled claim button", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("closed-badge-cf-issue-4")).toBeDefined();
    });

    const badge = screen.getByTestId("closed-badge-cf-issue-4");
    expect(badge.textContent).toContain("Closed on GitHub");

    const claimBtn = screen.getByTestId("claim-btn-cf-issue-4") as HTMLButtonElement;
    expect(claimBtn.disabled).toBe(true);
    expect(claimBtn.title).toBe("This issue is closed on GitHub");
  });

  it("filters issues correctly by closed status", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByText("Document webhook endpoints")).toBeDefined();
    });

    const statusSelect = screen.getByTestId("status-filter-select");
    fireEvent.change(statusSelect, { target: { value: "closed" } });

    expect(screen.getByText("Document webhook endpoints")).toBeDefined();
    expect(screen.queryByText("Add CLI shell completion for zsh")).toBeNull();
    expect(screen.queryByText("Improve empty state message on Plan Review view")).toBeNull();
  });

  it("displays claim button on unassigned issues", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    const claimBtn = screen.getByTestId("claim-btn-cf-issue-1") as HTMLButtonElement;
    expect(claimBtn.disabled).toBe(false);
    expect(claimBtn.textContent).toContain("Claim Issue");
  });

  it("modal submit buttons set aria-busy='true' and display loading text when submitting claims or verifications", async () => {
    render(<ContributorFlywheel />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-btn-cf-issue-1")).toBeDefined();
    });

    // 1. Test Claim Modal Submit Button Loading State
    let resolveClaim: ((val: any) => void) | null = null;
    const claimPromise = new Promise((res) => {
      resolveClaim = res;
    });

    mockController!.addHandler("/claim", () => claimPromise);

    fireEvent.click(screen.getByTestId("claim-btn-cf-issue-1"));
    expect(screen.getByText("Claim Good First Issue")).toBeDefined();

    fireEvent.change(screen.getByTestId("claim-name-input"), { target: { value: "Alex Coder" } });
    fireEvent.change(screen.getByTestId("claim-handle-input"), { target: { value: "@alexcoder" } });

    const submitClaimBtn = screen.getByTestId("submit-claim-btn");
    expect(submitClaimBtn.getAttribute("aria-busy")).toBeNull();
    expect(submitClaimBtn.textContent).toBe("Confirm Claim");

    // Click submit
    fireEvent.click(submitClaimBtn);

    // Assert loading state
    expect(submitClaimBtn.getAttribute("aria-busy")).toBe("true");
    expect(submitClaimBtn.textContent).toContain("Claiming...");
    expect(submitClaimBtn.querySelector(".animate-spin")).not.toBeNull();

    // Resolve claim and finish modal
    await act(async () => {
      resolveClaim!({
        ...mockIssues[0],
        claimed: true,
        claimed_by: "@alexcoder",
        github_sync_status: "Synced",
        github_sync_message: "Assigned",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("claim-modal-done-btn")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("claim-modal-done-btn"));

    // 2. Test Verify Modal Submit Button Loading State
    await waitFor(() => {
      expect(screen.getByTestId("verify-issue-btn-cf-issue-3")).toBeDefined();
    });

    let resolveVerify: ((val: any) => void) | null = null;
    const verifyPromise = new Promise((res) => {
      resolveVerify = res;
    });

    mockController!.addHandler("/api/contributors/verify", () => verifyPromise);

    fireEvent.click(screen.getByTestId("verify-issue-btn-cf-issue-3"));
    expect(screen.getByText("Verify Contributor & Generate PR")).toBeDefined();

    const submitVerifyBtn = screen.getByTestId("submit-verify-btn");
    expect(submitVerifyBtn.getAttribute("aria-busy")).toBeNull();
    expect(submitVerifyBtn.textContent).toBe("Verify & Generate PR");

    // Click submit
    fireEvent.click(submitVerifyBtn);

    // Assert loading state
    expect(submitVerifyBtn.getAttribute("aria-busy")).toBe("true");
    expect(submitVerifyBtn.textContent).toContain("Verifying...");
    expect(submitVerifyBtn.querySelector(".animate-spin")).not.toBeNull();

    // Resolve verify and finish modal
    await act(async () => {
      resolveVerify!(mockVerifyResponse);
    });

    await waitFor(() => {
      expect(screen.getByTestId("finish-verify-btn")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("finish-verify-btn"));
  });
});
