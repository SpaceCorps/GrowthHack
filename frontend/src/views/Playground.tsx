import React, { useEffect, useState, useRef } from "react";
import { ActionButton } from "../components/ActionButton";
import type {
  WorktreeFileNode,
  PlaygroundScenario,
  PlaygroundRunState,
  PlaygroundMetrics,
  BannerEmbedInfo,
  ImportIssueRequest,
  PlaygroundFileInspection,
} from "../types";
import {
  Globe,
  Play,
  RotateCcw,
  GitBranch,
  ShieldCheck,
  GitPullRequest,
  FileCode,
  Star,
  Sparkles,
  ExternalLink,
  Clock,
  X,
  Layers,
  Copy,
  Check,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Plus,
  Columns,
  Code,
} from "lucide-react";

export const scenarioIdToSlug = (id: string): string => {
  if (id.startsWith("scenario-")) {
    return id.substring("scenario-".length);
  }
  return id;
};

export const slugToScenarioId = (
  slug: string,
  scenariosList: PlaygroundScenario[],
): string | undefined => {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return undefined;

  const exact = scenariosList.find((s) => s.id === cleanSlug);
  if (exact) return exact.id;

  const prefixed = scenariosList.find((s) => s.id === `scenario-${cleanSlug}`);
  if (prefixed) return prefixed.id;

  const stripped = scenariosList.find((s) => s.id.replace(/^scenario-/, "") === cleanSlug);
  if (stripped) return stripped.id;

  return undefined;
};

export const extractScenarioSlugFromLocation = (
  hash: string,
  search: string = "",
): string | null => {
  const hashWithoutPound = hash.replace(/^#/, "");
  if (hashWithoutPound) {
    const queryIndex = hashWithoutPound.indexOf("?");
    if (queryIndex !== -1) {
      const params = new URLSearchParams(hashWithoutPound.substring(queryIndex + 1));
      const val = params.get("scenario");
      if (val) return val;
    }
    const params = new URLSearchParams(hashWithoutPound);
    const val = params.get("scenario");
    if (val) return val;
  }
  if (search) {
    const params = new URLSearchParams(search);
    const val = params.get("scenario");
    if (val) return val;
  }
  return null;
};

export const resolveBaseOrigin = (): string => {
  if (typeof window === "undefined" || !window.location) {
    return "https://tendril.run";
  }
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || !hostname) {
    return "https://tendril.run";
  }
  return window.location.origin;
};

