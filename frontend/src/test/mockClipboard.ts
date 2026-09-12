import { vi } from "vite-plus/test";
import type { Mock } from "vite-plus/test";

export interface MockClipboardController {
  writeText: Mock<(text: string) => Promise<void>>;
  readText: Mock<() => Promise<string>>;
  restore: () => void;
  reset: () => void;
}

export interface MockClipboardOptions {
  writeTextImpl?: (text: string) => Promise<void> | void;
  readTextImpl?: () => Promise<string> | string;
  initialText?: string;
}

export function setupMockClipboard(options?: MockClipboardOptions): MockClipboardController {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  let currentText = options?.initialText ?? "";

  const writeText: Mock<(text: string) => Promise<void>> = vi
    .fn()
    .mockImplementation(async (text: string) => {
      currentText = text;
      if (options?.writeTextImpl) {
        await options.writeTextImpl(text);
      }
    });

  const readText: Mock<() => Promise<string>> = vi.fn().mockImplementation(async () => {
    if (options?.readTextImpl) {
      return await options.readTextImpl();
    }
    return currentText;
  });

  const clipboard = {
    writeText,
    readText,
  };

  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
    writable: true,
  });

  const restore = () => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalDescriptor);
    } else {
      try {
        delete (navigator as unknown as Record<string, unknown>).clipboard;
      } catch {
        Object.defineProperty(navigator, "clipboard", {
          value: undefined,
          configurable: true,
          writable: true,
        });
      }
    }
  };

  const reset = () => {
    writeText.mockClear();
    readText.mockClear();
    currentText = options?.initialText ?? "";
  };

  return {
    writeText,
    readText,
    restore,
    reset,
  };
}
