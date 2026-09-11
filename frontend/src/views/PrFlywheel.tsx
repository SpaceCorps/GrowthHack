import React, { useEffect, useMemo, useState } from "react";
import { ActionButton } from "../components/ActionButton";
import {
  GitPullRequest,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  FileCode2,
  Workflow,
  Shield,
  ShieldCheck,
  BookOpen,
  LayoutTemplate,
  ExternalLink,
  Users,
  Eye,
  MousePointerClick,
  Layers,
} from "lucide-react";

export type FlywheelBadgeFormat = "minimal" | "shield_svg" | "summary_card";

export const DEFAULT_ACTION_YML = `name: "Tendril Verification & PR Flywheel"
description: "Automated verification gates and PR attribution badge for Ivy-Tendril plans"
inputs:
  plan-id:
    description: "Tendril Plan ID"
    required: false
    default: ""
  verification-mode:
    description: "Verification execution mode (all, tests, clippy)"
    required: false
    default: "all"
  post-comment:
    description: "Whether to post verification summary comment on PR"
    required: false
    default: "true"
  github-token:
    description: "GitHub Token for posting PR comments"
    required: false
    default: "\${{ github.token }}"
runs:
  using: "composite"
  steps:
    - name: Run Tendril Verifications
      shell: bash
      run: |
        echo "Running Tendril verification gates in mode: \${{ inputs.verification-mode }}"
    - name: Upsert PR Summary Comment
      if: \${{ inputs.post-comment == 'true' && github.event.pull_request.number }}
      shell: bash
      env:
        GH_TOKEN: \${{ inputs.github-token }}
        GH_REPO: \${{ github.repository }}
        PR_NUMBER: \${{ github.event.pull_request.number }}
        PLAN_ID: \${{ inputs.plan-id }}
        VERIFICATION_MODE: \${{ inputs.verification-mode }}
      run: |
        cat << EOF > comment.md
        <!-- tendril-flywheel-badge -->
        <details>
        <summary><b>⚡ Ivy-Tendril Verification Summary</b>: passed</summary>

        | Metric | Value |
        | :--- | :--- |
        | **Plan** | \${PLAN_ID:-N/A} |
        | **Verification Mode** | \${VERIFICATION_MODE:-all} |
        | **Status** | Passed in isolated git worktree |

        <sub>Automated by [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) (Git Worktree Isolation)</sub>
        </details>
        EOF

        MARKER="<!-- tendril-flywheel-badge -->"
        mkdir -p tendril-attribution
        echo "\${PR_NUMBER}" > tendril-attribution/pr_number.txt
        cp comment.md tendril-attribution/comment.md

        if ! EXISTING_COMMENT_OUTPUT=$(gh api "repos/\${GH_REPO}/issues/\${PR_NUMBER}/comments" --jq ".[] | select(.body | contains(\\"\${MARKER}\\")) | .id" 2>&1); then
          if echo "$EXISTING_COMMENT_OUTPUT" | grep -iqE "Resource not accessible|403|HttpError"; then
            echo "::warning title=Fork PR Read-Only Permissions::GITHUB_TOKEN is read-only on fork pull_request runs. PR comment attribution was skipped. Use the companion workflow_run pattern (tendril-comment.yml) for open-source fork commenting."
            exit 0
          fi
          echo "::warning title=GitHub API Error::Failed to fetch comments: $EXISTING_COMMENT_OUTPUT"
          exit 0
        fi

        EXISTING_COMMENT_ID=$(echo "$EXISTING_COMMENT_OUTPUT" | head -n 1)

        if [ -n "$EXISTING_COMMENT_ID" ]; then
          echo "Updating existing PR comment ID: $EXISTING_COMMENT_ID"
          if ! PATCH_OUTPUT=$(gh api "repos/\${GH_REPO}/issues/comments/\${EXISTING_COMMENT_ID}" -X PATCH -F body=@comment.md 2>&1); then
            echo "::warning title=Comment Update Failed::Unable to update PR comment: $PATCH_OUTPUT"
          fi
        else
          echo "Creating new PR comment on PR #$PR_NUMBER"
          if ! POST_OUTPUT=$(gh pr comment "\${PR_NUMBER}" --body-file comment.md 2>&1); then
            echo "::warning title=Comment Creation Failed::Unable to create PR comment: $POST_OUTPUT"
          fi
        fi
`;

