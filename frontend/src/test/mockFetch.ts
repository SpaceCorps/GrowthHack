import { vi } from "vite-plus/test";
import type { Mock } from "vite-plus/test";
import type { AgentStatus, GhAuthStatus } from "../types";

export interface MockGithubStatus {
  configured: boolean;
  username?: string;
  message: string;
}

export type FetchResponseValue =
  | unknown
  | string
  | Response
  | ((url: string, options?: RequestInit) => unknown | Promise<unknown>);

export interface MockFetchOptions {
  handlers?: Record<string, FetchResponseValue>;
  fallback?: FetchResponseValue;
  silentFallback?: boolean;
}

export interface MockFetchController {
  fetchMock: Mock<typeof fetch>;
  restore: () => void;
  addHandler: (pattern: string | RegExp, response: FetchResponseValue) => void;
  resetHandlers: () => void;
}

export function createMockGithubStatus(overrides?: Partial<MockGithubStatus>): MockGithubStatus {
  return {
    configured: true,
    username: "testuser",
    message: "ok",
    ...overrides,
  };
}

export function createMockAgentStatus(overrides?: Partial<AgentStatus>): AgentStatus {
  return {
    is_available: true,
    agy_path: "/usr/local/bin/agy",
    version: "1.0.0",
    ...overrides,
  };
}

export function createMockGhAuthStatus(overrides?: Partial<GhAuthStatus>): GhAuthStatus {
  return {
    authenticated: true,
    account: "testuser",
    message: "GitHub CLI is authenticated as @testuser.",
    ...overrides,
  };
}

function createMockResponse(data: unknown, status = 200): Response {
  const isString = typeof data === "string";
  const textContent = isString ? data : JSON.stringify(data !== undefined ? data : {});
  const headers = new Headers();
  headers.set("content-type", isString ? "text/plain" : "application/json");

  const mockRes = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    headers,
    json: async () => {
      if (isString) {
        try {
          return JSON.parse(data as string);
        } catch {
          return data;
        }
      }
      if (typeof data === "object" && data !== null) {
        return JSON.parse(JSON.stringify(data));
      }
      return data;
    },
    text: async () => textContent,
    blob: async () => new Blob([textContent]),
    arrayBuffer: async () => new TextEncoder().encode(textContent).buffer,
    clone() {
      return createMockResponse(data, status);
    },
  };

  return mockRes as unknown as Response;
}

async function toResponse(
  value: FetchResponseValue,
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const resolved = typeof value === "function" ? await value(url, options) : value;

  if (resolved instanceof Response) {
    return resolved;
  }

  if (
    typeof resolved === "object" &&
    resolved !== null &&
    "json" in resolved &&
    typeof (resolved as { json: unknown }).json === "function"
  ) {
    const resObj = resolved as Record<string, unknown>;
    const status = typeof resObj.status === "number" ? resObj.status : 200;
    const ok = typeof resObj.ok === "boolean" ? resObj.ok : status >= 200 && status < 300;
    return {
      ok,
      status,
      statusText: typeof resObj.statusText === "string" ? resObj.statusText : ok ? "OK" : "Error",
      headers:
        resObj.headers instanceof Headers
          ? resObj.headers
          : new Headers({ "content-type": "application/json" }),
      text: typeof resObj.text === "function" ? resObj.text : async () => JSON.stringify(resObj),
      blob:
        typeof resObj.blob === "function"
          ? resObj.blob
          : async () => new Blob([JSON.stringify(resObj)]),
      arrayBuffer:
        typeof resObj.arrayBuffer === "function"
          ? resObj.arrayBuffer
          : async () => new ArrayBuffer(0),
      clone: () => resObj as unknown as Response,
      ...resObj,
    } as unknown as Response;
  }

  return createMockResponse(resolved);
}

interface HandlerEntry {
  pattern: string | RegExp;
  response: FetchResponseValue;
}

