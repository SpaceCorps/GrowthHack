import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { SegmentedControl, type SegmentedControlOption } from "./SegmentedControl";

afterEach(() => {
  cleanup();
});

describe("SegmentedControl Component", () => {
  it("renders string options correctly with ARIA radiogroup and radio roles", () => {
    const options = ["Dev.to", "Hashnode", "Medium"];
    render(
      <SegmentedControl
        options={options}
        value="Dev.to"
        onChange={vi.fn()}
        ariaLabel="Syndication channel selector"
      />,
    );

    const group = screen.getByRole("radiogroup", {
      name: "Syndication channel selector",
    });
    expect(group).toBeDefined();

    const radioButtons = screen.getAllByRole("radio");
    expect(radioButtons).toHaveLength(3);

    const devtoRadio = screen.getByRole("radio", { name: "Dev.to" });
    expect(devtoRadio.getAttribute("aria-checked")).toBe("true");

    const hashnodeRadio = screen.getByRole("radio", { name: "Hashnode" });
    expect(hashnodeRadio.getAttribute("aria-checked")).toBe("false");
  });

  it("renders object options with custom label, icon, and hint", () => {
    const options: SegmentedControlOption[] = [
      {
        value: "dual",
        label: "Dual Vector",
        hint: "(Default)",
        icon: <span data-testid="icon-dual">ICON</span>,
      },
      {
        value: "svg",
        label: "Vector SVG",
      },
    ];

    render(<SegmentedControl options={options} value="dual" onChange={vi.fn()} />);

    expect(screen.getByTestId("icon-dual")).toBeDefined();
    expect(screen.getByText("Dual Vector")).toBeDefined();
    expect(screen.getByText("(Default)")).toBeDefined();
    expect(screen.getByText("Vector SVG")).toBeDefined();
  });

  it("applies active and inactive classes for emerald variant by default", () => {
    const options = ["One", "Two"];
    render(<SegmentedControl options={options} value="One" onChange={vi.fn()} />);

    const activeBtn = screen.getByRole("radio", { name: "One" });
    expect(activeBtn.className).toContain("bg-emerald-500/20");
    expect(activeBtn.className).toContain("text-emerald-300");
    expect(activeBtn.className).toContain("border-emerald-500/50");

    const inactiveBtn = screen.getByRole("radio", { name: "Two" });
    expect(inactiveBtn.className).toContain("bg-slate-950");
    expect(inactiveBtn.className).toContain("text-slate-400");
    expect(inactiveBtn.className).toContain("border-slate-800");
  });

  it("applies correct active classes for cyan, indigo, and secondary variants", () => {
    const options = ["OptionA", "OptionB"];
    const { rerender } = render(
      <SegmentedControl options={options} value="OptionA" onChange={vi.fn()} variant="cyan" />,
    );

    let activeBtn = screen.getByRole("radio", { name: "OptionA" });
    expect(activeBtn.className).toContain("bg-cyan-500/20");
    expect(activeBtn.className).toContain("text-cyan-300");
    expect(activeBtn.className).toContain("border-cyan-500/50");

    rerender(
      <SegmentedControl options={options} value="OptionA" onChange={vi.fn()} variant="indigo" />,
    );
    activeBtn = screen.getByRole("radio", { name: "OptionA" });
    expect(activeBtn.className).toContain("bg-indigo-500/20");
    expect(activeBtn.className).toContain("text-indigo-300");
    expect(activeBtn.className).toContain("border-indigo-500/50");

    rerender(
      <SegmentedControl options={options} value="OptionA" onChange={vi.fn()} variant="secondary" />,
    );
    activeBtn = screen.getByRole("radio", { name: "OptionA" });
    expect(activeBtn.className).toContain("bg-slate-800");
    expect(activeBtn.className).toContain("text-slate-200");
    expect(activeBtn.className).toContain("border-slate-700");
  });

  it("applies sizing classes for xs, sm, and md sizes", () => {
    const options = ["A"];
    const { rerender } = render(
      <SegmentedControl options={options} value="A" onChange={vi.fn()} size="xs" />,
    );
    expect(screen.getByRole("radio").className).toContain("px-2.5 py-1 text-[11px] rounded-md");

    rerender(<SegmentedControl options={options} value="A" onChange={vi.fn()} size="sm" />);
    expect(screen.getByRole("radio").className).toContain("px-3 py-1.5 text-xs rounded-lg");

    rerender(<SegmentedControl options={options} value="A" onChange={vi.fn()} size="md" />);
    expect(screen.getByRole("radio").className).toContain(
      "px-4 py-2 text-xs sm:text-sm rounded-xl",
    );
  });

  it("triggers onChange when clicking an inactive option", () => {
    const handleChange = vi.fn();
    const options = ["Dev.to", "Hashnode"];
    render(<SegmentedControl options={options} value="Dev.to" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Hashnode" }));
    expect(handleChange).toHaveBeenCalledWith("Hashnode");
  });

  it("does not trigger onChange when option is disabled individually or via root disabled prop", () => {
    const handleChange = vi.fn();
    const options: SegmentedControlOption[] = [
      { value: "Enabled", label: "Enabled" },
      { value: "Disabled", label: "Disabled", disabled: true },
    ];

    const { rerender } = render(
      <SegmentedControl options={options} value="Enabled" onChange={handleChange} />,
    );

    const disabledBtn = screen.getByRole("radio", { name: "Disabled" }) as HTMLButtonElement;
    expect(disabledBtn.disabled).toBe(true);
    fireEvent.click(disabledBtn);
    expect(handleChange).not.toHaveBeenCalled();

    rerender(
      <SegmentedControl
        options={options}
        value="Enabled"
        onChange={handleChange}
        disabled={true}
      />,
    );

    const enabledBtn = screen.getByRole("radio", { name: "Enabled" }) as HTMLButtonElement;
    expect(enabledBtn.disabled).toBe(true);
    fireEvent.click(enabledBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("merges custom className on root radiogroup", () => {
    render(
      <SegmentedControl
        options={["One"]}
        value="One"
        onChange={vi.fn()}
        className="pt-2 custom-wrapper-class"
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group.className).toContain("custom-wrapper-class");
    expect(group.className).toContain("pt-2");
  });
});
