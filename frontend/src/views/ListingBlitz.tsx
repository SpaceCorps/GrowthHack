import React, { useState, useEffect } from "react";
import type { Listing } from "../types";
import {
  ListTree,
  ExternalLink,
  GitPullRequest,
  Sparkles,
  Copy,
  Check,
  Plus,
  Filter,
  Search,
  Terminal,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export interface ListingBlitzProps {
  listings: Listing[];
  onGenerateBlurb: (id: string) => void;
  onUpdateStatus: (id: string, status: any, prUrl?: string) => void;
  onCreateListing: (listing: Partial<Listing>) => void;
  onBatchGenerateBlurbs?: (category?: string, listingIds?: string[]) => Promise<any>;
  onVerifyBacklink?: (id: string) => Promise<any>;
  onSubmitUpstream?: (id: string) => Promise<any>;
  onBatchSubmitUpstream?: (category?: string, listingIds?: string[]) => Promise<any>;
  githubStatus?: { configured: boolean; username?: string; message: string };
  onSyncAllPrs?: () => Promise<any>;
  onSyncSinglePr?: (id: string) => Promise<any>;
}

export const CATEGORIES = [
  "All",
  "Awesome Repo",
  "Dev Directory",
  "Software Factory",
  "Package Manager",
  "Community",
] as const;

export function extractRepo(url: string): string | null {
  const match = url.match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return match ? match[1].replace(/\.git$/, "") : null;
}

export function extractMarkdownEntry(listing: Listing): string {
  if (listing.submission_blurb) {
    const lines = listing.submission_blurb.split("\n");
    const entryLine = lines.find((l) => l.trim().startsWith("- ["));
    if (entryLine) return entryLine.trim();
  }
  return `- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory with isolated Git worktrees and verification gates.`;
}

export function getPrTitle(listing: Listing): string {
  if (listing.category === "Awesome Repo") {
    return `Add Ivy-Tendril to Coding Agents & Developer Tools`;
  }
  return `Add Ivy-Tendril to ${listing.name}`;
}

export function getPrDescription(listing: Listing): string {
  const entry = extractMarkdownEntry(listing);
  return `## Add Ivy-Tendril to ${listing.name}

### Description
[Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) is an open-source autonomous multi-agent software factory. It plans tasks, orchestrates agents (Claude Code, Gemini, Codex) in isolated Git worktrees, and runs automated verification gates before producing pull requests.

### Category
${listing.category}

### Entry
${entry}

### Contribution Checklist
- [x] Item added in alphabetical order
- [x] Verified link to repository / official website
- [x] Concise formatting adheres to catalog guidelines
`;
}

export function getGhPrCommand(listing: Listing): string {
  const repo = extractRepo(listing.url) || "<owner/repo>";
  const title = getPrTitle(listing).replace(/"/g, '\\"');
  const body = getPrDescription(listing).replace(/"/g, '\\"');
  return `gh pr create --repo ${repo} --title "${title}" --body "${body}"`;
}

export const ListingBlitz: React.FC<ListingBlitzProps> = ({
  listings,
  onGenerateBlurb,
  onUpdateStatus,
  onCreateListing,
  onBatchGenerateBlurbs,
  onVerifyBacklink,
  onSubmitUpstream,
  onBatchSubmitUpstream,
  githubStatus,
  onSyncAllPrs,
  onSyncSinglePr,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // GitHub status & upstream submission state
  const [ghStatus, setGhStatus] = useState<{
    configured: boolean;
    username?: string;
    message: string;
  } | null>(githubStatus !== undefined ? githubStatus : null);
  const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState<boolean>(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);

  // PR sync state
  const [isSyncingAllPrs, setIsSyncingAllPrs] = useState<boolean>(false);
  const [syncPrMessage, setSyncPrMessage] = useState<string | null>(null);
  const [checkingPrMap, setCheckingPrMap] = useState<Record<string, boolean>>({});
  const [checkPrResults, setCheckPrResults] = useState<
    Record<string, { merged: boolean; message: string; status: string }>
  >({});

  useEffect(() => {
    if (githubStatus !== undefined) {
      setGhStatus(githubStatus);
      return;
    }
    fetch("/api/submissions/github-status")
      .then((res) => res.json())
      .then((data) => setGhStatus(data))
      .catch(() =>
        setGhStatus({
          configured: false,
          message: "GitHub token not configured. Set GITHUB_TOKEN environment variable.",
        }),
      );
  }, [githubStatus]);

  // Batch runner state
  const [batchCategory, setBatchCategory] = useState<string>("All");
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // Per-card expanded CLI state
  const [expandedCli, setExpandedCli] = useState<Record<string, boolean>>({});

  // Backlink verification loading and results
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});
  const [verificationResults, setVerificationResults] = useState<
    Record<string, { verified: boolean; message: string }>
  >({});

  // Add Listing Form
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Listing["category"]>("Awesome Repo");
  const [url, setUrl] = useState("");
  const [blurb, setBlurb] = useState("");
  const [notes, setNotes] = useState("");

  const filteredListings = listings.filter((l) => {
    const matchesCategory = filterCategory === "All" || l.category === filterCategory;
    const matchesStatus = filterStatus === "all" || l.status === filterStatus;
    const matchesSearch =
      searchQuery.trim() === "" ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.submission_blurb.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleCopy = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleCli = (id: string) => {
    setExpandedCli((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTriggerBatch = async () => {
    setIsBatchGenerating(true);
    setBatchMessage(null);
    try {
      if (onBatchGenerateBlurbs) {
        const catArg = batchCategory === "All" ? undefined : batchCategory;
        const res = await onBatchGenerateBlurbs(catArg);
        const count = res?.targeted_count ?? "targeted";
        setBatchMessage(`Batch generation initiated for ${count} listings!`);
      } else {
        const res = await fetch("/api/listings/generate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: batchCategory === "All" ? undefined : batchCategory,
          }),
        });
        const data = await res.json();
        setBatchMessage(data.message || "Batch generation started!");
      }
    } catch {
      setBatchMessage("Failed to start batch generation");
    } finally {
      setIsBatchGenerating(false);
      setTimeout(() => setBatchMessage(null), 5000);
    }
  };

  const handleVerifyBacklinkClick = async (id: string) => {
    setVerifyingMap((prev) => ({ ...prev, [id]: true }));
    try {
      let result;
      if (onVerifyBacklink) {
        result = await onVerifyBacklink(id);
      } else {
        const res = await fetch(`/api/listings/${id}/verify-backlink`, {
          method: "POST",
        });
        result = await res.json();
      }
      setVerificationResults((prev) => ({
        ...prev,
        [id]: {
          verified: result?.verified ?? false,
          message: result?.message ?? (result?.verified ? "Live backlink found!" : "Not verified"),
        },
      }));
      if (result?.verified) {
        onUpdateStatus(id, "Live");
      }
    } catch {
      setVerificationResults((prev) => ({
        ...prev,
        [id]: {
          verified: false,
          message: "Verification failed (network/unreachable)",
        },
      }));
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSubmitUpstreamClick = async (id: string) => {
    setSubmittingMap((prev) => ({ ...prev, [id]: true }));
    try {
      if (onSubmitUpstream) {
        await onSubmitUpstream(id);
      } else {
        await fetch(`/api/listings/${id}/submit-upstream`, { method: "POST" });
      }
      onUpdateStatus(id, "PR Submitted");
    } catch (err) {
      console.error("Submit upstream failed:", err);
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleTriggerBatchSubmit = async () => {
    setIsBatchSubmitting(true);
    setSubmissionMessage(null);
    try {
      const catArg = batchCategory === "All" ? undefined : batchCategory;
      if (onBatchSubmitUpstream) {
        const res = await onBatchSubmitUpstream(catArg);
        const count = res?.targeted_count ?? "targeted";
        setSubmissionMessage(`Batch upstream PR submission initiated for ${count} listings!`);
      } else {
        const res = await fetch("/api/listings/submit-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: catArg,
          }),
        });
        const data = await res.json();
        setSubmissionMessage(data.message || "Batch submission initiated!");
      }
    } catch {
      setSubmissionMessage("Failed to start batch upstream submission");
    } finally {
      setIsBatchSubmitting(false);
      setTimeout(() => setSubmissionMessage(null), 5000);
    }
  };

  const handleSyncAllPrs = async () => {
    setIsSyncingAllPrs(true);
    setSyncPrMessage(null);
    try {
      let data: any;
      if (onSyncAllPrs) {
        data = await onSyncAllPrs();
      } else {
        const res = await fetch("/api/listings/sync-prs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        data = await res.json();
      }
      if (data?.transitioned_ids && Array.isArray(data.transitioned_ids)) {
        for (const id of data.transitioned_ids) {
          onUpdateStatus(id, "Live");
        }
      }
      setSyncPrMessage(
        data?.message ||
          `Checked ${data?.checked_count ?? 0} PRs: ${data?.merged_count ?? 0} merged and transitioned to Live.`,
      );
    } catch {
      setSyncPrMessage("Failed to sync pull request merge statuses");
    } finally {
      setIsSyncingAllPrs(false);
      setTimeout(() => setSyncPrMessage(null), 5000);
    }
  };

  const handleCheckSinglePr = async (id: string) => {
    setCheckingPrMap((prev) => ({ ...prev, [id]: true }));
    try {
      let data: any;
      if (onSyncSinglePr) {
        data = await onSyncSinglePr(id);
      } else {
        const res = await fetch(`/api/listings/${id}/sync-pr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        data = await res.json();
      }
      setCheckPrResults((prev) => ({
        ...prev,
        [id]: {
          merged: data?.merged ?? false,
          message: data?.message ?? (data?.merged ? "PR Merged!" : "PR open"),
          status: data?.status ?? (data?.merged ? "Live" : "PR Submitted"),
        },
      }));
      if (data?.merged) {
        onUpdateStatus(id, "Live");
      }
    } catch {
      setCheckPrResults((prev) => ({
        ...prev,
        [id]: {
          merged: false,
          message: "Failed to check PR status",
          status: "Error",
        },
      }));
    } finally {
      setCheckingPrMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    onCreateListing({
      name,
      category,
      url,
      submission_blurb: blurb || `- [Ivy-Tendril](${url}) - Autonomous multi-agent coding factory.`,
      notes,
    });

    setName("");
    setUrl("");
    setBlurb("");
    setNotes("");
    setShowAddModal(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Live":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "Merged":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800";
      case "PR Submitted":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-800";
      case "Under Review":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getBlurbStatusBadge = (status?: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "Rejected":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      case "Pending":
      default:
        return "bg-amber-950/80 text-amber-300 border-amber-800";
    }
  };

  const getCategoryCount = (cat: string) => {
    if (cat === "All") return listings.length;
    return listings.filter((l) => l.category === cat).length;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ListTree className="w-4 h-4" />
            <span>Distribution Blitz // Ecosystem Repos & Catalogs</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            List Ivy-Tendril Everywhere Developers Look
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            50+ curated high-authority targets: Awesome lists, software factory registries,
            developer directories (AlternativeTo, OpenAlternative, DevHunt, LibHunt), and package
            ecosystems. Antigravity generates tailored blurbs and automated PR descriptions with
            backlink verification.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {ghStatus && ghStatus.configured && (
            <div
              data-testid="github-status-badge"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>GitHub Connected: @{ghStatus.username || "authenticated"}</span>
            </div>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Target Directory</span>
          </button>
        </div>
      </div>

      {/* GitHub Token Status Alert Banner if unconfigured */}
      {ghStatus && !ghStatus.configured && (
        <div
          data-testid="github-status-banner"
          className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">GitHub Token Unconfigured: </span>
              <span>
                {ghStatus.message ||
                  "Set GITHUB_TOKEN or GITHUB_PAT environment variable or configure in Settings to enable automated 1-click PR submissions."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">Total Targets:</span>
          <p className="text-xl font-bold text-white mt-1">{listings.length}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">PRs Submitted:</span>
          <p className="text-xl font-bold text-indigo-400 mt-1">
            {
              listings.filter((l) => l.status === "PR Submitted" || l.status === "Under Review")
                .length
            }
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">Merged PRs:</span>
          <p className="text-xl font-bold text-cyan-400 mt-1">
            {listings.filter((l) => l.status === "Merged").length}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">Live Backlinks:</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {listings.filter((l) => l.status === "Live").length}
          </p>
        </div>
      </div>

      {/* Batch Runner Bar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">
              Batch Runner: Auto-Tailor Ecosystem Blurbs
            </h4>
            <p className="text-slate-400 text-[11px]">
              Generate structure-adapted PR descriptions and catalog entries in batch with
              Antigravity
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={batchCategory}
            onChange={(e) => setBatchCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500 font-medium"
            data-testid="batch-category-select"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({getCategoryCount(cat)})
              </option>
            ))}
          </select>

          <button
            onClick={handleTriggerBatch}
            disabled={isBatchGenerating}
            data-testid="batch-generate-btn"
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition-all shadow-md shadow-cyan-950 disabled:opacity-50"
          >
            {isBatchGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isBatchGenerating ? "Running Batch..." : "Batch Generate Tailored Blurbs"}</span>
          </button>

          <button
            onClick={handleTriggerBatchSubmit}
            disabled={isBatchSubmitting}
            data-testid="batch-submit-btn"
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold transition-all shadow-md shadow-indigo-950 disabled:opacity-50"
          >
            {isBatchSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <GitPullRequest className="w-4 h-4" />
            )}
            <span>
              {isBatchSubmitting ? "Submitting Upstream..." : "Batch Submit Upstream PRs"}
            </span>
          </button>

          <button
            onClick={handleSyncAllPrs}
            disabled={isSyncingAllPrs}
            data-testid="sync-all-prs-btn"
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold transition-all shadow-md shadow-emerald-950/20 disabled:opacity-50"
          >
            {isSyncingAllPrs ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{isSyncingAllPrs ? "Syncing PRs..." : "Sync PR Status"}</span>
          </button>
        </div>
      </div>

      {batchMessage && (
        <div className="p-3 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-200 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{batchMessage}</span>
        </div>
      )}

      {submissionMessage && (
        <div
          data-testid="batch-submission-message"
          className="p-3 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-200 text-xs flex items-center space-x-2"
        >
          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          <span>{submissionMessage}</span>
        </div>
      )}

      {syncPrMessage && (
        <div
          data-testid="sync-prs-message"
          className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center space-x-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{syncPrMessage}</span>
        </div>
      )}

      {/* Category Pill Bar & Search Controls */}
      <div className="space-y-3">
        {/* Category Pill Bar */}
        <div className="flex flex-wrap items-center gap-2" data-testid="category-pill-bar">
          {CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat);
            const isActive = filterCategory === cat;
            const slug = cat.toLowerCase().replace(/\s+/g, "-");
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                data-testid={`pill-${slug}`}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  isActive
                    ? "bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-950"
                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-slate-800"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-cyan-800 text-cyan-100" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search targets by name, url, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                data-testid="status-filter"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Statuses</option>
                <option value="Targeted">Targeted</option>
                <option value="PR Submitted">PR Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Merged">Merged</option>
                <option value="Live">Live</option>
              </select>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-400">
            Showing {filteredListings.length} of {listings.length} targets
          </span>
        </div>
      </div>

      {/* Listings Table / Cards */}
      <div className="space-y-4">
        {filteredListings.map((listing) => {
          const isVerifying = verifyingMap[listing.id] || false;
          const verifyResult = verificationResults[listing.id];
          const isCliExpanded = expandedCli[listing.id] || false;
          const markdownEntry = extractMarkdownEntry(listing);
          const prTitle = getPrTitle(listing);
          const prDescription = getPrDescription(listing);
          const ghCommand = getGhPrCommand(listing);
          const isGitHub = !!extractRepo(listing.url);
          const isEligibleForSubmission =
            isGitHub && (listing.status === "Targeted" || listing.status === "Under Review");
          const isSubmitting = submittingMap[listing.id] || false;

          return (
            <div
              key={listing.id}
              data-testid={`listing-card-${listing.id}`}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-3"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-300">
                    {listing.category}
                  </span>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {listing.name}
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-cyan-400"
                      title="Open target URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {listing.submission_blurb && listing.submission_blurb.trim().length > 0 && (
                    <span
                      data-testid={`blurb-badge-${listing.id}`}
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase border ${getBlurbStatusBadge(listing.blurb_status)}`}
                    >
                      {listing.blurb_status === "Approved"
                        ? "Blurb Approved"
                        : listing.blurb_status === "Rejected"
                          ? "Blurb Rejected"
                          : "Blurb Pending Review"}
                    </span>
                  )}

                  {/* Status Dropdown */}
                  <select
                    value={listing.status}
                    onChange={(e) => onUpdateStatus(listing.id, e.target.value as any)}
                    className={`text-xs px-2.5 py-1 rounded-md border font-semibold focus:outline-none ${getStatusBadge(
                      listing.status,
                    )}`}
                    data-testid={`status-select-${listing.id}`}
                  >
                    <option value="Targeted">Targeted</option>
                    <option value="PR Submitted">PR Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Merged">Merged</option>
                    <option value="Live">Live</option>
                  </select>

                  {/* Backlink Verification Button */}
                  <button
                    onClick={() => handleVerifyBacklinkClick(listing.id)}
                    disabled={isVerifying}
                    data-testid={`verify-backlink-${listing.id}`}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{isVerifying ? "Verifying..." : "Verify Backlink"}</span>
                  </button>

                  {/* Backlink Result Badge / Chip */}
                  {verifyResult && (
                    <span
                      data-testid={`backlink-badge-${listing.id}`}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        verifyResult.verified
                          ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
                          : "bg-amber-950/90 text-amber-300 border-amber-800"
                      }`}
                    >
                      {verifyResult.verified ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      <span>
                        {verifyResult.verified ? "Verified Live" : "No backlink detected"}
                      </span>
                    </span>
                  )}

                  {listing.pr_url && (
                    <a
                      href={listing.pr_url}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`view-pr-${listing.id}`}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800 text-xs font-mono"
                    >
                      <GitPullRequest className="w-3.5 h-3.5" />
                      <span>View PR</span>
                    </a>
                  )}

                  {/* Check PR Status Button */}
                  {(listing.status === "PR Submitted" || listing.status === "Under Review") &&
                    listing.pr_url && (
                      <button
                        onClick={() => handleCheckSinglePr(listing.id)}
                        disabled={checkingPrMap[listing.id]}
                        data-testid={`check-pr-${listing.id}`}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {checkingPrMap[listing.id] ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <GitPullRequest className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{checkingPrMap[listing.id] ? "Checking..." : "Check PR Status"}</span>
                      </button>
                    )}

                  {/* Single PR Check Result Badge */}
                  {checkPrResults[listing.id] && (
                    <span
                      data-testid={`check-pr-badge-${listing.id}`}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        checkPrResults[listing.id].merged
                          ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
                          : "bg-indigo-950/90 text-indigo-300 border-indigo-800"
                      }`}
                    >
                      {checkPrResults[listing.id].merged ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-indigo-400" />
                      )}
                      <span>{checkPrResults[listing.id].message}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Submission Blurb Preview */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 relative group">
                <div className="whitespace-pre-wrap leading-relaxed pr-16 max-h-48 overflow-y-auto">
                  {listing.submission_blurb || "No submission blurb generated yet."}
                </div>
              </div>

              {/* 1-Click PR Copy Actions Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  1-Click PR Actions:
                </span>

                <button
                  onClick={() => handleCopy(`md-${listing.id}`, markdownEntry)}
                  data-testid={`copy-markdown-${listing.id}`}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  {copiedKey === `md-${listing.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>
                    {copiedKey === `md-${listing.id}` ? "Copied Entry!" : "Copy Markdown Entry"}
                  </span>
                </button>

                <button
                  onClick={() => handleCopy(`title-${listing.id}`, prTitle)}
                  data-testid={`copy-title-${listing.id}`}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  {copiedKey === `title-${listing.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>
                    {copiedKey === `title-${listing.id}` ? "Copied Title!" : "Copy PR Title"}
                  </span>
                </button>

                <button
                  onClick={() => handleCopy(`full-${listing.id}`, prDescription)}
                  data-testid={`copy-pr-${listing.id}`}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  {copiedKey === `full-${listing.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>
                    {copiedKey === `full-${listing.id}`
                      ? "Copied Description!"
                      : "Copy PR Description & Checklist"}
                  </span>
                </button>

                <button
                  onClick={() => handleToggleCli(listing.id)}
                  data-testid={`toggle-cli-${listing.id}`}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    isCliExpanded
                      ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{isCliExpanded ? "Hide gh CLI Snippet" : "View gh CLI Snippet"}</span>
                </button>
              </div>

              {/* Expandable gh pr create CLI snippet drawer */}
              {isCliExpanded && (
                <div
                  data-testid={`cli-drawer-${listing.id}`}
                  className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-xs space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                    <span className="flex items-center space-x-1.5 text-cyan-400">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>GitHub CLI Submission Command:</span>
                    </span>

                    <button
                      onClick={() => handleCopy(`gh-${listing.id}`, ghCommand)}
                      data-testid={`copy-cli-${listing.id}`}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans transition-colors"
                    >
                      {copiedKey === `gh-${listing.id}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>
                        {copiedKey === `gh-${listing.id}` ? "Copied!" : "Copy CLI Snippet"}
                      </span>
                    </button>
                  </div>

                  <pre className="text-slate-300 whitespace-pre-wrap break-all leading-relaxed bg-slate-900/80 p-2.5 rounded border border-slate-800/60 overflow-x-auto">
                    {ghCommand}
                  </pre>
                </div>
              )}

              {/* Bottom Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-slate-400 italic">
                  Notes: {listing.notes || "No notes added."}
                </span>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {isGitHub && (
                    <button
                      onClick={() => handleSubmitUpstreamClick(listing.id)}
                      disabled={isSubmitting || !isEligibleForSubmission}
                      data-testid={`submit-upstream-${listing.id}`}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        isEligibleForSubmission
                          ? "bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white border-cyan-500/40 shadow-md shadow-indigo-950"
                          : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60"
                      }`}
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-200" />
                      ) : (
                        <GitPullRequest className="w-3.5 h-3.5 text-cyan-200" />
                      )}
                      <span>{isSubmitting ? "Submitting PR..." : "Submit Upstream PR"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => onGenerateBlurb(listing.id)}
                    data-testid={`generate-blurb-${listing.id}`}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white font-semibold transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tailor PR Blurb with Antigravity</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Target Repository / Directory</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. awesome-github-actions (sdras)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Awesome Repo">Awesome Repo</option>
                    <option value="Dev Directory">Dev Directory</option>
                    <option value="Software Factory">Software Factory</option>
                    <option value="Package Manager">Package Manager</option>
                    <option value="Community">Community</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Initial Blurb / PR Markdown
                </label>
                <textarea
                  rows={2}
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  placeholder="- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - ..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Strategy Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Target 'CI/CD Agents' subsection, requires signed commit"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
