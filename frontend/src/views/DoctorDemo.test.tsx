import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { DoctorDemo } from "./DoctorDemo";
import type { DiagnosticReport, DemoScenario, DemoRunState, OnboardingMetrics } from "../types";

const mockReport: DiagnosticReport = {
  timestamp: "2026-09-10T18:00:00Z",
  checks: [
    {
      id: "git_installed",
      name: "Git CLI Installed",
      category: "git",
      status: "Pass",
      message: "Detected: git version 2.39.5",
      remediation_command: undefined,
      can_auto_fix: false,
    },
    {
      id: "git_worktrees",
      name: "Git Worktree Capability",
      category: "git",
      status: "Pass",
      message: "Git worktree commands are supported and functioning.",
      remediation_command: undefined,
      can_auto_fix: false,
    },
    {
      id: "agent_claude",
      name: "Claude Code CLI",
      category: "agent",
      status: "Warning",
      message: "Claude Code CLI not found in PATH.",
      remediation_command: "npm install -g @anthropic-ai/claude-code",
      can_auto_fix: false,
    },
    {
      id: "key_anthropic",
      name: "ANTHROPIC_API_KEY",
      category: "keys",
      status: "Warning",
      message: "ANTHROPIC_API_KEY environment variable is not set.",
      remediation_command: 'export ANTHROPIC_API_KEY="your-key"',
      can_auto_fix: true,
    },
    {
      id: "port_4200",
      name: "Backend Port 4200",
      category: "ports",
      status: "Pass",
      message: "Port 4200 loopback binding verified and accessible.",
      remediation_command: undefined,
      can_auto_fix: false,
    },
  ],
  summary: {
    total: 5,
    passed: 3,
    warnings: 2,
    failures: 0,
    ready_for_execution: true,
  },
};

const mockScenarios: DemoScenario[] = [
  {
    id: "scenario-health-check",
    title: "Add health check endpoint with uptime metrics",
    description: "Simulates an autonomous agent implementing /api/health.",
    target_branch: "master",
    estimated_duration_sec: 15,
  },
  {
    id: "scenario-rate-limiter",
    title: "Add token bucket rate limiter to public endpoints",
    description: "Simulates creating an isolated worktree.",
    target_branch: "master",
    estimated_duration_sec: 20,
  },
];

const mockInitialDemoState: DemoRunState = {
  id: "demo-1",
  status: "Idle",
  current_step: 1,
  step_progress_pct: 0,
  logs: ["Ready to run zero-config demo simulation."],
  elapsed_seconds: 0,
};

const mockMetrics: OnboardingMetrics = {
  first_run_completed: false,
  demo_completed_count: 1,
  diagnostic_runs_count: 2,
  time_to_first_pr_seconds: 54.2,
  github_starred: false,
};