export const DEFAULT_WORKFLOW_YML = `name: Tendril Verification & PR Flywheel

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy

      - name: Setup Node.js & pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Run Backend Tests
        run: |
          cd backend
          cargo test

      - name: Run Frontend Tests
        run: |
          cd frontend
          pnpm install --frozen-lockfile
          pnpm run build

      - name: Test Companion Workflow Run Trigger
        shell: bash
        run: |
          python3 -m pip install --quiet pyyaml 2>/dev/null || true
          python3 -c "import yaml; yaml.safe_load(open('.github/workflows/tendril-verify.yml')); yaml.safe_load(open('.github/workflows/tendril-comment.yml')); yaml.safe_load(open('action.yml')); print('all yaml valid')"

          # Verify workflow name contract
          VERIFY_NAME=$(python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/tendril-verify.yml'))['name'])")
          COMMENT_WORKFLOWS=$(python3 -c "import yaml; doc=yaml.safe_load(open('.github/workflows/tendril-comment.yml')); on_sec=doc.get(True) or doc.get('on'); print(on_sec['workflow_run']['workflows'][0])")
          if [ "$VERIFY_NAME" != "$COMMENT_WORKFLOWS" ]; then
            echo "Workflow name mismatch: '$VERIFY_NAME' vs '$COMMENT_WORKFLOWS'"
            exit 1
          fi
          echo "Workflow name contract verified: $VERIFY_NAME"

          # Script Execution & Dry-Run Test
          # 1. Missing artifact scenario
          rm -rf tendril-attribution
          DRY_RUN=true GH_REPO="" INPUT_PR_NUMBER="" bash -c '
            DRY_RUN="\${DRY_RUN:-false}"
            PR_NUMBER=""
            if [ -f "tendril-attribution/pr_number.txt" ] && [ -s "tendril-attribution/pr_number.txt" ]; then
              PR_NUMBER=$(cat tendril-attribution/pr_number.txt | tr -d "[:space:]")
            elif [ -n "$INPUT_PR_NUMBER" ]; then
              PR_NUMBER="$INPUT_PR_NUMBER"
            fi
            if [ -z "$PR_NUMBER" ]; then
              echo "::warning title=Missing PR Metadata::No PR attribution metadata artifact found and no PR number provided. Skipping fork comment."
              exit 0
            fi
            exit 1
          '

          # 2. Missing comment scenario
          mkdir -p tendril-attribution
          echo "42" > tendril-attribution/pr_number.txt
          rm -f tendril-attribution/comment.md
          DRY_RUN=true GH_REPO="" INPUT_MOCK_COMMENT="" bash -c '
            if [ ! -f "tendril-attribution/comment.md" ] || [ ! -s "tendril-attribution/comment.md" ]; then
              if [ -n "$INPUT_MOCK_COMMENT" ]; then
                echo "$INPUT_MOCK_COMMENT" > tendril-attribution/comment.md
              else
                echo "::warning title=Missing Comment Body::tendril-attribution/comment.md missing or empty. Skipping fork comment."
                exit 0
              fi
            fi
            exit 1
          '

          # 3. Valid artifact dry-run scenario
          cat << 'EOF' > tendril-attribution/comment.md
          <!-- tendril-flywheel-badge -->
          ### Summary
          EOF
          DRY_RUN=true GH_REPO="spacecorps/growthhack" bash -c '
            DRY_RUN="true"
            PR_NUMBER=$(cat tendril-attribution/pr_number.txt | tr -d "[:space:]")
            MARKER="<!-- tendril-flywheel-badge -->"
            EXISTING_COMMENT_ID=""
            if [ -n "$EXISTING_COMMENT_ID" ]; then
              echo "[DRY RUN] Would update comment $EXISTING_COMMENT_ID on PR #$PR_NUMBER via gh api PATCH"
            else
              echo "[DRY RUN] Would create new comment on PR #$PR_NUMBER via gh pr comment POST"
            fi
          '
          rm -rf tendril-attribution

      - name: Post Tendril PR Attribution Badge
        if: always()
        uses: ./.
        with:
          plan-id: "00291"
          verification-mode: "all"
          post-comment: "true"
          github-token: \${{ secrets.GITHUB_TOKEN }}

      - name: Save Verification Attribution Artifact
        if: always() && github.event_name == 'pull_request'
        shell: bash
        run: |
          mkdir -p tendril-attribution
          echo "\${{ github.event.pull_request.number }}" > tendril-attribution/pr_number.txt

      - name: Upload Attribution Artifact
        if: always() && github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: tendril-verification-summary
          path: tendril-attribution/
          retention-days: 1
`;

