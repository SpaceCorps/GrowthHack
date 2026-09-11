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
});
