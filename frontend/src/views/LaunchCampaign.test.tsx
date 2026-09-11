import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LaunchCampaign } from "./LaunchCampaign";
import type { LaunchCampaignState, AuthenticityAnalysis } from "../types";

const mockCampaign: LaunchCampaignState = {
  show_hn: {
    title: "Show HN: Ivy-Tendril – Autonomous coding agents in isolated Git worktrees",
    url: "https://github.com/Ivy-Interactive/Ivy-Tendril",
    maker_comment:
      "Hi HN! We built Ivy-Tendril because running autonomous coding agents directly in shared working copies triggers merge collisions and git index locks. Tendril provisions an ephemeral, isolated Git worktree for every agent task, runs strict verification test gates before creating pull requests, and orchestrates Claude Code, Codex, and Gemini CLI in parallel. Everything is open source Rust (Axum/Tokio) and React 19. https://github.com/Ivy-Interactive/Ivy-Tendril",
    authenticity_score: 92,
    score_breakdown: {
      score: 92,
      rating: "Authentic & Technical (High HN Alignment)",
      suggestions: [
        "Strong technical grounding with isolated worktrees",
        "Clear architectural problem statement",
      ],
      keyword_matches: ["isolated git worktrees", "Rust", "Axum", "open source"],
      penalty_reasons: [],
    },
  },
  product_hunt: {
    taglines: [
      "Autonomous coding agents in isolated Git worktrees",
      "Run multi-agent software factories with verification gates",
    ],
    selected_tagline: "Autonomous coding agents in isolated Git worktrees",
    first_comment: "Hey Product Hunt! 👋 We built Ivy-Tendril to solve agent workspace collision.",
    asset_specs: [
      {
        name: "Gallery Images",
        dimensions: "1270x760",
        requirement: "3-5 high-resolution screenshots",
        status: "Ready",
      },
      {
        name: "Thumbnail",
        dimensions: "240x240",
        requirement: "Animated GIF or clean SVG icon",
        status: "Ready",
      },
      {
        name: "Demo Video",
        dimensions: "1920x1080",
        requirement: "90s uncut demo video",
        status: "In Progress",
      },
    ],
    checklist: [
      {
        id: "ph-1",
        task: "Schedule launch for 00:01 AM PST",
        completed: false,
      },
      {
        id: "ph-2",
        task: "Verify hunter account permissions",
        completed: true,
      },
    ],
  },
  beta_testers: [
    {
      id: "tester-1",
      name: "Sarah Lin",
      handle: "@slin-dev",
      platform: "GitHub",
      specialty: "Rust & Distributed Systems",
      outreach_status: "Committed",
      notes: "Excited about worktree isolation and Axum backend.",
      updated_at: "2026-09-11T05:00:00Z",
    },
    {
      id: "tester-2",
      name: "David K.",
      handle: "@dk_hacker",
      platform: "HN",
      specialty: "DevOps & CI/CD",
      outreach_status: "Committed",
      notes: "Runs 40+ repo monorepos, wants to test CLI.",
      updated_at: "2026-09-11T05:00:00Z",
    },
    {
      id: "tester-11",
      name: "Maya Patel",
      handle: "@mayap_ai",
      platform: "HN",
      specialty: "LLM Evaluation & Agents",
      outreach_status: "Identified",
      notes: "Prominent commenter on recent r/LocalLLaMA thread.",
      updated_at: "2026-09-11T05:00:00Z",
    },
  ],
  syndication_checklist: [
    {
      id: "syn-reddit",
      platform: "Reddit",
      title: "r/programming Technical Deep-Dive",
      instructions: "Adhere to r/programming self-promotion rules. Zero marketing hype.",
      blurb: "We open-sourced Ivy-Tendril to solve agent workspace collision using Git worktrees.",
      completed: false,
    },
    {
      id: "syn-twitter",
      platform: "Twitter/X",
      title: "10-Tweet Technical Launch Thread",
      instructions: "Hook with video demo of multi-agent worktree collisions.",
      blurb: "🚨 Why your AI coding agents keep breaking each other 🧵👇",
      completed: false,
    },
  ],
  timeline: [
    {
      id: "phase-t48",
      phase: "T-48h Preparation",
      timing: "48 hours before launch",
      tasks: [
        {
          id: "task-t48-1",
          title: "Run tendril doctor on all target platforms",
          description: "Ensure zero onboarding friction for new developers.",
          completed: true,
        },
        {
          id: "task-t48-2",
          title: "Warm up 20 technical beta testers via personalized DMs",
          description: "Confirm launch hour availability and provide early access build.",
          completed: false,
        },
      ],
    },
    {
      id: "phase-t24",
      phase: "T-24h Asset Freeze",
      timing: "24 hours before launch",
      tasks: [
        {
          id: "task-t24-1",
          title: "Freeze repository main branch and verify CI green",
          description: "No breaking changes permitted 24 hours prior to launch.",
          completed: true,
        },
      ],
    },
  ],
};

