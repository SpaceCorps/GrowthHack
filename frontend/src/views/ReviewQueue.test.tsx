import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ReviewQueue } from "./ReviewQueue";
import type { ReviewItem } from "../types";

const mockItems: ReviewItem[] = [
  {
    id: "item-1",
    type: "article",
    title: "How Git Worktrees Solve Agent Hallucination",
    subtitle: "Deep architectural breakdown",
    channel: "Website",
    summary: "Preventing collisions in multi-agent coding.",
    content: "Full content of article 1...",
    backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
    citations: ["https://git-scm.com/docs/git-worktree"],
    status: "Pending",
    createdAt: "2026-09-10T12:00:00Z",
    rawId: "art-1",
  },
  {
    id: "item-2",
    type: "video_demo",
    title: "From GitHub Issue to Verified Pull Request",
    subtitle: "15-minute loop demo",
    channel: "LinkedIn",
    summary: "Autonomous issue-to-PR workflow.",
    content: "Full content of item 2...",
    backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
    citations: ["https://docs.github.com/en/issues"],
    status: "Pending",
    createdAt: "2026-09-10T12:05:00Z",
    rawId: "art-2",
  },
];

describe("ReviewQueue Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders card deck with initial review items", () => {
    render(<ReviewQueue items={mockItems} />);

    expect(screen.getByText("How Git Worktrees Solve Agent Hallucination")).toBeDefined();
    expect(screen.getByText("Channel: Website")).toBeDefined();
    expect(screen.getByText("Preventing collisions in multi-agent coding.")).toBeDefined();
    expect(screen.getByTestId("approve-btn")).toBeDefined();
    expect(screen.getByTestId("reject-btn")).toBeDefined();
  });

  it("approving a card triggers onApprove callback and transitions to next card", async () => {
    const onApprove = vi.fn();
    render(<ReviewQueue items={mockItems} onApprove={onApprove} />);

    const approveBtn = screen.getByTestId("approve-btn");
    fireEvent.click(approveBtn);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));

    // After animation, second card is now active
    expect(screen.getByText("From GitHub Issue to Verified Pull Request")).toBeDefined();
  });

  it("rejecting a card triggers onReject callback and transitions to next card", async () => {
    const onReject = vi.fn();
    render(<ReviewQueue items={mockItems} onReject={onReject} />);

    const rejectBtn = screen.getByTestId("reject-btn");
    fireEvent.click(rejectBtn);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));

    // After animation, second card is now active
    expect(screen.getByText("From GitHub Issue to Verified Pull Request")).toBeDefined();
  });

  it("keyboard shortcut triggers (ArrowRight / ArrowLeft) trigger appropriate actions", async () => {
    const onApprove = vi.fn();
    render(<ReviewQueue items={mockItems} onApprove={onApprove} />);

    fireEvent.keyDown(window, { key: "ArrowRight" });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));

    expect(screen.getByText("From GitHub Issue to Verified Pull Request")).toBeDefined();
  });

  it("empty state renders when no pending review items exist", () => {
    render(<ReviewQueue items={[]} />);

    expect(screen.getByText("All Caught Up! 🎉")).toBeDefined();
    expect(screen.getByText("No pending review items found in the queue.")).toBeDefined();
  });

  it("pointer drag swipe right past threshold triggers onApprove and transitions to next card", async () => {
    const onApprove = vi.fn();
    render(<ReviewQueue items={mockItems} onApprove={onApprove} />);

    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 250, clientY: 100 }); // +150px > 120 threshold

    // Approved stamp should be visible
    expect(screen.getByTestId("approved-stamp")).toBeDefined();

    fireEvent.pointerUp(card, { clientX: 250, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));
    expect(screen.getByText("From GitHub Issue to Verified Pull Request")).toBeDefined();
  });

  it("pointer drag swipe left past threshold triggers onReject and transitions to next card", async () => {
    const onReject = vi.fn();
    render(<ReviewQueue items={mockItems} onReject={onReject} />);

    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 50, clientY: 100 }); // -150px < -120 threshold

    // Rejected stamp should be visible
    expect(screen.getByTestId("rejected-stamp")).toBeDefined();

    fireEvent.pointerUp(card, { clientX: 50, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));
    expect(screen.getByText("From GitHub Issue to Verified Pull Request")).toBeDefined();
  });

  it("pointer drag release below threshold resets card position without invoking callbacks", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(<ReviewQueue items={mockItems} onApprove={onApprove} onReject={onReject} />);

    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 150, clientY: 100 }); // +50px < 120 threshold

    fireEvent.pointerUp(card, { clientX: 150, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    expect(card.style.transform).toBe("translate3d(0px, 0px, 0) rotate(0deg)");
    expect(screen.getByText("How Git Worktrees Solve Agent Hallucination")).toBeDefined();
  });

  it("pointer interactions inside the content preview box do not initiate card drag", () => {
    const onApprove = vi.fn();
    render(<ReviewQueue items={mockItems} onApprove={onApprove} />);

    const previewBox = screen.getByText("Full content of article 1...");
    fireEvent.pointerDown(previewBox, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(previewBox, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(previewBox, { clientX: 300, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.queryByTestId("approved-stamp")).toBeNull();
    expect(screen.getByText("How Git Worktrees Solve Agent Hallucination")).toBeDefined();
  });
});
