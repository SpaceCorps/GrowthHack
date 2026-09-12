import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("returns initialValue when the key is absent", () => {
    const { result } = renderHook(() => useLocalStorage("missing-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("rehydrates a previously stored boolean value", () => {
    localStorage.setItem("bool-key", "true");
    const { result } = renderHook(() => useLocalStorage("bool-key", false));
    expect(result.current[0]).toBe(true);
  });

  it("rehydrates a previously stored JSON object", () => {
    localStorage.setItem("object-key", JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useLocalStorage<Record<string, number>>("object-key", {}));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it("rehydrates a previously stored JSON array", () => {
    localStorage.setItem("array-key", JSON.stringify(["x", "y"]));
    const { result } = renderHook(() => useLocalStorage<string[]>("array-key", []));
    expect(result.current[0]).toEqual(["x", "y"]);
  });

  it("returns initialValue when the stored value is unparseable garbage", () => {
    localStorage.setItem("garbage-key", "{not-json");
    const { result } = renderHook(() => useLocalStorage("garbage-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("returns initialValue when validate rejects the parsed value", () => {
    localStorage.setItem("empty-array-key", JSON.stringify([]));
    const { result } = renderHook(() =>
      useLocalStorage<string[]>("empty-array-key", ["default"], {
        validate: (v): v is string[] => Array.isArray(v) && v.length > 0,
      }),
    );
    expect(result.current[0]).toEqual(["default"]);
  });

  it("setter writes JSON.stringify(next) to the given key", () => {
    const { result } = renderHook(() => useLocalStorage("write-key", "initial"));
    act(() => {
      result.current[1]("updated");
    });
    expect(localStorage.getItem("write-key")).toBe(JSON.stringify("updated"));
    expect(result.current[0]).toBe("updated");
  });

  it("setter supports the updater form", () => {
    const { result } = renderHook(() => useLocalStorage("toggle-key", false));
    act(() => {
      result.current[1]((prev) => !prev);
    });
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("toggle-key")).toBe("true");
  });

  it("falls back to initialValue when localStorage.getItem throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });
    const { result } = renderHook(() => useLocalStorage("throwing-key", "safe"));
    expect(result.current[0]).toBe("safe");
  });

  it("still updates React state when localStorage.setItem throws", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const { result } = renderHook(() => useLocalStorage("quota-key", "initial"));
    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");
  });
});
