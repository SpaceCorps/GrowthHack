import React, { useEffect, useState } from "react";
import type {
  ActiveTab,
  AgentStatus,
  Article,
  ContributorIssue,
  GrowthIssue,
  Listing,
  PackageManagerTarget,
  Recipe,
  ReviewItem,
  RunRecipeResponse,
  TrendTopic,
  VideoDemo,
  LaunchCampaignState,
} from "./types";
import { Navigation } from "./components/Navigation";
import { LiveTerminal } from "./components/LiveTerminal";
import { Menu, Sparkles } from "lucide-react";
const IssuesHub = React.lazy(() =>
  import("./views/IssuesHub").then((m) => ({ default: m.IssuesHub })),
);
const ArticleEngine = React.lazy(() =>
  import("./views/ArticleEngine").then((m) => ({ default: m.ArticleEngine })),
);
const TrendRadar = React.lazy(() =>
  import("./views/TrendRadar").then((m) => ({ default: m.TrendRadar })),
);
const ListingBlitz = React.lazy(() =>
  import("./views/ListingBlitz").then((m) => ({ default: m.ListingBlitz })),
);
const PackageManagerBlitz = React.lazy(() =>
  import("./views/PackageManagerBlitz").then((m) => ({ default: m.PackageManagerBlitz })),
);
const VideoDemos = React.lazy(() =>
  import("./views/VideoDemos").then((m) => ({ default: m.VideoDemos })),
);
const AgentConsole = React.lazy(() =>
  import("./views/AgentConsole").then((m) => ({ default: m.AgentConsole })),
);
const ReviewQueue = React.lazy(() =>
  import("./views/ReviewQueue").then((m) => ({ default: m.ReviewQueue })),
);
const PrFlywheel = React.lazy(() =>
  import("./views/PrFlywheel").then((m) => ({ default: m.PrFlywheel })),
);
const RecipeHub = React.lazy(() =>
  import("./views/RecipeHub").then((m) => ({ default: m.RecipeHub })),
);
const ContributorFlywheel = React.lazy(() =>
  import("./views/ContributorFlywheel").then((m) => ({ default: m.ContributorFlywheel })),
);
const DoctorDemo = React.lazy(() =>
  import("./views/DoctorDemo").then((m) => ({ default: m.DoctorDemo })),
);
const LaunchCampaign = React.lazy(() =>
  import("./views/LaunchCampaign").then((m) => ({ default: m.LaunchCampaign })),
);
const Playground = React.lazy(() =>
  import("./views/Playground").then((m) => ({ default: m.Playground })),
);
const ArticleModal = React.lazy(() =>
  import("./components/ArticleModal").then((m) => ({ default: m.ArticleModal })),
);

const VALID_TABS: ActiveTab[] = [
  "issues",
  "articles",
  "trends",
  "demos",
  "listings",
  "packages",
  "contributors",
  "recipes",
  "agent",
  "review",
  "flywheel",
  "doctor",
  "launch",
  "playground",
];

