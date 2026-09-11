import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import {
  setupMockFetch,
  createMockGithubStatus,
  createMockAgentStatus,
  createMockGhAuthStatus,
} from "./index";
import type { MockFetchController } from "./index";

describe("mockFetch shared test utility", () => {
  let controller: MockFetchController | null = null;

  afterEach(() => {
    if (controller) {
      controller.restore();
      controller = null;
    }
  });

  describe("Fixture Factories", () => {
    it("creates default mock github status and accepts overrides", () => {
      const defaultStatus = createMockGithubStatus();
      expect(defaultStatus).toEqual({
        configured: true,
        username: "testuser",
        message: "ok",
      });

      const overridden = createMockGithubStatus({
        configured: false,
        message: "missing token",
      });
      expect(overridden).toEqual({
        configured: false,
        username: "testuser",
        message: "missing token",
      });
    });

    it("creates default mock agent status and accepts overrides", () => {
      const defaultStatus = createMockAgentStatus();
      expect(defaultStatus).toEqual({
        is_available: true,
        agy_path: "/usr/local/bin/agy",
        version: "1.0.0",
      });

      const overridden = createMockAgentStatus({
        is_available: false,
        agy_path: "/custom/path",
      });
      expect(overridden.is_available).toBe(false);
      expect(overridden.agy_path).toBe("/custom/path");
      expect(overridden.version).toBe("1.0.0");
    });

    it("creates default mock GitHub auth status and accepts overrides", () => {
      const defaultAuth = createMockGhAuthStatus();
      expect(defaultAuth).toEqual({
        authenticated: true,
        account: "testuser",
        message: "GitHub CLI is authenticated as @testuser.",
      });

      const overridden = createMockGhAuthStatus({
        authenticated: false,
        message: "not logged in",
      });
      expect(overridden.authenticated).toBe(false);
      expect(overridden.account).toBe("testuser");
      expect(overridden.message).toBe("not logged in");
    });
  });

  describe("Default Endpoint Matching", () => {
    beforeEach(() => {
      controller = setupMockFetch();
    });

    it("matches default /api/submissions/github-status", async () => {
      const res = await fetch("/api/submissions/github-status");
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toEqual({
        configured: true,
        username: "testuser",
        message: "ok",
      });
    });

    it("matches default /api/agent/status with is_running: false", async () => {
      const res = await fetch("/api/agent/status");
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toEqual({
        is_available: true,
        agy_path: "/usr/local/bin/agy",
        version: "1.0.0",
        is_running: false,
      });
    });

    it("matches default /api/packages/gh-auth-status", async () => {
      const res = await fetch("/api/packages/gh-auth-status");
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toEqual({
        authenticated: true,
        account: "testuser",
        message: "GitHub CLI is authenticated as @testuser.",
      });
    });

    it("matches standard collection endpoints returning empty arrays", async () => {
      const endpoints = [
        "/api/issues",
        "/api/articles",
        "/api/trends",
        "/api/listings",
        "/api/packages",
        "/api/demos",
        "/api/recipes",
        "/api/contributors/issues",
      ];

      for (const endpoint of endpoints) {
        const res = await fetch(endpoint);
        expect(res.ok).toBe(true);
        const data = await res.json();
        expect(data).toEqual([]);
      }
    });
  });

  describe("Custom Route Handlers and Controller Methods", () => {
    it("handles custom static object and function responses via options.handlers", async () => {
      controller = setupMockFetch({
        handlers: {
          "/api/custom/static": { key: "value123" },
          "/api/custom/dynamic": (url) => ({ receivedUrl: url }),
        },
      });

      const staticRes = await fetch("/api/custom/static");
      expect(await staticRes.json()).toEqual({ key: "value123" });

      const dynamicRes = await fetch("/api/custom/dynamic?foo=bar");
      expect(await dynamicRes.json()).toEqual({
        receivedUrl: "/api/custom/dynamic?foo=bar",
      });
    });

    it("supports dynamically registering handlers with addHandler using string and RegExp", async () => {
      controller = setupMockFetch();

      controller.addHandler("/api/dynamic-string", { added: true });
      controller.addHandler(/\/api\/items\/\d+/, (url) => ({
        itemId: url.split("/").pop(),
      }));

      const stringRes = await fetch("/api/dynamic-string");
      expect(await stringRes.json()).toEqual({ added: true });

      const regexRes = await fetch("/api/items/42");
      expect(await regexRes.json()).toEqual({ itemId: "42" });
    });

    it("resets dynamic handlers back to options.handlers when resetHandlers is called", async () => {
      controller = setupMockFetch({
        handlers: {
          "/api/base": { base: true },
        },
      });

      controller.addHandler("/api/extra", { extra: true });

      const res1 = await fetch("/api/extra");
      expect(await res1.json()).toEqual({ extra: true });

      controller.resetHandlers();

      // /api/extra is removed and falls back to default fallback {}
      const res2 = await fetch("/api/extra");
      expect(await res2.json()).toEqual({});

      // base handler remains
      const resBase = await fetch("/api/base");
      expect(await resBase.json()).toEqual({ base: true });
    });
  });

  describe("Fallback Handling", () => {
    it("returns default 200 empty object response for unmatched /api/ routes", async () => {
      controller = setupMockFetch();

      const res = await fetch("/api/some/unknown/route");
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
      expect(await res.text()).toBe("{}");
    });

    it("uses custom fallback response when options.fallback is configured", async () => {
      controller = setupMockFetch({
        fallback: { customFallback: true },
      });

      const res = await fetch("/api/unknown");
      expect(await res.json()).toEqual({ customFallback: true });
    });

    it("returns 404 for non-api unhandled routes when silentFallback is false", async () => {
      controller = setupMockFetch();

      const res = await fetch("https://external-service.com/other");
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
    });

    it("returns 200 empty object for non-api routes when silentFallback is true", async () => {
      controller = setupMockFetch({ silentFallback: true });

      const res = await fetch("https://external-service.com/other");
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });
  });

  describe("Global fetch restoration and isolation", () => {
    it("properly restores original fetch without leakage", async () => {
      const originalFetch = globalThis.fetch;
      const testController = setupMockFetch();

      expect(globalThis.fetch).not.toBe(originalFetch);
      expect(globalThis.fetch).toBe(testController.fetchMock);

      testController.restore();
      expect(globalThis.fetch).toBe(originalFetch);
    });
  });
});