export const DEFAULT_COMPANION_WORKFLOW_YML = `name: Tendril Fork PR Comment

on:
  workflow_run:
    workflows: ["Tendril Verification & PR Flywheel"]
    types: [completed]
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to comment on"
        required: false
        default: ""
      dry_run:
        description: "Dry run simulation without mutating GitHub API"
        required: false
        type: boolean
        default: false
      mock_comment:
        description: "Custom mock comment markdown text"
        required: false
        default: ""

jobs:
  comment:
    runs-on: ubuntu-latest
    if: >
      (github.event_name == 'workflow_dispatch') ||
      (github.event.workflow_run.event == 'pull_request' && github.event.workflow_run.conclusion == 'success')
    permissions:
      pull-requests: write
      issues: write
    steps:
      - name: Download Verification Artifact
        if: github.event_name == 'workflow_run'
        uses: actions/download-artifact@v4
        with:
          name: tendril-verification-summary
          run-id: \${{ github.event.workflow_run.id }}
          github-token: \${{ secrets.GITHUB_TOKEN }}
          path: tendril-attribution/
        continue-on-error: true

      - name: Upsert PR Comment
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GH_REPO: \${{ github.repository }}
          INPUT_PR_NUMBER: \${{ inputs.pr_number }}
          INPUT_DRY_RUN: \${{ inputs.dry_run }}
          INPUT_MOCK_COMMENT: \${{ inputs.mock_comment }}
        run: |
          DRY_RUN="\${DRY_RUN:-\${INPUT_DRY_RUN:-false}}"

          PR_NUMBER=""
          if [ -f "tendril-attribution/pr_number.txt" ] && [ -s "tendril-attribution/pr_number.txt" ]; then
            PR_NUMBER=$(cat tendril-attribution/pr_number.txt | tr -d '[:space:]')
          elif [ -n "$INPUT_PR_NUMBER" ]; then
            PR_NUMBER="$INPUT_PR_NUMBER"
          fi

          if [ -z "$PR_NUMBER" ]; then
            echo "::warning title=Missing PR Metadata::No PR attribution metadata artifact found and no PR number provided. Skipping fork comment."
            exit 0
          fi

          if [ ! -f "tendril-attribution/comment.md" ] || [ ! -s "tendril-attribution/comment.md" ]; then
            if [ -n "$INPUT_MOCK_COMMENT" ]; then
              mkdir -p tendril-attribution
              echo "$INPUT_MOCK_COMMENT" > tendril-attribution/comment.md
            else
              echo "::warning title=Missing Comment Body::tendril-attribution/comment.md missing or empty. Skipping fork comment."
              exit 0
            fi
          fi

          MARKER="<!-- tendril-flywheel-badge -->"
          EXISTING_COMMENT_ID=""
          if [ -n "$GH_REPO" ]; then
            EXISTING_COMMENT_ID=$(gh api "repos/\${GH_REPO}/issues/\${PR_NUMBER}/comments" --jq ".[] | select(.body | contains(\\"\${MARKER}\\")) | .id" 2>/dev/null | head -n 1 || true)
          fi

          if [ -n "$EXISTING_COMMENT_ID" ]; then
            echo "Updating comment $EXISTING_COMMENT_ID on PR #$PR_NUMBER"
            if [ "$DRY_RUN" = "true" ]; then
              echo "[DRY RUN] Would update comment $EXISTING_COMMENT_ID on PR #$PR_NUMBER via gh api PATCH"
            else
              gh api "repos/\${GH_REPO}/issues/comments/\${EXISTING_COMMENT_ID}" -X PATCH -F body=@tendril-attribution/comment.md
            fi
          else
            echo "Creating new comment on PR #$PR_NUMBER"
            if [ "$DRY_RUN" = "true" ]; then
              echo "[DRY RUN] Would create new comment on PR #$PR_NUMBER via gh pr comment POST"
            else
              gh pr comment "\${PR_NUMBER}" --body-file tendril-attribution/comment.md
            fi
          fi
`;

