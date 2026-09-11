import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, act, cleanup } from "@testing-library/react";
import { App, resolveActiveTabFromLocation } from "./App";
import { setupMockFetch } from "./test";
import type { MockFetchController } from "./test";

describe("App URL Hash Routing", () => {
  let mockController: MockFetchController | null = null;

  beforeEach(() => {
    window.location.hash = "";
    mockController = setupMockFetch({
      handlers: {
        "/api/submissions/github-status": { configured: false },
        "/api/playground/scenarios": [],
        "/api/playground/tree": [],
        "/api/playground/status": {
          id: "init",
          scenario_id: "scenario-health-check",
          status: "Idle",
          current_step: 1,
          step_progress_pct: 0,
          logs: [],
          verification_gates: [],
          elapsed_seconds: 0,
          speed_multiplier: 1.0,
        },
        "/api/playground/metrics": null,
        "/api/playground/banner": null,
        "/api/launch/overview": null,
      },
    });
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
    if (mockController) {
      mockController.restore();
      mockController = null;
    }
    vi.restoreAllMocks();
  });

  it("resolves active tab to playground when scenario= is in location hash or search", () => {
    expect(resolveActiveTabFromLocation("#scenario=rate-limiter")).toBe("playground");
    expect(resolveActiveTabFromLocation("#tab=playground&scenario=rate-limiter")).toBe(
      "playground",
    );
    expect(resolveActiveTabFromLocation("#playground?scenario=rate-limiter")).toBe("playground");
    expect(resolveActiveTabFromLocation("", "scenario=rate-limiter")).toBe("playground");
    expect(resolveActiveTabFromLocation("#issues")).toBe("issues");
    expect(resolveActiveTabFromLocation("#doctor")).toBe("doctor");
  });

  it("mounts App with playground active tab when window.location.hash is #scenario=rate-limiter", async () => {
    window.location.hash = "#scenario=rate-limiter";

    await act(async () => {
      render(<App />);
    });

    // When activeTab === "playground", Playground view is mounted
    expect(await screen.findByText(/Interactive Browser Web Playground/i)).toBeDefined();
  });

  it("handleHashChange switches active tab to playground when hash transitions to #scenario=terminal-theme", async () => {
    window.location.hash = "#issues";

    await act(async () => {
      render(<App />);
    });

    // Initially on issues tab
    expect(screen.queryByText(/Interactive Browser Web Playground/i)).toBeNull();

    // Trigger hash change to #scenario=terminal-theme
    await act(async () => {
      window.location.hash = "#scenario=terminal-theme";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // Now switched to playground tab
    expect(await screen.findByText(/Interactive Browser Web Playground/i)).toBeDefined();
  });
});
