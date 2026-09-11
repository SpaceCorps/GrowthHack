import React, { useEffect, useMemo, useState } from "react";
import type {
  AllContributorsResponse,
  ContributingGuideResponse,
  ContributorIssue,
} from "../types";
import {
  Users,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Search,
  Filter,
  Code2,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertCircle,
} from "lucide-react";

interface ContributorFlywheelProps {
  onIssueClaimed?: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  command?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "step-1",
    title: "Step 1: Clone Repository & Install Prerequisites",
    description:
      "Ensure Rust 1.95+, Node 24+, pnpm, and Vite+ (vp) are installed. Clone the repo and install dependencies.",
    command:
      "git clone https://github.com/SpaceCorps/GrowthHack.git && cd GrowthHack/frontend && vp install",
  },
  {
    id: "step-2",
    title: "Step 2: Run Local Verification Gates",
    description:
      "Run verification checks to guarantee the test suite and linters pass cleanly in under 60 seconds.",
    command: "cd backend && cargo test && cd ../frontend && vp check",
  },
  {
    id: "step-3",
    title: "Step 3: Pick & Claim a 15-Minute Good First Issue",
    description:
      "Select an unclaimed task with clear scope, affected files, and mentor contacts from the catalog below.",
  },
  {
    id: "step-4",
    title: "Step 4: Submit PR with Automated Verification",
    description:
      "Push your feature branch and open a PR with the verification badge to fast-track merge review.",
    command:
      "git checkout -b fix/contributor-task && git commit -m 'Implement beginner task' && git push origin fix/contributor-task",
  },
];

