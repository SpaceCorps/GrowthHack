import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { Playground } from "./Playground";
import type {
  PlaygroundScenario,
  PlaygroundRunState,
  PlaygroundMetrics,
  BannerEmbedInfo,
  WorktreeFileNode,
} from "../types";

const mockScenarios: PlaygroundScenario[] = [
  {
    id: "scenario-health-check",
    title: "Health check endpoint with uptime metrics",
    description: "Simulates an autonomous agent implementing /api/health.",
    target_branch: "master",
    estimated_seconds: 15,
    file_tree: [
      {
        name: "backend",
        path: "backend",
        is_dir: true,
        status: "Modified",
        children: [
          {
            name: "health.rs",
            path: "backend/src/api/health.rs",
            is_dir: false,
            status: "Created",
          },
        ],
      },
    ],
    diff: "diff --git a/backend/src/api/health.rs b/backend/src/api/health.rs\n+ pub async fn health_check() {}",
    pr_summary: "Pull Request: Add health check endpoint\nAll verifications passed.",
  },
  {
    id: "scenario-rate-limiter",
    title: "Token bucket rate limiter Tower middleware",
    description: "Simulates creating an isolated worktree.",
    target_branch: "master",
    estimated_seconds: 20,
    file_tree: [
      {
        name: "backend",
        path: "backend",
        is_dir: true,
        status: "Modified",
      },
    ],
    diff: "diff --git a/backend/src/middleware/rate_limit.rs\n+ pub fn build_rate_limiter() {}",
    pr_summary: "Pull Request: Token bucket rate limiter\nAll verifications passed.",
  },
];

const mockTree: WorktreeFileNode[] = [
  {
    name: "backend",
    path: "backend",
    is_dir: true,
    status: "Modified",
    children: [
      {
        name: "health.rs",
        path: "backend/src/api/health.rs",
        is_dir: false,
        status: "Created",
      },
    ],
  },
  {
    name: "frontend",
    path: "frontend",
    is_dir: true,
    status: "Unchanged",
  },
];

const mockInitialState: PlaygroundRunState = {
  id: "pg-run-1",
  scenario_id: "scenario-health-check",
  status: "Idle",
  current_step: 1,
  step_progress_pct: 0,
  logs: [
    "tendril.run interactive browser sandbox ready.",
    "Select a scenario or import a GitHub issue to test the 30-second loop.",
  ],
  verification_gates: [
    {
      name: "RustClippy",
      command: "cargo clippy -- -D warnings",
      status: "Pending",
      duration_ms: 0,
      output: "Pending execution in isolated worktree.",
    },
    {
      name: "RustTest",
      command: "cargo test",
      status: "Pending",
      duration_ms: 0,
      output: "Pending execution in isolated worktree.",
    },
    {
      name: "NpmLint",
      command: "vp fmt --check . && vp lint .",
      status: "Pending",
      duration_ms: 0,
      output: "Pending execution in isolated worktree.",
    },
    {
      name: "NpmBuild",
      command: "vp install && vp build",
      status: "Pending",
      duration_ms: 0,
      output: "Pending execution in isolated worktree.",
    },
    {
      name: "CheckResult",
      command: "tendril verify check-result",
      status: "Pending",
      duration_ms: 0,
      output: "Pending verification report generation.",
    },
  ],
  diff_preview: undefined,
  pr_summary: undefined,
  elapsed_seconds: 0,
  speed_multiplier: 1.0,
};

const mockMetrics: PlaygroundMetrics = {
  total_sessions: 12,
  walkthroughs_completed: 8,
  issues_imported: 3,
  github_stars_clicked: 5,
  avg_completion_seconds: 28.6,
};

const mockBanner: BannerEmbedInfo = {
  title: "Try Tendril in 30 Seconds Embed Banner",
  badge_url: "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4",
  target_url: "https://tendril.run/playground",
  markdown_snippet:
    "[![Try Tendril in 30 Seconds](https://img.shields.io/badge/Try%20Tendril-30s)](https://tendril.run/playground)",
  html_snippet:
    '<a href="https://tendril.run/playground"><img src="https://img.shields.io/badge/Try%20Tendril-30s" /></a>',
  raw_svg: "<svg></svg>",
};

