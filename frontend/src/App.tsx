import React, { useEffect, useState } from "react";
import type {
  ActiveTab,
  AgentStatus,
  Article,
  ContributorIssue,
  GrowthIssue,
  Listing,
  PackageManagerTarget,
  ReviewItem,
  TrendTopic,
  VideoDemo,
} from "./types";
import { Navigation } from "./components/Navigation";
import { LiveTerminal } from "./components/LiveTerminal";
import { ArticleModal } from "./components/ArticleModal";
import { IssuesHub } from "./views/IssuesHub";
import { ArticleEngine } from "./views/ArticleEngine";
import { TrendRadar } from "./views/TrendRadar";
import { ListingBlitz } from "./views/ListingBlitz";
import { PackageManagerBlitz } from "./views/PackageManagerBlitz";
import { VideoDemos } from "./views/VideoDemos";
import { AgentConsole } from "./views/AgentConsole";
import { ReviewQueue } from "./views/ReviewQueue";
import { PrFlywheel } from "./views/PrFlywheel";
import { ContributorFlywheel } from "./views/ContributorFlywheel";
import { DoctorDemo } from "./views/DoctorDemo";

export const App: React.FC = () => {
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialTabParam = searchParams?.get("tab") as ActiveTab | null;
  const initialArticleId = searchParams?.get("article");

  const getInitialTab = (): ActiveTab => {
    const hash = window.location.hash.replace("#", "") as ActiveTab;
    const validTabs: ActiveTab[] = [
      "issues",
      "articles",
      "trends",
      "demos",
      "listings",
      "packages",
      "contributors",
      "agent",
      "review",
      "flywheel",
      "doctor",
    ];
    if (validTabs.includes(hash)) return hash;
    return initialTabParam && validTabs.includes(initialTabParam) ? initialTabParam : "issues";
  };

  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialTab);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    window.location.hash = tab;
  };
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [issues, setIssues] = useState<GrowthIssue[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [packages, setPackages] = useState<PackageManagerTarget[]>([]);
  const [demos, setDemos] = useState<VideoDemo[]>([]);
  const [contributorIssues, setContributorIssues] = useState<ContributorIssue[]>([]);

  // Live Terminal & Modal State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [terminalTitle, setTerminalTitle] = useState<string>("Antigravity Agent");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articleModalTab, setArticleModalTab] = useState<
    "content" | "raw" | "backlinks" | "export"
  >((searchParams?.get("modalTab") as "content" | "raw" | "backlinks" | "export") || "content");

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
        resContributors,
      ] = await Promise.all([
        fetch("/api/issues").then((r) => r.json()),
        fetch("/api/articles").then((r) => r.json()),
        fetch("/api/trends").then((r) => r.json()),
        fetch("/api/listings").then((r) => r.json()),
        fetch("/api/packages").then((r) => r.json()),
        fetch("/api/agent/status").then((r) => r.json()),
        fetch("/api/demos").then((r) => r.json()),
        fetch("/api/contributors/issues").then((r) => r.json()),
      ]);
      setIssues(resIssues);
      setArticles(resArticles);
      setTrends(resTrends);
      setListings(resListings);
      setPackages(resPackages);
      setAgentStatus(resStatus);
      setDemos(resDemos);
      setContributorIssues(resContributors);

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
      const hash = window.location.hash.replace("#", "") as ActiveTab;
      const validTabs: ActiveTab[] = [
        "issues",
        "articles",
        "trends",
        "demos",
        "listings",
        "packages",
        "contributors",
        "agent",
        "review",
        "flywheel",
      ];
      if (validTabs.includes(hash)) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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

  const handleDispatchPackagePr = async (id: string, version?: string) => {
    try {
      const res = await fetch(`/api/packages/${id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
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
        art.status === "Approved" ? "Approved" : art.status === "Rejected" ? "Rejected" : "Pending",
      createdAt: art.created_at,
      rawId: art.id,
    }));

    const demoItems: ReviewItem[] = demos.map((demo) => ({
      id: `demo-${demo.id}`,
      type: "video_demo" as const,
      title: demo.headline,
      subtitle: `${demo.feature} • Platform: ${demo.target_platform} (${demo.duration_seconds}s)`,
      channel: demo.target_platform,
      summary: `Video script & storyboard for ${demo.feature} on ${demo.target_platform}`,
      content: `${demo.headline}\n\n${demo.body}\n\n### Storyboard\n${demo.storyboard}`,
      backlinks: ["https://github.com/Ivy-Interactive/Ivy-Tendril"],
      citations: [],
      status:
        demo.status === "Approved"
          ? "Approved"
          : demo.status === "Rejected"
            ? "Rejected"
            : "Pending",
      createdAt: demo.created_at,
      rawId: demo.id,
    }));

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
    if (
      item.type === "listing_blurb" &&
      updated.content !== undefined &&
      updated.content !== item.content &&
      !updated.status
    ) {
      nextUpdated.status = "Pending";
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
            status: updated.status,
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
            status: updated.status,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        agentStatus={agentStatus}
        issuesCount={issues.length}
        articlesCount={articles.length}
        trendsCount={trends.length}
        listingsCount={listings.length}
        packagesCount={packages.length}
        reviewCount={pendingReviewCount}
        contributorsCount={contributorIssues.filter((i) => !i.claimed).length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          />
        )}

        {activeTab === "review" && (
          <ReviewQueue
            items={reviewItems}
            onApprove={handleApproveReviewItem}
            onReject={handleRejectReviewItem}
            onRefine={handleRefineReviewItem}
            onBatchPublish={handleBatchPublish}
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

        {activeTab === "demos" && <VideoDemos onGenerateDemo={handleGenerateDemo} demos={demos} />}

        {activeTab === "listings" && (
          <ListingBlitz
            listings={listings}
            onGenerateBlurb={handleGenerateBlurb}
            onUpdateStatus={handleUpdateListingStatus}
            onCreateListing={handleCreateListing}
            onBatchGenerateBlurbs={handleBatchGenerateBlurbs}
            onVerifyBacklink={handleVerifyBacklink}
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

        {activeTab === "agent" && (
          <AgentConsole agentStatus={agentStatus} onRunCustomPrompt={handleRunCustomPrompt} />
        )}

        {activeTab === "doctor" && <DoctorDemo />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
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
    </div>
  );
};
