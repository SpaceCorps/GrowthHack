import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { IssuesHub } from "./IssuesHub";
import type { GrowthIssue } from "../types";

const mockIssues: GrowthIssue[] = [
  {
    id: "issue-1",
    title: "10x Worktrees Benchmark Article",
    category: "Content Engine",
    priority: "High",
    status: "Todo",
    description:
      "Write authoritative deep dive benchmarking Git worktrees vs containerized environments.",
    direct_actions: ["Draft article in Antigravity", "Publish to Substack"],
    run_count: 2,
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "issue-2",
    title: "Daily Reddit Agent Mentions Scan",
    category: "Community Scouting",
    priority: "Critical",
    status: "Active Routine",
    description: "Scan r/LocalLLaMA and r/Cursor for workflow bottlenecks.",
    direct_actions: ["Execute agent search", "Queue responses"],
    routine_schedule: "Every day at 09:00 UTC",
    run_count: 14,
    created_at: "2026-09-09T10:00:00Z",
    updated_at: "2026-09-11T09:00:00Z",
  },
];

describe("IssuesHub View", () => {
  const defaultProps = {
    issues: mockIssues,
    onRunIssue: vi.fn(),
    onUpdateStatus: vi.fn(),
    onCreateIssue: vi.fn(),
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders '+ New Direct Action' button with high-contrast emerald-500 and text-slate-950", () => {
    render(<IssuesHub {...defaultProps} />);

    const newActionBtn = screen.getByRole("button", { name: /New Direct Action/i });
    expect(newActionBtn).toBeDefined();
    expect(newActionBtn.className).toContain("bg-emerald-500");
    expect(newActionBtn.className).toContain("text-slate-950");
    expect(newActionBtn.className).toContain("font-bold");
    expect(newActionBtn.className).not.toContain("text-white");
    expect(newActionBtn.className).not.toContain("bg-emerald-600");
  });

  it("renders 'Run Action' button with high-contrast styling and triggers onRunIssue on click", () => {
    render(<IssuesHub {...defaultProps} />);

    const runButtons = screen.getAllByRole("button", { name: /Run Action/i });
    expect(runButtons.length).toBe(2);

    const firstRunBtn = runButtons[0];
    expect(firstRunBtn.className).toContain("bg-emerald-500");
    expect(firstRunBtn.className).toContain("text-slate-950");
    expect(firstRunBtn.className).not.toContain("text-white");

    fireEvent.click(firstRunBtn);
    expect(defaultProps.onRunIssue).toHaveBeenCalledWith("issue-1");
  });

  it("opens create issue modal and renders 'Create Issue' button with compliant contrast", () => {
    render(<IssuesHub {...defaultProps} />);

    const newActionBtn = screen.getByRole("button", { name: /New Direct Action/i });
    fireEvent.click(newActionBtn);

    const modalTitle = screen.getByText("Create New Direct Action Issue");
    expect(modalTitle).toBeDefined();

    const createBtn = screen.getByRole("button", { name: /Create Issue/i });
    expect(createBtn).toBeDefined();
    expect(createBtn.className).toContain("bg-emerald-500");
    expect(createBtn.className).toContain("text-slate-950");
    expect(createBtn.className).toContain("font-bold");
    expect(createBtn.className).not.toContain("text-white");

    const titleInput = screen.getByPlaceholderText(/e\.g\. Hacker News Show HN Launch Automation/i);
    fireEvent.change(titleInput, { target: { value: "New Custom Task" } });

    fireEvent.click(createBtn);
    expect(defaultProps.onCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Custom Task",
        priority: "High",
      }),
    );
  });
});
