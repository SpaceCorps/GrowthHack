import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RecipeHub } from "./RecipeHub";
import type { Recipe } from "../types";

const mockRecipes: Recipe[] = [
  {
    id: "recipe-bugfixer",
    slug: "bugfixer",
    name: "Bugfixer",
    description:
      "Autonomous issue reproduction script generation, isolated worktree test creation, and targeted bug repair.",
    category: "Maintenance",
    author: "Tendril Core Team",
    author_avatar: undefined,
    version: "1.0.0",
    tags: ["bugfix", "git-worktrees", "reproduction", "automated-repair"],
    promptware_template: "name: Bugfixer\nsteps:\n  - id: reproduce\n    action: Test case",
    parameters: [
      {
        name: "issue_id",
        description: "Target GitHub issue ID or bug description",
        default_value: "42",
        required: true,
        param_type: "string",
      },
      {
        name: "test_first",
        description: "Generate failing reproduction test before implementing fix",
        default_value: "true",
        required: false,
        param_type: "boolean",
      },
    ],
    cli_snippet: "tendril run recipe/bugfixer --issue=<issue_id>",
    forks_count: 142,
    stars_count: 580,
    is_official: true,
    badge: "Core Team",
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "recipe-security-patcher",
    slug: "security-patcher",
    name: "Security Patcher",
    description:
      "Automated CVE dependency auditing, breaking-change risk analysis, and automated version bump PRs.",
    category: "Security",
    author: "Tendril Core Team",
    author_avatar: undefined,
    version: "1.0.0",
    tags: ["security", "cve", "audit", "dependencies"],
    promptware_template: "name: Security Patcher\nsteps:\n  - id: audit\n    action: CVE scan",
    parameters: [
      {
        name: "cve_id",
        description: "Target CVE identifier or dependency advisory",
        default_value: "CVE-2026-1042",
        required: true,
        param_type: "string",
      },
    ],
    cli_snippet: "tendril run recipe/security-patcher --cve=<cve_id>",
    forks_count: 89,
    stars_count: 412,
    is_official: true,
    badge: "Core Team",
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "recipe-test-generator",
    slug: "test-generator",
    name: "Test Generator",
    description:
      "Differential coverage analysis and edge-case unit and integration test synthesis with mock verification.",
    category: "Testing",
    author: "Tendril Core Team",
    author_avatar: undefined,
    version: "1.0.0",
    tags: ["testing", "coverage", "unit-tests", "edge-cases"],
    promptware_template: "name: Test Generator\nsteps:\n  - id: coverage\n    action: Map",
    parameters: [
      {
        name: "test_scope",
        description: "Target file, module, or test scope path",
        default_value: "src/api/recipes.rs",
        required: true,
        param_type: "string",
      },
    ],
    cli_snippet: "tendril run recipe/test-generator --scope=<test_scope>",
    forks_count: 215,
    stars_count: 890,
    is_official: true,
    badge: "Core Team",
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "recipe-pr-reviewer",
    slug: "pr-reviewer",
    name: "PR Reviewer",
    description:
      "Deep architectural analysis, code smell detection, and constructive review comment synthesis on open PRs.",
    category: "Code Quality",
    author: "Tendril Core Team",
    author_avatar: undefined,
    version: "1.0.0",
    tags: ["code-quality", "pr-review", "architecture", "diff-analysis"],
    promptware_template: "name: PR Reviewer\nsteps:\n  - id: diff\n    action: Audit",
    parameters: [
      {
        name: "pr_number",
        description: "Pull request number or GitHub URL",
        default_value: "105",
        required: true,
        param_type: "string",
      },
    ],
    cli_snippet: "tendril run recipe/pr-reviewer --pr=<pr_number>",
    forks_count: 178,
    stars_count: 670,
    is_official: true,
    badge: "Core Team",
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "recipe-db-migrator",
    slug: "db-migrator",
    name: "DB Migrator",
    description:
      "Schema diff detection, safe migration script generation (up and down), and backward compatibility verification.",
    category: "Database",
    author: "Tendril Core Team",
    author_avatar: undefined,
    version: "1.0.0",
    tags: ["database", "migration", "schema", "sql"],
    promptware_template: "name: DB Migrator\nsteps:\n  - id: diff\n    action: Diff schema",
    parameters: [
      {
        name: "schema_target",
        description: "Target table, model, or migration name",
        default_value: "add_recipes_table",
        required: true,
        param_type: "string",
      },
    ],
    cli_snippet: "tendril run recipe/db-migrator --name=<schema_target>",
    forks_count: 64,
    stars_count: 320,
    is_official: true,
    badge: "Core Team",
    created_at: "2026-09-10T12:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
  },
];

