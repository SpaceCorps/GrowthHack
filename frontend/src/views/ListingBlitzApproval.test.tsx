import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ListingBlitz } from "./ListingBlitz";
import { ReviewQueue } from "./ReviewQueue";
import type { Listing, ReviewItem } from "../types";

const mockListings: Listing[] = [
  {
    id: "list-1",
    name: "awesome-ai-agents",
    category: "Awesome Repo",
    url: "https://github.com/e2b-dev/awesome-ai-agents",
    status: "PR Submitted",
    submission_blurb:
      "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent factory.",
    notes: "High authority repo",
    blurb_status: "Approved",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-2",
    name: "awesome-devtools",
    category: "Awesome Repo",
    url: "https://github.com/frenck/awesome-devtools",
    status: "Targeted",
    submission_blurb:
      "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Parallel agents.",
    notes: "Targeting Git utils",
    blurb_status: "Rejected",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-3",
    name: "OpenAlternative",
    category: "Dev Directory",
    url: "https://openalternative.co/",
    status: "Targeted",
    submission_blurb: "Ivy-Tendril open-source alternative.",
    notes: "Submit soon",
    blurb_status: "Pending",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-4",
    name: "DevHunt",
    category: "Dev Directory",
    url: "https://devhunt.org/",
    status: "Targeted",
    submission_blurb: "Ivy-Tendril directory entry.",
    notes: "Phase 1 campaign",
    // blurb_status unset with non-empty blurb -> should show Pending
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "list-5",
    name: "EmptyBlurbTarget",
    category: "Community",
    url: "https://example.com/",
    status: "Targeted",
    submission_blurb: "",
    notes: "No blurb",
    updated_at: "2026-09-10T12:00:00Z",
  },
];

describe("ListingBlitz Blurb Approval Badges", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders appropriate blurb status badges for Approved, Rejected, and Pending states", () => {
    render(
      <ListingBlitz
        listings={mockListings}
        onUpdateStatus={vi.fn()}
        onGenerateBlurb={vi.fn()}
        onCreateListing={vi.fn()}
      />,
    );

    // list-1: Approved
    expect(screen.getByTestId("blurb-badge-list-1").textContent).toBe("Blurb Approved");
    // list-2: Rejected
    expect(screen.getByTestId("blurb-badge-list-2").textContent).toBe("Blurb Rejected");
    // list-3: Pending
    expect(screen.getByTestId("blurb-badge-list-3").textContent).toBe("Blurb Pending Review");
    // list-4: unset blurb_status with blurb -> Pending Review
    expect(screen.getByTestId("blurb-badge-list-4").textContent).toBe("Blurb Pending Review");
    // list-5: empty blurb -> no badge rendered
    expect(screen.queryByTestId("blurb-badge-list-5")).toBeNull();
  });
});

describe("Review Queue Listing Blurb Approval Flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("approving a listing blurb triggers approval callback and PUT to /api/listings/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "list-1", blurb_status: "Approved" }),
    });
    global.fetch = fetchMock;

    const mockReviewItem: ReviewItem = {
      id: "listing-list-1",
      type: "listing_blurb",
      title: "awesome-ai-agents",
      subtitle: "Awesome Repo • https://github.com/e2b-dev/awesome-ai-agents",
      channel: "GitHub PR",
      summary: "High authority repo",
      content:
        "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent factory.",
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      citations: ["https://github.com/e2b-dev/awesome-ai-agents"],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "list-1",
    };

    const handleApprove = async (item: ReviewItem) => {
      if (item.type === "listing_blurb") {
        await fetch(`/api/listings/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blurb_status: "Approved" }),
        });
      }
    };

    render(<ReviewQueue items={[mockReviewItem]} onApprove={handleApprove} />);

    expect(screen.getByText("awesome-ai-agents")).toBeDefined();
    expect(screen.getByText("Channel: GitHub PR")).toBeDefined();

    const approveBtn = screen.getByTestId("approve-btn");
    fireEvent.click(approveBtn);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/listings/list-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blurb_status: "Approved" }),
    });
  });

  it("batch publish triggers submit-pr for approved listing blurbs and updates listing status to PR Submitted", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/submit-pr")) {
        return {
          ok: true,
          json: async () => ({
            task_id: "task-pr-123",
            message: "PR submission initiated",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({}),
      };
    });
    global.fetch = fetchMock;

    const mockApprovedItem: ReviewItem = {
      id: "listing-list-1",
      type: "listing_blurb",
      title: "awesome-ai-agents",
      subtitle: "Awesome Repo • https://github.com/e2b-dev/awesome-ai-agents",
      channel: "GitHub PR",
      summary: "High authority repo",
      content:
        "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent factory.",
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      citations: ["https://github.com/e2b-dev/awesome-ai-agents"],
      status: "Approved",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "list-1",
    };

    let publishedItems: ReviewItem[] = [];
    const handleBatchPublish = async (items: ReviewItem[]) => {
      for (const it of items) {
        if (it.type === "listing_blurb") {
          await fetch(`/api/listings/${it.rawId}/submit-pr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      publishedItems = items;
    };

    render(<ReviewQueue items={[mockApprovedItem]} onBatchPublish={handleBatchPublish} />);

    // Open Export Approved modal
    const exportBtn = screen.getByText(/Export Approved/);
    fireEvent.click(exportBtn);

    // Verify modal shows "PR Submission & Antigravity Generation" badge
    expect(screen.getByText("PR Submission & Antigravity Generation")).toBeDefined();

    // Click Publish All
    const publishAllBtn = screen.getByText("Publish All");
    await act(async () => {
      fireEvent.click(publishAllBtn);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/listings/list-1/submit-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(publishedItems.length).toBe(1);
    expect(publishedItems[0].id).toBe("listing-list-1");
  });
});
