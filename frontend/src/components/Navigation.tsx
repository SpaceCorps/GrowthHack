import React from "react";
import type { ActiveTab, AgentStatus } from "../types";
import {
  Target,
  FileText,
  Radio,
  Clapperboard,
  ListTree,
  Package,
  Terminal,
  Sparkles,
  Star,
  Cpu,
  CheckCheck,
  GitPullRequest,
} from "lucide-react";

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  agentStatus: AgentStatus | null;
  issuesCount: number;
  articlesCount: number;
  trendsCount: number;
  listingsCount: number;
  packagesCount?: number;
  reviewCount?: number;
  recipesCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  agentStatus,
  issuesCount,
  articlesCount,
  trendsCount,
  listingsCount,
  packagesCount,
  reviewCount,
  recipesCount,
}) => {
  const navItems = [
    {
      id: "issues" as ActiveTab,
      label: "Direct Action Issues",
      icon: Target,
      count: issuesCount,
    },
    {
      id: "articles" as ActiveTab,
      label: "10x Content Engine",
      icon: FileText,
      count: articlesCount,
    },
    {
      id: "review" as ActiveTab,
      label: "Approval Deck",
      icon: CheckCheck,
      count: reviewCount,
    },
    {
      id: "recipes" as ActiveTab,
      label: "Recipe Hub & Packs",
      icon: Sparkles,
      count: recipesCount,
    },
    {
      id: "trends" as ActiveTab,
      label: "Trend Radar & Newsroom",
      icon: Radio,
      count: trendsCount,
    },
    {
      id: "demos" as ActiveTab,
      label: "Video Demos & LinkedIn",
      icon: Clapperboard,
    },
    {
      id: "listings" as ActiveTab,
      label: "Listing & Repo Blitz",
      icon: ListTree,
      count: listingsCount,
    },
    {
      id: "packages" as ActiveTab,
      label: "Package Blitz",
      icon: Package,
      count: packagesCount,
    },
    {
      id: "flywheel" as ActiveTab,
      label: "PR Flywheel",
      icon: GitPullRequest,
    },
    {
      id: "agent" as ActiveTab,
      label: "Antigravity Console",
      icon: Terminal,
    },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Target */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  SpaceCorps //
                </span>
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  GrowthHack
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    Ivy-Tendril
                  </span>
                </h1>
              </div>
            </div>

            {/* Target Star Meter */}
            <div className="hidden lg:flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-slate-400">Target:</span>
              <span className="font-semibold text-slate-200">175</span>
              <span className="text-slate-600">→</span>
              <span className="font-bold text-amber-300">100,000 Stars</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                  <span className="hidden md:inline">{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Local Agent Status Indicator */}
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs border ${
                agentStatus?.is_available
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                  : "bg-rose-950/60 text-rose-300 border-rose-800/80"
              }`}
              title={agentStatus?.agy_path || "Agent CLI not detected"}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="hidden sm:inline font-mono">
                {agentStatus?.is_available ? "Antigravity" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
