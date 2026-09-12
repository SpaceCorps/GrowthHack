import { vi } from "vite-plus/test";
import type { Mock } from "vite-plus/test";

export interface MockBlobUrlController {
  createObjectURL: Mock<(blob: Blob | MediaSource) => string>;
  revokeObjectURL: Mock<(url: string) => void>;
  restore: () => void;
  reset: () => void;
  getCreatedUrls: () => string[];
  getRevokedUrls: () => string[];
}

export interface MockBlobUrlOptions {
  defaultUrl?: string;
  createObjectURLImpl?: (blob: Blob | MediaSource) => string;
  revokeObjectURLImpl?: (url: string) => void;
}

export function setupMockBlobUrl(options?: MockBlobUrlOptions): MockBlobUrlController {
  const targets: (typeof URL)[] = [];
  if (typeof window !== "undefined" && window.URL) {
    targets.push(window.URL);
  }
  if (typeof URL !== "undefined" && !targets.includes(URL)) {
    targets.push(URL);
  }

  const originalDescriptors = targets.map((target) => ({
    target,
    create: Object.getOwnPropertyDescriptor(target, "createObjectURL"),
    revoke: Object.getOwnPropertyDescriptor(target, "revokeObjectURL"),
  }));

  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  const defaultUrl = options?.defaultUrl ?? "blob:mock-url";

  const createObjectURL: Mock<(blob: Blob | MediaSource) => string> = vi
    .fn()
    .mockImplementation((blob: Blob | MediaSource) => {
      const url = options?.createObjectURLImpl ? options.createObjectURLImpl(blob) : defaultUrl;
      createdUrls.push(url);
      return url;
    });

  const revokeObjectURL: Mock<(url: string) => void> = vi.fn().mockImplementation((url: string) => {
    revokedUrls.push(url);
    if (options?.revokeObjectURLImpl) {
      options.revokeObjectURLImpl(url);
    }
  });

  for (const target of targets) {
    Object.defineProperty(target, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(target, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    });
  }

  const restore = () => {
    for (const { target, create, revoke } of originalDescriptors) {
      if (create) {
        Object.defineProperty(target, "createObjectURL", create);
      } else {
        try {
          delete (target as unknown as Record<string, unknown>).createObjectURL;
        } catch {
          Object.defineProperty(target, "createObjectURL", {
            value: undefined,
            configurable: true,
            writable: true,
          });
        }
      }

      if (revoke) {
        Object.defineProperty(target, "revokeObjectURL", revoke);
      } else {
        try {
          delete (target as unknown as Record<string, unknown>).revokeObjectURL;
        } catch {
          Object.defineProperty(target, "revokeObjectURL", {
            value: undefined,
            configurable: true,
            writable: true,
          });
        }
      }
    }
  };

  const reset = () => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    createdUrls.length = 0;
    revokedUrls.length = 0;
  };

  const getCreatedUrls = () => [...createdUrls];
  const getRevokedUrls = () => [...revokedUrls];

  return {
    createObjectURL,
    revokeObjectURL,
    restore,
    reset,
    getCreatedUrls,
    getRevokedUrls,
  };
}
