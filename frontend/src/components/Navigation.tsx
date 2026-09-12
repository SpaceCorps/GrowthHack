import React from "react";
import type { ActiveTab, AgentStatus } from "../types";
import { useLocalStorage } from "../hooks";
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
  Activity,
  Users,
  Rocket,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

export interface NavigationProps {
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
  contributorsCount?: number;
  launchCount?: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const STORAGE_KEY_SIDEBAR_COLLAPSED = "growthhack_sidebar_collapsed";

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
  contributorsCount,
  launchCount,
  isMobileOpen = false,
  onMobileClose,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useLocalStorage<boolean>(
    STORAGE_KEY_SIDEBAR_COLLAPSED,
    false,
  );
  const isCollapsed =
    controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const navContainerRef = React.useRef<HTMLElement | null>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeTab]);

  const sections: NavSection[] = [
    {
      title: "Growth & Content",
      items: [
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
      ],
    },
    {
      title: "Distribution & Blitz",
      items: [
        {
          id: "listings" as ActiveTab,
          label: "Listing & Repo Blitz",
          icon: ListTree,
          count: listingsCount,
        },
        {
          id: "launch" as ActiveTab,
          label: "Launch Campaign",
          icon: Rocket,
          count: launchCount,
        },
        {
          id: "packages" as ActiveTab,
          label: "Package Blitz",
          icon: Package,
          count: packagesCount,
        },
        {
          id: "contributors" as ActiveTab,
          label: "Contributor Flywheel",
          icon: Users,
          count: contributorsCount,
        },
        {
          id: "flywheel" as ActiveTab,
          label: "PR Flywheel",
          icon: GitPullRequest,
        },
      ],
    },
    {
      title: "Tools & Diagnostics",
      items: [
        {
          id: "agent" as ActiveTab,
          label: "Antigravity Console",
          icon: Terminal,
        },
        {
          id: "doctor" as ActiveTab,
          label: "Doctor & Demo",
          icon: Activity,
        },
        {
          id: "playground" as ActiveTab,
          label: "Web Playground",
          icon: Globe,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          data-testid="mobile-backdrop"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur-md lg:static lg:h-screen lg:sticky lg:top-0 transition-all duration-200 ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-16" : "lg:w-64"} w-64`}
      >
        {/* Header / Brand Area */}
        <div className="p-3 border-b border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            {isCollapsed ? (
              <div
                className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0"
                title="SpaceCorps // GrowthHack (Ivy-Tendril)"
              >
                <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
              </div>
            ) : (
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                  <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block truncate">
                    SpaceCorps //
                  </span>
                  <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>GrowthHack</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                      Ivy-Tendril
                    </span>
                  </h1>
                </div>
              </div>
            )}

            {/* Collapse toggle (desktop) and Close button (mobile) */}
            <div className="flex items-center space-x-1">
              {onMobileClose && (
                <button
                  type="button"
                  aria-label="Close sidebar"
                  onClick={onMobileClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Target Star Meter */}
          {isCollapsed ? (
            <div
              title="Target: 175 -> 100,000 Stars"
              className="hidden lg:flex items-center justify-center p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-amber-400"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400" />
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-slate-400">Target:</span>
              <span className="font-semibold text-slate-200">175</span>
              <span className="text-slate-600">&rarr;</span>
              <span className="font-bold text-amber-300">100,000 Stars</span>
            </div>
          )}

          {/* Local Agent Status Indicator */}
          {isCollapsed ? (
            <div
              className={`hidden lg:flex items-center justify-center p-1.5 rounded-lg text-xs border ${
                agentStatus?.is_available
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                  : "bg-rose-950/60 text-rose-300 border-rose-800/80"
              }`}
              title={agentStatus?.agy_path || "Agent CLI not detected"}
            >
              <div className="relative">
                <Cpu className="w-3.5 h-3.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse absolute -top-0.5 -right-0.5" />
              </div>
              <span className="sr-only">
                {agentStatus?.is_available ? "Antigravity" : "Offline"}
              </span>
            </div>
          ) : (
            <div
              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs border ${
                agentStatus?.is_available
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                  : "bg-rose-950/60 text-rose-300 border-rose-800/80"
              }`}
              title={agentStatus?.agy_path || "Agent CLI not detected"}
            >
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
              <span className="font-mono text-xs truncate">
                {agentStatus?.is_available ? "Antigravity" : "Offline"}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav
          ref={navContainerRef}
          className="flex-1 overflow-y-auto px-2 py-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
        >
          {sections.map((section, sIndex) => (
            <div key={section.title} className="space-y-1">
              {isCollapsed ? (
                sIndex > 0 && <div className="my-2 border-t border-slate-800/80 mx-1" />
              ) : (
                <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      tabRefs.current[item.id] = el;
                    }}
                    onClick={() => {
                      setActiveTab(item.id);
                      onMobileClose?.();
                    }}
                    title={
                      isCollapsed
                        ? item.count !== undefined
                          ? `${item.label} (${item.count})`
                          : item.label
                        : undefined
                    }
                    className={`w-full shrink-0 flex items-center rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isCollapsed
                        ? "justify-center p-2 relative group"
                        : "space-x-2.5 px-3 py-2 text-left"
                    } ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium shadow-xs"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-emerald-400" : "text-slate-400"
                      }`}
                    />
                    <span
                      className={`inline whitespace-nowrap truncate ${
                        isCollapsed ? "sr-only lg:sr-only" : ""
                      }`}
                    >
                      {item.label}
                    </span>

                    {/* Count badge */}
                    {item.count !== undefined &&
                      (isCollapsed ? (
                        <span className="hidden lg:block absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ) : (
                        <span
                          className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
                            isActive
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {item.count}
                        </span>
                      ))}

                    {/* Collapsed flyout tooltip for desktop */}
                    {isCollapsed && (
                      <div className="hidden lg:group-hover:flex absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-slate-100 text-xs rounded-md shadow-xl z-50 whitespace-nowrap items-center gap-2 border border-slate-700 pointer-events-none">
                        <span>{item.label}</span>
                        {item.count !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-emerald-300 font-mono">
                            {item.count}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-400">
          {isCollapsed ? (
            <div className="flex flex-col items-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("contributors");
                  onMobileClose?.();
                }}
                title="Contributor Guide & Fast-Track Onboarding"
                className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                <Users className="w-4 h-4" />
              </button>
              <a
                href="https://github.com/SpaceCorps/GrowthHack"
                target="_blank"
                rel="noreferrer"
                title="GitHub Repo"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <div className="flex flex-col space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("contributors");
                  onMobileClose?.();
                }}
                className="text-left text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-2 py-1 px-1 rounded hover:bg-slate-800/40 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Contributor Guide</span>
              </button>
              <a
                href="https://github.com/SpaceCorps/GrowthHack"
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-200 transition-colors flex items-center space-x-2 py-1 px-1 rounded hover:bg-slate-800/40"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">GitHub Repo</span>
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
