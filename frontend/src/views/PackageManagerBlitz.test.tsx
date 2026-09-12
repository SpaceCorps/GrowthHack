import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { PackageManagerBlitz } from "./PackageManagerBlitz";
import type { PackageManagerTarget } from "../types";
import { setupMockFetch, createMockGhAuthStatus, setupMockClipboard } from "../test";
import type { MockFetchController, MockClipboardController } from "../test";

const mockPackages: PackageManagerTarget[] = [
  {
    id: "pkg-homebrew",
    target_key: "homebrew",
    name: "Homebrew (tap & core)",
    os: "macOS / Linux",
    registry_repo: "ivy-interactive/homebrew-tap",
    package_id: "tendril",
    install_command: "brew install ivy-interactive/tap/tendril",
    status: "PR Submitted",
    pr_url: "https://github.com/ivy-interactive/homebrew-tap/pull/1",
    manifest_filename: "tendril.rb",
    notes: "Official tap formula with dual arm64/x86_64 bottles.",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "pkg-winget",
    target_key: "winget",
    name: "Windows Package Manager (winget)",
    os: "Windows",
    registry_repo: "microsoft/winget-pkgs",
    package_id: "Ivy.Tendril",
    install_command: "winget install Ivy.Tendril",
    status: "PR Submitted",
    pr_url: "https://github.com/microsoft/winget-pkgs/pull/189204",
    manifest_filename: "Ivy.Tendril.yaml",
    notes: "Singleton manifest schema v1.6.0 with portable installers.",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "pkg-scoop",
    target_key: "scoop",
    name: "Scoop (Extras)",
    os: "Windows",
    registry_repo: "ScoopInstaller/Extras",
    package_id: "tendril",
    install_command: "scoop bucket add extras && scoop install tendril",
    status: "Under Review",
    pr_url: "https://github.com/ScoopInstaller/Extras/pull/14522",
    manifest_filename: "tendril.json",
    notes: "Submitted to Scoop Extras bucket.",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "pkg-npx",
    target_key: "npx",
    name: "npx Zero-Install",
    os: "Cross-Platform",
    registry_repo: "npm",
    package_id: "@ivy-interactive/tendril",
    install_command: "npx @ivy-interactive/tendril",
    status: "Live",
    manifest_filename: "package.json",
    notes: "Sub-60-second time-to-first-run launcher.",
    updated_at: "2026-09-10T12:00:00Z",
  },
];