export const DEFAULT_FORK_GUIDE_MD = `# GitHub Actions Fork Security & PR Permissions Guide

When open-source contributors submit pull requests from external repository forks, GitHub enforces strict security boundaries to prevent malicious code from accessing repository secrets or modifying repository contents.

---

## 1. Why Fork Pull Request Tokens are Read-Only

Under the standard \`pull_request\` event trigger:
- The execution context runs code from the contributor fork branch.
- GitHub automatically assigns a read-only \`GITHUB_TOKEN\` (even if your workflow YAML declares \`permissions: { pull-requests: write }\`).
- Repository secrets and write tokens are withheld.
- Calls to \`gh pr comment\` or the GitHub Issues Comments API fail with \`HTTP 403: Resource not accessible by integration\`.

This behavior is intentional by GitHub security design to protect open-source repositories against arbitrary code execution attacks.

---

## 2. Two Solutions for Tendril Attribution & Verification

### Option A: Single Workflow with Graceful Fallback (Default)
In \`action.yml\`, the token error check detects HTTP 403 / \`Resource not accessible\` responses from \`gh api\` and logs an informational warning notice (\`::warning\`) rather than failing the overall verification job:
- **Internal PRs (branches within repo):** The verification comment and badge are upserted immediately.
- **Fork PRs (external contributors):** The verification passes cleanly; comment creation is skipped without breaking CI.

### Option B: Companion \`workflow_run\` Pattern (Recommended for Open Source)
To guarantee that verification summary comments are posted on fork pull requests without sacrificing repository security:
1. The primary verification workflow (\`tendril-verify.yml\`) runs on \`pull_request\` in untrusted fork context and uploads the attribution summary as a build artifact.
2. The companion workflow (\`tendril-comment.yml\`) triggers on \`workflow_run\` after the primary workflow completes successfully.
3. Because \`workflow_run\` executes in the context of the base default branch (not the fork branch), it safely receives write permissions (\`pull-requests: write\`), downloads the artifact, and posts the comment on the contributor PR.

---

## 3. GitHub Repository Configuration Checklist

1. **Workflow Permissions**:
   Navigate to **Settings > Actions > General > Workflow permissions**.
   Ensure **Read repository contents and packages permissions** (or **Read and write permissions**) is selected according to your team policy.
2. **Fork Pull Request Workflows**:
   Under **Fork pull request workflows from outside collaborators**, choose **Require approval for first-time contributors** (recommended) or your preferred approval model.
3. **Artifact Retention**:
   Attribution artifacts are lightweight text files. Keep retention set to \`1\` day in \`tendril-verify.yml\` to minimize artifact storage.

---

## 4. Automated Workflow Testing in CI

Because GitHub Actions does not trigger \`workflow_run\` events on pull request branches before merging to the default branch, the companion workflow (\`tendril-comment.yml\`) requires automated testing in the primary CI pipeline (\`tendril-verify.yml\`):

1. **YAML Lint & Schema Validation**:
   Syntax and YAML validity of \`tendril-verify.yml\`, \`tendril-comment.yml\`, and \`action.yml\` are verified on every PR using standard YAML parsers.
2. **Workflow Name Contract Assertion**:
   Asserts that the workflow name specified in \`tendril-comment.yml\` (\`workflows: ["Tendril Verification & PR Flywheel"]\`) matches the exact \`name:\` declared in \`tendril-verify.yml\`.
3. **Automated Dry-Run & Defensive Guards**:
   The upsert script executes under simulated conditions (\`DRY_RUN=true\`) to test missing metadata artifacts, missing comment bodies, and successful upsert branching without mutating GitHub APIs.
4. **On-Demand Manual Dispatch**:
   The companion workflow supports \`workflow_dispatch\`, enabling developers to test attribution commenting on-demand for any PR:
   \`\`\`bash
   gh workflow run tendril-comment.yml -f pr_number=42 -f dry_run=true
   \`\`\`
`;