describe("DoctorDemo View Component", () => {
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

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes("/api/doctor/diagnose")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockReport),
        });
      }
      if (url.includes("/api/doctor/fix")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockReport,
              checks: mockReport.checks.map((c) =>
                c.id === "key_anthropic" ? { ...c, status: "Pass" } : c,
              ),
              summary: { ...mockReport.summary, passed: 4, warnings: 1 },
            }),
        });
      }
      if (url.includes("/api/demo/scenarios")) {
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "scenario-custom-test",
                title: "Custom Test Scenario",
                description: "Description of custom test",
                target_branch: "master",
                estimated_duration_sec: 15,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScenarios),
        });
      }
      if (url.includes("/api/demo/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInitialDemoState),
        });
      }
      if (url.includes("/api/demo/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMetrics),
        });
      }
      if (url.includes("/api/demo/start")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockInitialDemoState,
              status: "Running",
              current_step: 2,
              step_progress_pct: 50,
              logs: [
                ...mockInitialDemoState.logs,
                "[00:12] Step 2/4 (Worktree): Creating isolated git worktree...",
              ],
            }),
        });
      }
      if (url.includes("/api/demo/reset")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInitialDemoState),
        });
      }
      if (url.includes("/api/demo/star-click")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockMetrics, github_starred: true }),
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

  it("renders diagnostic checklist and run diagnostic button", async () => {
    await act(async () => {
      render(<DoctorDemo />);
    });

    expect(screen.getByText("Tendril Doctor & Replayable Demo Simulator")).toBeDefined();
    expect(screen.getByText("System Diagnostic Checklist")).toBeDefined();
    expect(screen.getByText("Run Diagnostics")).toBeDefined();
    expect(screen.getByText("Fix All Fixable")).toBeDefined();

    // Check categories buttons
    expect(screen.getByText("All Checks")).toBeDefined();
    expect(screen.getByText("Git Environment")).toBeDefined();
    expect(screen.getByText("Agent CLIs")).toBeDefined();
    expect(screen.getByText("API Keys")).toBeDefined();
    expect(screen.getByText("Port Availability")).toBeDefined();

    // Verify rendered checks from mockReport
    expect(screen.getByText("Git CLI Installed")).toBeDefined();
    expect(screen.getByText("Claude Code CLI")).toBeDefined();
    expect(screen.getByText("ANTHROPIC_API_KEY")).toBeDefined();
    expect(screen.getByText("Backend Port 4200")).toBeDefined();
  });

  it("runs diagnostics and updates status indicators", async () => {
    await act(async () => {
      render(<DoctorDemo />);
    });

    const runButton = screen.getByText("Run Diagnostics");

    await act(async () => {
      fireEvent.click(runButton);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/doctor/diagnose", {
      method: "POST",
    });

    // Summary numbers from mockReport
    expect(screen.getByText("Ready to Execute")).toBeDefined();
  });

  it("triggers 1-click remediation command copying", async () => {
    await act(async () => {
      render(<DoctorDemo />);
    });

    const copyButtons = screen.getAllByText("Copy");
    expect(copyButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    expect(clipboardWriteTextMock).toHaveBeenCalled();
  });

  it("executes replayable demo workflow stepper to PR generation", async () => {
    await act(async () => {
      render(<DoctorDemo />);
    });

    expect(screen.getByText("Replayable Zero-Config Demo Simulator")).toBeDefined();
    const startButton = screen.getByText("Start Replayable Demo");

    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/demo/start", expect.any(Object));

    // Verify all 4 steps are rendered
    expect(screen.getByText("Issue Intake")).toBeDefined();
    expect(screen.getByText("Isolated Worktree")).toBeDefined();
    expect(screen.getByText("Verification Gates")).toBeDefined();
    expect(screen.getByText("PR Diff Preview")).toBeDefined();
  });

  it("displays first-success celebration modal with GitHub star link", async () => {
    let demoStarted = false;
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/api/demo/status")) {
        if (!demoStarted) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockInitialDemoState),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "completed-demo",
              status: "Completed",
              current_step: 4,
              step_progress_pct: 100,
              logs: ["[00:54] Verified pull request generated with clean mergeability."],
              diff_preview: "diff --git a/backend/src/api/health.rs b/backend/src/api/health.rs",
              pr_summary: "Verification Summary: All Pass",
              elapsed_seconds: 54.2,
            }),
        });
      }
      if (url.includes("/api/demo/start")) {
        demoStarted = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "completed-demo",
              status: "Running",
              current_step: 1,
              step_progress_pct: 25,
              logs: ["Starting..."],
              elapsed_seconds: 5.0,
            }),
        });
      }
      if (url.includes("/api/demo/star-click")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockMetrics, github_starred: true }),
        });
      }
      if (url.includes("/api/demo/metrics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMetrics),
        });
      }
      if (url.includes("/api/doctor/diagnose")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockReport),
        });
      }
      if (url.includes("/api/demo/scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScenarios),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    vi.useFakeTimers();

    await act(async () => {
      render(<DoctorDemo />);
    });

    const startButton = screen.getByText("Start Replayable Demo");
    await act(async () => {
      fireEvent.click(startButton);
    });

    // Advance timer to trigger the polling interval
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Celebration modal should be visible
    expect(screen.getByText("Enjoying Tendril? Star us on GitHub! ⭐")).toBeDefined();

    const starButton = screen.getByText("Star Ivy-Tendril on GitHub");
    await act(async () => {
      fireEvent.click(starButton);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/demo/star-click", {
      method: "POST",
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/Ivy-Interactive/Ivy-Tendril",
      "_blank",
    );

    vi.useRealTimers();
  });

  it("streams simulation logs and updates steps reactively via EventSource", async () => {
    let messageListener: ((e: { data: string }) => void) | null = null;
    let closed = false;

    class MockEventSource {
      url: string;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          if (this.onmessage) {
            messageListener = this.onmessage;
          }
        }, 0);
      }
      close() {
        closed = true;
      }
    }

    (global as any).EventSource = MockEventSource;

    try {
      await act(async () => {
        render(<DoctorDemo />);
      });

      const startButton = screen.getByText("Start Replayable Demo");
      await act(async () => {
        fireEvent.click(startButton);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/demo/start", expect.any(Object));

      // Wait a tick for EventSource instantiation
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
      });

      // Simulate Step 2 log arrival
      await act(async () => {
        if (messageListener) {
          messageListener({
            data: "[00:12] Step 2/4 (Worktree): Creating isolated git worktree at 'Worktrees/spacecorps/growthhack'...",
          });
        }
      });

      // Verify line is rendered in terminal drawer
      expect(
        screen.getByText(
          "[00:12] Step 2/4 (Worktree): Creating isolated git worktree at 'Worktrees/spacecorps/growthhack'...",
        ),
      ).toBeDefined();

      // Simulate Step 3 log arrival
      await act(async () => {
        if (messageListener) {
          messageListener({
            data: "[00:30] Step 3/4 (Verification): RustClippy check: cargo clippy -- -D warnings -> PASS",
          });
        }
      });

      expect(
        screen.getByText(
          "[00:30] Step 3/4 (Verification): RustClippy check: cargo clippy -- -D warnings -> PASS",
        ),
      ).toBeDefined();

      // Simulate [DONE] log arrival
      await act(async () => {
        if (messageListener) {
          messageListener({
            data: "[DONE] Autonomous pipeline completed successfully.",
          });
        }
      });

      expect(screen.getByText("[DONE] Autonomous pipeline completed successfully.")).toBeDefined();
      expect(closed).toBe(true);
    } finally {
      delete (global as any).EventSource;
    }
  });

  it("renders dynamic scenario list and updates active scenario selection", async () => {
    await act(async () => {
      render(<DoctorDemo />);
    });

    // Check that scenarios from mockScenarios are rendered
    expect(screen.getByText("Add health check endpoint with uptime metrics")).toBeDefined();
    expect(screen.getByText("Add token bucket rate limiter to public endpoints")).toBeDefined();

    // Verify branch & estimated duration
    expect(screen.getByText("Branch: master • Est. 15s")).toBeDefined();
    expect(screen.getByText("Branch: master • Est. 20s")).toBeDefined();

    // Select second scenario
    const rateLimiterButton = screen.getByText("Add token bucket rate limiter to public endpoints");
    await act(async () => {
      fireEvent.click(rateLimiterButton);
    });

    // Click start demo
    const startButton = screen.getByText("Start Replayable Demo");
    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/demo/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          scenario_id: "scenario-rate-limiter",
          speed_multiplier: 1.0,
        }),
      }),
    );
  });

  it("opens Add Scenario modal, submits custom scenario, and selects it", async () => {
    await act(async () => {
      render(<DoctorDemo />);
    });

    const addScenarioButton = screen.getByText("Add Scenario");
    await act(async () => {
      fireEvent.click(addScenarioButton);
    });

    // Verify modal is open
    expect(screen.getByText("Create Custom Demo Scenario")).toBeDefined();

    // Fill form
    const idInput = screen.getByPlaceholderText("scenario-my-workflow");
    const titleInput = screen.getByPlaceholderText(
      "Add JWT authentication and refresh token rotation",
    );
    const descInput = screen.getByPlaceholderText(
      "Simulates an autonomous agent creating auth middleware with token validation tests in an isolated worktree.",
    );

    fireEvent.change(idInput, { target: { value: "scenario-custom-test" } });
    fireEvent.change(titleInput, { target: { value: "Custom Test Scenario" } });
    fireEvent.change(descInput, { target: { value: "Description of custom test" } });

    const submitButton = screen.getByText("Create Scenario");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/demo/scenarios",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  describe("Terminal Drawer Step and Search Filters", () => {
    const multiStepLogsState: DemoRunState = {
      id: "demo-filter-test",
      status: "Idle",
      current_step: 4,
      step_progress_pct: 100,
      logs: [
        "[00:02] Step 1/4 (Intake): Analyzing task issue intake and specification...",
        "[00:15] Step 2/4 (Worktree): Creating isolated git worktree branch...",
        "[00:30] Step 3/4 (Verification): RustClippy check: cargo clippy -- -D warnings -> PASS",
        "[00:45] Step 4/4 (PR Diff): Formatted pull request diff preview ready.",
      ],
      elapsed_seconds: 45,
    };

    beforeEach(() => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/demo/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(multiStepLogsState),
          });
        }
        if (url.includes("/api/doctor/diagnose")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockReport),
          });
        }
        if (url.includes("/api/demo/scenarios")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockScenarios),
          });
        }
        if (url.includes("/api/demo/metrics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMetrics),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it("renders step filter buttons and search input in terminal drawer", async () => {
      await act(async () => {
        render(<DoctorDemo />);
      });

      expect(screen.getByRole("button", { name: "All" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Intake" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Worktree" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Verification" })).toBeDefined();
      expect(screen.getByRole("button", { name: "PR Diff" })).toBeDefined();
      expect(screen.getByPlaceholderText("Filter logs...")).toBeDefined();
    });

    it("filters logs by step filter buttons", async () => {
      await act(async () => {
        render(<DoctorDemo />);
      });

      // Verify all 4 initial logs are visible
      expect(screen.getByText(/Step 1\/4 \(Intake\)/)).toBeDefined();
      expect(screen.getByText(/Step 2\/4 \(Worktree\)/)).toBeDefined();
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.getByText(/Step 4\/4 \(PR Diff\)/)).toBeDefined();

      // Click Intake
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Intake" }));
      });
      expect(screen.getByText(/Step 1\/4 \(Intake\)/)).toBeDefined();
      expect(screen.queryByText(/Step 2\/4 \(Worktree\)/)).toBeNull();
      expect(screen.queryByText(/Step 3\/4 \(Verification\)/)).toBeNull();
      expect(screen.queryByText(/Step 4\/4 \(PR Diff\)/)).toBeNull();
      expect(screen.getByText("Showing 1 of 4 logs")).toBeDefined();

      // Click Worktree
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Worktree" }));
      });
      expect(screen.queryByText(/Step 1\/4 \(Intake\)/)).toBeNull();
      expect(screen.getByText(/Step 2\/4 \(Worktree\)/)).toBeDefined();
      expect(screen.queryByText(/Step 3\/4 \(Verification\)/)).toBeNull();
      expect(screen.queryByText(/Step 4\/4 \(PR Diff\)/)).toBeNull();

      // Click Verification
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Verification" }));
      });
      expect(screen.queryByText(/Step 1\/4 \(Intake\)/)).toBeNull();
      expect(screen.queryByText(/Step 2\/4 \(Worktree\)/)).toBeNull();
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.queryByText(/Step 4\/4 \(PR Diff\)/)).toBeNull();

      // Click PR Diff
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "PR Diff" }));
      });
      expect(screen.queryByText(/Step 1\/4 \(Intake\)/)).toBeNull();
      expect(screen.queryByText(/Step 2\/4 \(Worktree\)/)).toBeNull();
      expect(screen.queryByText(/Step 3\/4 \(Verification\)/)).toBeNull();
      expect(screen.getByText(/Step 4\/4 \(PR Diff\)/)).toBeDefined();

      // Click All
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "All" }));
      });
      expect(screen.getByText(/Step 1\/4 \(Intake\)/)).toBeDefined();
      expect(screen.getByText(/Step 2\/4 \(Worktree\)/)).toBeDefined();
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.getByText(/Step 4\/4 \(PR Diff\)/)).toBeDefined();
      expect(screen.queryByText(/Showing \d of \d logs/)).toBeNull();
    });

    it("filters logs by search query substring case-insensitively and clears search", async () => {
      await act(async () => {
        render(<DoctorDemo />);
      });

      const searchInput = screen.getByPlaceholderText("Filter logs...");

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "CLIPPY" } });
      });

      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.queryByText(/Step 1\/4 \(Intake\)/)).toBeNull();
      expect(screen.queryByText(/Step 2\/4 \(Worktree\)/)).toBeNull();
      expect(screen.queryByText(/Step 4\/4 \(PR Diff\)/)).toBeNull();
      expect(screen.getByText("Showing 1 of 4 logs")).toBeDefined();

      // Clear search with X button
      const clearSearchBtn = screen.getByLabelText("Clear search");
      await act(async () => {
        fireEvent.click(clearSearchBtn);
      });

      expect(screen.getByText(/Step 1\/4 \(Intake\)/)).toBeDefined();
      expect(screen.getByText(/Step 2\/4 \(Worktree\)/)).toBeDefined();
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.getByText(/Step 4\/4 \(PR Diff\)/)).toBeDefined();
      expect(screen.queryByText(/Showing \d of \d logs/)).toBeNull();
    });

    it("combines step filter button and search input conjunctionally", async () => {
      await act(async () => {
        render(<DoctorDemo />);
      });

      // Select Verification step
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Verification" }));
      });
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();

      // Search for PASS (should match Step 3)
      const searchInput = screen.getByPlaceholderText("Filter logs...");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "PASS" } });
      });
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.getByText("Showing 1 of 4 logs")).toBeDefined();

      // Search for FAIL (no match within Verification step)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "FAIL" } });
      });
      expect(screen.queryByText(/Step 3\/4 \(Verification\)/)).toBeNull();
      expect(screen.getByText("No log lines matching active filter.")).toBeDefined();
      expect(screen.getByText("Showing 0 of 4 logs")).toBeDefined();
    });

    it("resets filters when clicking Clear button", async () => {
      await act(async () => {
        render(<DoctorDemo />);
      });

      // Filter by Worktree and search "branch"
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Worktree" }));
      });
      const searchInput = screen.getByPlaceholderText("Filter logs...") as HTMLInputElement;
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "branch" } });
      });

      expect(screen.getByText("Showing 1 of 4 logs")).toBeDefined();
      const clearBtn = screen.getByRole("button", { name: "Clear" });

      await act(async () => {
        fireEvent.click(clearBtn);
      });

      expect(searchInput.value).toBe("");
      expect(screen.getByText(/Step 1\/4 \(Intake\)/)).toBeDefined();
      expect(screen.getByText(/Step 2\/4 \(Worktree\)/)).toBeDefined();
      expect(screen.getByText(/Step 3\/4 \(Verification\)/)).toBeDefined();
      expect(screen.getByText(/Step 4\/4 \(PR Diff\)/)).toBeDefined();
      expect(screen.queryByText(/Showing \d of \d logs/)).toBeNull();
    });

    it("displays empty state feedback when query matches zero log lines", async () => {
      await act(async () => {
        render(<DoctorDemo />);
      });

      const searchInput = screen.getByPlaceholderText("Filter logs...");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "nonexistent query string" } });
      });

      expect(screen.getByText("No log lines matching active filter.")).toBeDefined();
      expect(screen.getByText("Showing 0 of 4 logs")).toBeDefined();
    });
  });
});