const defaultRoutes: Array<{
  pattern: string;
  handler: () => FetchResponseValue;
}> = [
  {
    pattern: "/api/submissions/github-status",
    handler: () => createMockGithubStatus(),
  },
  {
    pattern: "/api/agent/status",
    handler: () => ({ ...createMockAgentStatus(), is_running: false }),
  },
  {
    pattern: "/api/packages/gh-auth-status",
    handler: () => createMockGhAuthStatus(),
  },
  { pattern: "/api/issues", handler: () => [] },
  { pattern: "/api/articles", handler: () => [] },
  { pattern: "/api/trends", handler: () => [] },
  { pattern: "/api/listings", handler: () => [] },
  { pattern: "/api/packages", handler: () => [] },
  { pattern: "/api/demos", handler: () => [] },
  { pattern: "/api/recipes", handler: () => [] },
  { pattern: "/api/contributors/issues", handler: () => [] },
];

export function setupMockFetch(options?: MockFetchOptions): MockFetchController {
  const originalFetch = globalThis.fetch;

  const initialCustomHandlers: HandlerEntry[] = [];
  if (options?.handlers) {
    for (const [pattern, response] of Object.entries(options.handlers)) {
      initialCustomHandlers.push({ pattern, response });
    }
  }

  let customHandlers: HandlerEntry[] = [...initialCustomHandlers];

  const fetchMock = vi
    .fn()
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (typeof input === "object" && input !== null && "url" in input) {
        url = (input as { url: string }).url;
      }

      const urlWithoutQuery = url.split("?")[0];

      // 1. Check custom handlers for exact match
      for (const entry of customHandlers) {
        if (
          typeof entry.pattern === "string" &&
          (url === entry.pattern || urlWithoutQuery === entry.pattern)
        ) {
          return toResponse(entry.response, url, init);
        }
      }

      // 2. Check custom handlers for regex or substring match
      for (const entry of customHandlers) {
        if (entry.pattern instanceof RegExp && entry.pattern.test(url)) {
          return toResponse(entry.response, url, init);
        }
        if (typeof entry.pattern === "string" && url.includes(entry.pattern)) {
          return toResponse(entry.response, url, init);
        }
      }

      // 3. Check default handlers for exact match
      for (const entry of defaultRoutes) {
        if (url === entry.pattern || urlWithoutQuery === entry.pattern) {
          return toResponse(entry.handler(), url, init);
        }
      }

      // 4. Check default handlers for substring match (longer pattern first)
      const sortedDefaults = [...defaultRoutes].sort((a, b) => b.pattern.length - a.pattern.length);
      for (const entry of sortedDefaults) {
        if (url.includes(entry.pattern)) {
          return toResponse(entry.handler(), url, init);
        }
      }

      // 5. Fallback response
      if (options?.fallback !== undefined) {
        return toResponse(options.fallback, url, init);
      }

      if (url.includes("/api/")) {
        return toResponse({}, url, init);
      }

      if (options?.silentFallback) {
        return toResponse({}, url, init);
      }

      return createMockResponse({ error: `Unhandled fetch request: ${url}` }, 404);
    });

  const nodeGlobal = (globalThis as unknown as { global?: { fetch?: typeof fetch } }).global;

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  if (nodeGlobal) {
    nodeGlobal.fetch = fetchMock as unknown as typeof fetch;
  }
  if (typeof window !== "undefined") {
    (window as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  }

  const controller: MockFetchController = {
    fetchMock: fetchMock as unknown as Mock<typeof fetch>,
    restore: () => {
      globalThis.fetch = originalFetch;
      if (nodeGlobal) {
        nodeGlobal.fetch = originalFetch;
      }
      if (typeof window !== "undefined") {
        (window as unknown as { fetch: typeof fetch }).fetch = originalFetch;
      }
    },
    addHandler: (pattern: string | RegExp, response: FetchResponseValue) => {
      customHandlers.unshift({ pattern, response });
    },
    resetHandlers: () => {
      customHandlers = [...initialCustomHandlers];
    },
  };

  return controller;
}