describe("LaunchCampaign Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/launch/overview") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCampaign),
        });
      }
      if (url === "/api/launch/show-hn/analyze") {
        const analysis: AuthenticityAnalysis = {
          score: 96,
          rating: "Authentic & Technical (High HN Alignment)",
          suggestions: ["Excellent technical depth with high authenticity"],
          keyword_matches: ["isolated git worktrees", "Rust", "Axum", "benchmarks"],
          penalty_reasons: [],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(analysis),
        });
      }
      if (url.startsWith("/api/launch/testers/")) {
        const body = opts?.body ? JSON.parse(opts.body as string) : {};
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockCampaign.beta_testers[2],
              outreach_status: body.outreach_status || "Committed",
            }),
        });
      }
      if (url.startsWith("/api/launch/checklist/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...mockCampaign.syndication_checklist[0],
              completed: true,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

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
  });

  it("test_renders_launch_orchestrator_dashboard", async () => {
    render(<LaunchCampaign initialCampaign={mockCampaign} />);

    // Header title and progress
    expect(screen.getByText("Coordinated Show HN & Product Hunt Launch")).toBeTruthy();
    expect(screen.getByText(/48-Hour Execution Progress/i)).toBeTruthy();

    // Timeline phases
    expect(screen.getByText("T-48h Preparation")).toBeTruthy();
    expect(screen.getByText("T-24h Asset Freeze")).toBeTruthy();

    // Main navigation tabs
    expect(screen.getByText("48-Hour Timeline")).toBeTruthy();
    expect(screen.getByText("Show HN Studio")).toBeTruthy();
    expect(screen.getByText("Product Hunt Kit")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Beta Mobilization/i })).toBeTruthy();
    expect(screen.getByText("Cross-Channel Syndication")).toBeTruthy();
  });

  it("test_show_hn_authenticity_analyzer_recalculates", async () => {
    render(<LaunchCampaign initialCampaign={mockCampaign} />);

    // Navigate to Show HN Studio tab
    fireEvent.click(screen.getByRole("button", { name: /Show HN Studio/i }));

    // Check initial score
    expect(screen.getByText("Authenticity Analyzer")).toBeTruthy();
    expect(screen.getByDisplayValue(mockCampaign.show_hn.title)).toBeTruthy();

    // Type new title
    const titleInput = screen.getByDisplayValue(mockCampaign.show_hn.title);
    fireEvent.change(titleInput, {
      target: {
        value: "Show HN: Ivy-Tendril - Benchmarks and reproducible worktrees in Rust",
      },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/launch/show-hn/analyze",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    // Verify updated score and suggestions
    await waitFor(() => {
      expect(screen.getByText("Excellent technical depth with high authenticity")).toBeTruthy();
    });
  });

  it("test_product_hunt_kit_copy_snippets", async () => {
    render(<LaunchCampaign initialCampaign={mockCampaign} />);

    // Navigate to Product Hunt Kit
    fireEvent.click(screen.getByRole("button", { name: /Product Hunt Kit/i }));

    expect(screen.getByText(/Product Hunt Tagline/i)).toBeTruthy();
    expect(screen.getByText("Hunter / Maker First Comment")).toBeTruthy();

    // Click Copy Tagline button
    const copyTaglineBtn = screen.getByRole("button", { name: /Copy Tagline/i });
    fireEvent.click(copyTaglineBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      mockCampaign.product_hunt.selected_tagline,
    );

    // Click Copy first comment button
    const copyCommentBtn = screen.getByTitle("Copy first comment");
    fireEvent.click(copyCommentBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      mockCampaign.product_hunt.first_comment,
    );
  });

  it("test_beta_tester_status_filter_and_update", async () => {
    render(<LaunchCampaign initialCampaign={mockCampaign} />);

    // Navigate to Beta Mobilization
    fireEvent.click(screen.getByRole("button", { name: /Beta Mobilization/i }));

    expect(screen.getByText("Sarah Lin")).toBeTruthy();
    expect(screen.getByText("Maya Patel")).toBeTruthy();

    // Filter by status "Identified"
    const statusSelect = screen.getByDisplayValue("All Statuses");
    fireEvent.change(statusSelect, { target: { value: "Identified" } });

    // Now Maya Patel should be visible, Sarah Lin should not be visible
    expect(screen.getByText("Maya Patel")).toBeTruthy();
    expect(screen.queryByText("Sarah Lin")).toBeNull();

    // Update Maya Patel's outreach status
    const testerStatusDropdowns = screen.getAllByDisplayValue("Identified");
    fireEvent.change(testerStatusDropdowns[1], { target: { value: "Committed" } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/launch/testers/tester-11",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ outreach_status: "Committed" }),
        }),
      );
    });
  });

  it("test_syndication_checklist_toggle", async () => {
    render(<LaunchCampaign initialCampaign={mockCampaign} />);

    // Navigate to Cross-Channel Syndication
    fireEvent.click(screen.getByRole("button", { name: /Cross-Channel Syndication/i }));

    expect(screen.getByText("r/programming Technical Deep-Dive")).toBeTruthy();
    expect(screen.getByText("10-Tweet Technical Launch Thread")).toBeTruthy();

    // Toggle checklist checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/launch/checklist/syn-reddit",
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });
  });
});