describe("PackageManagerBlitz View", () => {
  let mockController: MockFetchController | null = null;
  let mockClipboard: MockClipboardController | null = null;

  beforeEach(() => {
    mockClipboard = setupMockClipboard();
    mockController = setupMockFetch({
      handlers: {
        "/api/packages/gh-auth-status": createMockGhAuthStatus(),
        "/api/packages": (url: string) => {
          const target = url.split("/")[3] || "homebrew";
          return {
            target_key: target,
            filename: `${target}.manifest`,
            language: "json",
            content: `Mock content for ${target}`,
            install_command: `install ${target}`,
            instructions: `Instructions for ${target}`,
            release_tag: "v0.8.4",
            fetched_at: "2026-09-10T12:00:00Z",
          };
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    if (mockClipboard) {
      mockClipboard.restore();
      mockClipboard = null;
    }
    if (mockController) {
      mockController.restore();
      mockController = null;
    }
  });

  it("renders install command cards for Homebrew, Winget, Scoop, and npx", () => {
    render(<PackageManagerBlitz packages={mockPackages} />);

    // Check heading and hero stats
    expect(screen.getByText("Package Manager & One-Line Install Blitz")).toBeDefined();
    expect(screen.getByText("< 60s Target")).toBeDefined();

    // Check 1-click install command texts
    expect(screen.getByText("brew install ivy-interactive/tap/tendril")).toBeDefined();
    expect(screen.getByText("winget install Ivy.Tendril")).toBeDefined();
    expect(screen.getByText("scoop bucket add extras && scoop install tendril")).toBeDefined();
    expect(screen.getByText("npx @ivy-interactive/tendril")).toBeDefined();

    // Check tracker rows and card headers
    expect(screen.getAllByText("Homebrew (tap & core)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Windows Package Manager (winget)").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("Scoop (Extras)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("npx Zero-Install").length).toBeGreaterThanOrEqual(1);
  });

  it("copies install commands to clipboard on click", () => {
    render(<PackageManagerBlitz packages={mockPackages} />);

    const copyBrewBtn = screen.getByTestId("copy-btn-homebrew");
    fireEvent.click(copyBrewBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "brew install ivy-interactive/tap/tendril",
    );

    const copyWingetBtn = screen.getByTestId("copy-btn-winget");
    fireEvent.click(copyWingetBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("winget install Ivy.Tendril");

    const copyScoopBtn = screen.getByTestId("copy-btn-scoop");
    fireEvent.click(copyScoopBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "scoop bucket add extras && scoop install tendril",
    );

    const copyNpxBtn = screen.getByTestId("copy-btn-npx");
    fireEvent.click(copyNpxBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npx @ivy-interactive/tendril");
  });

  it("opens manifest drawer and switches manifest tabs", () => {
    render(<PackageManagerBlitz packages={mockPackages} />);

    // Click main inspect button
    const inspectBtn = screen.getByTestId("inspect-manifest-btn");
    fireEvent.click(inspectBtn);

    // Manifest drawer is visible
    expect(screen.getByTestId("manifest-drawer")).toBeDefined();
    expect(screen.getByText("Package Manifest Inspector: tendril.rb")).toBeDefined();

    // Switch to winget tab
    const wingetTab = screen.getByTestId("manifest-tab-winget");
    fireEvent.click(wingetTab);
    expect(screen.getByText("Package Manifest Inspector: Ivy.Tendril.yaml")).toBeDefined();
    expect(screen.getByText(/PackageIdentifier: Ivy.Tendril/)).toBeDefined();

    // Switch to scoop tab
    const scoopTab = screen.getByTestId("manifest-tab-scoop");
    fireEvent.click(scoopTab);
    expect(screen.getByText("Package Manifest Inspector: tendril.json")).toBeDefined();
    expect(screen.getByText(/"checkver": "github"/)).toBeDefined();

    // Switch to npx tab
    const npxTab = screen.getByTestId("manifest-tab-npx");
    fireEvent.click(npxTab);
    expect(screen.getByText("Package Manifest Inspector: package.json")).toBeDefined();
    expect(screen.getByText(/"name": "@ivy-interactive\/tendril"/)).toBeDefined();

    // Test copying manifest content
    const copyManifestBtn = screen.getByTestId("copy-manifest-btn");
    fireEvent.click(copyManifestBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("updates submission status and calls onUpdatePackageStatus callback", async () => {
    const onUpdateStatus = vi.fn().mockImplementation(() => Promise.resolve());
    render(<PackageManagerBlitz packages={mockPackages} onUpdatePackageStatus={onUpdateStatus} />);

    // Open edit modal for winget
    const editBtn = screen.getByTestId("edit-status-pkg-winget");
    fireEvent.click(editBtn);

    expect(screen.getByText("Update Status: Windows Package Manager (winget)")).toBeDefined();

    // Change status to Merged
    const statusSelect = screen.getByTestId("status-select");
    fireEvent.change(statusSelect, { target: { value: "Merged" } });

    // Submit form
    const saveBtn = screen.getByTestId("save-status-btn");
    fireEvent.click(saveBtn);

    expect(onUpdateStatus).toHaveBeenCalledTimes(1);
    expect(onUpdateStatus).toHaveBeenCalledWith(
      "pkg-winget",
      expect.objectContaining({
        status: "Merged",
      }),
    );
  });

  it("loads dynamic manifest and displays live release badge on drawer open", async () => {
    const mockManifestResponse = {
      target_key: "homebrew",
      filename: "tendril.rb",
      language: "ruby",
      content: "# Live dynamic formula content v1.2.3",
      install_command: "brew install ivy-interactive/tap/tendril",
      instructions: "Dynamic tap instructions",
      release_tag: "v1.2.3",
      fetched_at: "2026-09-10T12:00:00Z",
    };

    mockController?.addHandler("/api/packages/homebrew/manifest", mockManifestResponse);

    render(<PackageManagerBlitz packages={mockPackages} />);

    // Click inspect button for homebrew
    const inspectBtn = screen.getByTestId("inspect-manifest-homebrew");
    fireEvent.click(inspectBtn);

    // Verify fetch was called with /api/packages/homebrew/manifest
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/packages/homebrew/manifest");

    // Verify release status pill shows dynamic release tag
    const releasePill = await screen.findByText(/Release: v1\.2\.3 \(Dynamic\)/);
    expect(releasePill).toBeDefined();

    // Verify code content updated from fetch
    expect(await screen.findByText("# Live dynamic formula content v1.2.3")).toBeDefined();
  });

  it("triggers manifest reload with updated release tag on refresh button click", async () => {
    mockController?.addHandler("/api/packages/homebrew/manifest", (url: string) => {
      const tag = url.includes("refresh=true") ? "v1.3.0" : "v1.2.0";
      return {
        target_key: "homebrew",
        filename: "tendril.rb",
        language: "ruby",
        content: `# Formula content ${tag}`,
        install_command: "brew install ivy-interactive/tap/tendril",
        instructions: "Dynamic tap instructions",
        release_tag: tag,
        fetched_at: "2026-09-10T12:00:00Z",
      };
    });

    render(<PackageManagerBlitz packages={mockPackages} />);

    // Open drawer
    const inspectBtn = screen.getByTestId("inspect-manifest-homebrew");
    fireEvent.click(inspectBtn);

    expect(await screen.findByText("Release: v1.2.0 (Dynamic)")).toBeDefined();

    // Click Refresh from GitHub button
    const refreshBtn = screen.getByTestId("refresh-github-btn");
    fireEvent.click(refreshBtn);

    // Verify refresh URL was requested
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/packages/homebrew/manifest?refresh=true");

    // Verify release tag updated to v1.3.0
    expect(await screen.findByText("Release: v1.3.0 (Dynamic)")).toBeDefined();
    expect(await screen.findByText("# Formula content v1.3.0")).toBeDefined();
  });

  it("renders dispatch PR action button for package targets", () => {
    render(<PackageManagerBlitz packages={mockPackages} />);

    // Winget, Scoop, Homebrew have dispatch action buttons
    expect(screen.getByTestId("dispatch-pr-pkg-winget")).toBeDefined();
    expect(screen.getByTestId("dispatch-pr-pkg-scoop")).toBeDefined();
    expect(screen.getByTestId("dispatch-pr-pkg-homebrew")).toBeDefined();

    // npx should not have dispatch PR button
    expect(screen.queryByTestId("dispatch-pr-pkg-npx")).toBeNull();
  });

  it("opens dispatch modal and triggers onDispatchPackagePr callback", async () => {
    const onDispatch = vi.fn().mockImplementation(() => Promise.resolve());
    render(<PackageManagerBlitz packages={mockPackages} onDispatchPackagePr={onDispatch} />);

    // Click dispatch button for Scoop
    const dispatchScoopBtn = screen.getByTestId("dispatch-pr-pkg-scoop");
    fireEvent.click(dispatchScoopBtn);

    // Modal opens
    const modal = screen.getByTestId("dispatch-modal");
    expect(modal).toBeDefined();
    expect(within(modal).getByText("Dispatch Upstream PR: Scoop (Extras)")).toBeDefined();
    expect(within(modal).getByText("ScoopInstaller/Extras")).toBeDefined();
    expect(within(modal).getByText(/gh repo fork ScoopInstaller\/Extras/)).toBeDefined();

    // Confirm dispatch
    const confirmBtn = screen.getByTestId("confirm-dispatch-btn");
    fireEvent.click(confirmBtn);

    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith("pkg-scoop", "0.8.4");
  });

  it("displays authenticated badge in dispatch modal when gh-auth-status returns authenticated: true", async () => {
    mockController?.addHandler(
      "/api/packages/gh-auth-status",
      createMockGhAuthStatus({
        account: "spacecorps-dev",
        message: "GitHub CLI is authenticated as @spacecorps-dev.",
      }),
    );

    render(<PackageManagerBlitz packages={mockPackages} />);

    const dispatchBtn = screen.getByTestId("dispatch-pr-pkg-winget");
    fireEvent.click(dispatchBtn);

    const badge = await screen.findByTestId("gh-auth-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("GitHub CLI Authenticated");
    expect(badge.textContent).toContain("spacecorps-dev");

    const confirmBtn = screen.getByTestId("confirm-dispatch-btn") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it("displays warning banner and gh auth login recommendation when gh-auth-status returns authenticated: false", async () => {
    mockController?.addHandler(
      "/api/packages/gh-auth-status",
      createMockGhAuthStatus({
        authenticated: false,
        account: undefined,
        message:
          "You are not logged into any GitHub hosts. Run 'gh auth login' to authenticate GitHub CLI.",
      }),
    );

    const onDispatch = vi.fn().mockImplementation(() => Promise.resolve());
    render(<PackageManagerBlitz packages={mockPackages} onDispatchPackagePr={onDispatch} />);

    const dispatchBtn = screen.getByTestId("dispatch-pr-pkg-homebrew");
    fireEvent.click(dispatchBtn);

    const warning = await screen.findByTestId("gh-auth-warning");
    expect(warning).toBeDefined();
    expect(within(warning).getByText("GitHub CLI Authentication Required")).toBeDefined();
    expect(
      within(warning).getByText(
        "You must authenticate with GitHub CLI before submitting upstream pull requests.",
      ),
    ).toBeDefined();
    expect(within(warning).getByText("gh auth login")).toBeDefined();

    // Confirm button is disabled without override
    const confirmBtn = screen.getByTestId("confirm-dispatch-btn") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    // Check override checkbox
    const skipCheckbox = screen.getByTestId("skip-auth-checkbox") as HTMLInputElement;
    fireEvent.click(skipCheckbox);
    expect(skipCheckbox.checked).toBe(true);
    expect(confirmBtn.disabled).toBe(false);

    // Click confirm dispatch with override enabled
    fireEvent.click(confirmBtn);
    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith("pkg-homebrew", "0.8.4", true);
  });

  it("triggers manifest fetch with ?tag= query parameter when release tag input changes", async () => {
    mockController?.addHandler("/api/packages/homebrew/manifest", (url: string) => {
      const isTag = url.includes("tag=v1.3.0");
      return {
        target_key: "homebrew",
        filename: "tendril.rb",
        language: "ruby",
        content: isTag ? "# Tagged formula content v1.3.0" : "# Default formula content",
        install_command: "brew install ivy-interactive/tap/tendril",
        instructions: "Dynamic tap instructions",
        release_tag: isTag ? "v1.3.0" : "v1.2.0",
        fetched_at: "2026-09-10T12:00:00Z",
      };
    });

    render(<PackageManagerBlitz packages={mockPackages} />);

    // Open drawer
    const inspectBtn = screen.getByTestId("inspect-manifest-homebrew");
    fireEvent.click(inspectBtn);

    // Find release tag input and change value
    const tagInput = await screen.findByTestId("release-tag-input");
    fireEvent.change(tagInput, { target: { value: "v1.3.0" } });

    // Verify fetch was called with tag query parameter
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("tag=v1.3.0"));
    expect(await screen.findByText("# Tagged formula content v1.3.0")).toBeDefined();
  });

  it("passes chosen release tag to dispatch handler from upstream PR dispatch modal", async () => {
    const onDispatch = vi.fn().mockImplementation(() => Promise.resolve());
    render(<PackageManagerBlitz packages={mockPackages} onDispatchPackagePr={onDispatch} />);

    // Click dispatch button for Scoop
    const dispatchScoopBtn = screen.getByTestId("dispatch-pr-pkg-scoop");
    fireEvent.click(dispatchScoopBtn);

    // Modal opens, set release tag input
    const tagInput = screen.getByTestId("dispatch-tag-input");
    fireEvent.change(tagInput, { target: { value: "v1.5.0" } });

    // Confirm dispatch
    const confirmBtn = screen.getByTestId("confirm-dispatch-btn");
    fireEvent.click(confirmBtn);

    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith("pkg-scoop", "1.5.0", "v1.5.0");
  });

  it("displays fork synchronized badge when fork-status returns is_synchronized: true", async () => {
    mockController?.addHandler("/fork-status", {
      target_key: "scoop",
      upstream_repo: "ScoopInstaller/Extras",
      fork_repo: "testuser/Extras",
      fork_exists: true,
      is_synchronized: true,
      behind_by: 0,
      ahead_by: 0,
      status: "synchronized",
      message: "Fork is synchronized with upstream.",
    });

    render(<PackageManagerBlitz packages={mockPackages} />);

    const dispatchBtn = screen.getByTestId("dispatch-pr-pkg-scoop");
    fireEvent.click(dispatchBtn);

    const badge = await screen.findByTestId("fork-status-synchronized");
    expect(badge.textContent).toContain("Fork Synchronized");
    expect(badge.textContent).toContain("testuser/Extras");
    expect(badge.textContent).toContain("ScoopInstaller/Extras");

    const confirmBtn = screen.getByTestId("confirm-dispatch-btn") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it("displays out-of-sync warning with commit count and sync button when fork is behind", async () => {
    mockController?.addHandler("/fork-status", {
      target_key: "homebrew",
      upstream_repo: "ivy-interactive/homebrew-tap",
      fork_repo: "testuser/homebrew-tap",
      fork_exists: true,
      is_synchronized: false,
      behind_by: 23,
      ahead_by: 0,
      status: "behind",
      message: "Fork is 23 commits behind upstream. Synchronize fork before dispatching.",
    });

    render(<PackageManagerBlitz packages={mockPackages} />);

    const dispatchBtn = screen.getByTestId("dispatch-pr-pkg-homebrew");
    fireEvent.click(dispatchBtn);

    const warning = await screen.findByTestId("fork-status-warning");
    expect(within(warning).getByText("Upstream Fork Out of Sync")).toBeDefined();
    expect(warning.textContent).toContain("23 commits behind");
    expect(warning.textContent).toContain("ivy-interactive/homebrew-tap");
    expect(screen.getByTestId("sync-fork-now-btn")).toBeDefined();

    // Confirm button disabled until skip checkbox is toggled
    const confirmBtn = screen.getByTestId("confirm-dispatch-btn") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    const skipCheckbox = screen.getByTestId("skip-sync-checkbox") as HTMLInputElement;
    fireEvent.click(skipCheckbox);
    expect(skipCheckbox.checked).toBe(true);
    expect(confirmBtn.disabled).toBe(false);
  });

  it("clicking Sync Fork Now triggers the sync API call and refreshes fork status", async () => {
    let forkStatusCallCount = 0;
    mockController?.addHandler("/sync-fork", { success: true, message: "Fork synchronized." });
    mockController?.addHandler("/fork-status", () => {
      forkStatusCallCount += 1;
      const synced = forkStatusCallCount > 1;
      return {
        target_key: "homebrew",
        upstream_repo: "ivy-interactive/homebrew-tap",
        fork_repo: "testuser/homebrew-tap",
        fork_exists: true,
        is_synchronized: synced,
        behind_by: synced ? 0 : 5,
        ahead_by: 0,
        status: synced ? "synchronized" : "behind",
        message: synced ? "Fork is synchronized with upstream." : "Fork is 5 commits behind.",
      };
    });

    render(<PackageManagerBlitz packages={mockPackages} />);

    const dispatchBtn = screen.getByTestId("dispatch-pr-pkg-homebrew");
    fireEvent.click(dispatchBtn);

    await screen.findByTestId("fork-status-warning");

    const syncBtn = screen.getByTestId("sync-fork-now-btn");
    fireEvent.click(syncBtn);

    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("/api/packages/pkg-homebrew/sync-fork") &&
          call[1]?.method === "POST",
      ),
    ).toBe(true);

    await screen.findByTestId("fork-status-synchronized");
    expect(screen.queryByTestId("fork-status-warning")).toBeNull();
  });
});
