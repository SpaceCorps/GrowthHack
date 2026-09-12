import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import {
  ReviewQueue,
  resetSharedAudioContextForTesting,
  getAutoPostDestination,
} from "./ReviewQueue";
import type { ReviewItem } from "../types";
import { setupMockBlobUrl } from "../test";
import type { MockBlobUrlController } from "../test";

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
  let mockBlobUrl: MockBlobUrlController | null = null;
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
    mockBlobUrl = setupMockBlobUrl();
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
    if (mockBlobUrl) {
      mockBlobUrl.restore();
      mockBlobUrl = null;
    }
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

  it("refining an approved article resets status to Pending when content is modified", async () => {
    const onRefineMock = vi.fn();
    const approvedArticle: ReviewItem = {
      id: "art-approved-1",
      type: "article",
      title: "Original Article Title",
      subtitle: "Sub",
      channel: "Website",
      summary: "Original summary",
      content: "Original article content",
      backlinks: [],
      citations: [],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "art-1",
    };

    render(<ReviewQueue items={[approvedArticle]} onRefine={onRefineMock} />);
    fireEvent.click(screen.getByTestId("refine-btn"));

    const contentInput = screen.getByDisplayValue("Original article content");
    fireEvent.change(contentInput, { target: { value: "Modified article content" } });

    fireEvent.click(screen.getByText("Save & Update Card"));

    expect(onRefineMock).toHaveBeenCalledWith(
      approvedArticle,
      expect.objectContaining({
        content: "Modified article content",
        status: "Pending",
      }),
    );
  });

  it("refining an approved video demo resets status to Pending when headline or content is modified", async () => {
    const onRefineMock = vi.fn();
    const approvedDemo: ReviewItem = {
      id: "demo-approved-1",
      type: "video_demo",
      title: "Original Demo Headline",
      subtitle: "Sub",
      channel: "LinkedIn",
      summary: "Demo summary",
      content: "Original demo script",
      backlinks: [],
      citations: [],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "demo-1",
    };

    render(<ReviewQueue items={[approvedDemo]} onRefine={onRefineMock} />);
    fireEvent.click(screen.getByTestId("refine-btn"));

    const headlineInput = screen.getByDisplayValue("Original Demo Headline");
    fireEvent.change(headlineInput, { target: { value: "Updated Demo Headline" } });

    fireEvent.click(screen.getByText("Save & Update Card"));

    expect(onRefineMock).toHaveBeenCalledWith(
      approvedDemo,
      expect.objectContaining({
        title: "Updated Demo Headline",
        status: "Pending",
      }),
    );
  });

  it("saving refinement without changes preserves existing status", async () => {
    const onRefineMock = vi.fn();
    const approvedArticle: ReviewItem = {
      id: "art-approved-2",
      type: "article",
      title: "Original Article Title",
      subtitle: "Sub",
      channel: "Website",
      summary: "Original summary",
      content: "Original article content",
      backlinks: [],
      citations: [],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "art-2",
    };

    render(<ReviewQueue items={[approvedArticle]} onRefine={onRefineMock} />);
    fireEvent.click(screen.getByTestId("refine-btn"));

    fireEvent.click(screen.getByText("Save & Update Card"));

    expect(onRefineMock).toHaveBeenCalledTimes(1);
    const updatedPayload = onRefineMock.mock.calls[0][1];
    expect(updatedPayload.status).toBeUndefined();
  });

  it("refining an approved trend synthesis resets status to Pending when topic or summary/content is modified", async () => {
    const onRefineMock = vi.fn();
    const approvedTrend: ReviewItem = {
      id: "trend-approved-1",
      type: "trend_synthesis",
      title: "Original Trend Topic",
      subtitle: "Sub",
      channel: "GitHub",
      summary: "Original trend summary",
      content: "Original trend content",
      backlinks: [],
      citations: [],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "trend-1",
    };

    render(<ReviewQueue items={[approvedTrend]} onRefine={onRefineMock} />);
    fireEvent.click(screen.getByTestId("refine-btn"));

    const topicInput = screen.getByDisplayValue("Original Trend Topic");
    fireEvent.change(topicInput, { target: { value: "Updated Trend Topic" } });

    fireEvent.click(screen.getByText("Save & Update Card"));

    expect(onRefineMock).toHaveBeenCalledWith(
      approvedTrend,
      expect.objectContaining({
        title: "Updated Trend Topic",
        status: "Pending",
      }),
    );
  });

  it("saving trend synthesis refinement without changes preserves existing status", async () => {
    const onRefineMock = vi.fn();
    const approvedTrend: ReviewItem = {
      id: "trend-approved-2",
      type: "trend_synthesis",
      title: "Original Trend Topic",
      subtitle: "Sub",
      channel: "GitHub",
      summary: "Original trend summary",
      content: "Original trend content",
      backlinks: [],
      citations: [],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "trend-2",
    };

    render(<ReviewQueue items={[approvedTrend]} onRefine={onRefineMock} />);
    fireEvent.click(screen.getByTestId("refine-btn"));

    fireEvent.click(screen.getByText("Save & Update Card"));

    expect(onRefineMock).toHaveBeenCalledTimes(1);
    const updatedPayload = onRefineMock.mock.calls[0][1];
    expect(updatedPayload.status).toBeUndefined();
  });

  describe("Instant Auto-Post", () => {
    const listingItem: ReviewItem = {
      id: "item-listing-1",
      type: "listing_blurb",
      title: "Awesome Repo Submission",
      subtitle: "Directory PR",
      channel: "GitHub PR",
      summary: "Blurb for directory listing.",
      content: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril)",
      backlinks: [],
      citations: [],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "listing-1",
    };

    it("renders the auto-post toggle enabled by default with no stored preference", () => {
      render(<ReviewQueue items={mockItems} />);

      const toggleBtn = screen.getByTestId("auto-post-toggle-btn");
      expect(toggleBtn).toBeDefined();
      expect(screen.getByText("Instant Auto-Post")).toBeDefined();
    });

    it("approving with auto-post enabled calls onApprove and onAutoPost with the article item", async () => {
      const onApprove = vi.fn();
      const onAutoPost = vi.fn().mockResolvedValue(undefined);
      render(<ReviewQueue items={mockItems} onApprove={onApprove} onAutoPost={onAutoPost} />);

      fireEvent.click(screen.getByTestId("approve-btn"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));
      expect(onAutoPost).toHaveBeenCalledTimes(1);
      expect(onAutoPost).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));
    });

    it("toggling auto-post off before approving calls onApprove and not onAutoPost", async () => {
      const onApprove = vi.fn();
      const onAutoPost = vi.fn().mockResolvedValue(undefined);
      render(<ReviewQueue items={mockItems} onApprove={onApprove} onAutoPost={onAutoPost} />);

      fireEvent.click(screen.getByTestId("auto-post-toggle-btn"));
      expect(screen.getByText("Manual Publish")).toBeDefined();

      fireEvent.click(screen.getByTestId("approve-btn"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onAutoPost).not.toHaveBeenCalled();
    });

    it("toggling auto-post writes to localStorage and a fresh render rehydrates the off state", () => {
      const { unmount } = render(<ReviewQueue items={mockItems} />);

      fireEvent.click(screen.getByTestId("auto-post-toggle-btn"));
      expect(localStorage.getItem("growth_review_auto_post_enabled")).toBe("false");

      unmount();
      render(<ReviewQueue items={mockItems} />);
      expect(screen.getByText("Manual Publish")).toBeDefined();
    });

    it("shows the correct auto-post destination badge per item type, hidden when disabled", () => {
      expect(getAutoPostDestination("article")).toBe("Ivy Web");
      expect(getAutoPostDestination("listing_blurb")).toBe("Upstream PR");
      expect(getAutoPostDestination("video_demo")).toBe("Platform Assets");
      expect(getAutoPostDestination("trend_synthesis")).toBe("Platform Assets");

      const { unmount } = render(<ReviewQueue items={[listingItem]} />);
      expect(screen.getByTestId("auto-post-destination-badge").textContent).toContain(
        "Upstream PR",
      );
      unmount();

      render(<ReviewQueue items={mockItems} />);
      fireEvent.click(screen.getByTestId("auto-post-toggle-btn"));
      expect(screen.queryByTestId("auto-post-destination-badge")).toBeNull();
    });

    it("pointer drag past +120px dispatches auto-post via the gesture path", async () => {
      const onApprove = vi.fn();
      const onAutoPost = vi.fn().mockResolvedValue(undefined);
      render(<ReviewQueue items={mockItems} onApprove={onApprove} onAutoPost={onAutoPost} />);

      const card = screen.getByTestId("active-card");
      fireEvent.pointerDown(card, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.pointerMove(card, { clientX: 250, clientY: 100 });
      fireEvent.pointerUp(card, { clientX: 250, clientY: 100 });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onAutoPost).toHaveBeenCalledTimes(1);
      expect(onAutoPost).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" }));
    });

    it("shows the dispatching then dispatched toast, clears after 2500ms, and increments the auto-posted count", async () => {
      let resolveAutoPost: () => void = () => {};
      const onAutoPost = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveAutoPost = resolve;
          }),
      );
      render(<ReviewQueue items={mockItems} onAutoPost={onAutoPost} />);

      fireEvent.click(screen.getByTestId("approve-btn"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.getByTestId("auto-post-toast").textContent).toContain("Dispatching to Ivy Web");

      await act(async () => {
        resolveAutoPost();
        await Promise.resolve();
      });
      expect(screen.getByTestId("auto-post-toast").textContent).toContain("Dispatched to Ivy Web");
      expect(screen.getByTestId("auto-posted-count").textContent).toContain("1");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(screen.queryByTestId("auto-post-toast")).toBeNull();
    });

    it("renders the failure toast when onAutoPost rejects, without throwing out of the component", async () => {
      const onAutoPost = vi.fn().mockRejectedValue(new Error("dispatch failed"));
      render(<ReviewQueue items={mockItems} onAutoPost={onAutoPost} />);

      fireEvent.click(screen.getByTestId("approve-btn"));

      await expect(
        act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        }),
      ).resolves.toBeUndefined();

      expect(screen.getByTestId("auto-post-toast").textContent).toContain("Auto-post failed");
    });

    it("excludes a Published item from the pending deck and includes it in the export count", () => {
      const publishedItem: ReviewItem = { ...mockItems[0], status: "Published" };
      render(<ReviewQueue items={[publishedItem, mockItems[1]]} />);

      expect(screen.queryByText(publishedItem.title)).toBeNull();
      expect(screen.getByText("From GitHub Issue to Verified Pull Request")).toBeDefined();
      expect(screen.getByText("Export Approved (1)")).toBeDefined();
    });
  });

  describe("Markdown Asset Export with mockBlobUrl", () => {
    it("downloads bundled markdown file for approved and published assets", async () => {
      const exportableItems: ReviewItem[] = [
        {
          ...mockItems[0],
          status: "Approved",
        },
        {
          ...mockItems[1],
          status: "Published",
        },
      ];

      render(<ReviewQueue items={exportableItems} />);

      const exportBtn = screen.getByText("Export Approved (2)");
      expect((exportBtn.closest("button") as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(exportBtn);

      expect(screen.getByText(/Export Approved Growth Assets/)).toBeDefined();

      const downloadMdBtn = screen.getByRole("button", { name: /download \.md/i });
      fireEvent.click(downloadMdBtn);

      expect(mockBlobUrl!.createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = mockBlobUrl!.createObjectURL.mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect((blob as Blob).type).toBe("text/markdown;charset=utf-8");

      const markdownContent = await (blob as Blob).text();
      expect(markdownContent).toContain("# 1. How Git Worktrees Solve Agent Hallucination");
      expect(markdownContent).toContain("**Type:** article | **Channel:** Website");
      expect(markdownContent).toContain("Preventing collisions in multi-agent coding.");
      expect(markdownContent).toContain("Full content of article 1...");
      expect(markdownContent).toContain(
        "**Backlinks:** https://github.com/Ivy-Interactive/Ivy-Tendril",
      );
      expect(markdownContent).toContain("# 2. From GitHub Issue to Verified Pull Request");
      expect(markdownContent).toContain("**Type:** video_demo | **Channel:** LinkedIn");
      expect(markdownContent).toContain("========================================");

      expect(mockBlobUrl!.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      expect(mockBlobUrl!.getCreatedUrls()).toEqual(["blob:mock-url"]);
      expect(mockBlobUrl!.getRevokedUrls()).toEqual(["blob:mock-url"]);
    });

    it("downloads bundled markdown when exporting approved items from empty deck state", async () => {
      const approvedItem: ReviewItem = {
        ...mockItems[0],
        status: "Approved",
      };

      render(<ReviewQueue items={[approvedItem]} />);

      const exportBtn = screen.getByText("Export 1 Approved Items");
      fireEvent.click(exportBtn);

      const downloadMdBtn = screen.getByRole("button", { name: /download \.md/i });
      fireEvent.click(downloadMdBtn);

      expect(mockBlobUrl!.createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = mockBlobUrl!.createObjectURL.mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      const markdownContent = await (blob as Blob).text();
      expect(markdownContent).toContain("# 1. How Git Worktrees Solve Agent Hallucination");

      expect(mockBlobUrl!.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      expect(mockBlobUrl!.getCreatedUrls()).toEqual(["blob:mock-url"]);
      expect(mockBlobUrl!.getRevokedUrls()).toEqual(["blob:mock-url"]);
    });
  });
});
