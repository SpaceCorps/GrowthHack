import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ReviewQueue, resetSharedAudioContextForTesting } from "./ReviewQueue";
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
  let vibrateMock: ReturnType<typeof vi.fn>;
  let mockOscillator: {
    type: string;
    frequency: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let mockGain: {
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    resetSharedAudioContextForTesting();

    vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    mockOscillator = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    class MockAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createOscillator = vi.fn(() => mockOscillator);
      createGain = vi.fn(() => mockGain);
    }

    Object.defineProperty(window, "AudioContext", {
      value: MockAudioContext,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    resetSharedAudioContextForTesting();
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

  it("triggers haptic vibration pulse with 15ms when dragging past +120px threshold (swipe right)", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 225, clientY: 100 }); // +125px >= 120 threshold

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(15);
  });

  it("triggers haptic vibration pulse with 15ms when dragging past -120px threshold (swipe left)", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 75, clientY: 100 }); // -125px <= -120 threshold

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(15);
  });

  it("continued dragging past threshold in the same motion does not re-trigger vibration repeatedly", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 230, clientY: 100 }); // +130px
    fireEvent.pointerMove(card, { clientX: 260, clientY: 100 }); // +160px
    fireEvent.pointerMove(card, { clientX: 300, clientY: 100 }); // +200px

    expect(vibrateMock).toHaveBeenCalledTimes(1);
  });

  it("dragging back below threshold and crossing again calls navigator.vibrate a second time", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 230, clientY: 100 }); // Cross threshold (+130px)
    expect(vibrateMock).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(card, { clientX: 150, clientY: 100 }); // Below threshold (+50px)
    expect(vibrateMock).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(card, { clientX: 240, clientY: 100 }); // Cross threshold again (+140px)
    expect(vibrateMock).toHaveBeenCalledTimes(2);
    expect(vibrateMock).toHaveBeenLastCalledWith(15);
  });

  it("when navigator.vibrate is undefined, dragging past threshold works smoothly without throwing errors", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    expect(() => {
      fireEvent.pointerMove(card, { clientX: 250, clientY: 100 });
    }).not.toThrow();
    fireEvent.pointerUp(card, { clientX: 250, clientY: 100 });
  });

  it("triggers Web Audio click synthesis when dragging past +120px threshold (swipe right)", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 225, clientY: 100 }); // +125px >= 120 threshold

    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
    expect(mockOscillator.stop).toHaveBeenCalledTimes(1);
    expect(mockGain.connect).toHaveBeenCalledTimes(1);
  });

  it("triggers Web Audio click synthesis when dragging past -120px threshold (swipe left)", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 75, clientY: 100 }); // -125px <= -120 threshold

    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
    expect(mockOscillator.stop).toHaveBeenCalledTimes(1);
    expect(mockGain.connect).toHaveBeenCalledTimes(1);
  });

  it("continued dragging past threshold in the same motion does not re-trigger sound repeatedly", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 230, clientY: 100 }); // +130px
    fireEvent.pointerMove(card, { clientX: 260, clientY: 100 }); // +160px
    fireEvent.pointerMove(card, { clientX: 300, clientY: 100 }); // +200px

    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it("dragging back below threshold and crossing again triggers audio feedback a second time", () => {
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 230, clientY: 100 }); // Cross threshold (+130px)
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(card, { clientX: 150, clientY: 100 }); // Below threshold (+50px)
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(card, { clientX: 240, clientY: 100 }); // Cross threshold again (+140px)
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });

  it("clicking the sound toggle button mutes audio feedback and prevents sound on threshold crossing", () => {
    render(<ReviewQueue items={mockItems} />);
    const toggleBtn = screen.getByTestId("sound-toggle-btn");
    expect(screen.getByText("Sound On")).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(screen.getByText("Muted")).toBeDefined();

    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { clientX: 230, clientY: 100 });

    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it("toggling sound state updates and persists preference to localStorage", () => {
    render(<ReviewQueue items={mockItems} />);
    const toggleBtn = screen.getByTestId("sound-toggle-btn");

    // Initially sound is enabled by default
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("growth_review_sound_enabled")).toBe("false");

    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("growth_review_sound_enabled")).toBe("true");
  });

  it("pressing M key toggles sound state", () => {
    render(<ReviewQueue items={mockItems} />);
    expect(screen.getByText("Sound On")).toBeDefined();

    fireEvent.keyDown(window, { key: "m" });
    expect(screen.getByText("Muted")).toBeDefined();
    expect(localStorage.getItem("growth_review_sound_enabled")).toBe("false");

    fireEvent.keyDown(window, { key: "M" });
    expect(screen.getByText("Sound On")).toBeDefined();
    expect(localStorage.getItem("growth_review_sound_enabled")).toBe("true");
  });

  it("when AudioContext is undefined, dragging past threshold operates smoothly without error", () => {
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    expect(() => {
      fireEvent.pointerMove(card, { clientX: 250, clientY: 100 });
    }).not.toThrow();
    fireEvent.pointerUp(card, { clientX: 250, clientY: 100 });
  });

  it("when AudioContext throws an exception, card dragging fails silently without crashing", () => {
    class FailingAudioContext {
      constructor() {
        throw new Error("AudioContext blocked by autoplay policy");
      }
    }
    Object.defineProperty(window, "AudioContext", {
      value: FailingAudioContext,
      writable: true,
      configurable: true,
    });
    render(<ReviewQueue items={mockItems} />);
    const card = screen.getByTestId("active-card");
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
    expect(() => {
      fireEvent.pointerMove(card, { clientX: 250, clientY: 100 });
    }).not.toThrow();
    fireEvent.pointerUp(card, { clientX: 250, clientY: 100 });
  });
});
