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

  it("refining listing blurb resets status to Pending when text is modified", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "list-1", blurb_status: "Pending" }),
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

    const handleRefine = vi.fn(async (item: ReviewItem, updated: Partial<ReviewItem>) => {
      if (item.type === "listing_blurb") {
        const isModified = updated.content !== undefined && updated.content !== item.content;
        const blurbStatus = updated.status ?? (isModified ? "Pending" : undefined);
        await fetch(`/api/listings/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submission_blurb: updated.content,
            notes: updated.summary,
            ...(blurbStatus ? { blurb_status: blurbStatus } : {}),
          }),
        });
      }
    });

    render(<ReviewQueue items={[mockReviewItem]} onRefine={handleRefine} />);

    // Open refine modal
    const refineBtn = screen.getByTestId("refine-btn");
    fireEvent.click(refineBtn);

    // Modal should be open with textarea
    const contentTextarea = screen.getByDisplayValue(
      "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent factory.",
    );
    fireEvent.change(contentTextarea, {
      target: {
        value:
          "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Refined blurb text.",
      },
    });

    // Save refinement
    const saveBtn = screen.getByText("Save & Update Card");
    fireEvent.click(saveBtn);

    expect(handleRefine).toHaveBeenCalledTimes(1);
    expect(handleRefine).toHaveBeenCalledWith(
      mockReviewItem,
      expect.objectContaining({
        content:
          "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Refined blurb text.",
        status: "Pending",
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/listings/list-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_blurb:
          "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Refined blurb text.",
        notes: "High authority repo",
        blurb_status: "Pending",
      }),
    });
  });
});
