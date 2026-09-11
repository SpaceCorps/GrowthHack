import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, act, cleanup } from "@testing-library/react";
import { App, resolveActiveTabFromLocation } from "./App";

describe("App URL Hash Routing", () => {
  beforeEach(() => {
    window.location.hash = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/issues")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/articles")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/trends")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/listings")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/packages")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/agent/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ is_running: false }) });
      }
      if (url.includes("/api/demos")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/submissions/github-status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: false }) });
      }
      if (url.includes("/api/recipes")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/contributors/issues")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/playground/scenarios")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/playground/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/playground/status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "init",
              scenario_id: "scenario-health-check",
              status: "Idle",
              current_step: 1,
              step_progress_pct: 0,
              logs: [],
              verification_gates: [],
              elapsed_seconds: 0,
              speed_multiplier: 1.0,
            }),
        });
      }
      if (url.includes("/api/playground/metrics")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
      }
      if (url.includes("/api/playground/banner")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
      }
      if (url.includes("/api/launch/overview")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
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
    expect(screen.getByText(/Interactive Browser Web Playground/i)).toBeDefined();
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
    expect(screen.getByText(/Interactive Browser Web Playground/i)).toBeDefined();
  });
});
