import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { EngagementVelocityChart } from "./EngagementVelocityChart";
import type { EngagementSnapshot, EngagementVelocity } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("EngagementVelocityChart Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      container.remove();
      container = null;
      root = null;
    }
  });

  it("renders empty state gracefully when no snapshots are provided", async () => {
    await act(async () => {
      root!.render(<EngagementVelocityChart snapshots={[]} />);
    });

    expect(container!.textContent).toContain("Historical Velocity Graph Awaiting Data");
    expect(container!.textContent).toContain("At least 2 historical snapshots are required");
  });

  it("renders single snapshot with notification to record more points", async () => {
    const singleSnapshot: EngagementSnapshot[] = [
      {
        timestamp: new Date().toISOString(),
        views: 120,
        reactions: 15,
        comments: 4,
      },
    ];

    await act(async () => {
      root!.render(<EngagementVelocityChart snapshots={singleSnapshot} />);
    });

    expect(container!.textContent).toContain("Historical Velocity Graph Awaiting Data");
    expect(container!.textContent).toContain("At least 2 historical snapshots are required");
  });

  it("renders pure SVG chart lines and area paths with multiple snapshots", async () => {
    const snapshots: EngagementSnapshot[] = [
      {
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
        views: 100,
        reactions: 10,
        comments: 2,
      },
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        views: 250,
        reactions: 30,
        comments: 6,
      },
      {
        timestamp: new Date().toISOString(),
        views: 500,
        reactions: 65,
        comments: 14,
      },
    ];

    const velocity: EngagementVelocity = {
      views_24h: 250,
      reactions_24h: 35,
      comments_24h: 8,
      views_per_day: 200.0,
      reactions_per_day: 27.5,
      comments_per_day: 6.0,
      trend: "Accelerating",
    };

    await act(async () => {
      root!.render(
        <EngagementVelocityChart
          snapshots={snapshots}
          velocity={velocity}
          title="Custom Test Title"
        />,
      );
    });

    expect(container!.textContent).toContain("Custom Test Title");
    expect(container!.textContent).toContain("Accelerating");
    expect(container!.textContent).toContain("+200 views/day");

    const svg = container!.querySelector("svg");
    expect(svg).toBeDefined();

    const paths = container!.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("toggles metric filters between all, views, reactions, and comments", async () => {
    const snapshots: EngagementSnapshot[] = [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        views: 100,
        reactions: 10,
        comments: 2,
      },
      {
        timestamp: new Date().toISOString(),
        views: 200,
        reactions: 20,
        comments: 4,
      },
    ];

    await act(async () => {
      root!.render(<EngagementVelocityChart snapshots={snapshots} />);
    });

    const viewsFilterBtn = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Views",
    );
    expect(viewsFilterBtn).toBeDefined();

    await act(async () => {
      viewsFilterBtn!.click();
    });

    expect(viewsFilterBtn!.className).toContain("text-cyan-300");
  });

  it("renders comparative multi-line curves for Dev.to, Hashnode, and Medium", async () => {
    const snapshots: EngagementSnapshot[] = [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        views: 300,
        reactions: 30,
        comments: 6,
        channels: {
          "Dev.to": { views: 150, reactions: 15, comments: 3 },
          Hashnode: { views: 100, reactions: 10, comments: 2 },
          Medium: { views: 50, reactions: 5, comments: 1 },
        },
      },
      {
        timestamp: new Date().toISOString(),
        views: 600,
        reactions: 60,
        comments: 12,
        channels: {
          "Dev.to": { views: 300, reactions: 30, comments: 6 },
          Hashnode: { views: 200, reactions: 20, comments: 4 },
          Medium: { views: 100, reactions: 10, comments: 2 },
        },
      },
    ];

    await act(async () => {
      root!.render(<EngagementVelocityChart snapshots={snapshots} />);
    });

    const channelToggleBtn = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Channel Comparison"),
    );
    expect(channelToggleBtn).toBeDefined();

    await act(async () => {
      channelToggleBtn!.click();
    });

    const devtoLine = container!.querySelector('path[data-channel="Dev.to"]');
    const hashnodeLine = container!.querySelector('path[data-channel="Hashnode"]');
    const mediumLine = container!.querySelector('path[data-channel="Medium"]');

    expect(devtoLine).not.toBeNull();
    expect(hashnodeLine).not.toBeNull();
    expect(mediumLine).not.toBeNull();

    expect(devtoLine?.getAttribute("stroke")).toBe("#818cf8");
    expect(hashnodeLine?.getAttribute("stroke")).toBe("#38bdf8");
    expect(mediumLine?.getAttribute("stroke")).toBe("#34d399");
  });

  it("toggles view mode between aggregate and channel comparison", async () => {
    const snapshots: EngagementSnapshot[] = [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        views: 100,
        reactions: 10,
        comments: 2,
        channels: {
          "Dev.to": { views: 50, reactions: 5, comments: 1 },
          Hashnode: { views: 50, reactions: 5, comments: 1 },
        },
      },
      {
        timestamp: new Date().toISOString(),
        views: 200,
        reactions: 20,
        comments: 4,
        channels: {
          "Dev.to": { views: 100, reactions: 10, comments: 2 },
          Hashnode: { views: 100, reactions: 10, comments: 2 },
        },
      },
    ];

    await act(async () => {
      root!.render(<EngagementVelocityChart snapshots={snapshots} />);
    });

    // Default is Aggregate View
    expect(container!.textContent).toContain("All Metrics");
    expect(container!.querySelector('path[data-channel="Dev.to"]')).toBeNull();

    const channelBtn = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Channel Comparison"),
    );
    await act(async () => {
      channelBtn!.click();
    });

    // Switched to channels
    expect(container!.textContent).toContain("Dev.to");
    expect(container!.textContent).toContain("Hashnode");
    expect(container!.querySelector('path[data-channel="Dev.to"]')).not.toBeNull();

    // Toggle back to aggregate
    const aggBtn = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Aggregate View",
    );
    await act(async () => {
      aggBtn!.click();
    });

    expect(container!.textContent).toContain("All Metrics");
    expect(container!.querySelector('path[data-channel="Dev.to"]')).toBeNull();
  });

  it("displays per-channel velocity summary pills and tooltips", async () => {
    const snapshots: EngagementSnapshot[] = [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        views: 250,
        reactions: 25,
        comments: 5,
        channels: {
          "Dev.to": { views: 100, reactions: 10, comments: 2 },
          Hashnode: { views: 100, reactions: 10, comments: 2 },
          Medium: { views: 50, reactions: 5, comments: 1 },
        },
      },
      {
        timestamp: new Date().toISOString(),
        views: 500,
        reactions: 50,
        comments: 10,
        channels: {
          "Dev.to": { views: 250, reactions: 25, comments: 5 },
          Hashnode: { views: 180, reactions: 18, comments: 3 },
          Medium: { views: 70, reactions: 7, comments: 2 },
        },
      },
    ];

    const velocity: EngagementVelocity = {
      views_24h: 250,
      reactions_24h: 25,
      comments_24h: 5,
      views_per_day: 250,
      reactions_per_day: 25,
      comments_per_day: 5,
      trend: "Accelerating",
      channels: {
        "Dev.to": {
          views_per_day: 150,
          reactions_per_day: 15,
          comments_per_day: 3,
          views_delta_24h: 150,
          reactions_delta_24h: 15,
          comments_delta_24h: 3,
          trend: "Accelerating",
        },
        Hashnode: {
          views_per_day: 80,
          reactions_per_day: 8,
          comments_per_day: 1,
          views_delta_24h: 80,
          reactions_delta_24h: 8,
          comments_delta_24h: 1,
          trend: "Steady",
        },
        Medium: {
          views_per_day: 20,
          reactions_per_day: 2,
          comments_per_day: 1,
          views_delta_24h: 20,
          reactions_delta_24h: 2,
          comments_delta_24h: 1,
          trend: "Decelerating",
        },
      },
    };

    await act(async () => {
      root!.render(<EngagementVelocityChart snapshots={snapshots} velocity={velocity} />);
    });

    const channelBtn = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Channel Comparison"),
    );
    await act(async () => {
      channelBtn!.click();
    });

    // Check summary pills in header
    expect(container!.textContent).toContain("Dev.to: +150/d (Accelerating)");
    expect(container!.textContent).toContain("Hashnode: +80/d (Steady)");
    expect(container!.textContent).toContain("Medium: +20/d (Decelerating)");

    // Hover over a data point circle
    const circles = container!.querySelectorAll("svg circle");
    expect(circles.length).toBeGreaterThan(0);

    await act(async () => {
      circles[0].dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });

    // Tooltip should display channel values and rates
    expect(container!.textContent).toContain("Dev.to:");
    expect(container!.textContent).toContain("Hashnode:");
    expect(container!.textContent).toContain("Medium:");
  });
});
