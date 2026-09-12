import { useCallback, useEffect, useRef } from "react";

export interface UseOverlayDismissOptions {
  /** When false the hook is inert (no listener, backdrop clicks ignored). Default true. */
  enabled?: boolean;
  /** While true, dismissal is suppressed — e.g. an in-flight request. Default false. */
  locked?: boolean;
  /** CSS selector; if a descendant of the overlay matches, Escape is left to that overlay. */
  guardSelector?: string;
  /** Call e.stopPropagation() on the Escape event before dismissing. Default false. */
  stopPropagation?: boolean;
}

export interface UseOverlayDismissResult {
  /** Attach to the overlay (backdrop) element — used for guardSelector lookups. */
  overlayRef: React.RefObject<HTMLDivElement | null>;
  /** Attach as the overlay element's onClick — dismisses only on a true backdrop hit. */
  onBackdropClick: (e: React.MouseEvent<HTMLElement>) => void;
}

export function useOverlayDismiss(
  onDismiss: () => void,
  options: UseOverlayDismissOptions = {},
): UseOverlayDismissResult {
  const { enabled = true, locked = false, guardSelector, stopPropagation = false } = options;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (locked) return;
      if (guardSelector && overlayRef.current?.querySelector(guardSelector)) return;
      if (stopPropagation) e.stopPropagation();
      onDismiss();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, locked, guardSelector, stopPropagation, onDismiss]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!enabled || locked) return;
      if (e.target === e.currentTarget) onDismiss();
    },
    [enabled, locked, onDismiss],
  );

  return { overlayRef, onBackdropClick };
}