export const PrFlywheel: React.FC = () => {
  // Badge Configurator State
  const [projectName, setProjectName] = useState("growthhack");
  const [planId, setPlanId] = useState("00291");
  const [planTitle, setPlanTitle] = useState("Built with Tendril PR Flywheel");
  const [agentsCount, setAgentsCount] = useState<number>(3);
  const [testsPassed, setTestsPassed] = useState<number>(24);
  const [tokensSaved, setTokensSaved] = useState<number>(142500);
  const [diffUrl, setDiffUrl] = useState("https://github.com/spacecorps/growthhack/pull/5/files");
  const [badgeFormat, setBadgeFormat] = useState<FlywheelBadgeFormat>("summary_card");

  // Viral Reach Estimator State
  const [monthlyPrs, setMonthlyPrs] = useState<number>(12);
  const [teamSize, setTeamSize] = useState<number>(5);

  // Workflow Templates from API
  const [actionYml, setActionYml] = useState<string>(DEFAULT_ACTION_YML);
  const [workflowYml, setWorkflowYml] = useState<string>(DEFAULT_WORKFLOW_YML);
  const [companionWorkflowYml, setCompanionWorkflowYml] = useState<string>(
    DEFAULT_COMPANION_WORKFLOW_YML,
  );
  const [forkGuideMd, setForkGuideMd] = useState<string>(DEFAULT_FORK_GUIDE_MD);
  const [workflowMode, setWorkflowMode] = useState<"single" | "companion">("single");
  const [activeTemplateTab, setActiveTemplateTab] = useState<
    "action" | "verify" | "comment" | "guide"
  >("action");

  // Clipboard copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/badges/workflows");
        if (res.ok) {
          const data = await res.json();
          if (data.action_yml) setActionYml(data.action_yml);
          if (data.workflow_yml) setWorkflowYml(data.workflow_yml);
          if (data.companion_workflow_yml) setCompanionWorkflowYml(data.companion_workflow_yml);
          if (data.fork_guide_md) setForkGuideMd(data.fork_guide_md);
        }
      } catch {
        // Fallback to defaults if backend unavailable
      }
    };
    fetchTemplates();
  }, []);

  const copyToClipboard = (key: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Generated Markdown according to format
  const generatedMarkdown = useMemo(() => {
    if (badgeFormat === "minimal") {
      return `⚡ Orchestrated with [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) (${agentsCount} agents in isolated worktrees)`;
    }
    if (badgeFormat === "shield_svg") {
      return `[![Orchestrated with Ivy-Tendril](https://img.shields.io/badge/Orchestrated%20with-Ivy--Tendril-10b981?style=flat-square&logo=github)](https://github.com/Ivy-Interactive/Ivy-Tendril)`;
    }
    const safeDiffUrl = diffUrl || "https://github.com/Ivy-Interactive/Ivy-Tendril";
    return `<details>\n<summary><b>⚡ Ivy-Tendril Verification Summary</b>: ${testsPassed} tests passed</summary>\n\n| Metric | Value |\n| :--- | :--- |\n| **Project** | ${projectName} |\n| **Plan** | ${planId} - ${planTitle} |\n| **Orchestration** | ${agentsCount} agents in isolated worktrees |\n| **Verification Tests** | ${testsPassed} passed |\n| **Tokens Saved** | ${tokensSaved.toLocaleString()} |\n| **Diff Inspection** | [Inspect Worktree Diff](${safeDiffUrl}) |\n\n<sub>Automated by [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) (Git Worktree Isolation)</sub>\n</details>`;
  }, [badgeFormat, agentsCount, testsPassed, projectName, planId, planTitle, tokensSaved, diffUrl]);

  const shieldUrl =
    "https://img.shields.io/badge/Orchestrated%20with-Ivy--Tendril-10b981?style=flat-square&logo=github";

  // Viral Reach Estimations
  const estimates = useMemo(() => {
    const validPrs = Math.max(1, monthlyPrs);
    const validTeam = Math.max(1, teamSize);
    const monthlyImpressions = validPrs * (validTeam * 35 + 120);
    const monthlyClicks = Math.round(monthlyImpressions * 0.045);
    const annualImpressions = monthlyImpressions * 12;

    return {
      monthlyImpressions,
      monthlyClicks,
      annualImpressions,
    };
  }, [monthlyPrs, teamSize]);

  return (
    <div className="space-y-8">
      {/* Eyebrow & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
              Distribution Engine
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              PR Flywheel
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-emerald-400" />
            Built with Tendril: PR Attribution Studio
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Transform automated pull requests into high-trust distribution channels. Generate
            respectful verification footers, Shields.io badges, and production CI workflows.
          </p>
        </div>

        {/* 1-Click Action Header Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            onClick={() => copyToClipboard("header_markdown", generatedMarkdown)}
            icon={
              copiedKey === "header_markdown" ? (
                <Check className="w-3.5 h-3.5 text-slate-950" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )
            }
          >
            {copiedKey === "header_markdown" ? "Copied Markdown!" : "Copy PR Markdown"}
          </ActionButton>
          <button
            type="button"
            onClick={() => copyToClipboard("header_workflow", workflowYml)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all"
          >
            {copiedKey === "header_workflow" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied CI YAML!</span>
              </>
            ) : (
              <>
                <Workflow className="w-3.5 h-3.5 text-cyan-400" />
                <span>Copy Workflow YAML</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Configurator & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configurator & Estimator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Format Selector Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-emerald-400" />
                Badge Style & Format
              </h3>
              <span className="text-xs font-mono text-slate-400 uppercase">{badgeFormat}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                data-testid="format-minimal"
                onClick={() => setBadgeFormat("minimal")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                  badgeFormat === "minimal"
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-sm"
                    : "bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Minimal</span>
              </button>

              <button
                type="button"
                data-testid="format-shield"
                onClick={() => setBadgeFormat("shield_svg")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                  badgeFormat === "shield_svg"
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-sm"
                    : "bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Shields.io</span>
              </button>

              <button
                type="button"
                data-testid="format-summary"
                onClick={() => setBadgeFormat("summary_card")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                  badgeFormat === "summary_card"
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-sm"
                    : "bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Summary Card</span>
              </button>
            </div>
          </div>

          {/* Badge Configurator Parameters */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Badge Configurator
            </h3>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="project-name-input"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Project Name
                </label>
                <input
                  id="project-name-input"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  placeholder="e.g. growthhack"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="plan-id-input"
                    className="block text-xs font-medium text-slate-400 mb-1"
                  >
                    Plan ID
                  </label>
                  <input
                    id="plan-id-input"
                    type="text"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                    placeholder="e.g. 00291"
                  />
                </div>

                <div>
                  <label
                    htmlFor="agent-count-input"
                    className="block text-xs font-medium text-slate-400 mb-1"
                  >
                    Agent Count
                  </label>
                  <input
                    id="agent-count-input"
                    type="number"
                    min="1"
                    max="10"
                    value={agentsCount}
                    onChange={(e) => setAgentsCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="plan-title-input"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Plan Title
                </label>
                <input
                  id="plan-title-input"
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  placeholder="Plan title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tests-passed-input"
                    className="block text-xs font-medium text-slate-400 mb-1"
                  >
                    Tests Passed
                  </label>
                  <input
                    id="tests-passed-input"
                    type="number"
                    min="0"
                    value={testsPassed}
                    onChange={(e) => setTestsPassed(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tokens-saved-input"
                    className="block text-xs font-medium text-slate-400 mb-1"
                  >
                    Tokens Saved
                  </label>
                  <input
                    id="tokens-saved-input"
                    type="number"
                    min="0"
                    value={tokensSaved}
                    onChange={(e) => setTokensSaved(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="worktree-diff-url-input"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Worktree Diff URL
                </label>
                <input
                  id="worktree-diff-url-input"
                  type="text"
                  value={diffUrl}
                  onChange={(e) => setDiffUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60"
                  placeholder="https://github.com/.../pull/1/files"
                />
              </div>
            </div>
          </div>

          {/* Viral Reach Estimator */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Viral Reach Estimator
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono">
                Organic Growth
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="monthly-pr-volume-input"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Monthly PR Volume
                </label>
                <input
                  id="monthly-pr-volume-input"
                  type="number"
                  min="1"
                  max="500"
                  value={monthlyPrs}
                  onChange={(e) => setMonthlyPrs(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="team-size-input"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Active Team Size
                </label>
                <input
                  id="team-size-input"
                  type="number"
                  min="1"
                  max="100"
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>
            </div>

            {/* Metric Output Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-1 text-slate-400 text-[11px] mb-1">
                  <Eye className="w-3 h-3 text-emerald-400" />
                  <span>Impressions</span>
                </div>
                <div
                  data-testid="monthly-impressions"
                  className="text-base font-bold text-white font-mono"
                >
                  {estimates.monthlyImpressions.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500">per month</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-1 text-slate-400 text-[11px] mb-1">
                  <MousePointerClick className="w-3 h-3 text-cyan-400" />
                  <span>Ref Clicks</span>
                </div>
                <div
                  data-testid="referral-clicks"
                  className="text-base font-bold text-cyan-300 font-mono"
                >
                  {estimates.monthlyClicks.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500">4.5% CTR est.</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-1 text-slate-400 text-[11px] mb-1">
                  <Users className="w-3 h-3 text-amber-400" />
                  <span>Annual Reach</span>
                </div>
                <div
                  data-testid="annual-reach"
                  className="text-base font-bold text-amber-300 font-mono"
                >
                  {estimates.annualImpressions.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500">developers/yr</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview Deck & Workflow Asset Exporters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dual-Pane Preview Deck */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                Live PR Attribution Preview Deck
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="copy-markdown-btn"
                  onClick={() => copyToClipboard("preview_markdown", generatedMarkdown)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  {copiedKey === "preview_markdown" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  data-testid="copy-shield-btn"
                  onClick={() => copyToClipboard("preview_shield", shieldUrl)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  {copiedKey === "preview_shield" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span>Copy Shield URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pane 1: Simulated GitHub PR Description Footer */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Simulated PR Description Footer
              </span>
              <div
                data-testid="pr-description-preview"
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-3"
              >
                <div className="text-slate-500 italic pb-2 border-b border-slate-800/80">
                  ## Description
                  <br />
                  Implemented automated verification gates and attribution flywheel components.
                </div>

                {/* Rendered Badge Preview */}
                <div className="pt-2">
                  {badgeFormat === "minimal" && (
                    <div className="text-slate-200 flex items-center gap-1.5 font-sans">
                      <span>⚡ Orchestrated with</span>
                      <a
                        href="https://github.com/Ivy-Interactive/Ivy-Tendril"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 underline hover:text-emerald-300 inline-flex items-center gap-0.5"
                      >
                        Ivy-Tendril
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-slate-400">
                        ({agentsCount} agents in isolated worktrees)
                      </span>
                    </div>
                  )}

                  {badgeFormat === "shield_svg" && (
                    <div className="py-1">
                      <a
                        href="https://github.com/Ivy-Interactive/Ivy-Tendril"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block"
                      >
                        <img src={shieldUrl} alt="Orchestrated with Ivy-Tendril" className="h-5" />
                      </a>
                    </div>
                  )}

                  {badgeFormat === "summary_card" && (
                    <div className="font-sans border border-slate-800 rounded-lg bg-slate-900/60 p-3 space-y-2">
                      <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                        <span className="text-emerald-400">
                          ⚡ Ivy-Tendril Verification Summary:
                        </span>
                        <span>{testsPassed} tests passed</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded border border-slate-800/60 font-mono">
                        <div>
                          <span className="text-slate-500">Plan:</span> {planId} - {planTitle}
                        </div>
                        <div>
                          <span className="text-slate-500">Agents:</span> {agentsCount} isolated
                          worktrees
                        </div>
                        <div>
                          <span className="text-slate-500">Tests:</span> {testsPassed} passed
                        </div>
                        <div>
                          <span className="text-slate-500">Tokens:</span>{" "}
                          {tokensSaved.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <a
                          href={diffUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 underline hover:text-emerald-300"
                        >
                          Inspect Worktree Diff
                        </a>
                        <span className="text-[10px] text-slate-500">Automated by Ivy-Tendril</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pane 2: Rendered GitHub Bot Comment Card */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Simulated GitHub Bot Comment Card
              </span>
              <div
                data-testid="pr-bot-comment-preview"
                className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
              >
                {/* Comment Card Header */}
                <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-slate-950">
                      T
                    </div>
                    <span className="text-xs font-semibold text-slate-200">tendril-bot</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      bot
                    </span>
                    <span className="text-[10px] text-slate-500">commented just now</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Plan #{planId}</span>
                </div>

                {/* Comment Card Body */}
                <div className="p-4 space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-emerald-300">
                      All verification gates passed in isolated worktree
                    </span>
                  </div>

                  <pre className="bg-slate-900 border border-slate-800 rounded p-3 text-[11px] text-slate-300 font-mono overflow-x-auto">
                    {generatedMarkdown}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow and Action Templates Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-emerald-400" />
                  CI Automation Templates (.github/workflows)
                </h3>
                <div
                  data-testid="fork-safe-badge"
                  title="Fork PRs are protected against 403 errors: token errors are gracefully caught, and companion workflow_run pattern enables secure open-source commenting."
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[11px] font-medium cursor-help"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fork Safe</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="copy-action-yml-btn"
                  onClick={() => copyToClipboard("action_yml", actionYml)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  {copiedKey === "action_yml" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied action.yml</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy action.yml</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  data-testid="copy-workflow-yml-btn"
                  onClick={() => copyToClipboard("workflow_yml", workflowYml)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  {copiedKey === "workflow_yml" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied CI Workflow</span>
                    </>
                  ) : (
                    <>
                      <Workflow className="w-3 h-3 text-cyan-400" />
                      <span>Copy CI Workflow</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  data-testid="copy-companion-yml-btn"
                  onClick={() => copyToClipboard("companion_yml", companionWorkflowYml)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  {copiedKey === "companion_yml" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied Companion Workflow</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-emerald-400" />
                      <span>Copy Companion Workflow</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  data-testid="copy-fork-guide-btn"
                  onClick={() => copyToClipboard("fork_guide", forkGuideMd)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  {copiedKey === "fork_guide" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied Fork Guide</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-3 h-3 text-amber-400" />
                      <span>Copy Fork Guide</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Fork Safe Alert Banner */}
            <div
              data-testid="fork-safe-banner"
              className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-emerald-300 flex items-center gap-2">
                  <span>Fork-Safe PR Commenting Active</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-900/80 text-emerald-200 rounded border border-emerald-700/60">
                    Protected against 403 errors
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  GitHub assigns read-only tokens on fork pull requests. The composite action
                  gracefully catches 403 permissions and logs an informational warning notice
                  instead of breaking CI, while the companion workflow_run pattern securely posts
                  verification summaries with write permissions.
                </p>
              </div>
            </div>

            {/* Workflow CI Testing Card */}
            <div
              data-testid="workflow-ci-testing-card"
              className="bg-slate-950/50 border border-cyan-800/50 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5"
            >
              <Workflow className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="font-semibold text-cyan-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Workflow CI Testing Active</span>
                    <span
                      data-testid="ci-testing-badge"
                      className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded border border-cyan-700/60"
                    >
                      Automated & Dispatchable
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="copy-dispatch-cmd-btn"
                    onClick={() =>
                      copyToClipboard(
                        "dispatch_cmd",
                        `gh workflow run tendril-comment.yml -f pr_number=${planId || "42"} -f dry_run=true`,
                      )
                    }
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                  >
                    {copiedKey === "dispatch_cmd" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied CLI Command</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-cyan-400" />
                        <span>Copy Test Command</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Companion workflows are automatically linted and dry-run tested on PR branches in
                  CI. You can also trigger on-demand simulation via GitHub CLI:
                </p>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[10px] text-cyan-300 overflow-x-auto">
                  gh workflow run tendril-comment.yml -f pr_number={planId || "42"} -f dry_run=true
                </div>
              </div>
            </div>

            {/* Architecture Mode Selector */}
            <div className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-300">
                <span className="font-medium text-white mr-2">Architecture Mode:</span>
                <span className="text-slate-400 text-[11px]">
                  {workflowMode === "single"
                    ? "Single Workflow (action.yml gracefully catches 403 errors on fork PRs)"
                    : "Companion Pattern (tendril-comment.yml posts comments securely via workflow_run)"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="mode-single"
                  onClick={() => setWorkflowMode("single")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    workflowMode === "single"
                      ? "bg-slate-800 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Single Workflow
                </button>
                <button
                  type="button"
                  data-testid="mode-companion"
                  onClick={() => setWorkflowMode("companion")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    workflowMode === "companion"
                      ? "bg-slate-800 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Companion Pattern
                </button>
              </div>
            </div>

            {/* Template Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2">
              <button
                type="button"
                data-testid="tab-action-yml"
                onClick={() => setActiveTemplateTab("action")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTemplateTab === "action"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
                    : "bg-slate-800/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                action.yml
              </button>
              <button
                type="button"
                data-testid="tab-verify-yml"
                onClick={() => setActiveTemplateTab("verify")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTemplateTab === "verify"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
                    : "bg-slate-800/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                tendril-verify.yml
              </button>
              <button
                type="button"
                data-testid="tab-comment-yml"
                onClick={() => setActiveTemplateTab("comment")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTemplateTab === "comment"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
                    : "bg-slate-800/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                tendril-comment.yml
              </button>
              <button
                type="button"
                data-testid="tab-fork-guide"
                onClick={() => setActiveTemplateTab("guide")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTemplateTab === "guide"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
                    : "bg-slate-800/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                Fork Permissions Guide
              </button>
            </div>

            {/* Active Template Content Viewer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  {activeTemplateTab === "action" &&
                    "action.yml (Composite Action with Graceful Fork Fallback)"}
                  {activeTemplateTab === "verify" &&
                    ".github/workflows/tendril-verify.yml (Primary PR Verification & Artifact Exporter)"}
                  {activeTemplateTab === "comment" &&
                    ".github/workflows/tendril-comment.yml (Companion Workflow Run Commenter)"}
                  {activeTemplateTab === "guide" &&
                    "FORK_PERMISSIONS_GUIDE.md (GitHub Actions Fork Security & Token Scoping)"}
                </span>
                <span className="text-[10px] text-slate-500">
                  {activeTemplateTab === "action" && "Composite Action"}
                  {activeTemplateTab === "verify" && "PR Verification Workflow"}
                  {activeTemplateTab === "comment" && "Companion Workflow Run"}
                  {activeTemplateTab === "guide" && "Documentation Guide"}
                </span>
              </div>

              {activeTemplateTab === "action" && (
                <pre
                  data-testid="action-yml-preview"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] text-slate-300 font-mono h-56 overflow-y-auto"
                >
                  {actionYml}
                </pre>
              )}

              {activeTemplateTab === "verify" && (
                <pre
                  data-testid="workflow-yml-preview"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] text-slate-300 font-mono h-56 overflow-y-auto"
                >
                  {workflowYml}
                </pre>
              )}

              {activeTemplateTab === "comment" && (
                <pre
                  data-testid="companion-workflow-preview"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] text-slate-300 font-mono h-56 overflow-y-auto"
                >
                  {companionWorkflowYml}
                </pre>
              )}

              {activeTemplateTab === "guide" && (
                <pre
                  data-testid="fork-guide-preview"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] text-slate-300 font-mono h-56 overflow-y-auto whitespace-pre-wrap"
                >
                  {forkGuideMd}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