describe("RecipeHub View", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders all 5 seeded gold-standard recipes with category pills and tags", () => {
    render(<RecipeHub recipes={mockRecipes} />);

    // Check headings and hero badges
    expect(screen.getByText("Ready-to-Run Workflow Pack & Recipe Hub")).toBeDefined();
    expect(screen.getByText("Curated Promptware Recipes & Automation Packs")).toBeDefined();

    // Check recipe names
    expect(screen.getByText("Bugfixer")).toBeDefined();
    expect(screen.getByText("Security Patcher")).toBeDefined();
    expect(screen.getByText("Test Generator")).toBeDefined();
    expect(screen.getByText("PR Reviewer")).toBeDefined();
    expect(screen.getByText("DB Migrator")).toBeDefined();

    // Check categories and tags
    expect(screen.getAllByText("Maintenance").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Security").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Testing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Code Quality").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Database").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("reproduction")).toBeDefined();
    expect(screen.getByText("cve")).toBeDefined();
  });

  it("filters recipes by search query and category tabs", () => {
    render(<RecipeHub recipes={mockRecipes} />);

    // Initial state: all 5 visible
    expect(screen.getByText("Bugfixer")).toBeDefined();
    expect(screen.getByText("Security Patcher")).toBeDefined();

    // Filter by category: "Security"
    const securityTab = screen.getByRole("button", { name: "Security" });
    fireEvent.click(securityTab);

    expect(screen.getByText("Security Patcher")).toBeDefined();
    expect(screen.queryByText("Bugfixer")).toBeNull();
    expect(screen.queryByText("DB Migrator")).toBeNull();

    // Switch back to "All"
    const allTab = screen.getByRole("button", { name: "All" });
    fireEvent.click(allTab);
    expect(screen.getByText("Bugfixer")).toBeDefined();

    // Filter by search query
    const searchInput = screen.getByPlaceholderText(/search recipes/i);
    fireEvent.change(searchInput, { target: { value: "migrator" } });

    expect(screen.getByText("DB Migrator")).toBeDefined();
    expect(screen.queryByText("Bugfixer")).toBeNull();
    expect(screen.queryByText("Security Patcher")).toBeNull();
  });

  it("configures parameters and dynamically updates CLI snippet", () => {
    render(<RecipeHub recipes={mockRecipes} />);

    // Find and click "Customize & Run" on Bugfixer
    const customizeButtons = screen.getAllByRole("button", { name: /customize & run/i });
    fireEvent.click(customizeButtons[0]);

    // Modal should be open
    expect(screen.getByText("Configure Recipe: Bugfixer")).toBeDefined();

    // Verify initial command preview contains default issue=42
    expect(screen.getByText(/tendril run recipe\/bugfixer --issue=42/i)).toBeDefined();

    // Change parameter issue_id to 999
    const inputs = screen.getAllByRole("textbox");
    const issueInput = inputs.find((inp) => (inp as HTMLInputElement).value === "42");
    expect(issueInput).toBeDefined();
    fireEvent.change(issueInput!, { target: { value: "999" } });

    // Verify dynamic update in command preview
    expect(screen.getByText(/tendril run recipe\/bugfixer --issue=999/i)).toBeDefined();
  });

  it("copies CLI snippet to clipboard", async () => {
    render(<RecipeHub recipes={mockRecipes} />);

    // Click 1-Click Copy CLI trigger for bugfixer
    const copyTrigger = screen.getByText("tendril run recipe/bugfixer");
    fireEvent.click(copyTrigger);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("tendril run recipe/bugfixer");
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeDefined();
    });
  });

  it("opens promptware YAML drawer", () => {
    render(<RecipeHub recipes={mockRecipes} />);

    // Click "View YAML" for the first card
    const viewYamlButtons = screen.getAllByRole("button", { name: /view yaml/i });
    fireEvent.click(viewYamlButtons[0]);

    // Drawer should open and show promptware YAML specification
    expect(screen.getByText("Bugfixer Promptware")).toBeDefined();
    expect(screen.getByText(/name: Bugfixer/i)).toBeDefined();
    expect(screen.getByText(/action: Test case/i)).toBeDefined();
  });

  it("submits community recipe and awards contributor badge", async () => {
    const onRefreshMock = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "recipe-docstring-generator",
        slug: "docstring-generator",
        name: "Docstring Generator",
        category: "Code Quality",
        badge: "Community Pioneer",
        is_official: false,
      }),
    });

    render(<RecipeHub recipes={mockRecipes} onRefresh={onRefreshMock} />);

    // Open submit community recipe modal
    const openModalBtn = screen.getByRole("button", { name: /submit community recipe/i });
    fireEvent.click(openModalBtn);

    expect(screen.getAllByText("Submit Community Recipe").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/community pioneer/i).length).toBeGreaterThanOrEqual(1);

    // Fill form fields
    const nameInput = screen.getByPlaceholderText(/e\.g\. Docstring Generator/i);
    const slugInput = screen.getByPlaceholderText(/e\.g\. docstring-generator/i);
    const descInput = screen.getByPlaceholderText(/Brief description of workflow/i);

    fireEvent.change(nameInput, { target: { value: "Docstring Generator" } });
    fireEvent.change(slugInput, { target: { value: "docstring-generator" } });
    fireEvent.change(descInput, { target: { value: "Generates Google-style docstrings" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /submit recipe/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/recipes/submit",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(onRefreshMock).toHaveBeenCalled();
    });
  });
});
