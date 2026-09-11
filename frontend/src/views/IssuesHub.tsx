import React, { useState } from "react";
import type { GrowthIssue } from "../types";
import { Play, CheckCircle2, Flame, Plus, Calendar, RotateCw, Search, Filter } from "lucide-react";

interface IssuesHubProps {
  issues: GrowthIssue[];
  onRunIssue: (id: string) => void;
  onUpdateStatus: (id: string, status: "Todo" | "In Progress" | "Active Routine" | "Done") => void;
  onCreateIssue: (issue: Partial<GrowthIssue>) => void;
}

export const IssuesHub: React.FC<IssuesHubProps> = ({
  issues,
  onRunIssue,
  onUpdateStatus,
  onCreateIssue,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Issue Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Content Engine");
  const [newPriority, setNewPriority] = useState<"Critical" | "High" | "Medium" | "Low">("High");
  const [newDesc, setNewDesc] = useState("");
  const [newActions, setNewActions] = useState("");
  const [newSchedule, setNewSchedule] = useState("");

  const categories = Array.from(new Set(issues.map((i) => i.category)));

  const filteredIssues = issues.filter((issue) => {
    const matchesCategory = filterCategory === "all" || issue.category === filterCategory;
    const matchesStatus = filterStatus === "all" || issue.status === filterStatus;
    const matchesSearch =
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateIssue({
      title: newTitle,
      category: newCategory,
      priority: newPriority,
      description: newDesc,
      direct_actions: newActions
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean),
      routine_schedule: newSchedule || undefined,
    });

    setNewTitle("");
    setNewDesc("");
    setNewActions("");
    setNewSchedule("");
    setShowAddModal(false);
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "Critical":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      case "High":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "Medium":
        return "bg-sky-950/80 text-sky-300 border-sky-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "Active Routine":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "In Progress":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-800";
      case "Done":
        return "bg-slate-800 text-slate-400 border-slate-700 line-through";
      default:
        return "bg-slate-900 text-slate-400 border-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Strategy Mission */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Flame className="w-4 h-4" />
            <span>Growth Engine Cockpit // Direct Actions</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
            Scale Ivy-Tendril to 100k Stars Through Real Adoption
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Direct-action initiatives executed autonomously by your local{" "}
            <strong>Antigravity</strong> agent. Automate daily 10x articles, blitz Awesome-lists,
            scout trends, and engineer viral pull request loops.
          </p>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="Active Routine">Active Routine</option>
              <option value="In Progress">In Progress</option>
              <option value="Todo">Todo</option>
              <option value="Done">Done</option>
            </select>
          </div>
        </div>

        {/* Add Issue Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-950/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Direct Action</span>
        </button>
      </div>

      {/* Issues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filteredIssues.map((issue) => (
          <div
            key={issue.id}
            className="flex flex-col justify-between p-5 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all group shadow-sm hover:shadow-md"
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    #{issue.number}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 font-medium">
                    {issue.category}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getPriorityBadge(issue.priority)}`}
                  >
                    {issue.priority}
                  </span>
                  <select
                    value={issue.status}
                    onChange={(e) => onUpdateStatus(issue.id, e.target.value as any)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium focus:outline-none ${getStatusBadge(issue.status)}`}
                  >
                    <option value="Todo">Todo</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Active Routine">Active Routine</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug">
                {issue.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                {issue.description}
              </p>

              {/* Direct Actions Checklist */}
              <div className="mt-4 pt-3 border-t border-slate-800/70">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Direct Action Items</span>
                  <span className="text-emerald-400 font-mono">
                    {issue.direct_actions.length} actions
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {issue.direct_actions.slice(0, 3).map((action, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70 mt-0.5 shrink-0" />
                      <span className="truncate">{action}</span>
                    </li>
                  ))}
                  {issue.direct_actions.length > 3 && (
                    <li className="text-[11px] text-slate-500 pl-5">
                      +{issue.direct_actions.length - 3} more actions
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="mt-5 pt-3 border-t border-slate-800/70 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                {issue.routine_schedule ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Calendar className="w-3 h-3" />
                    {issue.routine_schedule}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3 h-3" />
                    Runs: {issue.run_count}
                  </span>
                )}
              </div>

              <button
                onClick={() => onRunIssue(issue.id)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-all group-hover:shadow-emerald-950/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Action</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Issue Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create New Direct Action Issue</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Issue Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hacker News Show HN Launch Automation"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Explain the strategy and expected impact on GitHub stars/adoption..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Direct Actions (One per line)
                </label>
                <textarea
                  rows={3}
                  value={newActions}
                  onChange={(e) => setNewActions(e.target.value)}
                  placeholder="Action 1&#10;Action 2&#10;Action 3"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Routine Schedule (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily at 09:00 UTC, Weekly on Fridays"
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
