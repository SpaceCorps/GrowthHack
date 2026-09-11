import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PrFlywheel, DEFAULT_ACTION_YML, DEFAULT_WORKFLOW_YML } from "./PrFlywheel";

describe("PrFlywheel Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
      configurable: true,
      writable: true,
    });
    // Mock fetch for /api/badges/workflows
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            action_yml: 'name: "Tendril Verification & PR Flywheel"\ninputs:\n',
            workflow_yml: "name: Tendril Verification & PR Flywheel\non:\n",
          }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders PR Flywheel Studio with form controls and preview panes", () => {
    render(<PrFlywheel />);

    expect(screen.getByText("Built with Tendril: PR Attribution Studio")).toBeDefined();
    expect(screen.getByText("Badge Configurator")).toBeDefined();
    expect(screen.getByText("Live PR Attribution Preview Deck")).toBeDefined();
    expect(screen.getByText("Viral Reach Estimator")).toBeDefined();

    // Check form controls
    expect(screen.getByLabelText("Project Name")).toBeDefined();
    expect(screen.getByLabelText("Plan ID")).toBeDefined();
    expect(screen.getByLabelText("Plan Title")).toBeDefined();
    expect(screen.getByLabelText("Agent Count")).toBeDefined();
    expect(screen.getByLabelText("Tests Passed")).toBeDefined();
    expect(screen.getByLabelText("Tokens Saved")).toBeDefined();
    expect(screen.getByLabelText("Worktree Diff URL")).toBeDefined();

    // Check preview elements
    expect(screen.getByTestId("pr-description-preview")).toBeDefined();
    expect(screen.getByTestId("pr-bot-comment-preview")).toBeDefined();
  });

  it("updates live preview when changing badge format and metrics", () => {
    render(<PrFlywheel />);

    // Default format is summary_card
    expect(screen.getByText("⚡ Ivy-Tendril Verification Summary:")).toBeDefined();

    // Switch to Minimal format
    const minimalToggle = screen.getByTestId("format-minimal");
    fireEvent.click(minimalToggle);
    expect(screen.getByText("⚡ Orchestrated with")).toBeDefined();

    // Switch to Shields.io format
    const shieldToggle = screen.getByTestId("format-shield");
    fireEvent.click(shieldToggle);
    const shieldImg = screen.getByAltText("Orchestrated with Ivy-Tendril");
    expect(shieldImg).toBeDefined();

    // Switch back to Summary Card
    const summaryToggle = screen.getByTestId("format-summary");
    fireEvent.click(summaryToggle);

    // Update tests passed metric
    const testsInput = screen.getByLabelText("Tests Passed");
    fireEvent.change(testsInput, { target: { value: "48" } });

    expect(screen.getByText("48 tests passed")).toBeDefined();
  });

  it("copies markdown and workflow YAML to clipboard on button click", () => {
    render(<PrFlywheel />);

    const copyMarkdownBtn = screen.getByTestId("copy-markdown-btn");
    fireEvent.click(copyMarkdownBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Copied")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    const copyWorkflowBtn = screen.getByTestId("copy-workflow-yml-btn");
    fireEvent.click(copyWorkflowBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Copied CI Workflow")).toBeDefined();
  });

  it("calculates viral reach estimates dynamically", () => {
    render(<PrFlywheel />);

    const impressionsElem = screen.getByTestId("monthly-impressions");
    const initialImpressions = impressionsElem.textContent;

    // Change Monthly PR Volume from default 12 to 25
    const prInput = screen.getByLabelText("Monthly PR Volume");
    fireEvent.change(prInput, { target: { value: "25" } });

    const updatedImpressions = impressionsElem.textContent;
    expect(updatedImpressions).not.toEqual(initialImpressions);

    // Change Active Team Size from 5 to 10
    const teamInput = screen.getByLabelText("Active Team Size");
    fireEvent.change(teamInput, { target: { value: "10" } });

    const finalImpressions = impressionsElem.textContent;
    expect(finalImpressions).not.toEqual(updatedImpressions);

    // Check referral clicks update
    const clicksElem = screen.getByTestId("referral-clicks");
    expect(clicksElem.textContent).toBeDefined();
  });

  it("includes updated upsert definition and permissions in workflow templates", async () => {
    render(<PrFlywheel />);

    expect(DEFAULT_ACTION_YML).toContain("<!-- tendril-flywheel-badge -->");
    expect(DEFAULT_ACTION_YML).toContain("EXISTING_COMMENT_ID");
    expect(DEFAULT_ACTION_YML).toContain(
      'gh api "repos/${GH_REPO}/issues/comments/${EXISTING_COMMENT_ID}"',
    );
    expect(DEFAULT_ACTION_YML).toContain('gh pr comment "${PR_NUMBER}"');
    expect(DEFAULT_WORKFLOW_YML).toContain("pull-requests: write");
    expect(DEFAULT_WORKFLOW_YML).toContain("issues: write");

    const copyActionBtn = screen.getByTestId("copy-action-yml-btn");
    fireEvent.click(copyActionBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText("Copied action.yml")).toBeDefined();
  });
});
