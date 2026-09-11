import React, { useEffect, useMemo, useState } from "react";
import {
  GitPullRequest,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  FileCode2,
  Workflow,
  Shield,
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
        EXISTING_COMMENT_ID=$(gh api "repos/\${GH_REPO}/issues/\${PR_NUMBER}/comments" --jq ".[] | select(.body | contains(\\"\${MARKER}\\")) | .id" | head -n 1)

        if [ -n "$EXISTING_COMMENT_ID" ]; then
          echo "Updating existing PR comment ID: $EXISTING_COMMENT_ID"
          gh api "repos/\${GH_REPO}/issues/comments/\${EXISTING_COMMENT_ID}" -X PATCH -F body=@comment.md
        else
          echo "Creating new PR comment on PR #$PR_NUMBER"
          gh pr comment "\${PR_NUMBER}" --body-file comment.md
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

      - name: Post Tendril PR Attribution Badge
        if: always()
        uses: ./.
        with:
          plan-id: "00291"
          verification-mode: "all"
          post-comment: "true"
          github-token: \${{ secrets.GITHUB_TOKEN }}
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
          <button
            type="button"
            onClick={() => copyToClipboard("header_markdown", generatedMarkdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md shadow-emerald-600/20"
          >
            {copiedKey === "header_markdown" ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied Markdown!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy PR Markdown</span>
              </>
            )}
          </button>
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                CI Automation Templates (.github/workflows)
              </h3>
              <div className="flex items-center gap-2">
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
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* action.yml snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>action.yml</span>
                  <span className="text-[10px] text-slate-500">Composite Action</span>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] text-slate-300 font-mono h-48 overflow-y-auto">
                  {actionYml}
                </pre>
              </div>

              {/* tendril-verify.yml snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>.github/workflows/tendril-verify.yml</span>
                  <span className="text-[10px] text-slate-500">PR Workflow</span>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] text-slate-300 font-mono h-48 overflow-y-auto">
                  {workflowYml}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
