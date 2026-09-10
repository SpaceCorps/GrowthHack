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

    global.fetch = vi.fn().mockImplementation((url: string) => {
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
});
