import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Navigation, STORAGE_KEY_SIDEBAR_COLLAPSED } from "./Navigation";
import type { ActiveTab } from "../types";

describe("Navigation component", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
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

  it("organizes navigation items into categorized sections", () => {
    render(<Navigation {...defaultProps} />);

    expect(screen.getByText("Growth & Content")).toBeDefined();
    expect(screen.getByText("Distribution & Blitz")).toBeDefined();
    expect(screen.getByText("Tools & Diagnostics")).toBeDefined();
  });

  it("verifies the brand logo, target meter, and agent status render in the sidebar header", () => {
    const { container } = render(<Navigation {...defaultProps} />);

    expect(screen.getByText("SpaceCorps //")).toBeDefined();
    expect(screen.getByText("GrowthHack")).toBeDefined();
    expect(screen.getByText("Ivy-Tendril")).toBeDefined();
    expect(screen.getByText(/100,000 Stars/i)).toBeDefined();

    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.querySelector("nav")).not.toBeNull();
    expect(aside?.textContent).toContain("SpaceCorps //");
    expect(aside?.textContent).toContain("Antigravity");
  });

  it("collapses and expands the sidebar when the collapse toggle button is clicked", () => {
    const { container } = render(<Navigation {...defaultProps} />);

    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-64");

    const collapseBtn = screen.getByRole("button", { name: /collapse sidebar/i });
    fireEvent.click(collapseBtn);

    expect(aside?.className).toContain("lg:w-16");
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeDefined();

    const expandBtn = screen.getByRole("button", { name: /expand sidebar/i });
    fireEvent.click(expandBtn);

    expect(aside?.className).toContain("lg:w-64");
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeDefined();
  });

  it("persists collapsed state to localStorage when toggled in uncontrolled mode", () => {
    render(<Navigation {...defaultProps} />);

    const collapseBtn = screen.getByRole("button", { name: /collapse sidebar/i });
    fireEvent.click(collapseBtn);

    expect(localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED)).toBe("true");

    const expandBtn = screen.getByRole("button", { name: /expand sidebar/i });
    fireEvent.click(expandBtn);

    expect(localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED)).toBe("false");
  });

  it("rehydrates initial collapsed state from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, "true");
    const { container } = render(<Navigation {...defaultProps} />);

    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-16");
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeDefined();
  });

  it("opens and closes the mobile drawer when triggered", () => {
    const onMobileClose = vi.fn();
    const { rerender } = render(
      <Navigation {...defaultProps} isMobileOpen={false} onMobileClose={onMobileClose} />,
    );

    expect(screen.queryByTestId("mobile-backdrop")).toBeNull();

    rerender(<Navigation {...defaultProps} isMobileOpen={true} onMobileClose={onMobileClose} />);

    const backdrop = screen.getByTestId("mobile-backdrop");
    expect(backdrop).toBeDefined();
    fireEvent.click(backdrop);
    expect(onMobileClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole("button", { name: /close sidebar/i });
    fireEvent.click(closeBtn);
    expect(onMobileClose).toHaveBeenCalledTimes(2);
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