describe("Playground View Component", () => {
  let clipboardWriteTextMock: any;

  beforeEach(() => {
    clipboardWriteTextMock = vi.fn().mockImplementation(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: clipboardWriteTextMock,
      },
      configurable: true,
      writable: true,
    });

    vi.spyOn(window, "open").mockImplementation(() => null);

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/playground/scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScenarios),
        });
      }
      if (url.includes("/api/playground/tree")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTree),
        });
      }
      if (url.includes("/api/playground/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInitialState),
        });
      }
      if (url.includes("/api/playground/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMetrics),
        });
      }
      if (url.includes("/api/playground/banner")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBanner),
        });
      }
      if (url.includes("/api/playground/start")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockInitialState,
              status: "Running",
              current_step: 2,
              step_progress_pct: 50,
              logs: [
                ...mockInitialState.logs,
                "[00:10] Step 2/4 (Worktree): Provisioning ephemeral git worktree...",
              ],
            }),
        });
      }
      if (url.includes("/api/playground/reset")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInitialState),
        });
      }
      if (url.includes("/api/playground/import-issue")) {
        const imported: PlaygroundScenario = {
          id: "custom-imported-1",
          title: "Custom Synthesized Issue",
          description: "Synthesized from URL",
          target_branch: "master",
          estimated_seconds: 25,
          file_tree: mockTree,
          diff: "diff --git a/custom.rs\n+ pub fn custom() {}",
          pr_summary: "# PR Summary: Custom",
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(imported),
        });
      }
      if (url.includes("/api/playground/star-click")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockMetrics,
              github_stars_clicked: mockMetrics.github_stars_clicked + 1,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders playground header, scenario selector cards, and stepper", async () => {
    await act(async () => {
      render(<Playground />);
    });

    expect(screen.getByText("Interactive Browser Web Playground")).toBeDefined();
    expect(
      screen.getByText("Choose Developer Scenario or Import Custom GitHub Issue"),
    ).toBeDefined();
    expect(screen.getByText("Autonomous Pipeline Stepper")).toBeDefined();

    // Curated scenarios
    expect(
      screen.getAllByText("Health check endpoint with uptime metrics").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Token bucket rate limiter Tower middleware")).toBeDefined();

    // Stepper stages
    expect(screen.getByText("Issue Intake")).toBeDefined();
    expect(screen.getByText("Ephemeral Worktree")).toBeDefined();
    expect(screen.getByText("Verification Gates")).toBeDefined();
    expect(screen.getByText("Verified PR Diff")).toBeDefined();

    // Worktree sandbox column
    expect(screen.getByText("Worktree Sandbox")).toBeDefined();
  });

  it("selects a scenario and starts 30-second simulation", async () => {
    await act(async () => {
      render(<Playground />);
    });

    const startButton = screen.getByText("Start Simulation (30s)");

    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/playground/start", expect.any(Object));
  });

  it("switches tabs between Verification Gates, Diff, and PR Summary", async () => {
    await act(async () => {
      render(<Playground />);
    });

    // Default tab shows Gates
    expect(screen.getByText("RustClippy")).toBeDefined();
    expect(screen.getByText("RustTest")).toBeDefined();

    // Switch to Diff tab
    const diffTabBtn = screen.getByText("Diff");
    await act(async () => {
      fireEvent.click(diffTabBtn);
    });
    expect(screen.getByText(/health_check/)).toBeDefined();

    // Switch to PR Summary tab
    const prTabBtn = screen.getByText("PR Summary");
    await act(async () => {
      fireEvent.click(prTabBtn);
    });
    expect(screen.getByText(/Pull Request: Add health check endpoint/)).toBeDefined();
  });

  it("allows importing custom GitHub issue via modal", async () => {
    await act(async () => {
      render(<Playground />);
    });

    const openImportBtn = screen.getByText("Import Custom GitHub Issue");
    await act(async () => {
      fireEvent.click(openImportBtn);
    });

    expect(screen.getByText("Synthesize Scenario")).toBeDefined();

    const titleInput = screen.getByPlaceholderText("e.g. Add Prometheus telemetry endpoint");
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: "Add Prometheus telemetry endpoint" } });
    });

    const submitBtn = screen.getByText("Synthesize Scenario");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/playground/import-issue", expect.any(Object));
  });

  it("copies embed banner markdown and HTML snippets", async () => {
    await act(async () => {
      render(<Playground />);
    });

    const copyMarkdownBtn = screen.getByText("Copy Markdown");
    await act(async () => {
      fireEvent.click(copyMarkdownBtn);
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(mockBanner.markdown_snippet);

    const copyHtmlBtn = screen.getByText("Copy HTML");
    await act(async () => {
      fireEvent.click(copyHtmlBtn);
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(mockBanner.html_snippet);
  });

  it("shows celebration modal on simulation completion with star-on-GitHub CTA", async () => {
    let running = false;
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/api/playground/status")) {
        if (!running) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockInitialState),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockInitialState,
              status: "Completed",
              current_step: 4,
              step_progress_pct: 100,
              elapsed_seconds: 28.6,
              verification_gates: mockInitialState.verification_gates.map((g) => ({
                ...g,
                status: "Passed",
              })),
              diff_preview: "diff --git a/test.rs\n+ pub fn test() {}",
              pr_summary: "PR verified in 28.6s",
            }),
        });
      }
      if (url.includes("/api/playground/start")) {
        running = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockInitialState,
              status: "Running",
              current_step: 1,
            }),
        });
      }
      if (url.includes("/api/playground/scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScenarios),
        });
      }
      if (url.includes("/api/playground/tree")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTree),
        });
      }
      if (url.includes("/api/playground/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMetrics),
        });
      }
      if (url.includes("/api/playground/banner")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBanner),
        });
      }
      if (url.includes("/api/playground/star-click")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockMetrics,
              github_stars_clicked: mockMetrics.github_stars_clicked + 1,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    vi.useFakeTimers();

    await act(async () => {
      render(<Playground />);
    });

    const startBtn = screen.getByText("Start Simulation (30s)");
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Advance timer to trigger polling interval
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/Walkthrough Complete! Star Tendril on GitHub/)).toBeDefined();

    const starBtn = screen.getByText("Star Ivy-Tendril on GitHub");
    await act(async () => {
      fireEvent.click(starBtn);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/playground/star-click", {
      method: "POST",
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/Ivy-Interactive/Ivy-Tendril",
      "_blank",
    );

    vi.useRealTimers();
  });

  it("auto-selects scenario-rate-limiter when initialized with #scenario=rate-limiter in URL hash", async () => {
    window.location.hash = "#scenario=rate-limiter";

    await act(async () => {
      render(<Playground />);
    });

    expect(
      screen.getAllByText("Token bucket rate limiter Tower middleware").length,
    ).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/playground/tree?scenario_id=scenario-rate-limiter"),
    );

    window.location.hash = "";
  });

  it("updates window.location.hash to #scenario=<slug> when clicking a scenario card", async () => {
    window.location.hash = "";

    await act(async () => {
      render(<Playground />);
    });

    const card = screen.getAllByText("Token bucket rate limiter Tower middleware")[0];
    await act(async () => {
      fireEvent.click(card);
    });

    expect(window.location.hash).toBe("#scenario=rate-limiter");

    window.location.hash = "";
  });

  it("copies the scenario URL with the resolved base origin to the clipboard and shows feedback when clicking Share Scenario", async () => {
    window.location.hash = "#scenario=rate-limiter";

    await act(async () => {
      render(<Playground />);
    });

    const shareBtn = screen.getByText("Share Scenario");
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      "https://tendril.run/#scenario=rate-limiter",
    );
    expect(screen.getAllByText("Link Copied!").length).toBeGreaterThan(0);

    window.location.hash = "";
  });

  it("switches active scenario in response to hashchange events", async () => {
    window.location.hash = "";

    await act(async () => {
      render(<Playground />);
    });

    expect(screen.getAllByText("Health check endpoint with uptime metrics").length).toBeGreaterThan(
      0,
    );

    await act(async () => {
      window.location.hash = "#scenario=rate-limiter";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/playground/tree?scenario_id=scenario-rate-limiter"),
    );

    window.location.hash = "";
  });
});