export const Playground: React.FC = () => {
  const getInitialScenarioId = (): string => {
    if (typeof window !== "undefined") {
      const slug = extractScenarioSlugFromLocation(window.location.hash, window.location.search);
      if (slug) {
        if (slug.startsWith("scenario-") || slug.startsWith("custom-")) {
          return slug;
        }
        return `scenario-${slug}`;
      }
    }
    return "scenario-health-check";
  };

  // Scenario and simulation state
  const [scenarios, setScenarios] = useState<PlaygroundScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(getInitialScenarioId);
  const [fileTree, setFileTree] = useState<WorktreeFileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    backend: true,
    "backend/src": true,
    "backend/src/api": true,
    "backend/tests": true,
    frontend: true,
    "frontend/src": true,
  });

  const [simulationState, setSimulationState] = useState<PlaygroundRunState>({
    id: "init",
    scenario_id: "scenario-health-check",
    status: "Idle",
    current_step: 1,
    step_progress_pct: 0,
    logs: [
      "tendril.run interactive browser sandbox ready.",
      "Select a scenario or import a GitHub issue to test the 30-second loop.",
    ],
    verification_gates: [],
    diff_preview: undefined,
    pr_summary: undefined,
    elapsed_seconds: 0,
    speed_multiplier: 1.0,
  });

  const [startingSimulation, setStartingSimulation] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [metrics, setMetrics] = useState<PlaygroundMetrics | null>(null);
  const [bannerInfo, setBannerInfo] = useState<BannerEmbedInfo | null>(null);

  // File Inspection State
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    "backend/src/api/health.rs",
  );
  const [inspectedFile, setInspectedFile] = useState<PlaygroundFileInspection | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [inspectorViewMode, setInspectorViewMode] = useState<"split" | "diff" | "source">("split");
  const [showFullDiff, setShowFullDiff] = useState<boolean>(false);
  const [copiedSource, setCopiedSource] = useState<boolean>(false);

  // UI Tabs & Modals
  const [activeRightTab, setActiveRightTab] = useState<"gates" | "diff" | "pr">("gates");
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Import Issue Form State
  const [importUrl, setImportUrl] = useState<string>("");
  const [importTitle, setImportTitle] = useState<string>("");
  const [importDesc, setImportDesc] = useState<string>("");
  const [importingIssue, setImportingIssue] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch initial data and sync scenario from URL
  useEffect(() => {
    const slug = extractScenarioSlugFromLocation(window.location.hash, window.location.search);
    if (!slug) {
      if (!window.location.hash.includes("scenario=")) {
        window.location.hash = "scenario=health-check";
      }
    }
    fetchScenarios();
    fetchTree(selectedScenarioId);
    fetchStatus();
    fetchMetrics();
    fetchBanner(selectedScenarioId);
  }, []);

  // Update tree and banner when scenario changes
  useEffect(() => {
    fetchTree(selectedScenarioId);
    fetchBanner(selectedScenarioId);
  }, [selectedScenarioId]);

  // Listen for hashchange events to switch active scenario
  useEffect(() => {
    const handleHashChange = () => {
      const slug = extractScenarioSlugFromLocation(window.location.hash, window.location.search);
      if (slug) {
        const matchedId =
          slugToScenarioId(slug, scenarios) ||
          (slug.startsWith("scenario-") || slug.startsWith("custom-") ? slug : `scenario-${slug}`);
        if (matchedId && matchedId !== selectedScenarioId) {
          setSelectedScenarioId(matchedId);
        }
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [scenarios, selectedScenarioId]);

  // Polling simulation status while running
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (simulationState.status === "Running") {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/playground/status");
          if (res.ok) {
            const data: PlaygroundRunState = await res.json();
            setSimulationState(data);
            if (data.status === "Completed") {
              setShowCelebrationModal(true);
              fetchMetrics();
            }
          }
        } catch (err) {
          console.error("Failed to poll playground status:", err);
        }
      }, 350);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [simulationState.status]);

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simulationState.logs]);

  const fetchScenarios = async () => {
    try {
      const res = await fetch("/api/playground/scenarios");
      if (res.ok) {
        const data: PlaygroundScenario[] = await res.json();
        setScenarios(data);

        const slug = extractScenarioSlugFromLocation(window.location.hash, window.location.search);
        if (slug) {
          const matchedId = slugToScenarioId(slug, data);
          if (matchedId) {
            setSelectedScenarioId(matchedId);
            fetchTree(matchedId);
            fetchBanner(matchedId);
          }
        } else {
          setSelectedScenarioId("scenario-health-check");
          if (!window.location.hash.includes("scenario=")) {
            window.location.hash = "scenario=health-check";
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch scenarios:", err);
    }
  };

  const findFirstModifiedFile = (nodes: WorktreeFileNode[]): string | null => {
    for (const node of nodes) {
      if (!node.is_dir && node.status !== "Unchanged") {
        return node.path;
      }
      if (node.children) {
        const found = findFirstModifiedFile(node.children);
        if (found) return found;
      }
    }
    for (const node of nodes) {
      if (!node.is_dir) return node.path;
      if (node.children) {
        const found = findFirstModifiedFile(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const fetchFileContent = async (scenarioId: string, filePath: string) => {
    setLoadingFile(true);
    try {
      const res = await fetch(
        `/api/playground/file-content?scenario_id=${encodeURIComponent(
          scenarioId,
        )}&path=${encodeURIComponent(filePath)}`,
      );
      if (res.ok) {
        const data: PlaygroundFileInspection = await res.json();
        setInspectedFile(data);
      } else {
        setInspectedFile(null);
      }
    } catch (err) {
      console.error("Failed to fetch file content:", err);
      setInspectedFile(null);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSelectFile = (filePath: string) => {
    setSelectedFilePath(filePath);
    setActiveRightTab("diff");
    setShowFullDiff(false);
    fetchFileContent(selectedScenarioId, filePath);
  };

  const copySourceCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    }
  };

  const fetchTree = async (scenarioId: string) => {
    try {
      const res = await fetch(`/api/playground/tree?scenario_id=${encodeURIComponent(scenarioId)}`);
      if (res.ok) {
        const data: WorktreeFileNode[] = await res.json();
        setFileTree(data);
        const targetFile = findFirstModifiedFile(data) || "backend/src/api/health.rs";
        setSelectedFilePath(targetFile);
        fetchFileContent(scenarioId, targetFile);
      }
    } catch (err) {
      console.error("Failed to fetch worktree tree:", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/playground/status");
      if (res.ok) {
        const data: PlaygroundRunState = await res.json();
        setSimulationState(data);
      }
    } catch (err) {
      console.error("Failed to fetch playground status:", err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/playground/metrics");
      if (res.ok) {
        const data: PlaygroundMetrics = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch playground metrics:", err);
    }
  };

  const fetchBanner = async (scenarioId?: string) => {
    try {
      const targetId = scenarioId || selectedScenarioId;
      const res = await fetch(`/api/playground/banner?scenario_id=${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data: BannerEmbedInfo = await res.json();
        setBannerInfo(data);
      }
    } catch (err) {
      console.error("Failed to fetch banner info:", err);
    }
  };

  const handleSelectScenario = (id: string) => {
    if (simulationState.status === "Running") return;
    setSelectedScenarioId(id);
    const slug = scenarioIdToSlug(id);
    window.location.hash = `scenario=${slug}`;
  };

  const getShareUrl = (scenarioId?: string): string => {
    const id = scenarioId || selectedScenarioId;
    const slug = scenarioIdToSlug(id);
    const origin = resolveBaseOrigin();
    return `${origin}/#scenario=${slug}`;
  };

  const handleShareScenario = async (scenarioId?: string) => {
    const shareUrl = getShareUrl(scenarioId);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy share link:", err);
    }
  };

  const startSimulation = async () => {
    setStartingSimulation(true);
    try {
      const res = await fetch("/api/playground/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: selectedScenarioId,
          speed_multiplier: speedMultiplier,
        }),
      });
      if (res.ok) {
        const data: PlaygroundRunState = await res.json();
        setSimulationState(data);
      }
    } catch (err) {
      console.error("Failed to start playground simulation:", err);
    } finally {
      setStartingSimulation(false);
    }
  };

  const resetSimulation = async () => {
    try {
      const res = await fetch("/api/playground/reset", { method: "POST" });
      if (res.ok) {
        const data: PlaygroundRunState = await res.json();
        setSimulationState(data);
        setShowCelebrationModal(false);
      }
    } catch (err) {
      console.error("Failed to reset playground simulation:", err);
    }
  };

  const handleImportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingIssue(true);
    try {
      const payload: ImportIssueRequest = {
        issue_url: importUrl.trim() || undefined,
        title: importTitle.trim() || undefined,
        description: importDesc.trim() || undefined,
      };

      const res = await fetch("/api/playground/import-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newScenario: PlaygroundScenario = await res.json();
        setScenarios((prev) => [newScenario, ...prev]);
        setSelectedScenarioId(newScenario.id);
        const slug = scenarioIdToSlug(newScenario.id);
        window.location.hash = `scenario=${slug}`;
        setShowImportModal(false);
        setImportUrl("");
        setImportTitle("");
        setImportDesc("");
        fetchMetrics();
      }
    } catch (err) {
      console.error("Failed to import custom issue:", err);
    } finally {
      setImportingIssue(false);
    }
  };

  const handleStarClick = async () => {
    try {
      await fetch("/api/playground/star-click", { method: "POST" });
      fetchMetrics();
    } catch (err) {
      console.error("Failed to record star click:", err);
    }
    window.open("https://github.com/Ivy-Interactive/Ivy-Tendril", "_blank");
  };

  const copyToClipboard = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const steps = [
    { number: 1, title: "Issue Intake", icon: Layers, desc: "Specification & plan parsing" },
    { number: 2, title: "Ephemeral Worktree", icon: GitBranch, desc: "Zero-risk git sandbox" },
    { number: 3, title: "Verification Gates", icon: ShieldCheck, desc: "Linters & test suites" },
    { number: 4, title: "Verified PR Diff", icon: GitPullRequest, desc: "Clean merge ready" },
  ];

  const renderTreeNode = (node: WorktreeFileNode, depth: number = 0) => {
    if (node.is_dir) {
      const isExpanded = !!expandedFolders[node.path];
      return (
        <div key={node.path} className="select-none">
          <button
            onClick={() => toggleFolder(node.path)}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 hover:bg-slate-800/60 rounded text-left transition-colors group cursor-pointer"
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-cyan-400" />
            ) : (
              <Folder className="w-4 h-4 text-cyan-500" />
            )}
            <span className="text-xs font-mono text-slate-200 group-hover:text-white">
              {node.name}
            </span>
            {node.status !== "Unchanged" && (
              <span
                className={`ml-auto text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                  node.status === "Created"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                {node.status}
              </span>
            )}
          </button>
          {isExpanded && node.children && (
            <div>{node.children.map((child) => renderTreeNode(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    const isSelected = selectedFilePath === node.path;
    return (
      <button
        key={node.path}
        type="button"
        onClick={() => handleSelectFile(node.path)}
        className={`w-full flex items-center gap-1.5 py-1 px-1.5 rounded transition-colors group cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
          isSelected
            ? "bg-cyan-500/20 text-white border-l-2 border-cyan-400 font-semibold shadow-sm"
            : "hover:bg-slate-800/40"
        }`}
        style={{ paddingLeft: `${depth * 14 + 20}px` }}
      >
        <FileText
          className={`w-3.5 h-3.5 shrink-0 ${
            isSelected ? "text-cyan-300" : "text-slate-400 group-hover:text-slate-200"
          }`}
        />
        <span
          className={`text-xs font-mono truncate ${
            isSelected ? "text-white" : "text-slate-300 group-hover:text-white"
          }`}
        >
          {node.name}
        </span>
        {node.status !== "Unchanged" && (
          <span
            className={`ml-auto text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase shrink-0 ${
              node.status === "Created"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {node.status}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
                <Globe className="w-6 h-6" />
              </span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                  tendril.run // Interactive Sandbox
                </span>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Interactive Browser Web Playground
                </h1>
              </div>
            </div>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              Experience Tendril's issue-to-verified-PR workflow in your browser in 30 seconds. Zero
              local installs required: watch autonomous planning, ephemeral git worktree isolation,
              verification gates, and syntax-highlighted PR diff generation.
            </p>
          </div>

          {/* Metrics & Action Strip */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-950/70 border border-slate-800 rounded-lg p-3">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-xs text-slate-400">Walkthroughs</div>
              <div className="text-lg font-bold text-cyan-400">
                {metrics?.walkthroughs_completed || 0}
              </div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-xs text-slate-400">Avg Time</div>
              <div className="text-lg font-bold text-emerald-400">
                {metrics?.avg_completion_seconds
                  ? `${metrics.avg_completion_seconds.toFixed(1)}s`
                  : "28.6s"}
              </div>
            </div>
            <div className="text-center px-2 flex items-center gap-2">
              <button
                onClick={() => handleShareScenario()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-md text-xs font-semibold transition-all cursor-pointer"
                title="Copy share link for this scenario"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Share Scenario</span>
                  </>
                )}
              </button>
              <button
                onClick={handleStarClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md text-xs font-semibold transition-all cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>Star on GitHub</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Selector & Custom Intake Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Choose Developer Scenario or Import Custom GitHub Issue
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select one of our curated high-velocity engineering scenarios, or paste any public
              GitHub issue.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleShareScenario()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              {shareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Share Link</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Import Custom GitHub Issue
            </button>
          </div>
        </div>

        {/* Curated Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scenarios.map((sc) => {
            const isSelected = selectedScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc.id)}
                disabled={simulationState.status === "Running"}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-md"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white line-clamp-1">{sc.title}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />}
                </div>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {sc.description}
                </p>
                {sc.labels && sc.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sc.labels.map((label, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono border border-slate-700/50"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500 font-mono">
                  <span>Branch: {sc.target_branch}</span>
                  <span className="text-cyan-400 font-semibold">~{sc.estimated_seconds}s run</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stepper & Execution Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-400" />
              Autonomous Pipeline Stepper
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-400">
                Current scenario:{" "}
                <span className="text-white font-semibold">{activeScenario?.title}</span>
              </p>
              {activeScenario?.issue_url && (
                <a
                  href={activeScenario.issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View GitHub Issue</span>
                </a>
              )}
            </div>
            {activeScenario?.labels && activeScenario.labels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {activeScenario.labels.map((label, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono font-medium"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Speed Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
              <span className="px-2 text-slate-500 font-medium">Speed:</span>
              {[
                { val: 1.0, label: "1x Real" },
                { val: 2.0, label: "2x Fast" },
                { val: 5.0, label: "5x Turbo" },
              ].map((sp) => (
                <button
                  key={sp.val}
                  onClick={() => setSpeedMultiplier(sp.val)}
                  disabled={simulationState.status === "Running"}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    speedMultiplier === sp.val
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>

            <button
              onClick={resetSimulation}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>

            <ActionButton
              onClick={startSimulation}
              loading={startingSimulation || simulationState.status === "Running"}
              loadingText="Simulating..."
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
            >
              {simulationState.status === "Completed"
                ? "Re-Run 30s Simulation"
                : "Start Simulation (30s)"}
            </ActionButton>
          </div>
        </div>

        {/* 4-Step Stepper Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Pipeline Stage: {simulationState.current_step} / 4
            </span>
            <span className="font-mono text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Elapsed: {simulationState.elapsed_seconds.toFixed(1)}s (Target: &lt;30s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted =
                simulationState.current_step > step.number ||
                simulationState.status === "Completed";
              const isCurrent =
                simulationState.current_step === step.number &&
                simulationState.status === "Running";

              return (
                <div
                  key={step.number}
                  className={`p-4 rounded-xl border relative transition-all ${
                    isCurrent
                      ? "bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500/30"
                      : isCompleted
                        ? "bg-emerald-500/10 border-emerald-500/40"
                        : "bg-slate-950/60 border-slate-800 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCompleted
                          ? "bg-emerald-500 text-slate-950"
                          : isCurrent
                            ? "bg-cyan-500 text-slate-950 animate-pulse"
                            : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.number}
                    </span>
                    <Icon
                      className={`w-5 h-5 ${
                        isCompleted
                          ? "text-emerald-400"
                          : isCurrent
                            ? "text-cyan-400 animate-bounce"
                            : "text-slate-500"
                      }`}
                    />
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-bold text-white">{step.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${simulationState.step_progress_pct}%` }}
            />
          </div>
        </div>

        {/* Three-Column Interactive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
          {/* Column 1: Simulated Worktree Tree (3 cols) */}
          <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col h-96 overflow-hidden">
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                Worktree Sandbox
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ephemeral</span>
            </div>
            <div className="p-2 overflow-y-auto flex-1 space-y-0.5">
              {fileTree.length > 0 ? (
                fileTree.map((node) => renderTreeNode(node))
              ) : (
                <div className="text-xs text-slate-500 p-4 text-center">
                  Loading worktree file tree...
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Live Agent Terminal (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col h-96 overflow-hidden">
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-xs font-mono text-slate-400 ml-2">
                  agent-terminal // stdout
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-cyan-300">
                {simulationState.status}
              </span>
            </div>

            <div className="p-3.5 font-mono text-xs text-slate-300 flex-1 overflow-y-auto space-y-1.5">
              {simulationState.logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed flex items-start gap-2">
                  <span className="text-slate-600 select-none">&gt;</span>
                  <span
                    className={
                      log.includes("PASS") || log.includes("successfully")
                        ? "text-emerald-400 font-semibold"
                        : log.includes("Error")
                          ? "text-rose-400"
                          : log.includes("Step")
                            ? "text-cyan-300 font-semibold"
                            : "text-slate-300"
                    }
                  >
                    {log}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Column 3: Verification Gates & Diff Viewer (4 cols) */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col h-96 overflow-hidden">
            <div className="p-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveRightTab("gates")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    activeRightTab === "gates"
                      ? "bg-slate-800 text-cyan-300 border border-slate-700"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Gates (
                  {simulationState.verification_gates.filter((g) => g.status === "Passed").length}
                  /5)
                </button>
                <button
                  onClick={() => setActiveRightTab("diff")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    activeRightTab === "diff"
                      ? "bg-slate-800 text-cyan-300 border border-slate-700"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="hidden sm:inline">Code &amp; </span>
                  <span>Diff</span>
                </button>
                <button
                  onClick={() => setActiveRightTab("pr")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    activeRightTab === "pr"
                      ? "bg-slate-800 text-cyan-300 border border-slate-700"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  PR Summary
                </button>
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
              {activeRightTab === "gates" && (
                <div className="space-y-2">
                  {simulationState.verification_gates.map((gate) => (
                    <div
                      key={gate.name}
                      className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {gate.status === "Passed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : gate.status === "Running" ? (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-600" />
                          )}
                          {gate.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                            gate.status === "Passed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : gate.status === "Running"
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {gate.status}
                        </span>
                      </div>
                      <code className="text-[10px] text-slate-400 font-mono block bg-slate-950/60 px-1.5 py-0.5 rounded truncate">
                        {gate.command}
                      </code>
                      <p className="text-[11px] text-slate-400 leading-tight pt-0.5">
                        {gate.output}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeRightTab === "diff" && (
                <div className="flex flex-col h-full space-y-2">
                  {/* File inspector header toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span
                        className="font-mono text-slate-200 truncate font-semibold"
                        title={inspectedFile?.path || selectedFilePath || ""}
                      >
                        {inspectedFile?.path || selectedFilePath || "No file selected"}
                      </span>
                      {inspectedFile && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0 ${
                            inspectedFile.status === "Created"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : inspectedFile.status === "Modified"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {inspectedFile.status}
                        </span>
                      )}
                      {inspectedFile && (
                        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                          {inspectedFile.line_count} lines ({inspectedFile.language})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* View mode toggle buttons */}
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setInspectorViewMode("split")}
                          className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            inspectorViewMode === "split"
                              ? "bg-cyan-600 text-white font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Side by side split view"
                        >
                          <Columns className="w-3 h-3" />
                          <span>Split</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorViewMode("source")}
                          className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            inspectorViewMode === "source"
                              ? "bg-cyan-600 text-white font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Source code only"
                        >
                          <Code className="w-3 h-3" />
                          <span>Source</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorViewMode("diff")}
                          className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            inspectorViewMode === "diff"
                              ? "bg-cyan-600 text-white font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Diff only"
                        >
                          <GitPullRequest className="w-3 h-3" />
                          <span>Diff</span>
                        </button>
                      </div>

                      {/* Copy source code button */}
                      {inspectedFile && (
                        <button
                          type="button"
                          onClick={() => copySourceCode(inspectedFile.content)}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium transition-colors cursor-pointer"
                          title="Copy source code"
                        >
                          {copiedSource ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Main Inspector Code & Diff Panes */}
                  {loadingFile ? (
                    <div className="flex items-center justify-center py-16 text-xs text-slate-500 font-mono">
                      Loading file content &amp; diff...
                    </div>
                  ) : inspectedFile ? (
                    <div
                      className={`grid gap-2 overflow-hidden flex-1 ${
                        inspectorViewMode === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {/* Left Pane: Source Code */}
                      {(inspectorViewMode === "split" || inspectorViewMode === "source") && (
                        <div className="flex flex-col bg-slate-950 border border-slate-900 rounded-lg overflow-hidden h-72">
                          <div className="px-2.5 py-1 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between shrink-0">
                            <span className="truncate">Source: {inspectedFile.name}</span>
                            <span className="text-cyan-400">{inspectedFile.language}</span>
                          </div>
                          <div className="flex-1 overflow-auto p-2 font-mono text-xs flex leading-5">
                            {/* Gutter with line numbers */}
                            <div className="select-none text-slate-600 text-right pr-2.5 mr-2.5 border-r border-slate-800">
                              {inspectedFile.content.split("\n").map((_, idx) => (
                                <div key={idx}>{idx + 1}</div>
                              ))}
                            </div>
                            {/* Monospace Code */}
                            <pre className="text-slate-200 whitespace-pre overflow-x-auto flex-1">
                              <code>{inspectedFile.content}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Right Pane: Unified Diff */}
                      {(inspectorViewMode === "split" || inspectorViewMode === "diff") && (
                        <div className="flex flex-col bg-slate-950 border border-slate-900 rounded-lg overflow-hidden h-72">
                          <div className="px-2.5 py-1 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between shrink-0">
                            <span>Unified Diff</span>
                            {inspectedFile.status !== "Unchanged" && (
                              <button
                                type="button"
                                onClick={() => setShowFullDiff(!showFullDiff)}
                                className="text-cyan-400 hover:text-cyan-300 text-[10px] cursor-pointer"
                              >
                                {showFullDiff ? "Show File Diff" : "Show Full Diff"}
                              </button>
                            )}
                          </div>
                          <div className="flex-1 overflow-auto p-2 font-mono text-xs">
                            {inspectedFile.status === "Unchanged" && !showFullDiff ? (
                              <div className="text-slate-500 text-xs text-center py-10 space-y-2">
                                <p>File unchanged in this simulation run. No diff chunks.</p>
                                <button
                                  type="button"
                                  onClick={() => setShowFullDiff(true)}
                                  className="text-cyan-400 hover:underline text-xs cursor-pointer"
                                >
                                  View full scenario diff
                                </button>
                              </div>
                            ) : (
                              (showFullDiff
                                ? simulationState.diff_preview || activeScenario?.diff || ""
                                : inspectedFile.file_diff ||
                                  simulationState.diff_preview ||
                                  activeScenario?.diff ||
                                  ""
                              )
                                .split("\n")
                                .map((line, i) => (
                                  <span
                                    key={i}
                                    className={
                                      line.startsWith("+") && !line.startsWith("+++")
                                        ? "text-emerald-400 block bg-emerald-950/30 px-1"
                                        : line.startsWith("-") && !line.startsWith("---")
                                          ? "text-rose-400 block bg-rose-950/30 px-1"
                                          : line.startsWith("@@")
                                            ? "text-cyan-400 block font-bold mt-1"
                                            : "text-slate-400 block"
                                    }
                                  >
                                    {line}
                                  </span>
                                ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs text-center py-12">
                      Click on any file in the worktree tree to inspect source code and unified diff
                      side by side.
                    </div>
                  )}
                </div>
              )}

              {activeRightTab === "pr" && (
                <div className="font-sans text-xs text-slate-300 whitespace-pre-wrap leading-relaxed p-1">
                  {simulationState.pr_summary || activeScenario?.pr_summary || (
                    <div className="text-slate-500 text-xs text-center py-6">
                      PR summary will generate upon verification gate pass.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embed Banner Generator Widget */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-cyan-400" />
              Embed &quot;Try Tendril in 30 Seconds&quot; Banner Generator
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Add interactive zero-barrier demo badges to your README.md or website to maximize
              developer conversion.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Preview Banner */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Visual Preview
            </span>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg shadow-md hover:border-cyan-500/50 transition-colors">
              <a
                href={bannerInfo?.target_url || getShareUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                <img
                  src={
                    bannerInfo?.badge_url ||
                    "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4?style=for-the-badge&logo=visualstudiocode&logoColor=white"
                  }
                  alt="Try Tendril in 30 Seconds"
                  className="rounded"
                />
              </a>
            </div>
            <p className="text-xs text-slate-500">
              Links directly to{" "}
              <span className="text-cyan-400 font-mono">
                {bannerInfo?.target_url
                  ? bannerInfo.target_url.replace("https://", "")
                  : `tendril.run/#scenario=${scenarioIdToSlug(selectedScenarioId)}`}
              </span>
            </p>
          </div>

          {/* Snippet Code Boxes */}
          <div className="space-y-3">
            {/* Markdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Markdown (for README.md):</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      bannerInfo?.markdown_snippet ||
                        `[![Try Tendril in 30 Seconds](${
                          bannerInfo?.badge_url ||
                          "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4?style=for-the-badge&logo=visualstudiocode&logoColor=white"
                        })](${bannerInfo?.target_url || getShareUrl()})`,
                      "markdown",
                    )
                  }
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  {copiedSnippet === "markdown" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
              </div>
              <code className="block bg-slate-950 border border-slate-800 p-2.5 rounded text-[11px] font-mono text-slate-300 break-all select-all">
                {bannerInfo?.markdown_snippet ||
                  `[![Try Tendril in 30 Seconds](${
                    bannerInfo?.badge_url ||
                    "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4?style=for-the-badge&logo=visualstudiocode&logoColor=white"
                  })](${bannerInfo?.target_url || getShareUrl()})`}
              </code>
            </div>

            {/* HTML */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">HTML (for Website & Docs):</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      bannerInfo?.html_snippet ||
                        `<a href="${
                          bannerInfo?.target_url || getShareUrl()
                        }" target="_blank" rel="noopener noreferrer"><img src="${
                          bannerInfo?.badge_url ||
                          "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4?style=for-the-badge&logo=visualstudiocode&logoColor=white"
                        }" alt="Try Tendril in 30 Seconds" /></a>`,
                      "html",
                    )
                  }
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  {copiedSnippet === "html" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy HTML</span>
                    </>
                  )}
                </button>
              </div>
              <code className="block bg-slate-950 border border-slate-800 p-2.5 rounded text-[11px] font-mono text-slate-300 break-all select-all">
                {bannerInfo?.html_snippet ||
                  `<a href="${
                    bannerInfo?.target_url || getShareUrl()
                  }" target="_blank" rel="noopener noreferrer"><img src="${
                    bannerInfo?.badge_url ||
                    "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4?style=for-the-badge&logo=visualstudiocode&logoColor=white"
                  }" alt="Try Tendril in 30 Seconds" /></a>`}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Import Custom GitHub Issue Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Import Custom GitHub Issue</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Public GitHub Issue URL (Optional):
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/Ivy-Interactive/Ivy-Tendril/issues/42"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Live issue title, description, and labels will be imported automatically when a
                    GitHub token is configured.
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Issue Title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Add Prometheus telemetry endpoint"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Task Specification / Description:
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the desired behavior, affected files, and verification criteria..."
                  value={importDesc}
                  onChange={(e) => setImportDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <ActionButton variant="secondary" onClick={() => setShowImportModal(false)}>
                  Cancel
                </ActionButton>
                <ActionButton
                  type="submit"
                  variant="cyan"
                  size="md"
                  disabled={!importUrl.trim() && !importTitle.trim()}
                  loading={importingIssue}
                  loadingText="Synthesizing..."
                >
                  Synthesize Scenario
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Celebration & Star Modal */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">
                Walkthrough Complete! Star Tendril on GitHub ⭐
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                You just tested Tendril&apos;s complete autonomous pipeline in under 30 seconds:
                ephemeral worktree isolation, 5 verified test gates, and a conflict-free PR diff.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Verified in {simulationState.elapsed_seconds.toFixed(1)}s (5 gates passed)
            </div>

            <p className="text-[11px] text-slate-500">
              Join 10,000+ developers building verified software factories with Ivy-Tendril.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleShareScenario()}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Share this run</span>
                  </>
                )}
              </button>
              <button
                onClick={handleStarClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Star className="w-4 h-4 fill-slate-950" />
                Star Ivy-Tendril on GitHub
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowCelebrationModal(false)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Continue Exploring
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