export const ContributorFlywheel: React.FC<ContributorFlywheelProps> = ({ onIssueClaimed }) => {
  const [issues, setIssues] = useState<ContributorIssue[]>([]);
  const [contributingGuide, setContributingGuide] = useState<ContributingGuideResponse | null>(
    null,
  );
  const [allContributors, setAllContributors] = useState<AllContributorsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Expanded reproduction steps
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});

  // Checklist state stored in localStorage
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("growthhack_onboarding_checklist");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Claim modal state
  const [claimingIssue, setClaimingIssue] = useState<ContributorIssue | null>(null);
  const [contributorName, setContributorName] = useState<string>("");
  const [githubHandle, setGithubHandle] = useState<string>("");
  const [githubIssueNumber, setGithubIssueNumber] = useState<string>("");
  const [autoSyncGithub, setAutoSyncGithub] = useState<boolean>(true);
  const [claimFeedback, setClaimFeedback] = useState<ContributorIssue | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchFlywheelData = async () => {
    try {
      setLoading(true);
      const [issuesRes, guideRes, contribRes] = await Promise.all([
        fetch("/api/contributors/issues").then((r) => r.json()),
        fetch("/api/contributors/contributing-md").then((r) => r.json()),
        fetch("/api/contributors/all-contributors").then((r) => r.json()),
      ]);
      setIssues(issuesRes);
      setContributingGuide(guideRes);
      setAllContributors(contribRes);
    } catch (err) {
      console.error("Failed to load contributor flywheel data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlywheelData();
  }, []);

  const handleToggleStep = (stepId: string) => {
    const updated = { ...completedSteps, [stepId]: !completedSteps[stepId] };
    setCompletedSteps(updated);
    try {
      localStorage.setItem("growthhack_onboarding_checklist", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to persist checklist state:", err);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadContributingMd = () => {
    if (!contributingGuide) return;
    const blob = new Blob([contributingGuide.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = contributingGuide.filename || "CONTRIBUTING.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleReproduction = (id: string) => {
    setExpandedIssues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenClaimModal = (issue: ContributorIssue) => {
    setClaimingIssue(issue);
    setContributorName("");
    setGithubHandle("");
    setGithubIssueNumber(issue.github_issue_number ? String(issue.github_issue_number) : "");
    setAutoSyncGithub(true);
    setClaimFeedback(null);
    setClaimError(null);
  };

  const handleCloseClaimModal = () => {
    setClaimingIssue(null);
    setClaimFeedback(null);
    setClaimError(null);
  };

  const handleConfirmClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingIssue) return;
    if (!contributorName.trim()) {
      setClaimError("Contributor name is required.");
      return;
    }

    try {
      setIsSubmittingClaim(true);
      setClaimError(null);

      const parsedIssueNumber = githubIssueNumber.trim()
        ? parseInt(githubIssueNumber.trim(), 10)
        : undefined;

      const res = await fetch(`/api/contributors/issues/${claimingIssue.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributor_name: contributorName.trim(),
          github_handle: githubHandle.trim() || undefined,
          github_issue_number: !isNaN(parsedIssueNumber as number) ? parsedIssueNumber : undefined,
          auto_sync_github: autoSyncGithub,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to claim issue.");
      }

      const updatedIssue: ContributorIssue = await res.json();
      setClaimFeedback(updatedIssue);
      await fetchFlywheelData();
      if (onIssueClaimed) {
        onIssueClaimed();
      }
    } catch (err: any) {
      setClaimError(err.message || "An error occurred while claiming the issue.");
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  // Metrics computation
  const totalIssues = issues.length;
  const unclaimedCount = useMemo(() => issues.filter((i) => !i.claimed).length, [issues]);
  const activeMentors = useMemo(() => {
    const mentors = new Set(issues.map((i) => i.mentor));
    return mentors.size;
  }, [issues]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (
        categoryFilter !== "all" &&
        issue.category.toLowerCase() !== categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (timeFilter !== "all" && issue.estimated_minutes > parseInt(timeFilter, 10)) {
        return false;
      }
      if (statusFilter === "unclaimed" && issue.claimed) {
        return false;
      }
      if (statusFilter === "claimed" && !issue.claimed) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesDesc = issue.description.toLowerCase().includes(q);
        const matchesCategory = issue.category.toLowerCase().includes(q);
        const matchesMentor = issue.mentor.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCategory && !matchesMentor) {
          return false;
        }
      }
      return true;
    });
  }, [issues, categoryFilter, timeFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-10 pb-16">
      {/* Hero & Metric Highlights */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Community Engine &middot; Fast-Track Onboarding
            </div>
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
              Contributor Flywheel & Onboarding Pipeline
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
              Accelerate your journey from initial repository clone to your first merged PR in under
              15 minutes. Pick a curated Good First Issue, run automated local verifications, and
              earn your place on the contributor grid.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{totalIssues}</div>
              <div className="text-xs text-slate-400 mt-1">Total Issues</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400" data-testid="unclaimed-count">
                {unclaimedCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">Unclaimed</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">&lt;15m</div>
              <div className="text-xs text-slate-400 mt-1">Avg Time to PR</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{activeMentors}</div>
              <div className="text-xs text-slate-400 mt-1">Active Mentors</div>
            </div>
          </div>
        </div>
      </section>

      {/* Fast-Track Onboarding Checklist */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              Fast-Track Onboarding Checklist
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Follow these four steps to set up your environment, verify tests, and ship your first
              pull request.
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {Object.values(completedSteps).filter(Boolean).length} / {ONBOARDING_STEPS.length}{" "}
            Completed
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ONBOARDING_STEPS.map((step) => {
            const isDone = !!completedSteps[step.id];
            return (
              <div
                key={step.id}
                className={`border rounded-xl p-4 transition-colors ${
                  isDone
                    ? "bg-cyan-950/20 border-cyan-800/50 text-slate-200"
                    : "bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none flex-1">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleToggleStep(step.id)}
                      data-testid={`checkbox-${step.id}`}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
                    />
                    <div>
                      <div
                        className={`text-sm font-medium ${isDone ? "text-cyan-300 line-through" : "text-slate-200"}`}
                      >
                        {step.title}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </label>
                </div>

                {step.command && (
                  <div className="mt-3 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300">
                    <span className="truncate mr-2">{step.command}</span>
                    <button
                      onClick={() => handleCopy(step.command!, `cmd-${step.id}`)}
                      data-testid={`copy-btn-${step.id}`}
                      className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                      title="Copy command"
                    >
                      {copiedKey === `cmd-${step.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Good First Issues Board */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-cyan-400" />
              Good First Issues Catalog
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Curated tasks scoped to 15-30 minutes with designated mentors and reproduction steps.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search issues, mentors, files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-issues-input"
                className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Category:
            </span>
            {["all", "Documentation", "CLI", "Frontend", "Backend", "Tests"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                data-testid={`filter-cat-${cat.toLowerCase()}`}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  categoryFilter.toLowerCase() === cat.toLowerCase()
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Max Time:</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                data-testid="time-filter-select"
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Any Duration</option>
                <option value="15">&le; 15 Minutes</option>
                <option value="20">&le; 20 Minutes</option>
                <option value="25">&le; 25 Minutes</option>
                <option value="30">&le; 30 Minutes</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="status-filter-select"
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Statuses</option>
                <option value="unclaimed">Unclaimed Only</option>
                <option value="claimed">Claimed Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Issues List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Loading contributor catalog...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl text-slate-400 text-sm">
            No contributor issues matched the selected filters.
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="issues-board"
          >
            {filteredIssues.map((issue) => {
              const isExpanded = !!expandedIssues[issue.id];
              return (
                <div
                  key={issue.id}
                  data-testid={`issue-card-${issue.id}`}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-shadow shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {issue.difficulty}
                        </span>
                        {issue.github_issue_number && (
                          <a
                            href={`https://github.com/${issue.github_repo || "SpaceCorps/GrowthHack"}/issues/${issue.github_issue_number}`}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`github-issue-badge-${issue.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                            title={`View GitHub Issue #${issue.github_issue_number}`}
                          >
                            #{issue.github_issue_number}
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                          </a>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {issue.estimated_minutes} min
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                      {issue.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                      {issue.description}
                    </p>

                    {/* Affected Files */}
                    {issue.affected_files.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Affected Files
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {issue.affected_files.map((file) => (
                            <span
                              key={file}
                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300"
                            >
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reproduction Steps Accordion */}
                    {issue.reproduction_steps.length > 0 && (
                      <div className="mt-3 border-t border-slate-800/80 pt-2">
                        <button
                          type="button"
                          onClick={() => toggleReproduction(issue.id)}
                          data-testid={`toggle-repro-${issue.id}`}
                          className="flex items-center justify-between w-full text-[11px] text-cyan-400 hover:text-cyan-300 py-1"
                        >
                          <span>Reproduction Steps ({issue.reproduction_steps.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {isExpanded && (
                          <ol className="mt-1 space-y-1 text-xs text-slate-400 list-decimal list-inside bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            {issue.reproduction_steps.map((step, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {step}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-400">
                      Mentor: <span className="text-slate-200 font-medium">{issue.mentor}</span>
                    </div>

                    {issue.claimed ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <UserCheck className="w-3.5 h-3.5" />
                          Claimed {issue.claimed_by ? `by ${issue.claimed_by}` : ""}
                        </span>
                        {issue.github_sync_status && (
                          <span
                            data-testid={`github-sync-status-${issue.id}`}
                            title={issue.github_sync_message || issue.github_sync_status}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              issue.github_sync_status.startsWith("Synced")
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : issue.github_sync_status.startsWith("Skipped")
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}
                          >
                            GitHub: {issue.github_sync_status}
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenClaimModal(issue)}
                        data-testid={`claim-btn-${issue.id}`}
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer shadow"
                      >
                        Claim Issue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CONTRIBUTING.md Studio */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-cyan-400" />
              CONTRIBUTING.md Studio
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Dynamic, validated contributor guidelines containing verified prerequisites, test
              commands, and PR templates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(contributingGuide?.content || "", "contributing-md")}
              data-testid="copy-contributing-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copiedKey === "contributing-md" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Markdown
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Markdown
                </>
              )}
            </button>
            <button
              onClick={handleDownloadContributingMd}
              data-testid="download-contributing-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download CONTRIBUTING.md
            </button>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-80 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
          {contributingGuide ? contributingGuide.content : "Loading guideline preview..."}
        </div>
      </section>

      {/* @all-contributors Grid & Badge Builder */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              @all-contributors Community Recognition
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Celebrate community members with standardized avatar grids and GitHub README badges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(allContributors?.badge_markdown || "", "badge-md")}
              data-testid="copy-badge-md-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copiedKey === "badge-md" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy Badge
            </button>
            <button
              onClick={() => handleCopy(allContributors?.html_grid || "", "grid-html")}
              data-testid="copy-grid-html-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copiedKey === "grid-html" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy HTML Grid
            </button>
          </div>
        </div>

        {/* Visual Avatar Grid Preview */}
        {allContributors && (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"
            data-testid="contributors-avatar-grid"
          >
            {allContributors.contributors.map((contributor) => (
              <div
                key={contributor.name}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col items-center text-center hover:border-slate-700 transition-colors"
              >
                <img
                  src={contributor.avatar_url}
                  alt={contributor.name}
                  className="w-14 h-14 rounded-full border-2 border-cyan-500/40 mb-2 object-cover"
                />
                <a
                  href={contributor.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-200 hover:text-cyan-400 flex items-center gap-1"
                >
                  {contributor.name}
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {contributor.contributions.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-cyan-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Claim Issue Modal */}
      {claimingIssue && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-cyan-400" />
              Claim Good First Issue
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Claim <span className="text-slate-200 font-semibold">{claimingIssue.title}</span> to
              notify mentors.
            </p>

            {claimError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{claimError}</span>
              </div>
            )}

            {claimFeedback ? (
              <div className="mt-4 space-y-4" data-testid="claim-feedback-banner">
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Issue Claimed Successfully!
                  </div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-slate-100">{claimFeedback.title}</span> is
                    now claimed by{" "}
                    <span className="font-semibold text-white">{claimFeedback.claimed_by}</span>.
                  </p>
                  <div className="mt-3 pt-3 border-t border-emerald-900/60 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">GitHub Sync Status:</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                          claimFeedback.github_sync_status?.startsWith("Synced")
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : claimFeedback.github_sync_status?.startsWith("Skipped")
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-red-500/20 text-red-300 border border-red-500/40"
                        }`}
                        data-testid="claim-feedback-sync-status"
                      >
                        {claimFeedback.github_sync_status || "Not linked"}
                      </span>
                    </div>
                    {claimFeedback.github_sync_message && (
                      <p className="text-slate-400 mt-1" data-testid="claim-feedback-sync-message">
                        {claimFeedback.github_sync_message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleCloseClaimModal}
                    data-testid="claim-modal-done-btn"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmClaim} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Full Name or Handle <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contributorName}
                    onChange={(e) => setContributorName(e.target.value)}
                    placeholder="e.g. Jane Developer"
                    data-testid="claim-name-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    GitHub Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={githubHandle}
                    onChange={(e) => setGithubHandle(e.target.value)}
                    placeholder="e.g. @janedev"
                    data-testid="claim-handle-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    GitHub Issue Number (Optional)
                  </label>
                  <input
                    type="number"
                    value={githubIssueNumber}
                    onChange={(e) => setGithubIssueNumber(e.target.value)}
                    placeholder="e.g. 14"
                    data-testid="claim-issue-number-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSyncGithub}
                      onChange={(e) => setAutoSyncGithub(e.target.checked)}
                      data-testid="claim-auto-sync-checkbox"
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-xs text-slate-300">
                      Automatically assign user and add 'claimed' label on GitHub
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseClaimModal}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClaim}
                    data-testid="submit-claim-btn"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
                  >
                    {isSubmittingClaim ? "Claiming..." : "Confirm Claim"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
