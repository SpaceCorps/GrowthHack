import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { AgentConsole } from "./AgentConsole";
import type { AgentStatus } from "../types";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const setTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("AgentConsole Component", () => {
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

  it("renders 'Auto-detected' executable when agentStatus is null", async () => {
    await act(async () => {
      root!.render(<AgentConsole agentStatus={null} onRunCustomPrompt={vi.fn()} />);
    });

    expect(container!.textContent).toContain("Executable: Auto-detected");
    expect(container!.textContent?.toLowerCase()).not.toContain("pavel");
  });

  it("renders 'Auto-detected' executable when agentStatus.agy_path is empty", async () => {
    const emptyStatus: AgentStatus = {
      is_available: true,
      agy_path: "",
      version: "1.0.0",
    };

    await act(async () => {
      root!.render(<AgentConsole agentStatus={emptyStatus} onRunCustomPrompt={vi.fn()} />);
    });

    expect(container!.textContent).toContain("Executable: Auto-detected");
    expect(container!.textContent?.toLowerCase()).not.toContain("pavel");
  });

  it("renders custom executable path when agentStatus.agy_path is provided", async () => {
    const customStatus: AgentStatus = {
      is_available: true,
      agy_path: "/usr/local/bin/agy",
      version: "1.0.0",
    };

    await act(async () => {
      root!.render(<AgentConsole agentStatus={customStatus} onRunCustomPrompt={vi.fn()} />);
    });

    expect(container!.textContent).toContain("Executable: /usr/local/bin/agy");
    expect(container!.textContent?.toLowerCase()).not.toContain("pavel");
  });

  it("does not leak developer username 'pavel' anywhere in rendered output", async () => {
    await act(async () => {
      root!.render(<AgentConsole agentStatus={null} onRunCustomPrompt={vi.fn()} />);
    });

    expect(container!.innerHTML.toLowerCase()).not.toContain("pavel");
  });

  it("populates prompt when quick action button is clicked and submits", async () => {
    const onRunCustomPrompt = vi.fn();
    await act(async () => {
      root!.render(<AgentConsole agentStatus={null} onRunCustomPrompt={onRunCustomPrompt} />);
    });

    const buttons = Array.from(container!.querySelectorAll("button"));
    const quickButton = buttons.find((b) => b.textContent?.includes("Draft 10x Worktrees Article"));
    expect(quickButton).toBeDefined();

    await act(async () => {
      quickButton!.click();
    });

    const form = container!.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onRunCustomPrompt).toHaveBeenCalledWith(
      expect.stringContaining("Write an authoritative 10x technical article"),
    );
  });

  it("calls onRunCustomPrompt when custom prompt form is submitted with typed input", async () => {
    const onRunCustomPrompt = vi.fn();
    await act(async () => {
      root!.render(<AgentConsole agentStatus={null} onRunCustomPrompt={onRunCustomPrompt} />);
    });

    const textarea = container!.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    await act(async () => {
      setTextareaValue(textarea, "Test prompt instruction");
    });

    const form = container!.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onRunCustomPrompt).toHaveBeenCalledWith("Test prompt instruction");
  });
});
