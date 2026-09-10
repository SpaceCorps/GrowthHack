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
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    localStorage.clear();
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

  it("renders discussion source controls and default target chips", async () => {
    await act(async () => {
      root!.render(<TrendRadar trends={[]} onScoutTrends={vi.fn()} onSynthesizeTrend={vi.fn()} />);
    });

    const buttons = Array.from(container!.querySelectorAll("button"));
    const configButton = buttons.find((b) => b.textContent?.includes("Discussion Targets"));
    expect(configButton).toBeDefined();

    await act(async () => {
      configButton!.click();
    });

    const panel = container!.querySelector('[data-testid="discussion-targets-panel"]');
    expect(panel).toBeDefined();

    expect(panel?.textContent).toContain("r/LocalLLaMA");
    expect(panel?.textContent).toContain("r/programming");
    expect(panel?.textContent).toContain("r/ClaudeAI");
    expect(panel?.textContent).toContain("Hacker News");
    expect(panel?.textContent).toContain("r/ChatGPTCoding");
    expect(panel?.textContent).toContain("Lobste.rs");
  });

  it("allows adding and removing custom subreddits and forums", async () => {
    await act(async () => {
      root!.render(<TrendRadar trends={[]} onScoutTrends={vi.fn()} onSynthesizeTrend={vi.fn()} />);
    });

    const buttons = Array.from(container!.querySelectorAll("button"));
    const configButton = buttons.find((b) => b.textContent?.includes("Discussion Targets"));
    await act(async () => {
      configButton!.click();
    });

    const input = container!.querySelector(
      'input[placeholder*="Add custom subreddit"]',
    ) as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      // Simulate typing into React input
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, "r/rust");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const addButton = Array.from(container!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Add"),
    );
    expect(addButton).toBeDefined();

    await act(async () => {
      addButton!.click();
    });

    let panel = container!.querySelector('[data-testid="discussion-targets-panel"]');
    expect(panel?.textContent).toContain("r/rust");

    const removeLobstersBtn = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label") === "Remove Lobste.rs",
    );
    expect(removeLobstersBtn).toBeDefined();

    await act(async () => {
      removeLobstersBtn!.click();
    });

    panel = container!.querySelector('[data-testid="discussion-targets-panel"]');
    const removeLobstersBtnAfter = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label") === "Remove Lobste.rs",
    );
    expect(removeLobstersBtnAfter).toBeUndefined();
  });

  it("calls onScoutTrends with active discussion sources on harvester click", async () => {
    const onScoutTrends = vi.fn();
    await act(async () => {
      root!.render(
        <TrendRadar trends={[]} onScoutTrends={onScoutTrends} onSynthesizeTrend={vi.fn()} />,
      );
    });

    const buttons = Array.from(container!.querySelectorAll("button"));
    const harvesterButton = buttons.find((b) => b.textContent?.includes("Harvester: Discussions"));
    expect(harvesterButton).toBeDefined();

    await act(async () => {
      harvesterButton!.click();
    });

    expect(onScoutTrends).toHaveBeenCalledWith(
      expect.arrayContaining([
        "r/LocalLLaMA",
        "r/programming",
        "r/ClaudeAI",
        "Hacker News",
        "r/ChatGPTCoding",
        "Lobste.rs",
      ]),
      "discussions",
    );
  });
});
