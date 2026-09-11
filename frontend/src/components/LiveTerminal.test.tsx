import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { LiveTerminal } from "./LiveTerminal";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    }
  }

  emitError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

describe("LiveTerminal Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      container.remove();
      container = null;
      root = null;
    }
  });

  it("renders connection error message when eventSource errors before receiving [DONE]", async () => {
    await act(async () => {
      root!.render(<LiveTerminal taskId="task-test-err" />);
    });

    const instance = MockEventSource.instances[0];
    expect(instance).toBeDefined();

    await act(async () => {
      instance.emitError();
    });

    expect(container!.textContent).toContain("[ERROR] Stream connection disconnected or lost.");
    expect(container!.textContent).toContain("Disconnected");
  });

  it("displays replayed initial logs on mount", async () => {
    await act(async () => {
      root!.render(<LiveTerminal taskId="task-test-replay" />);
    });

    const instance = MockEventSource.instances[0];
    expect(instance).toBeDefined();

    await act(async () => {
      instance.emitMessage("[SYSTEM] Initializing Antigravity agent runner...");
      instance.emitMessage("[SYSTEM] Spawning: /usr/local/bin/agy");
      instance.emitMessage("[STAGE] Generating content with Antigravity engine...");
    });

    expect(container!.textContent).toContain("[SYSTEM] Initializing Antigravity agent runner...");
    expect(container!.textContent).toContain("[SYSTEM] Spawning: /usr/local/bin/agy");
    expect(container!.textContent).toContain(
      "[STAGE] Generating content with Antigravity engine...",
    );
  });
});