export const resolveActiveTabFromLocation = (
  rawHash: string,
  searchStr: string = "",
): ActiveTab => {
  const currentSearch = searchStr ? new URLSearchParams(searchStr) : null;
  if (rawHash.includes("scenario=") || (currentSearch && currentSearch.has("scenario"))) {
    return "playground";
  }

  const hashWithoutPound = rawHash.replace(/^#/, "");
  if (
    hashWithoutPound.includes("?") ||
    hashWithoutPound.includes("&") ||
    hashWithoutPound.includes("=")
  ) {
    try {
      const [possibleTab] = hashWithoutPound.split("?");
      if (VALID_TABS.includes(possibleTab as ActiveTab)) {
        return possibleTab as ActiveTab;
      }
      const hashParams = new URLSearchParams(hashWithoutPound);
      const tabParam = hashParams.get("tab") as ActiveTab | null;
      if (tabParam && VALID_TABS.includes(tabParam)) {
        return tabParam;
      }
    } catch {
      // ignore
    }
  }

  if (VALID_TABS.includes(hashWithoutPound as ActiveTab)) {
    return hashWithoutPound as ActiveTab;
  }

  const tabParam = currentSearch?.get("tab") as ActiveTab | null;
  if (tabParam && VALID_TABS.includes(tabParam)) {
    return tabParam;
  }

  return "issues";
};

export const App: React.FC = () => {
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialArticleId = searchParams?.get("article");

  const getInitialTab = (): ActiveTab => {
    const rawHash = typeof window !== "undefined" ? window.location.hash : "";
    const searchStr = typeof window !== "undefined" ? window.location.search : "";
    return resolveActiveTabFromLocation(rawHash, searchStr);
  };

  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialTab);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    if (tab === "playground") {
      const currentHash = typeof window !== "undefined" ? window.location.hash : "";
      if (!currentHash.includes("scenario=") && !currentHash.startsWith("#playground")) {
        window.location.hash = "playground";
      }
    } else {
      window.location.hash = tab;
    }
  };
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [issues, setIssues] = useState<GrowthIssue[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [packages, setPackages] = useState<PackageManagerTarget[]>([]);
  const [demos, setDemos] = useState<VideoDemo[]>([]);
  const [githubStatus, setGithubStatus] = useState<
    | {
        configured: boolean;
        username?: string;
        message: string;
      }
    | undefined
  >(undefined);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [contributorIssues, setContributorIssues] = useState<ContributorIssue[]>([]);
  const [launchCampaign, setLaunchCampaign] = useState<LaunchCampaignState | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Live Terminal & Modal State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [terminalTitle, setTerminalTitle] = useState<string>("Antigravity Agent");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articleModalTab, setArticleModalTab] = useState<
    "content" | "raw" | "backlinks" | "export" | "engagement"
  >(
    (searchParams?.get("modalTab") as "content" | "raw" | "backlinks" | "export" | "engagement") ||
      "content",
  );

  // Initial Data Fetching
  const fetchAll = async () => {
    try {
      const [
        resIssues,
        resArticles,
        resTrends,
        resListings,
        resPackages,
        resStatus,
        resDemos,
        resGithub,
        resRecipes,
        resContributors,
        resLaunch,
      ] = await Promise.all([
        fetch("/api/issues").then((r) => r.json()),
        fetch("/api/articles").then((r) => r.json()),
        fetch("/api/trends").then((r) => r.json()),
        fetch("/api/listings").then((r) => r.json()),
        fetch("/api/packages").then((r) => r.json()),
        fetch("/api/agent/status").then((r) => r.json()),
        fetch("/api/demos").then((r) => r.json()),
        fetch("/api/submissions/github-status")
          .then((r) => r.json())
          .catch(() => undefined),
        fetch("/api/recipes").then((r) => r.json()),
        fetch("/api/contributors/issues").then((r) => r.json()),
        fetch("/api/launch/overview")
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setIssues(resIssues);
      setArticles(resArticles);
      setTrends(resTrends);
      setListings(resListings);
      setPackages(resPackages);
      setAgentStatus(resStatus);
      setDemos(resDemos);
      if (resGithub) {
        setGithubStatus(resGithub);
      }
      setRecipes(resRecipes);
      setContributorIssues(resContributors);
      if (resLaunch) {
        setLaunchCampaign(resLaunch);
      }

      if (initialArticleId && !selectedArticle) {
        const found = resArticles.find((a: Article) => a.id === initialArticleId);
        if (found) {
          setSelectedArticle(found);
        }
      }
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
    }
  };

  useEffect(() => {
    fetchAll();

    const handleHashChange = () => {
      const rawHash = typeof window !== "undefined" ? window.location.hash : "";
      const searchStr = typeof window !== "undefined" ? window.location.search : "";
      const resolved = resolveActiveTabFromLocation(rawHash, searchStr);
      setActiveTabState(resolved);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleRunRecipe = async (recipeId: string, parameters: Record<string, string>) => {
    try {
      const res = await fetch(`/api/recipes/${recipeId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters }),
      });
      if (res.ok) {
        const data: RunRecipeResponse = await res.json();
        if (data.task_id) {
          setTerminalTitle(`Recipe: ${recipeId}`);
          setActiveTaskId(data.task_id);
          fetchAll();
        }
      }
    } catch (err) {
      console.error("Failed to run recipe:", err);
    }
  };

  // Issue Handlers
  const handleRunIssue = async (id: string) => {
    try {
      const res = await fetch(`/api/issues/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Issue Action #${id}`);
        setActiveTaskId(data.task_id);
        fetchAll();
      }
    } catch (err) {
      console.error("Run issue error:", err);
    }
  };

  const handleUpdateIssueStatus = async (
    id: string,
    status: "Todo" | "In Progress" | "Active Routine" | "Done",
  ) => {
    try {
      await fetch(`/api/issues/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAll();
    } catch (err) {
      console.error("Update issue error:", err);
    }
  };

  const handleCreateIssue = async (issueData: Partial<GrowthIssue>) => {
    try {
      await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issueData),
      });
      fetchAll();
    } catch (err) {
      console.error("Create issue error:", err);
    }
  };

  // Article Handlers
  const handleGenerateArticle = async (
    feature: string,
    angle: string,
    channel: string,
    extra: string,
    timeoutSecs?: number,
  ) => {
    try {
      const res = await fetch("/api/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature,
          angle,
          channel,
          extra_context: extra || undefined,
          timeout_secs: timeoutSecs || undefined,
        }),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Drafting 10x Article: ${feature} (${angle})`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Generate article error:", err);
    }
  };

  const handleGenerateSpotlight = async (payload: {
    project_name: string;
    repo_url: string;
    tagline: string;
    key_features: string[];
    target_channel: string;
    extra_notes?: string;
    timeout_secs?: number;
  }) => {
    try {
      const res = await fetch("/api/articles/generate-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Drafting Project Spotlight: ${payload.project_name}`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Generate spotlight error:", err);
    }
  };
  const handleUpdateArticleStatus = async (
    id: string,
    status: "Draft" | "Ready" | "Published" | "Approved" | "Rejected",
  ) => {
    try {
      await fetch(`/api/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAll();
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      console.error("Update article status error:", err);
    }
  };

  const handleSyncMetrics = async () => {
    try {
      const res = await fetch("/api/articles/sync-metrics", { method: "POST" });
      if (res.ok) {
        fetchAll();
      }
    } catch (err) {
      console.error("Sync metrics error:", err);
    }
  };

  // Trend Handlers
  const handleScoutTrends = async (
    sourcesOrMode?: string[] | "general" | "discussions",
    optionalMode?: "general" | "discussions",
  ) => {
    let mode: "general" | "discussions" = "general";
    let sources: string[] | undefined = undefined;

    if (Array.isArray(sourcesOrMode)) {
      sources = sourcesOrMode;
      if (optionalMode) {
        mode = optionalMode;
      }
    } else if (sourcesOrMode === "discussions" || sourcesOrMode === "general") {
      mode = sourcesOrMode;
    }

    try {
      const res = await fetch("/api/trends/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sources }),
      });
      const data = await res.json();
      if (data.task_id) {
        if (mode === "discussions") {
          const targetsLabel =
            sources && sources.length > 0
              ? ` (${sources.slice(0, 3).join(", ")}${sources.length > 3 ? "..." : ""})`
              : " (Reddit & HN)";
          setTerminalTitle(`Harvester: Social Discussions${targetsLabel}`);
        } else {
          setTerminalTitle(`Scouting ${sources?.length ? sources.join(", ") : "All"} Trends`);
        }
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Scout trends error:", err);
    }
  };

  const handleSynthesizeTrend = async (
    id: string,
    tieIn: "direct" | "subtle" | "none",
    channel: string,
  ) => {
    try {
      const res = await fetch(`/api/trends/${id}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tendril_tie_in: tieIn, channel }),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Synthesizing Trend to ${channel}`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Synthesize trend error:", err);
    }
  };

  // Listing Handlers
  const handleGenerateBlurb = async (id: string) => {
    try {
      const res = await fetch(`/api/listings/${id}/generate-blurb`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Tailoring PR Blurb for Listing #${id}`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Generate blurb error:", err);
    }
  };

  const handleUpdateListingStatus = async (id: string, status: any, prUrl?: string) => {
    try {
      await fetch(`/api/listings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, pr_url: prUrl }),
      });
      fetchAll();
    } catch (err) {
      console.error("Update listing error:", err);
    }
  };

  const handleCreateListing = async (listingData: Partial<Listing>) => {
    try {
      await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listingData),
      });
      fetchAll();
    } catch (err) {
      console.error("Create listing error:", err);
    }
  };

  const handleBatchGenerateBlurbs = async (category?: string, listingIds?: string[]) => {
    try {
      const res = await fetch("/api/listings/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category === "all" ? undefined : category,
          listing_ids: listingIds,
        }),
      });
      const data = await res.json();
      if (data.task_ids && data.task_ids.length > 0) {
        setTerminalTitle(`Batch Blurb Generation (${data.targeted_count} targets)`);
        setActiveTaskId(data.task_ids[0]);
      }
      fetchAll();
      return data;
    } catch (err) {
      console.error("Batch generate blurbs error:", err);
      throw err;
    }
  };

  const handleVerifyBacklink = async (id: string) => {
    try {
      const res = await fetch(`/api/listings/${id}/verify-backlink`, {
        method: "POST",
      });
      const data = await res.json();
      fetchAll();
      return data;
    } catch (err) {
      console.error("Verify backlink error:", err);
      throw err;
    }
  };

  const handleSubmitUpstream = async (id: string) => {
    try {
      const res = await fetch(`/api/listings/${id}/submit-upstream`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Automated Upstream PR Submission #${id}`);
        setActiveTaskId(data.task_id);
      }
      fetchAll();
      return data;
    } catch (err) {
      console.error("Submit upstream PR error:", err);
      throw err;
    }
  };

  const handleBatchSubmitUpstream = async (category?: string, listingIds?: string[]) => {
    try {
      const res = await fetch("/api/listings/submit-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category === "all" ? undefined : category,
          listing_ids: listingIds,
        }),
      });
      const data = await res.json();
      if (data.task_ids && data.task_ids.length > 0) {
        setTerminalTitle(`Batch Upstream PR Submissions (${data.targeted_count} targets)`);
        setActiveTaskId(data.task_ids[0]);
      }
      fetchAll();
      return data;
    } catch (err) {
      console.error("Batch submit upstream PRs error:", err);
      throw err;
    }
  };

  const handleSyncAllPrs = async () => {
    try {
      const res = await fetch("/api/listings/sync-prs", { method: "POST" });
      const data = await res.json();
      fetchAll();
      return data;
    } catch (err) {
      console.error("Sync all PRs error:", err);
      throw err;
    }
  };

  const handleSyncSinglePr = async (id: string) => {
    try {
      const res = await fetch(`/api/listings/${id}/sync-pr`, { method: "POST" });
      const data = await res.json();
      fetchAll();
      return data;
    } catch (err) {
      console.error("Sync single PR error:", err);
      throw err;
    }
  };

  const handleUpdatePackageStatus = async (
    id: string,
    payload: { status?: string; pr_url?: string; notes?: string },
  ) => {
    try {
      await fetch(`/api/packages/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      fetchAll();
    } catch (err) {
      console.error("Update package status error:", err);
    }
  };

  const handleDispatchPackagePr = async (
    id: string,
    version?: string,
    tagOrSkipAuth?: string | boolean,
    skipAuthCheck?: boolean,
    skipSyncCheck?: boolean,
  ) => {
    const tag = typeof tagOrSkipAuth === "string" ? tagOrSkipAuth : undefined;
    const skipAuth = typeof tagOrSkipAuth === "boolean" ? tagOrSkipAuth : skipAuthCheck;
    try {
      const res = await fetch(`/api/packages/${id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          tag,
          skip_auth_check: skipAuth,
          skip_sync_check: skipSyncCheck,
        }),
      });
      const data = await res.json();
      if (data && data.task_id) {
        setTerminalTitle("Antigravity Upstream PR Dispatcher");
        setActiveTaskId(data.task_id);
      }
      fetchAll();
      return data?.task_id;
    } catch (err) {
      console.error("Dispatch package PR error:", err);
    }
  };

  const handleGenerateDemo = async (feature: string, platform: string, duration: number) => {
    try {
      const res = await fetch("/api/demos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature,
          target_platform: platform,
          duration_seconds: duration,
        }),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Generating ${feature} Demo (${platform})`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Generate demo error:", err);
    }
  };

  // Custom Prompt
  const handleRunCustomPrompt = async (prompt: string) => {
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle("Custom Antigravity Turn");
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error("Run custom prompt error:", err);
    }
  };

  // Review Queue State & Handlers
  const baseReviewItems: ReviewItem[] = [
    {
      id: "rev-demo-1",
      type: "video_demo",
      title: "Automated Worktree Sandboxing Demo (60s Screen Recording)",
      subtitle: "Target: LinkedIn Tech Video • Duration: 60s",
      channel: "LinkedIn",
      summary:
        "Short, punchy screen recording showing Tendril launching an agent into an isolated worktree and executing tests without touching main branch.",
      content:
        "## Video Demo Outline (60s)\n\n0:00 - 0:10: Show local developer repository with clean branch.\n0:10 - 0:25: Agent launches, worktree created dynamically in .tendril/Plans/.\n0:25 - 0:45: Parallel cargo test executes inside worktree while main repo stays untouched.\n0:45 - 1:00: PR opened with all tests green. Call to action: Star Ivy-Tendril on GitHub!\n",
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      citations: ["https://git-scm.com/docs/git-worktree"],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "demo-1",
    },
    {
      id: "rev-trend-1",
      type: "trend_synthesis",
      title: "OpenCode & Terminal AI: Why Multi-Agent Sandboxes Are the Next Frontier",
      subtitle: "Source: GitHub Trending #1 • Tie-in: Direct Tendril Worktree Comparison",
      channel: "Dev.to",
      summary:
        "Synthesis connecting the viral adoption of terminal coding agents with the critical need for isolated git worktrees to prevent workspace corruption.",
      content:
        "# OpenCode & Terminal AI: Why Multi-Agent Sandboxes Are the Next Frontier\n\nTerminal-first AI agents are breaking GitHub star records this week. But behind the hype, senior engineers are asking: how do you run 3 autonomous agents in parallel on the same codebase without destroying your local branch?\n\nEnter Git Worktrees: zero-copy workspace isolation.\n",
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      citations: ["https://github.com/trending"],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "trend-1",
    },
    {
      id: "rev-listing-1",
      type: "listing_blurb",
      title: "Awesome-AI-Agents Directory PR Submission Blurb",
      subtitle: "Target: e2b/awesome-ai-agents • Category: Autonomous Software Factory",
      channel: "GitHub PR",
      summary:
        "Tailored listing blurb positioning Ivy-Tendril as the premier autonomous plan management and agentic orchestration system.",
      content:
        "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous plan management and multi-agent orchestration engine featuring isolated Git worktree sandboxing and automated verification gates.\n",
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      citations: ["https://github.com/e2b-dev/awesome-ai-agents"],
      status: "Pending",
      createdAt: "2026-09-10T12:00:00Z",
      rawId: "listing-1",
    },
  ];

  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(baseReviewItems);

  useEffect(() => {
    const articleItems: ReviewItem[] = articles.map((art) => ({
      id: `article-${art.id}`,
      type: "article" as const,
      title: art.title,
      subtitle: `${art.feature} • Channel: ${art.channel}`,
      channel: art.channel,
      summary: art.summary,
      content: art.content,
      backlinks: art.backlinks || [],
      citations: art.outbound_citations || [],
      status:
        art.status === "Approved"
          ? "Approved"
          : art.status === "Rejected"
            ? "Rejected"
            : art.status === "Published"
              ? "Published"
              : "Pending",
      createdAt: art.created_at,
      rawId: art.id,
    }));

    const demoItems: ReviewItem[] = demos.map((demo) => {
      let content = `${demo.headline}\n\n${demo.body}`;

      if (demo.scenes && demo.scenes.length > 0) {
        content += "\n\n### 4-Stage Storyboard Breakdown:\n";
        demo.scenes.forEach((s) => {
          const startM = Math.floor(s.start_second / 60);
          const startS = (s.start_second % 60).toString().padStart(2, "0");
          const endM = Math.floor(s.end_second / 60);
          const endS = (s.end_second % 60).toString().padStart(2, "0");
          content += `- [${s.stage}] (${startM}:${startS} - ${endM}:${endS}) ${s.title}: ${s.visual_action}\n`;
          if (s.playwright_action) {
            content += `  Action: \`${s.playwright_action}\`\n`;
          }
        });
      } else if (demo.storyboard) {
        content += `\n\n### Storyboard\n${demo.storyboard}`;
      }

      if (demo.platform_copy) {
        content += "\n\n### Multi-Platform Copy Package:\n";
        content += `**LinkedIn:**\n${demo.platform_copy.linkedin_post}\n\n`;
        content += `**X/Twitter Thread:**\n${demo.platform_copy.twitter_thread.join("\n---\n")}\n\n`;
        content += `**YouTube Shorts:**\n${demo.platform_copy.youtube_shorts_caption}\n`;
      }

      if (demo.automation_config) {
        content += `\n\n### Playwright Automation Config:\nGenerator Path: ${demo.automation_config.generator_path}\nFormat: ${demo.automation_config.transcode_format}\nScript:\n\`\`\`javascript\n${demo.automation_config.playwright_script}\n\`\`\``;
      }

      return {
        id: `demo-${demo.id}`,
        type: "video_demo" as const,
        title: demo.headline,
        subtitle: `${demo.feature} • Platform: ${demo.target_platform} (${demo.duration_seconds}s)`,
        channel: demo.target_platform,
        summary: `Video script & storyboard for ${demo.feature} on ${demo.target_platform}`,
        content,
        backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
        citations: [],
        status:
          demo.status === "Approved"
            ? "Approved"
            : demo.status === "Rejected"
              ? "Rejected"
              : demo.status === "Published"
                ? "Published"
                : "Pending",
        createdAt: demo.created_at,
        rawId: demo.id,
      };
    });

    const trendItems: ReviewItem[] = trends.map((trend) => ({
      id: `trend-${trend.id}`,
      type: "trend_synthesis" as const,
      title: trend.topic,
      subtitle: `Source: ${trend.source} • Signal: ${trend.engagement}`,
      channel: trend.source,
      summary: trend.summary,
      content: `# ${trend.topic}\n\n**Source:** ${trend.source} (${trend.url})\n**Engagement:** ${trend.engagement}\n**Tendril Tie-In:** ${trend.tendril_tie_in}\n\n${trend.summary}`,
      backlinks:
        trend.tendril_tie_in !== "none" ? ["https://github.com/Ivy-Interactive/Ivy-Tendril"] : [],
      citations: [trend.url],
      status:
        trend.status === "Approved"
          ? "Approved"
          : trend.status === "Rejected"
            ? "Rejected"
            : trend.status === "Published"
              ? "Published"
              : "Pending",
      createdAt: trend.created_at,
      rawId: trend.id,
    }));

    const dynamicListingItems: ReviewItem[] = listings
      .filter((l) => l.submission_blurb && l.submission_blurb.trim().length > 0)
      .map((l) => ({
        id: `listing-${l.id}`,
        type: "listing_blurb" as const,
        title: l.name,
        subtitle: `${l.category} • ${l.url}`,
        channel: l.category === "Awesome Repo" ? "GitHub PR" : "Directory",
        summary: l.notes || `Submission blurb for ${l.name}`,
        content: l.submission_blurb,
        backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
        citations: [l.url],
        status:
          l.blurb_status === "Approved"
            ? "Approved"
            : l.blurb_status === "Rejected"
              ? "Rejected"
              : "Pending",
        createdAt: l.updated_at,
        rawId: l.id,
      }));

    const listingItems =
      dynamicListingItems.length > 0
        ? dynamicListingItems
        : baseReviewItems.filter((it) => it.type === "listing_blurb");

    setReviewItems([
      ...articleItems,
      ...(demoItems.length > 0
        ? demoItems
        : baseReviewItems.filter((it) => it.type === "video_demo")),
      ...(trendItems.length > 0
        ? trendItems
        : baseReviewItems.filter((it) => it.type === "trend_synthesis")),
      ...(listingItems.length > 0
        ? listingItems
        : baseReviewItems.filter((it) => it.type === "listing_blurb")),
    ]);
  }, [articles, demos, trends, listings]);

  const handleApproveReviewItem = async (item: ReviewItem) => {
    setReviewItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: "Approved" } : it)),
    );
    if (item.type === "article") {
      await handleUpdateArticleStatus(item.rawId, "Approved");
    } else if (item.type === "video_demo") {
      try {
        await fetch(`/api/demos/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Approved" }),
        });
        fetchAll();
      } catch (err) {
        console.error("Approve video demo error:", err);
      }
    } else if (item.type === "trend_synthesis") {
      try {
        await fetch(`/api/trends/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Approved" }),
        });
        fetchAll();
      } catch (err) {
        console.error("Approve trend error:", err);
      }
    } else if (item.type === "listing_blurb") {
      try {
        await fetch(`/api/listings/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blurb_status: "Approved" }),
        });
        fetchAll();
      } catch (err) {
        console.error("Approve listing blurb error:", err);
      }
    }
  };

  const downloadReviewItemMarkdown = (item: ReviewItem) => {
    const markdown = `# ${item.title}\n\n**Type:** ${item.type} | **Channel:** ${item.channel}\n\n${item.summary}\n\n---\n\n${item.content}\n\n**Backlinks:** ${item.backlinks.join(", ")}`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.type}_${item.rawId}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAutoPostReviewItem = async (item: ReviewItem) => {
    if (item.type === "article") {
      const res = await fetch(`/api/articles/${item.rawId}/auto-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_hero_image: true, hero_format: "dual" }),
      });
      if (!res.ok) {
        throw new Error(`Auto-post failed for article ${item.rawId}`);
      }
    } else if (item.type === "listing_blurb") {
      const res = await fetch(`/api/listings/${item.rawId}/submit-pr`, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Upstream PR dispatch failed for listing ${item.rawId}`);
      }
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Automated Upstream PR Submission #${item.rawId}`);
        setActiveTaskId(data.task_id);
      }
    } else if (item.type === "video_demo") {
      const res = await fetch(`/api/demos/${item.rawId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Published" }),
      });
      if (!res.ok) {
        throw new Error(`Publish failed for video demo ${item.rawId}`);
      }
      downloadReviewItemMarkdown(item);
    } else if (item.type === "trend_synthesis") {
      const res = await fetch(`/api/trends/${item.rawId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Published" }),
      });
      if (!res.ok) {
        throw new Error(`Publish failed for trend synthesis ${item.rawId}`);
      }
      downloadReviewItemMarkdown(item);
    }
    fetchAll();
  };

  const handleRejectReviewItem = async (item: ReviewItem) => {
    setReviewItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: "Rejected" } : it)),
    );
    if (item.type === "article") {
      await handleUpdateArticleStatus(item.rawId, "Rejected");
    } else if (item.type === "video_demo") {
      try {
        await fetch(`/api/demos/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Rejected" }),
        });
        fetchAll();
      } catch (err) {
        console.error("Reject video demo error:", err);
      }
    } else if (item.type === "trend_synthesis") {
      try {
        await fetch(`/api/trends/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Rejected" }),
        });
        fetchAll();
      } catch (err) {
        console.error("Reject trend error:", err);
      }
    } else if (item.type === "listing_blurb") {
      try {
        await fetch(`/api/listings/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blurb_status: "Rejected" }),
        });
        fetchAll();
      } catch (err) {
        console.error("Reject listing blurb error:", err);
      }
    }
  };

  const handleRefineReviewItem = async (item: ReviewItem, updated: Partial<ReviewItem>) => {
    let nextUpdated = { ...updated };
    if (!updated.status) {
      const isModified =
        (item.type === "listing_blurb" &&
          updated.content !== undefined &&
          updated.content !== item.content) ||
        (item.type === "article" &&
          ((updated.content !== undefined && updated.content !== item.content) ||
            (updated.title !== undefined && updated.title !== item.title) ||
            (updated.summary !== undefined && updated.summary !== item.summary))) ||
        (item.type === "video_demo" &&
          ((updated.content !== undefined && updated.content !== item.content) ||
            (updated.title !== undefined && updated.title !== item.title))) ||
        (item.type === "trend_synthesis" &&
          ((updated.content !== undefined && updated.content !== item.content) ||
            (updated.title !== undefined && updated.title !== item.title) ||
            (updated.summary !== undefined && updated.summary !== item.summary)));

      if (isModified) {
        nextUpdated.status = "Pending";
      }
    }
    setReviewItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, ...nextUpdated } : it)),
    );
    if (item.type === "article") {
      try {
        await fetch(`/api/articles/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updated.title,
            channel: updated.channel,
            summary: updated.summary,
            content: updated.content,
            backlinks: updated.backlinks,
            status: nextUpdated.status ?? updated.status,
          }),
        });
        fetchAll();
      } catch (err) {
        console.error("Refine article error:", err);
      }
    } else if (item.type === "video_demo") {
      try {
        await fetch(`/api/demos/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: updated.title,
            body: updated.content,
            status: nextUpdated.status ?? updated.status,
          }),
        });
        fetchAll();
      } catch (err) {
        console.error("Refine video demo error:", err);
      }
    } else if (item.type === "trend_synthesis") {
      try {
        await fetch(`/api/trends/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: updated.title,
            summary: updated.summary,
            status: nextUpdated.status ?? updated.status,
          }),
        });
        fetchAll();
      } catch (err) {
        console.error("Refine trend error:", err);
      }
    } else if (item.type === "listing_blurb") {
      try {
        const isModified = updated.content !== undefined && updated.content !== item.content;
        const blurbStatus = nextUpdated.status ?? (isModified ? "Pending" : undefined);
        await fetch(`/api/listings/${item.rawId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submission_blurb: updated.content,
            notes: updated.summary,
            ...(blurbStatus ? { blurb_status: blurbStatus } : {}),
          }),
        });
        fetchAll();
      } catch (err) {
        console.error("Refine listing blurb error:", err);
      }
    }
  };

  const handleBatchPublish = async (itemsToPublish: ReviewItem[]) => {
    for (const it of itemsToPublish) {
      if (it.type === "article") {
        await handleUpdateArticleStatus(it.rawId, "Published");
      } else if (it.type === "video_demo") {
        try {
          await fetch(`/api/demos/${it.rawId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Published" }),
          });
        } catch (err) {
          console.error("Publish video demo error:", err);
        }
      } else if (it.type === "listing_blurb") {
        try {
          await fetch(`/api/listings/${it.rawId}/submit-pr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("Batch publish PR submission error for listing:", err);
        }
      }
    }
    setReviewItems((prev) =>
      prev.map((it) =>
        itemsToPublish.some((pub) => pub.id === it.id) ? { ...it, status: "Approved" } : it,
      ),
    );
    fetchAll();
  };

  const pendingReviewCount = reviewItems.filter((it) => it.status === "Pending").length;
  const remainingLaunchChecklist = launchCampaign
    ? launchCampaign.syndication_checklist.filter((i) => !i.completed).length
    : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        agentStatus={agentStatus}
        issuesCount={issues.length}
        articlesCount={articles.length}
        trendsCount={trends.length}
        listingsCount={listings.length}
        packagesCount={packages.length}
        reviewCount={pendingReviewCount}
        recipesCount={recipes.length}
        contributorsCount={contributorIssues.filter((i) => !i.claimed).length}
        launchCount={remainingLaunchChecklist}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Mobile top bar (visible only on < lg screens) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-slate-950 font-bold" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                SpaceCorps // GrowthHack
              </span>
            </div>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs border ${
              agentStatus?.is_available
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                : "bg-rose-950/60 text-rose-300 border-rose-800/80"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span className="font-mono text-[10px]">
              {agentStatus?.is_available ? "Antigravity" : "Offline"}
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-24 text-slate-400">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading view...</span>
                </div>
              </div>
            }
          >
            {activeTab === "recipes" && (
              <RecipeHub recipes={recipes} onRefresh={fetchAll} onRunRecipe={handleRunRecipe} />
            )}
            {activeTab === "issues" && (
              <IssuesHub
                issues={issues}
                onRunIssue={handleRunIssue}
                onUpdateStatus={handleUpdateIssueStatus}
                onCreateIssue={handleCreateIssue}
              />
            )}

            {activeTab === "articles" && (
              <ArticleEngine
                articles={articles}
                onGenerateArticle={handleGenerateArticle}
                onGenerateSpotlight={handleGenerateSpotlight}
                onSelectArticle={(art, tab) => {
                  setSelectedArticle(art);
                  setArticleModalTab(tab || "content");
                }}
                onUpdateStatus={handleUpdateArticleStatus}
                onSyncMetrics={handleSyncMetrics}
                onResetEngagement={fetchAll}
              />
            )}

            {activeTab === "review" && (
              <ReviewQueue
                items={reviewItems}
                onApprove={handleApproveReviewItem}
                onReject={handleRejectReviewItem}
                onRefine={handleRefineReviewItem}
                onBatchPublish={handleBatchPublish}
                onAutoPost={handleAutoPostReviewItem}
              />
            )}
            {activeTab === "trends" && (
              <TrendRadar
                trends={trends}
                articles={articles}
                onScoutTrends={handleScoutTrends}
                onSynthesizeTrend={handleSynthesizeTrend}
                onSelectArticle={(art) => setSelectedArticle(art)}
                onUpdateArticleStatus={handleUpdateArticleStatus}
              />
            )}

            {activeTab === "demos" && (
              <VideoDemos onGenerateDemo={handleGenerateDemo} demos={demos} />
            )}

            {activeTab === "listings" && (
              <ListingBlitz
                listings={listings}
                onGenerateBlurb={handleGenerateBlurb}
                onUpdateStatus={handleUpdateListingStatus}
                onCreateListing={handleCreateListing}
                onBatchGenerateBlurbs={handleBatchGenerateBlurbs}
                onVerifyBacklink={handleVerifyBacklink}
                onSubmitUpstream={handleSubmitUpstream}
                onBatchSubmitUpstream={handleBatchSubmitUpstream}
                githubStatus={githubStatus}
                onSyncAllPrs={handleSyncAllPrs}
                onSyncSinglePr={handleSyncSinglePr}
              />
            )}

            {activeTab === "packages" && (
              <PackageManagerBlitz
                packages={packages}
                onUpdatePackageStatus={handleUpdatePackageStatus}
                onDispatchPackagePr={handleDispatchPackagePr}
              />
            )}

            {activeTab === "contributors" && <ContributorFlywheel onIssueClaimed={fetchAll} />}

            {activeTab === "flywheel" && <PrFlywheel />}

            {activeTab === "launch" && (
              <LaunchCampaign
                initialCampaign={launchCampaign || undefined}
                onCampaignUpdated={fetchAll}
              />
            )}

            {activeTab === "agent" && (
              <AgentConsole agentStatus={agentStatus} onRunCustomPrompt={handleRunCustomPrompt} />
            )}

            {activeTab === "doctor" && <DoctorDemo />}
            {activeTab === "playground" && <Playground />}
          </React.Suspense>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-900/50 py-4 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>GrowthHack Platform &middot; Scaling Ivy-Tendril adoption</p>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab("contributors")}
                className="text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Contributor Guide & Fast-Track Onboarding
              </button>
              <a
                href="https://github.com/SpaceCorps/GrowthHack"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-200 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating Live Terminal for Real-Time Streaming */}
      <LiveTerminal
        taskId={activeTaskId}
        title={terminalTitle}
        onClose={() => setActiveTaskId(null)}
        onTaskCompleted={() => {
          fetchAll();
        }}
      />

      {/* Article Detail & Markdown Viewer Modal */}
      {selectedArticle && (
        <React.Suspense fallback={null}>
          <ArticleModal
            article={selectedArticle}
            initialTab={articleModalTab}
            onClose={() => setSelectedArticle(null)}
            onUpdateStatus={handleUpdateArticleStatus}
            onArticleUpdated={(updated) => {
              setSelectedArticle(updated);
              fetchAll();
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};
