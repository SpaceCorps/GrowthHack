import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import { setupMockBlobUrl } from "./index";
import type { MockBlobUrlController } from "./index";

describe("mockBlobUrl shared test utility", () => {
  let controller: MockBlobUrlController | null = null;

  afterEach(() => {
    if (controller) {
      controller.restore();
      controller = null;
    }
  });

  it("intercepts window.URL.createObjectURL and returns blob:mock-url by default", () => {
    controller = setupMockBlobUrl();

    expect(typeof window.URL.createObjectURL).toBe("function");

    const blob = new Blob(["test-data"], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    expect(url).toBe("blob:mock-url");
    expect(controller.createObjectURL).toHaveBeenCalledTimes(1);
    expect(controller.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it("tracks generated URLs in getCreatedUrls() and calls spy with the passed Blob", () => {
    controller = setupMockBlobUrl();

    const blob1 = new Blob(["first"], { type: "text/plain" });
    const blob2 = new Blob(["second"], { type: "text/plain" });

    window.URL.createObjectURL(blob1);
    window.URL.createObjectURL(blob2);

    expect(controller.getCreatedUrls()).toEqual(["blob:mock-url", "blob:mock-url"]);
    expect(controller.createObjectURL).toHaveBeenCalledTimes(2);
    expect(controller.createObjectURL).toHaveBeenNthCalledWith(1, blob1);
    expect(controller.createObjectURL).toHaveBeenNthCalledWith(2, blob2);
  });

  it("intercepts window.URL.revokeObjectURL and tracks revoked URLs in getRevokedUrls()", () => {
    controller = setupMockBlobUrl();

    expect(typeof window.URL.revokeObjectURL).toBe("function");

    window.URL.revokeObjectURL("blob:test-1");
    window.URL.revokeObjectURL("blob:test-2");

    expect(controller.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(controller.revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:test-1");
    expect(controller.revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:test-2");
    expect(controller.getRevokedUrls()).toEqual(["blob:test-1", "blob:test-2"]);
  });

  it("supports custom defaultUrl, createObjectURLImpl, and revokeObjectURLImpl option handlers", () => {
    let customRevoked: string | null = null;
    const customCreate = vi.fn().mockImplementation((blob: Blob | MediaSource) => {
      return `blob:custom-url-${(blob as Blob).size}`;
    });
    const customRevoke = vi.fn().mockImplementation((url: string) => {
      customRevoked = url;
    });

    controller = setupMockBlobUrl({
      defaultUrl: "blob:custom-default",
      createObjectURLImpl: customCreate,
      revokeObjectURLImpl: customRevoke,
    });

    const blob = new Blob(["12345"], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    expect(url).toBe("blob:custom-url-5");
    expect(customCreate).toHaveBeenCalledWith(blob);
    expect(controller.getCreatedUrls()).toEqual(["blob:custom-url-5"]);

    window.URL.revokeObjectURL("blob:custom-url-5");
    expect(customRevoke).toHaveBeenCalledWith("blob:custom-url-5");
    expect(customRevoked).toBe("blob:custom-url-5");
    expect(controller.getRevokedUrls()).toEqual(["blob:custom-url-5"]);
  });

  it("falls back to custom defaultUrl when createObjectURLImpl is omitted", () => {
    controller = setupMockBlobUrl({ defaultUrl: "blob:custom-static-url" });

    const blob = new Blob(["hello"], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    expect(url).toBe("blob:custom-static-url");
    expect(controller.getCreatedUrls()).toEqual(["blob:custom-static-url"]);
  });

  it("clears mock histories and recorded URLs upon calling reset()", () => {
    controller = setupMockBlobUrl();

    const blob = new Blob(["data"]);
    window.URL.createObjectURL(blob);
    window.URL.revokeObjectURL("blob:mock-url");

    expect(controller.createObjectURL).toHaveBeenCalledTimes(1);
    expect(controller.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(controller.getCreatedUrls()).toHaveLength(1);
    expect(controller.getRevokedUrls()).toHaveLength(1);

    controller.reset();

    expect(controller.createObjectURL).toHaveBeenCalledTimes(0);
    expect(controller.revokeObjectURL).toHaveBeenCalledTimes(0);
    expect(controller.getCreatedUrls()).toEqual([]);
    expect(controller.getRevokedUrls()).toEqual([]);
  });

  it("restores original property descriptors and removes mock properties upon calling restore()", () => {
    const target = typeof window !== "undefined" && window.URL ? window.URL : URL;
    const initialCreateDescriptor = Object.getOwnPropertyDescriptor(target, "createObjectURL");
    const initialRevokeDescriptor = Object.getOwnPropertyDescriptor(target, "revokeObjectURL");

    controller = setupMockBlobUrl();
    expect(typeof target.createObjectURL).toBe("function");
    expect(typeof target.revokeObjectURL).toBe("function");

    controller.restore();
    controller = null;

    if (initialCreateDescriptor) {
      expect(Object.getOwnPropertyDescriptor(target, "createObjectURL")).toEqual(
        initialCreateDescriptor,
      );
    } else {
      expect(Object.getOwnPropertyDescriptor(target, "createObjectURL")).toBeUndefined();
    }

    if (initialRevokeDescriptor) {
      expect(Object.getOwnPropertyDescriptor(target, "revokeObjectURL")).toEqual(
        initialRevokeDescriptor,
      );
    } else {
      expect(Object.getOwnPropertyDescriptor(target, "revokeObjectURL")).toBeUndefined();
    }
  });

  it("preserves pre-existing custom descriptors when restored", () => {
    const target = typeof window !== "undefined" && window.URL ? window.URL : URL;
    const customCreate = vi.fn().mockReturnValue("blob:pre-existing");
    const customRevoke = vi.fn();

    Object.defineProperty(target, "createObjectURL", {
      value: customCreate,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(target, "revokeObjectURL", {
      value: customRevoke,
      configurable: true,
      writable: true,
    });

    controller = setupMockBlobUrl();
    expect(target.createObjectURL).toBe(controller.createObjectURL);
    expect(target.revokeObjectURL).toBe(controller.revokeObjectURL);

    controller.restore();
    controller = null;

    expect(target.createObjectURL).toBe(customCreate);
    expect(target.revokeObjectURL).toBe(customRevoke);

    delete (target as unknown as Record<string, unknown>).createObjectURL;
    delete (target as unknown as Record<string, unknown>).revokeObjectURL;
  });
});
