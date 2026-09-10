import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { TrendRadar } from "./TrendRadar";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("TrendRadar Component Source Selectors", () => {
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

  it("renders source toggle pills with all sources selected by default", async () => {
    await act(async () => {
      root!.render(<TrendRadar trends={[]} onScoutTrends={vi.fn()} onSynthesizeTrend={vi.fn()} />);
    });

    const buttons = Array.from(container!.querySelectorAll("button"));
    const githubPill = buttons.find((b) => b.textContent?.includes("GitHub"));
    const redditPill = buttons.find((b) => b.textContent?.includes("Reddit"));
    const linkedinPill = buttons.find((b) => b.textContent?.includes("LinkedIn"));

    expect(githubPill).toBeDefined();
    expect(redditPill).toBeDefined();
    expect(linkedinPill).toBeDefined();

    expect(githubPill?.className).toContain("border-indigo-500/50");
    expect(redditPill?.className).toContain("border-indigo-500/50");
    expect(linkedinPill?.className).toContain("border-indigo-500/50");
  });

  it("calls onScoutTrends with selected sources", async () => {
    const onScoutTrends = vi.fn();
    await act(async () => {
      root!.render(
        <TrendRadar trends={[]} onScoutTrends={onScoutTrends} onSynthesizeTrend={vi.fn()} />,
      );
    });

    const buttons = Array.from(container!.querySelectorAll("button"));
    const redditPill = buttons.find((b) => b.textContent?.includes("Reddit"));
    expect(redditPill).toBeDefined();

    // Toggle Reddit off
    await act(async () => {
      redditPill!.click();
    });

    expect(redditPill?.className).not.toContain("border-indigo-500/50");

    // Click "Scout Today's Trends"
    const scoutButton = buttons.find((b) => b.textContent?.includes("Scout Today's Trends"));
    expect(scoutButton).toBeDefined();

    await act(async () => {
      scoutButton!.click();
    });

    expect(onScoutTrends).toHaveBeenCalledWith(["GitHub", "LinkedIn"]);
  });
});
