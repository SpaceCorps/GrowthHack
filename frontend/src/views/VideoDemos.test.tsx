import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VideoDemos } from "./VideoDemos";
import type { VideoDemo } from "../types";
import { setupMockFetch, setupMockClipboard } from "../test";
import type { MockFetchController, MockClipboardController } from "../test";

const mockDemos: VideoDemo[] = [
  {
    id: "demo-test-1",
    feature: "Git Worktrees",
    target_platform: "LinkedIn",
    duration_seconds: 30,
    headline: "Stop Agent Collisions With Git Worktrees",
    body: "Here is why worktree isolation fixes agent race conditions.",
    storyboard: "00:00 - 00:05 Hook\n00:05 - 00:30 Walkthrough",
    status: "Approved",
    created_at: "2026-09-11T05:00:00Z",
    updated_at: "2026-09-11T05:00:00Z",
    scenes: [
      {
        stage: "Hook",
        start_second: 0,
        end_second: 5,
        title: "Index Lock Friction",
        visual_action: "Split terminal showing index lock error.",
        playwright_action: "await page.goto('/terminal');",
      },
      {
        stage: "WorktreeIsolation",
        start_second: 5,
        end_second: 15,
        title: "Ephemeral Worktree",
        visual_action: "Tendril spins up worktree.",
        playwright_action: "await page.click('#spawn');",
      },
      {
        stage: "TestVerification",
        start_second: 15,
        end_second: 25,
        title: "Parallel Test Suite",
        visual_action: "Running parallel verification.",
        playwright_action: "await page.click('#test');",
      },
      {
        stage: "PrBadgeOutro",
        start_second: 25,
        end_second: 30,
        title: "PR Badge & Outro",
        visual_action: "PR created with green verification badge.",
        playwright_action: "await page.screenshot();",
      },
    ],
    platform_copy: {
      linkedin_post: "LinkedIn hook post content for Git Worktrees.",
      twitter_thread: [
        "1/3 Git worktrees thread part 1",
        "2/3 Git worktrees thread part 2",
        "3/3 Git worktrees thread part 3",
      ],
      youtube_shorts_caption: "Shorts caption for Git Worktrees #DevTools",
    },
    automation_config: {
      generator_path: "/Users/rorychatt/git/web-demo-generator",
      playwright_script:
        "import { test } from '@playwright/test'; test('worktrees', async () => {});",
      transcode_format: "mp4",
    },
  },
  {
    id: "demo-test-2",
    feature: "Voice Control",
    target_platform: "X/Twitter",
    duration_seconds: 25,
    headline: "Hands-Free Voice Coding Walkthrough",
    body: "Speak architectural intent and launch agents.",
    storyboard: "00:00 - 00:05 Hook\n00:05 - 00:25 Demo",
    status: "Pending",
    created_at: "2026-09-11T05:00:00Z",
    updated_at: "2026-09-11T05:00:00Z",
  },
];

describe("VideoDemos View", () => {
  let mockClipboard: MockClipboardController | null = null;
  let mockController: MockFetchController | null = null;

  beforeEach(() => {
    mockClipboard = setupMockClipboard();

    mockController = setupMockFetch({
      handlers: {
        "/api/demos/generate": { task_id: "task-test-99", message: "Started" },
        "/api/demos": mockDemos,
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
  });

  it("renders demo cards with live data", () => {
    render(<VideoDemos demos={mockDemos} />);

    expect(screen.getAllByText("Git Worktrees").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Voice Control").length).toBeGreaterThan(0);
    expect(screen.getByText("“Stop Agent Collisions With Git Worktrees”")).toBeDefined();
    expect(screen.getByText("“Hands-Free Voice Coding Walkthrough”")).toBeDefined();
  });

  it("renders storyboard timeline visualizer with all 4 stages and duration labels", () => {
    render(<VideoDemos demos={mockDemos} />);

    expect(screen.getAllByText("Stage 1: Hook").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stage 2: Worktree Isolation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stage 3: Automated Test Verification").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stage 4: PR Badge Outro").length).toBeGreaterThan(0);

    expect(screen.getAllByText("0:00 - 0:05").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0:05 - 0:15").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0:15 - 0:25").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0:25 - 0:30").length).toBeGreaterThan(0);
  });

  it("expands and collapses scene Playwright steps", () => {
    render(<VideoDemos demos={mockDemos} />);

    const expandBtn = screen.getAllByText("Show Playwright Steps")[0];
    fireEvent.click(expandBtn);

    expect(screen.getByText("Hide Actions")).toBeDefined();
    expect(screen.getByText("await page.goto('/terminal');")).toBeDefined();
    expect(screen.getByText("await page.click('#spawn');")).toBeDefined();
  });

  it("switches between platform copy tabs (LinkedIn, X/Twitter, YouTube Shorts, Playwright)", () => {
    render(<VideoDemos demos={mockDemos} />);

    // Default tab is LinkedIn
    expect(screen.getByText("LinkedIn hook post content for Git Worktrees.")).toBeDefined();

    // Click Twitter tab
    const twitterTab = screen.getByTestId("tab-demo-test-1-twitter");
    fireEvent.click(twitterTab);
    expect(screen.getByText("1/3 Git worktrees thread part 1")).toBeDefined();

    // Click YouTube tab
    const youtubeTab = screen.getByTestId("tab-demo-test-1-youtube");
    fireEvent.click(youtubeTab);
    expect(screen.getByText("Shorts caption for Git Worktrees #DevTools")).toBeDefined();

    // Click Playwright tab
    const playwrightTab = screen.getByTestId("tab-demo-test-1-playwright");
    fireEvent.click(playwrightTab);
    expect(screen.getByText(/@playwright\/test/)).toBeDefined();
  });

  it("navigates platform copy tabs via ArrowRight/ArrowLeft on the tablist", () => {
    render(<VideoDemos demos={mockDemos} />);

    const twitterTab = screen.getByTestId("tab-demo-test-1-twitter");
    const tablist = twitterTab.closest('[role="tablist"]') as HTMLElement;
    expect(tablist).not.toBeNull();

    // Default tab is LinkedIn; ArrowRight moves to X/Twitter
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByText("1/3 Git worktrees thread part 1")).toBeDefined();
    expect(twitterTab.getAttribute("aria-selected")).toBe("true");

    // ArrowLeft moves back to LinkedIn
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(screen.getByText("LinkedIn hook post content for Git Worktrees.")).toBeDefined();
  });

  it("copies platform script and full package to clipboard", () => {
    render(<VideoDemos demos={mockDemos} />);

    const copyPostBtn = screen.getAllByText("Copy Post")[0];
    fireEvent.click(copyPostBtn);

    expect(mockClipboard?.writeText).toHaveBeenCalledWith(
      "LinkedIn hook post content for Git Worktrees.",
    );

    const copyPackageBtn = screen.getAllByText("Copy Full Package")[0];
    fireEvent.click(copyPackageBtn);

    expect(mockClipboard?.writeText).toHaveBeenCalledWith(
      expect.stringContaining("=== LINKEDIN POST ==="),
    );
  });

  it("submits generation request and handles callback", async () => {
    const onGenerateMock = vi.fn();
    render(<VideoDemos onGenerateDemo={onGenerateMock} demos={mockDemos} />);

    const submitBtn = screen.getByText("Generate Package");
    fireEvent.submit(submitBtn.closest("form")!);

    expect(onGenerateMock).toHaveBeenCalledWith("Git Worktrees", "LinkedIn", 30, "mp4");
  });
});
