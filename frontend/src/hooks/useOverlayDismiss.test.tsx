import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { useOverlayDismiss } from "./useOverlayDismiss";
import type { UseOverlayDismissOptions } from "./useOverlayDismiss";

// @ts-expect-error global flag for react act support
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
  onDismiss: () => void;
  options?: UseOverlayDismissOptions;
}

const Harness: React.FC<HarnessProps> = ({ onDismiss, options }) => {
  const { overlayRef, onBackdropClick } = useOverlayDismiss(onDismiss, options);

  return (
    <div ref={overlayRef} data-testid="overlay" onClick={onBackdropClick}>
      <div data-testid="card">card</div>
    </div>
  );
};

const GuardedHarness: React.FC<HarnessProps & { withGuard: boolean }> = ({
  onDismiss,
  options,
  withGuard,
}) => {
  const { overlayRef, onBackdropClick } = useOverlayDismiss(onDismiss, options);

  return (
    <div ref={overlayRef} data-testid="overlay" onClick={onBackdropClick}>
      {withGuard && <div data-nested-overlay="true">nested</div>}
    </div>
  );
};

describe("useOverlayDismiss", () => {
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
    vi.restoreAllMocks();
  });

  it("calls onDismiss when Escape is pressed", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not call onDismiss for a non-Escape key", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("registers no listener and ignores Escape when enabled is false", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} options={{ enabled: false }} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("suppresses Escape and backdrop click when locked is true", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} options={{ locked: true }} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onDismiss).not.toHaveBeenCalled();

    const overlay = container!.querySelector('[data-testid="overlay"]');
    await act(async () => {
      overlay!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("leaves Escape to a matching guardSelector descendant", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(
        <GuardedHarness
          onDismiss={onDismiss}
          withGuard={true}
          options={{ guardSelector: '[data-nested-overlay="true"]' }}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses on Escape when guardSelector does not match anything", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(
        <GuardedHarness
          onDismiss={onDismiss}
          withGuard={false}
          options={{ guardSelector: '[data-nested-overlay="true"]' }}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses when the backdrop itself is clicked", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} />);
    });

    const overlay = container!.querySelector('[data-testid="overlay"]');
    await act(async () => {
      overlay!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss when a click bubbles up from the inner card", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} />);
    });

    const card = container!.querySelector('[data-testid="card"]');
    await act(async () => {
      card!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("removes its Escape listener after unmount", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} />);
    });

    await act(async () => {
      root!.unmount();
    });
    container!.remove();
    container = null;
    root = null;

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("calls stopPropagation on the Escape event when stopPropagation is true", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root!.render(<Harness onDismiss={onDismiss} options={{ stopPropagation: true }} />);
    });

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
