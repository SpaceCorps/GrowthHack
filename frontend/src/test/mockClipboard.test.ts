import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import { setupMockClipboard } from "./index";
import type { MockClipboardController } from "./index";

describe("mockClipboard shared test utility", () => {
  let controller: MockClipboardController | null = null;

  afterEach(() => {
    if (controller) {
      controller.restore();
      controller = null;
    }
  });

  it("installs mock clipboard on navigator and intercepts writeText calls", async () => {
    controller = setupMockClipboard();

    expect(navigator.clipboard).toBeDefined();
    expect(typeof navigator.clipboard.writeText).toBe("function");
    expect(typeof navigator.clipboard.readText).toBe("function");

    await navigator.clipboard.writeText("test text");

    expect(controller.writeText).toHaveBeenCalledTimes(1);
    expect(controller.writeText).toHaveBeenCalledWith("test text");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test text");
  });

  it("preserves written text for subsequent readText calls", async () => {
    controller = setupMockClipboard();

    expect(await navigator.clipboard.readText()).toBe("");

    await navigator.clipboard.writeText("persisted content");

    expect(await navigator.clipboard.readText()).toBe("persisted content");
    expect(await controller.readText()).toBe("persisted content");
  });

  it("initializes with specified initialText option", async () => {
    controller = setupMockClipboard({ initialText: "seeded value" });

    expect(await navigator.clipboard.readText()).toBe("seeded value");
    expect(await controller.readText()).toBe("seeded value");
  });

  it("allows custom writeTextImpl and readTextImpl handlers", async () => {
    const customWrite = vi.fn().mockImplementation(async (text: string) => {
      if (text === "fail") {
        throw new Error("clipboard permission denied");
      }
    });
    const customRead = vi.fn().mockResolvedValue("dynamic text");

    controller = setupMockClipboard({
      writeTextImpl: customWrite,
      readTextImpl: customRead,
    });

    await expect(navigator.clipboard.writeText("fail")).rejects.toThrow(
      "clipboard permission denied",
    );
    expect(customWrite).toHaveBeenCalledWith("fail");

    const read = await navigator.clipboard.readText();
    expect(read).toBe("dynamic text");
    expect(customRead).toHaveBeenCalled();
  });

  it("resets mock call history and simulated clipboard content on reset()", async () => {
    controller = setupMockClipboard({ initialText: "initial" });

    await navigator.clipboard.writeText("new text");
    await navigator.clipboard.readText();

    expect(controller.writeText).toHaveBeenCalledTimes(1);
    expect(controller.readText).toHaveBeenCalledTimes(1);
    expect(await controller.readText()).toBe("new text");

    controller.reset();

    expect(controller.writeText).toHaveBeenCalledTimes(0);
    expect(controller.readText).toHaveBeenCalledTimes(0);
    expect(await controller.readText()).toBe("initial");
  });

  it("reinstates previous property descriptor and removes test pollution on restore()", async () => {
    const hadClipboardInitially = "clipboard" in navigator;
    const initialDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

    controller = setupMockClipboard();
    expect(navigator.clipboard).toBeDefined();

    controller.restore();
    controller = null;

    if (initialDescriptor) {
      expect(Object.getOwnPropertyDescriptor(navigator, "clipboard")).toEqual(initialDescriptor);
    } else if (!hadClipboardInitially) {
      expect("clipboard" in navigator).toBe(false);
    }
  });

  it("restores pre-existing custom clipboard descriptor", () => {
    const customClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      customProp: "preserved",
    };
    Object.defineProperty(navigator, "clipboard", {
      value: customClipboard,
      configurable: true,
      writable: true,
    });

    controller = setupMockClipboard();
    expect((navigator.clipboard as unknown as { customProp?: string }).customProp).toBeUndefined();

    controller.restore();
    controller = null;

    expect((navigator.clipboard as unknown as { customProp?: string }).customProp).toBe(
      "preserved",
    );

    // Clean up test descriptor
    delete (navigator as unknown as Record<string, unknown>).clipboard;
  });
});
