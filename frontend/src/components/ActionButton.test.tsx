import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { ActionButton } from "./ActionButton";

afterEach(() => {
  cleanup();
});

describe("ActionButton Component", () => {
  it("renders default emerald variant with high contrast classes", () => {
    render(<ActionButton>Click Me</ActionButton>);
    const button = screen.getByRole("button", { name: "Click Me" });
    expect(button).toBeDefined();
    expect(button.className).toContain("bg-emerald-500");
    expect(button.className).toContain("text-slate-950");
    expect(button.className).toContain("font-bold");
  });

  it("renders gradient variant with high contrast classes", () => {
    render(<ActionButton variant="gradient">Launch Runner</ActionButton>);
    const button = screen.getByRole("button", { name: "Launch Runner" });
    expect(button).toBeDefined();
    expect(button.className).toContain("from-emerald-400");
    expect(button.className).toContain("to-teal-400");
    expect(button.className).toContain("text-slate-950");
  });

  it("renders size classes for xs, sm, md, and lg", () => {
    const { rerender } = render(<ActionButton size="xs">XS</ActionButton>);
    expect(screen.getByRole("button").className).toContain("px-2.5 py-1 text-xs rounded-lg");

    rerender(<ActionButton size="sm">SM</ActionButton>);
    expect(screen.getByRole("button").className).toContain("px-3 py-1.5 text-xs rounded-lg");

    rerender(<ActionButton size="md">MD</ActionButton>);
    expect(screen.getByRole("button").className).toContain(
      "px-4 py-2 text-xs sm:text-sm rounded-xl",
    );

    rerender(<ActionButton size="lg">LG</ActionButton>);
    expect(screen.getByRole("button").className).toContain("px-6 py-2.5 text-sm rounded-xl");
  });

  it("handles loading state with spinner, disabled attribute, aria-busy, and loadingText", () => {
    const { rerender } = render(
      <ActionButton loading loadingText="Loading...">
        Submit
      </ActionButton>,
    );

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.queryByText("Submit")).toBeNull();

    const spinner = button.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();

    // Falls back to children if loadingText is not specified
    rerender(<ActionButton loading>Submit</ActionButton>);
    expect(screen.getByText("Submit")).toBeDefined();
  });

  it("triggers onClick when active, but not when disabled or loading", () => {
    const handleClick = vi.fn();
    const { rerender } = render(<ActionButton onClick={handleClick}>Active</ActionButton>);

    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Disabled state
    rerender(
      <ActionButton disabled onClick={handleClick}>
        Disabled
      </ActionButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Disabled" }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Loading state
    rerender(
      <ActionButton loading onClick={handleClick}>
        Loading
      </ActionButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders custom icon and children", () => {
    render(
      <ActionButton icon={<span data-testid="custom-icon">ICON</span>}>Action Text</ActionButton>,
    );

    expect(screen.getByTestId("custom-icon")).toBeDefined();
    expect(screen.getByText("Action Text")).toBeDefined();
  });

  it("merges additional className overrides", () => {
    render(<ActionButton className="custom-override-class extra-shadow">Styled</ActionButton>);
    const button = screen.getByRole("button", { name: "Styled" });
    expect(button.className).toContain("custom-override-class");
    expect(button.className).toContain("extra-shadow");
    expect(button.className).toContain("bg-emerald-500");
  });
});
