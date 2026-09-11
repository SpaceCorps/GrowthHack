import React, { useEffect, useState, useRef } from "react";
import type {
  DiagnosticCheck,
  DiagnosticReport,
  DemoScenario,
  DemoRunState,
  OnboardingMetrics,
} from "../types";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Play,
  RotateCcw,
  GitBranch,
  ShieldCheck,
  GitPullRequest,
  FileCode,
  Star,
  Sparkles,
  ExternalLink,
  Wrench,
  Clock,
  Terminal as TerminalIcon,
  X,
  Layers,
  Plus,
} from "lucide-react";

export const DoctorDemo: React.FC = () => {
  // Diagnostic State
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState<boolean>(false);
  const [fixingDiagnostics, setFixingDiagnostics] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Demo Simulator State
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("scenario-health-check");
  const [demoState, setDemoState] = useState<DemoRunState>({
    id: "init",
    status: "Idle",
    current_step: 1,
    step_progress_pct: 0,
    logs: ["Ready to run zero-config demo simulation."],
    diff_preview: undefined,
    pr_summary: undefined,
    elapsed_seconds: 0,
  });
  const [startingDemo, setStartingDemo] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);
  const [showAddScenarioModal, setShowAddScenarioModal] = useState<boolean>(false);
  const [newScenario, setNewScenario] = useState({
    id: "",
    title: "",
    description: "",
    target_branch: "master",
    estimated_duration_sec: 15,
    diff_preview: "",
    pr_summary: "",
  });
  const [submittingScenario, setSubmittingScenario] = useState<boolean>(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<OnboardingMetrics | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    fetchDiagnostics();
    fetchScenarios();
    fetchDemoStatus();
    fetchMetrics();
  }, []);

  // Stream demo status via SSE while running, with fallback polling
  useEffect(() => {
    if (demoState.status !== "Running") return;

    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/demo/status");
          if (res.ok) {
            const data: DemoRunState = await res.json();
            setDemoState(data);
            if (data.status === "Completed") {
              setShowCelebrationModal(true);
              fetchMetrics();
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
            }
          }
        } catch (err) {
          console.error("Failed to poll demo status:", err);
        }
      }, 350);
    };

    if (typeof EventSource !== "undefined" && demoState.id) {
      try {
        const es = new EventSource(`/api/demo/stream/${demoState.id}`);
        eventSource = es;

        es.onmessage = (event) => {
          const line = event.data;
          setDemoState((prev) => {
            const nextLogs = prev.logs.includes(line) ? prev.logs : [...prev.logs, line];
            let current_step = prev.current_step;
            let step_progress_pct = prev.step_progress_pct;

            if (line.includes("Step 1")) {
              current_step = 1;
              step_progress_pct = 25;
            } else if (line.includes("Step 2")) {
              current_step = 2;
              step_progress_pct = 50;
            } else if (line.includes("Step 3")) {
              current_step = 3;
              step_progress_pct = 75;
            } else if (line.includes("Step 4") || line.includes("[DONE]")) {
              current_step = 4;
              step_progress_pct = 100;
            }

            return {
              ...prev,
              current_step,
              step_progress_pct,
              logs: nextLogs,
            };
          });

          if (line.includes("[DONE]")) {
            es.close();
            fetch("/api/demo/status")
              .then((res) => (res.ok ? res.json() : null))
              .then((data: DemoRunState | null) => {
                if (data) {
                  setDemoState((prev) => ({
                    ...prev,
                    diff_preview: data.diff_preview ?? prev.diff_preview,
                    pr_summary: data.pr_summary ?? prev.pr_summary,
                    elapsed_seconds: data.elapsed_seconds ?? prev.elapsed_seconds,
                    logs: data.logs && data.logs.length > prev.logs.length ? data.logs : prev.logs,
                    status: "Completed",
                    current_step: 4,
                    step_progress_pct: 100,
                  }));
                } else {
                  setDemoState((prev) => ({
                    ...prev,
                    status: "Completed",
                    current_step: 4,
                    step_progress_pct: 100,
                  }));
                }
                setShowCelebrationModal(true);
                fetchMetrics();
              })
              .catch((err) => {
                console.error("Failed to fetch final demo status:", err);
                setDemoState((prev) => ({
                  ...prev,
                  status: "Completed",
                  current_step: 4,
                  step_progress_pct: 100,
                }));
                setShowCelebrationModal(true);
                fetchMetrics();
              });
          }
        };

        es.onerror = () => {
          es.close();
          eventSource = null;
          startPolling();
        };
      } catch (err) {
        console.error("Failed to establish EventSource, falling back to polling:", err);
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [demoState.status, demoState.id]);

  // Auto scroll terminal logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [demoState.logs]);

  const fetchDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const res = await fetch("/api/doctor/diagnose", { method: "POST" });
      if (res.ok) {
        const data: DiagnosticReport = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error("Failed to run diagnostics:", err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const fixDiagnostics = async (checkIds?: string[]) => {
    setFixingDiagnostics(true);
    try {
      const res = await fetch("/api/doctor/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkIds ? { check_ids: checkIds } : {}),
      });
      if (res.ok) {
        const data: DiagnosticReport = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error("Failed to apply diagnostic fixes:", err);
    } finally {
      setFixingDiagnostics(false);
    }
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch("/api/demo/scenarios");
      if (res.ok) {
        const data: DemoScenario[] = await res.json();
        setScenarios(data);
      }
    } catch (err) {
      console.error("Failed to fetch scenarios:", err);
    }
  };

  const fetchDemoStatus = async () => {
    try {
      const res = await fetch("/api/demo/status");
      if (res.ok) {
        const data: DemoRunState = await res.json();
        setDemoState(data);
      }
    } catch (err) {
      console.error("Failed to fetch demo status:", err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/demo/metrics");
      if (res.ok) {
        const data: OnboardingMetrics = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch onboarding metrics:", err);
    }
  };

  const startDemo = async () => {
    setStartingDemo(true);
    try {
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: selectedScenarioId,
          speed_multiplier: 1.0,
        }),
      });
      if (res.ok) {
        const data: DemoRunState = await res.json();
        setDemoState(data);
      }
    } catch (err) {
      console.error("Failed to start demo simulator:", err);
    } finally {
      setStartingDemo(false);
    }
  };

  const resetDemo = async () => {
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) {
        const data: DemoRunState = await res.json();
        setDemoState(data);
        setShowCelebrationModal(false);
      }
    } catch (err) {
      console.error("Failed to reset demo simulator:", err);
    }
  };

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenario.id.trim() || !newScenario.title.trim() || !newScenario.description.trim()) {
      setScenarioError("ID, title, and description are required.");
      return;
    }
    setSubmittingScenario(true);
    setScenarioError(null);
    try {
      const res = await fetch("/api/demo/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newScenario.id.trim(),
          title: newScenario.title.trim(),
          description: newScenario.description.trim(),
          target_branch: newScenario.target_branch.trim() || "master",
          estimated_duration_sec: Number(newScenario.estimated_duration_sec) || 15,
          diff_preview: newScenario.diff_preview.trim() || undefined,
          pr_summary: newScenario.pr_summary.trim() || undefined,
        }),
      });
      if (res.ok) {
        const created: DemoScenario = await res.json();
        await fetchScenarios();
        setSelectedScenarioId(created.id);
        setShowAddScenarioModal(false);
        setNewScenario({
          id: "",
          title: "",
          description: "",
          target_branch: "master",
          estimated_duration_sec: 15,
          diff_preview: "",
          pr_summary: "",
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setScenarioError(errData.error || "Failed to create scenario.");
      }
    } catch (err) {
      console.error("Failed to create demo scenario:", err);
      setScenarioError("Network error while creating scenario.");
    } finally {
      setSubmittingScenario(false);
    }
  };

  const handleResetScenarios = async () => {
    try {
      const res = await fetch("/api/demo/scenarios/reset", { method: "POST" });
      if (res.ok) {
        const defaultScenarios: DemoScenario[] = await res.json();
        setScenarios(defaultScenarios);
        if (!defaultScenarios.some((s) => s.id === selectedScenarioId)) {
          setSelectedScenarioId("scenario-health-check");
        }
      }
    } catch (err) {
      console.error("Failed to reset demo scenarios:", err);
    }
  };

  const handleStarClick = async () => {
    try {
      await fetch("/api/demo/star-click", { method: "POST" });
      fetchMetrics();
    } catch (err) {
      console.error("Failed to record star engagement:", err);
    }
    window.open("https://github.com/Ivy-Interactive/Ivy-Tendril", "_blank");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const filteredChecks = report?.checks.filter((check) => {
    if (categoryFilter === "all") return true;
    return check.category === categoryFilter;
  });

  const steps = [
    { number: 1, title: "Issue Intake", icon: Layers, desc: "Analyze task specification" },
    { number: 2, title: "Isolated Worktree", icon: GitBranch, desc: "Branch in clean worktree" },
    {
      number: 3,
      title: "Verification Gates",
      icon: ShieldCheck,
      desc: "Run Clippy, Tests & Build",
    },
    { number: 4, title: "PR Diff Preview", icon: GitPullRequest, desc: "Ready for 1-click merge" },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
                <Activity className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Tendril Doctor & Replayable Demo Simulator
              </h1>
            </div>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              Verify local environment prerequisites (Git worktrees, AI agent CLIs, API keys,
              loopback ports) and experience Tendril's autonomous execution pipeline in a zero-risk
              simulated sandbox in under 60 seconds.
            </p>
          </div>

          {/* Onboarding Metrics Badge Strip */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-950/70 border border-slate-800 rounded-lg p-3">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-xs text-slate-400">Diagnostics</div>
              <div className="text-lg font-bold text-cyan-400">
                {metrics?.diagnostic_runs_count || 0}
              </div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-xs text-slate-400">Demos Run</div>
              <div className="text-lg font-bold text-emerald-400">
                {metrics?.demo_completed_count || 0}
              </div>
            </div>
            <div className="text-center px-3">
              <button
                onClick={handleStarClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md text-xs font-semibold transition-all"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {metrics?.github_starred ? "Starred!" : "Star Ivy-Tendril"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Diagnostic Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              System Diagnostic Checklist
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Validates system health, agent binaries, security tokens, and local port bindings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fixDiagnostics()}
              disabled={fixingDiagnostics}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              <Wrench className="w-4 h-4" />
              {fixingDiagnostics ? "Fixing..." : "Fix All Fixable"}
            </button>
            <button
              onClick={fetchDiagnostics}
              disabled={loadingDiagnostics}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-cyan-500/20 disabled:opacity-50"
            >
              <Activity className="w-4 h-4" />
              {loadingDiagnostics ? "Scanning..." : "Run Diagnostics"}
            </button>
          </div>
        </div>

        {/* Diagnostic Summary Stats */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Total Checks</div>
              <div className="text-lg font-bold text-white">{report.summary.total}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Passed</div>
              <div className="text-lg font-bold text-emerald-400">{report.summary.passed}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Warnings</div>
              <div className="text-lg font-bold text-amber-400">{report.summary.warnings}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Failures</div>
              <div className="text-lg font-bold text-rose-400">{report.summary.failures}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-400">Status</div>
              <div
                className={`text-sm font-bold mt-1 ${
                  report.summary.ready_for_execution ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {report.summary.ready_for_execution ? "Ready to Execute" : "Warnings Found"}
              </div>
            </div>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "All Checks" },
            { id: "git", label: "Git Environment" },
            { id: "agent", label: "Agent CLIs" },
            { id: "keys", label: "API Keys" },
            { id: "ports", label: "Port Availability" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === tab.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Checklist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredChecks && filteredChecks.length > 0 ? (
            filteredChecks.map((check: DiagnosticCheck) => {
              const isPass = check.status === "Pass";
              const isWarning = check.status === "Warning";
              const isFail = check.status === "Fail";

              return (
                <div
                  key={check.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                        {isFail && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                        <span className="text-sm font-semibold text-white">{check.name}</span>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          isPass
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : isWarning
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {check.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{check.message}</p>
                  </div>

                  {/* Remediation Action Card */}
                  {check.remediation_command && (
                    <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                          <TerminalIcon className="w-3 h-3 text-cyan-400" />
                          Remediation Command:
                        </span>
                        <div className="flex items-center gap-2">
                          {check.can_auto_fix && (
                            <button
                              onClick={() => fixDiagnostics([check.id])}
                              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
                            >
                              Auto-Fix
                            </button>
                          )}
                          <button
                            onClick={() => copyToClipboard(check.remediation_command!)}
                            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                          >
                            {copiedCommand === check.remediation_command ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <code className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded block overflow-x-auto select-all">
                        {check.remediation_command}
                      </code>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-2 text-center py-8 text-slate-500 text-sm">
              {loadingDiagnostics ? "Running diagnostic checks..." : "No diagnostic checks found."}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Replayable Workflow Visualizer Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-cyan-400" />
              Replayable Zero-Config Demo Simulator
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Experience Tendril's end-to-end autonomous lifecycle (Intake &rarr; Worktree &rarr;
              Verifications &rarr; PR Diff).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetDemo}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={startDemo}
              disabled={startingDemo || demoState.status === "Running"}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-emerald-500/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              {demoState.status === "Running"
                ? "Simulating..."
                : demoState.status === "Completed"
                  ? "Replay Demo"
                  : "Start Replayable Demo"}
            </button>
          </div>
        </div>

        {/* Scenario Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Demo Scenario:
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetScenarios}
                disabled={demoState.status === "Running"}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Reset Defaults
              </button>
              <button
                onClick={() => setShowAddScenarioModal(true)}
                disabled={demoState.status === "Running"}
                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Scenario
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setSelectedScenarioId(sc.id)}
                disabled={demoState.status === "Running"}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedScenarioId === sc.id
                    ? "bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/20"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-bold text-white line-clamp-1">{sc.title}</div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{sc.description}</div>
                <div className="text-[10px] text-cyan-400 mt-2 font-mono">
                  Branch: {sc.target_branch} • Est. {sc.estimated_duration_sec}s
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 4-Step Stepper Bar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Autonomous Pipeline Stepper
            </span>
            <span className="text-xs font-mono text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Elapsed: {demoState.elapsed_seconds.toFixed(1)}s (Target: &lt;60s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted =
                demoState.current_step > step.number || demoState.status === "Completed";
              const isCurrent =
                demoState.current_step === step.number && demoState.status === "Running";

              return (
                <div
                  key={step.number}
                  className={`p-4 rounded-lg border relative transition-all ${
                    isCurrent
                      ? "bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500/30"
                      : isCompleted
                        ? "bg-emerald-500/10 border-emerald-500/40"
                        : "bg-slate-900 border-slate-800 opacity-60"
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
                  <div className="mt-2.5">
                    <div className="text-sm font-bold text-white">{step.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${demoState.step_progress_pct}%` }}
            />
          </div>
        </div>

        {/* Live Terminal Drawer & Output */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs font-mono text-slate-400 ml-2">
                tendril-worktree-runner (simulation stdout)
              </span>
            </div>
            {demoState.diff_preview && (
              <button
                onClick={() => setShowDiffModal(true)}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                Inspect PR Diff
              </button>
            )}
          </div>

          <div className="p-4 font-mono text-xs text-slate-300 h-52 overflow-y-auto space-y-1.5">
            {demoState.logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed flex items-start gap-2">
                <span className="text-slate-600 select-none">&gt;</span>
                <span
                  className={
                    log.includes("PASS")
                      ? "text-emerald-400 font-semibold"
                      : log.includes("Error")
                        ? "text-rose-400"
                        : log.includes("Step")
                          ? "text-cyan-300 font-medium"
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

        {/* Completed Simulation Diff & PR Summary Banner */}
        {demoState.status === "Completed" && demoState.diff_preview && (
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Simulation complete for{" "}
                <span className="text-white font-mono">
                  {scenarios.find((s) => s.id === selectedScenarioId)?.title || selectedScenarioId}
                </span>
                . PR diff and verification summary are ready.
              </span>
            </div>
            <button
              onClick={() => setShowDiffModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-all shrink-0"
            >
              <FileCode className="w-3.5 h-3.5" />
              Inspect PR Diff
            </button>
          </div>
        )}
      </div>

      {/* Add Custom Scenario Modal */}
      {showAddScenarioModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Create Custom Demo Scenario</h3>
              </div>
              <button
                onClick={() => setShowAddScenarioModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="p-4 overflow-y-auto space-y-4 text-xs">
              {scenarioError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  {scenarioError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Scenario ID (unique slug)*
                </label>
                <input
                  type="text"
                  required
                  placeholder="scenario-my-workflow"
                  value={newScenario.id}
                  onChange={(e) => setNewScenario({ ...newScenario, id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Title*</label>
                <input
                  type="text"
                  required
                  placeholder="Add JWT authentication and refresh token rotation"
                  value={newScenario.title}
                  onChange={(e) => setNewScenario({ ...newScenario, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Description*</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Simulates an autonomous agent creating auth middleware with token validation tests in an isolated worktree."
                  value={newScenario.description}
                  onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Target Branch</label>
                  <input
                    type="text"
                    placeholder="master"
                    value={newScenario.target_branch}
                    onChange={(e) =>
                      setNewScenario({ ...newScenario, target_branch: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">
                    Estimated Duration (sec)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={newScenario.estimated_duration_sec}
                    onChange={(e) =>
                      setNewScenario({
                        ...newScenario,
                        estimated_duration_sec: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Custom Diff Preview (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    "diff --git a/src/auth.rs b/src/auth.rs\n+pub fn verify_token() -> bool { true }"
                  }
                  value={newScenario.diff_preview}
                  onChange={(e) => setNewScenario({ ...newScenario, diff_preview: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Custom PR Verification Summary (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    "# Pull Request Summary\n\n## Verifications Passed\n- RustTest: 1 passed"
                  }
                  value={newScenario.pr_summary}
                  onChange={(e) => setNewScenario({ ...newScenario, pr_summary: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddScenarioModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingScenario}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submittingScenario ? "Creating..." : "Create Scenario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PR Diff Modal */}
      {showDiffModal && demoState.diff_preview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Generated Pull Request Diff</h3>
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-slate-300 whitespace-pre-wrap">
                  {demoState.diff_preview.split("\n").map((line, i) => (
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
                  ))}
                </pre>
              </div>

              {demoState.pr_summary && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-300 space-y-2">
                  <div className="font-semibold text-white">Verification Summary:</div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-400 leading-relaxed">
                    {demoState.pr_summary}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: First-Success Celebration Modal */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">
                Enjoying Tendril? Star us on GitHub! ⭐
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                First PR verified in &lt;60s with zero external configuration. Your support helps
                developers escape git merge collisions with autonomous worktree orchestration.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Autonomous Worktree Flow Verified Cleanly
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleStarClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4 fill-slate-950" />
                Star Ivy-Tendril on GitHub
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowCelebrationModal(false)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
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
