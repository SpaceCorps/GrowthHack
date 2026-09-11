import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Navigation } from "./Navigation";
import type { ActiveTab } from "../types";

describe("Navigation component", () => {
  afterEach(() => {
    cleanup();
  });
  const defaultProps = {
    activeTab: "issues" as ActiveTab,
    setActiveTab: vi.fn(),
    agentStatus: {
      is_available: true,
      agy_path: "/usr/local/bin/agy",
      version: "1.0.0",
      models: ["gemini-pro"],
      is_running: false,
    },
    issuesCount: 12,
    articlesCount: 5,
    trendsCount: 8,
    listingsCount: 15,
    packagesCount: 3,
    reviewCount: 4,
    recipesCount: 7,
    contributorsCount: 9,
    launchCount: 2,
  };

  const expectedTabs = [
    { id: "issues", label: "Direct Action Issues", count: 12 },
    { id: "articles", label: "10x Content Engine", count: 5 },
    { id: "review", label: "Approval Deck", count: 4 },
    { id: "recipes", label: "Recipe Hub & Packs", count: 7 },
    { id: "trends", label: "Trend Radar & Newsroom", count: 8 },
    { id: "demos", label: "Video Demos & LinkedIn", count: undefined },
    { id: "listings", label: "Listing & Repo Blitz", count: 15 },
    { id: "launch", label: "Launch Campaign", count: 2 },
    { id: "packages", label: "Package Blitz", count: 3 },
    { id: "contributors", label: "Contributor Flywheel", count: 9 },
    { id: "flywheel", label: "PR Flywheel", count: undefined },
    { id: "agent", label: "Antigravity Console", count: undefined },
    { id: "doctor", label: "Doctor & Demo", count: undefined },
    { id: "playground", label: "Web Playground", count: undefined },
  ];

  it("renders all 14 navigation tabs with their respective labels and icons", () => {
    render(<Navigation {...defaultProps} />);

    for (const tab of expectedTabs) {
      expect(screen.getByRole("button", { name: new RegExp(tab.label, "i") })).toBeDefined();
    }
  });

  it("applies whitespace-nowrap and shrink-0 classes to navigation items to prevent text wrapping", () => {
    render(<Navigation {...defaultProps} />);

    for (const tab of expectedTabs) {
      const button = screen.getByRole("button", { name: new RegExp(tab.label, "i") });
      expect(button.className).toContain("whitespace-nowrap");
      expect(button.className).toContain("shrink-0");

      const label = button.querySelector("span.inline");
      expect(label).not.toBeNull();
      expect(label?.className).toContain("whitespace-nowrap");
    }
  });

  it("displays numeric count badges on tabs that receive count props", () => {
    render(<Navigation {...defaultProps} />);

    for (const tab of expectedTabs) {
      if (tab.count !== undefined) {
        const button = screen.getByRole("button", { name: new RegExp(tab.label, "i") });
        expect(button.textContent).toContain(tab.count.toString());
      }
    }
  });

  it("highlights the active tab with active styling classes", () => {
    render(<Navigation {...defaultProps} activeTab="articles" />);

    const activeBtn = screen.getByRole("button", { name: /10x Content Engine/i });
    expect(activeBtn.className).toContain("bg-emerald-500/10");
    expect(activeBtn.className).toContain("text-emerald-300");

    const inactiveBtn = screen.getByRole("button", { name: /Direct Action Issues/i });
    expect(inactiveBtn.className).toContain("text-slate-400");
    expect(inactiveBtn.className).not.toContain("bg-emerald-500/10");
  });

  it("calls setActiveTab when any tab button is clicked", () => {
    const setActiveTab = vi.fn();
    render(<Navigation {...defaultProps} setActiveTab={setActiveTab} />);

    const button = screen.getByRole("button", { name: /Trend Radar & Newsroom/i });
    fireEvent.click(button);

    expect(setActiveTab).toHaveBeenCalledWith("trends");
  });

  it("renders the agent status indicator correctly in available and offline states", () => {
    const { rerender } = render(<Navigation {...defaultProps} />);
    expect(screen.getByText("Antigravity")).toBeDefined();

    rerender(
      <Navigation
        {...defaultProps}
        agentStatus={{
          is_available: false,
          agy_path: null,
          version: null,
          models: [],
          is_running: false,
        }}
      />,
    );
    expect(screen.getByText("Offline")).toBeDefined();
  });

  it("verifies the brand logo, target meter, and agent status render in the top tier", () => {
    const { container } = render(<Navigation {...defaultProps} />);

    expect(screen.getByText("SpaceCorps //")).toBeDefined();
    expect(screen.getByText("GrowthHack")).toBeDefined();
    expect(screen.getByText("Ivy-Tendril")).toBeDefined();
    expect(screen.getByText(/100,000 Stars/i)).toBeDefined();

    // Verify two tiers exist
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const tiers = header?.children;
    expect(tiers?.length).toBe(2);

    // Tier 1 contains Brand & Agent status
    expect(tiers?.[0].textContent).toContain("SpaceCorps //");
    expect(tiers?.[0].textContent).toContain("Antigravity");

    // Tier 2 contains navigation tabs
    expect(tiers?.[1].querySelector("nav")).not.toBeNull();
  });

  it("scrolls the active tab button into view when activeTab changes", () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(<Navigation {...defaultProps} activeTab="issues" />);
    expect(scrollIntoViewMock).toHaveBeenCalled();

    scrollIntoViewMock.mockClear();
    rerender(<Navigation {...defaultProps} activeTab="doctor" />);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  });
});
