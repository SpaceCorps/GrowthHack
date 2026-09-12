import React from "react";

export interface UseLocalStorageOptions<T> {
  /** Reject a parsed value that is structurally wrong or unusable; falls back to initialValue. */
  validate?: (value: unknown) => value is T;
}

const readValue = <T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
): T => {
  if (typeof window === "undefined" || !window.localStorage) return initialValue;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return initialValue;
    const parsed = JSON.parse(stored) as unknown;
    if (validate && !validate(parsed)) return initialValue;
    return parsed as T;
  } catch {
    return initialValue;
  }
};

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const { validate } = options ?? {};

  const [storedValue, setStoredValue] = React.useState<T>(() =>
    readValue(key, initialValue, validate),
  );

  const setValue = React.useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        if (typeof window !== "undefined" && window.localStorage) {
          try {
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch {
            // Ignore localStorage access errors (e.g. quota or security errors)
          }
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
