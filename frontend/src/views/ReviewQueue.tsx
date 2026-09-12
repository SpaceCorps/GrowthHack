import React, { useEffect, useState, useMemo } from "react";
import { ActionButton } from "../components/ActionButton";
import type { ReviewItem } from "../types";
import {
  Check,
  X,
  Undo2,
  Edit3,
  Download,
  Copy,
  FileText,
  Clapperboard,
  Radio,
  ListTree,
  ArrowDown,
  CheckCheck,
  ExternalLink,
  Send,
  Loader2,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  AlertTriangle,
} from "lucide-react";

export interface ReviewQueueProps {
  items: ReviewItem[];
  onApprove?: (item: ReviewItem) => void | Promise<void>;
  onReject?: (item: ReviewItem) => void | Promise<void>;
  onRefine?: (item: ReviewItem, updated: Partial<ReviewItem>) => void | Promise<void>;
  onBatchPublish?: (items: ReviewItem[]) => void | Promise<void>;
  onUndo?: (item: ReviewItem) => void | Promise<void>;
  onAutoPost?: (item: ReviewItem) => void | Promise<void>;
}

export const getAutoPostDestination = (type: ReviewItem["type"]): string =>
  type === "article" ? "Ivy Web" : type === "listing_blurb" ? "Upstream PR" : "Platform Assets";

type FilterType = "all" | "article" | "video_demo" | "trend_synthesis" | "listing_blurb";

const SWIPE_THRESHOLD = 120;

interface DeckAction {
  item: ReviewItem;
  action: "approve" | "reject" | "skip";
}

let sharedAudioCtx: AudioContext | null = null;

export const resetSharedAudioContextForTesting = () => {
  sharedAudioCtx = null;
};

export const playThresholdClickSound = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (
      !sharedAudioCtx ||
      sharedAudioCtx.state === "closed" ||
      !(sharedAudioCtx instanceof AudioContextClass)
    ) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.018);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.02);
  } catch {
    // Fail silently in headless, restricted or unsupported environments
  }
};

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  items: initialItems,
  onApprove,
  onReject,
  onRefine,
  onBatchPublish,
  onUndo,
  onAutoPost,
}) => {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [filter, setFilter] = useState<FilterType>("all");
  const [history, setHistory] = useState<DeckAction[]>([]);
  const [animation, setAnimation] = useState<"approving" | "rejecting" | null>(null);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Pointer drag state
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = React.useRef<boolean>(false);
  const dragOffsetRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasFeedbackRef = React.useRef<boolean>(false);

  // Audio feedback state (persisted to localStorage)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.localStorage) return true;
    try {
      const stored = localStorage.getItem("growth_review_sound_enabled");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const soundEnabledRef = React.useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem("growth_review_sound_enabled", String(next));
        } catch {
          // Ignore localStorage access errors
        }
      }
      return next;
    });
  };

  // Instant auto-post toggle (persisted to localStorage, default enabled)
  const [autoPostEnabled, setAutoPostEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.localStorage) return true;
    try {
      const stored = localStorage.getItem("growth_review_auto_post_enabled");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const autoPostEnabledRef = React.useRef<boolean>(autoPostEnabled);

  useEffect(() => {
    autoPostEnabledRef.current = autoPostEnabled;
  }, [autoPostEnabled]);

  const handleToggleAutoPost = () => {
    setAutoPostEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem("growth_review_auto_post_enabled", String(next));
        } catch {
          // Ignore localStorage access errors
        }
      }
      return next;
    });
  };

  // Dispatch feedback toast state
  const [dispatchFeedback, setDispatchFeedback] = useState<{
    itemId: string;
    title: string;
    destination: string;
    phase: "dispatching" | "dispatched" | "failed";
  } | null>(null);
  const [autoPostedCount, setAutoPostedCount] = useState<number>(0);

  // Edit/Refine state
  const [editTitle, setEditTitle] = useState<string>("");
  const [editChannel, setEditChannel] = useState<string>("");
  const [editSummary, setEditSummary] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [editBacklinks, setEditBacklinks] = useState<string>("");

  // Synchronize when initialItems change
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Counters
  const pendingItems = useMemo(() => items.filter((it) => it.status === "Pending"), [items]);
  const approvedItems = useMemo(() => items.filter((it) => it.status === "Approved"), [items]);
  const rejectedItems = useMemo(() => items.filter((it) => it.status === "Rejected"), [items]);
  const publishedItems = useMemo(() => items.filter((it) => it.status === "Published"), [items]);
  const exportableItems = useMemo(
    () => [...approvedItems, ...publishedItems],
    [approvedItems, publishedItems],
  );

  // Filtered pending deck
  const activeDeck = useMemo(() => {
    if (filter === "all") return pendingItems;
    return pendingItems.filter((it) => it.type === filter);
  }, [pendingItems, filter]);

  const currentItem = activeDeck[0] ?? null;
  const nextItem = activeDeck[1] ?? null;
  const thirdItem = activeDeck[2] ?? null;

  // Open refinement modal
  const handleOpenRefine = (item: ReviewItem) => {
    setEditTitle(item.title);
    setEditChannel(item.channel);
    setEditSummary(item.summary);
    setEditContent(item.content);
    setEditBacklinks((item.backlinks || []).join(", "));
    setIsRefining(true);
  };

  const handleSaveRefinement = async () => {
    if (!currentItem) return;
    const updatedBacklinks = editBacklinks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const isContentModified =
      (currentItem.type === "listing_blurb" && editContent !== currentItem.content) ||
      (currentItem.type === "article" &&
        (editContent !== currentItem.content ||
          editTitle !== currentItem.title ||
          editSummary !== currentItem.summary)) ||
      (currentItem.type === "video_demo" &&
        (editContent !== currentItem.content || editTitle !== currentItem.title)) ||
      (currentItem.type === "trend_synthesis" &&
        (editTitle !== currentItem.title ||
          editSummary !== currentItem.summary ||
          editContent !== currentItem.content));

    const updated: Partial<ReviewItem> = {
      title: editTitle,
      channel: editChannel,
      summary: editSummary,
      content: editContent,
      backlinks: updatedBacklinks,
      ...(isContentModified ? { status: "Pending" } : {}),
    };

    setItems((prev) => prev.map((it) => (it.id === currentItem.id ? { ...it, ...updated } : it)));

    if (onRefine) {
      await onRefine(currentItem, updated);
    }
    setIsRefining(false);
  };

  // Decision actions
  const handleApprove = async () => {
    if (!currentItem || animation) return;
    setAnimation("approving");
    setDragOffset({ x: 0, y: 0 });
    dragOffsetRef.current = { x: 0, y: 0 };

    const itemToApprove = currentItem;
    setTimeout(async () => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemToApprove.id ? { ...it, status: "Approved" } : it)),
      );
      setHistory((prev) => [...prev, { item: itemToApprove, action: "approve" }]);
      setAnimation(null);
      if (onApprove) {
        await onApprove(itemToApprove);
      }

      if (!autoPostEnabledRef.current) return;

      const destination = getAutoPostDestination(itemToApprove.type);
      setDispatchFeedback({
        itemId: itemToApprove.id,
        title: itemToApprove.title,
        destination,
        phase: "dispatching",
      });
      try {
        await onAutoPost?.(itemToApprove);
        setItems((prev) =>
          prev.map((it) => (it.id === itemToApprove.id ? { ...it, status: "Published" } : it)),
        );
        setAutoPostedCount((prev) => prev + 1);
        setDispatchFeedback({
          itemId: itemToApprove.id,
          title: itemToApprove.title,
          destination,
          phase: "dispatched",
        });
      } catch {
        setDispatchFeedback({
          itemId: itemToApprove.id,
          title: itemToApprove.title,
          destination,
          phase: "failed",
        });
      }
      setTimeout(() => setDispatchFeedback(null), 2500);
    }, 200);
  };

  const handleReject = async () => {
    if (!currentItem || animation) return;
    setAnimation("rejecting");
    setDragOffset({ x: 0, y: 0 });
    dragOffsetRef.current = { x: 0, y: 0 };

    const itemToReject = currentItem;
    setTimeout(async () => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemToReject.id ? { ...it, status: "Rejected" } : it)),
      );
      setHistory((prev) => [...prev, { item: itemToReject, action: "reject" }]);
      setAnimation(null);
      if (onReject) {
        await onReject(itemToReject);
      }
    }, 200);
  };

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || animation) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.closest("button, input, textarea, a, select, [role='button']") ||
        target.closest("[data-no-drag='true']") ||
        target.closest(".overflow-y-auto"))
    ) {
      return;
    }

    if (typeof (e.currentTarget as HTMLElement).setPointerCapture === "function") {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = { x: 0, y: 0 };
    isDraggingRef.current = true;
    hasFeedbackRef.current = false;
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragOffsetRef.current = { x: dx, y: dy };
    setDragOffset({ x: dx, y: dy });

    const isOverThreshold = Math.abs(dx) >= SWIPE_THRESHOLD;
    if (isOverThreshold && !hasFeedbackRef.current) {
      if (
        typeof navigator !== "undefined" &&
        "vibrate" in navigator &&
        typeof navigator.vibrate === "function"
      ) {
        try {
          navigator.vibrate(15);
        } catch {
          // Ignore environments where vibration is blocked or restricted
        }
      }
      if (soundEnabledRef.current) {
        playThresholdClickSound();
      }
      hasFeedbackRef.current = true;
    } else if (!isOverThreshold && hasFeedbackRef.current) {
      hasFeedbackRef.current = false;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    if (typeof (e.currentTarget as HTMLElement).releasePointerCapture === "function") {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    isDraggingRef.current = false;
    hasFeedbackRef.current = false;
    setIsDragging(false);

    const finalDx =
      e.clientX !== undefined && e.clientX !== dragStartRef.current.x
        ? e.clientX - dragStartRef.current.x
        : dragOffsetRef.current.x;

    if (finalDx > SWIPE_THRESHOLD) {
      handleApprove();
    } else if (finalDx < -SWIPE_THRESHOLD) {
      handleReject();
    } else {
      setDragOffset({ x: 0, y: 0 });
      dragOffsetRef.current = { x: 0, y: 0 };
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    if (typeof (e.currentTarget as HTMLElement).releasePointerCapture === "function") {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    isDraggingRef.current = false;
    hasFeedbackRef.current = false;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    dragOffsetRef.current = { x: 0, y: 0 };
  };

  const handleSkip = () => {
    if (!currentItem || animation) return;
    // Move current item to the back of the queue
    setItems((prev) => {
      const remaining = prev.filter((it) => it.id !== currentItem.id);
      return [...remaining, currentItem];
    });
    setHistory((prev) => [...prev, { item: currentItem, action: "skip" }]);
  };

  const handleUndo = async () => {
    if (history.length === 0 || animation) return;
    const lastAction = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    setItems((prev) => {
      const exists = prev.some((it) => it.id === lastAction.item.id);
      if (exists) {
        return prev.map((it) => (it.id === lastAction.item.id ? { ...it, status: "Pending" } : it));
      }
      return [{ ...lastAction.item, status: "Pending" }, ...prev];
    });

    if (onUndo) {
      await onUndo(lastAction.item);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRefining || showExportModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowRight" || e.code === "KeyA") {
        e.preventDefault();
        handleApprove();
      } else if (e.key === "ArrowLeft" || e.code === "KeyR") {
        e.preventDefault();
        handleReject();
      } else if (e.key === "ArrowUp" || e.code === "KeyE") {
        e.preventDefault();
        if (currentItem) handleOpenRefine(currentItem);
      } else if (e.key === "ArrowDown" || e.code === "Space") {
        e.preventDefault();
        handleSkip();
      } else if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "m" || e.key === "M" || e.code === "KeyM") {
        e.preventDefault();
        handleToggleSound();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentItem, animation, isRefining, showExportModal, history]);

  // Export handlers
  const handleCopyAll = () => {
    const markdownBundle = exportableItems
      .map(
        (it, idx) =>
          `# ${idx + 1}. ${it.title}\n\n**Type:** ${it.type} | **Channel:** ${it.channel}\n\n${it.summary}\n\n---\n\n${it.content}\n\n**Backlinks:** ${it.backlinks.join(", ")}`,
      )
      .join("\n\n========================================\n\n");

    navigator.clipboard.writeText(markdownBundle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const markdownBundle = exportableItems
      .map(
        (it, idx) =>
          `# ${idx + 1}. ${it.title}\n\n**Type:** ${it.type} | **Channel:** ${it.channel}\n\n${it.summary}\n\n---\n\n${it.content}\n\n**Backlinks:** ${it.backlinks.join(", ")}`,
      )
      .join("\n\n========================================\n\n");

    const blob = new Blob([markdownBundle], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `approved_growth_content_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [isBatchPublishing, setIsBatchPublishing] = useState<boolean>(false);

  const handleBatchPublish = async () => {
    setIsBatchPublishing(true);
    try {
      const unpublished = exportableItems.filter((item) => item.status !== "Published");
      for (const item of unpublished) {
        if (item.type === "article") {
          try {
            await fetch(`/api/articles/${item.rawId}/export/ivy-web`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sync_hero_image: true, hero_format: "dual" }),
            });
          } catch (err) {
            console.error("Batch publish export/sync error for article:", item.title, err);
          }
        }
      }

      if (onBatchPublish) {
        await onBatchPublish(unpublished);
      }
      setShowExportModal(false);
    } finally {
      setIsBatchPublishing(false);
    }
  };

  // Helper badge renderers
  const renderTypeBadge = (type: ReviewItem["type"]) => {
    switch (type) {
      case "article":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> 10x Article
          </span>
        );
      case "video_demo":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1">
            <Clapperboard className="w-3.5 h-3.5" /> Video Script
          </span>
        );
      case "trend_synthesis":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> Trend Synthesis
          </span>
        );
      case "listing_blurb":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
            <ListTree className="w-3.5 h-3.5" /> Directory PR
          </span>
        );
    }
  };

  const totalReviewed = approvedItems.length + rejectedItems.length + publishedItems.length;
  const totalDeckCount = totalReviewed + pendingItems.length;
  const progressPercent =
    totalDeckCount > 0 ? Math.round((totalReviewed / totalDeckCount) * 100) : 100;

  // Background card 2 depth interpolation
  const dragProgress = Math.min(Math.abs(dragOffset.x) / 200, 1);
  const nextScale = 0.95 + 0.05 * dragProgress;
  const nextOpacity = 0.6 + 0.25 * dragProgress;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Triage Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
              Autonomous Approval Loop
            </span>
            <span className="text-xs text-slate-500 font-mono">Tinder-Style Triage</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Human Approval Review Queue
            <span className="text-xs font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Deck Stack
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Rapidly curate, refine, and approve drafted growth content before publication.
          </p>
        </div>

        {/* Counter Pills & Export Trigger */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <span className="text-slate-400">Pending:</span>
            <span className="text-amber-400 font-bold">{pendingItems.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <span className="text-slate-400">Approved:</span>
            <span className="text-emerald-400 font-bold">{approvedItems.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <span className="text-slate-400">Rejected:</span>
            <span className="text-rose-400 font-bold">{rejectedItems.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <span className="text-slate-400">Published:</span>
            <span className="text-cyan-400 font-bold">{publishedItems.length}</span>
          </div>
          <div
            data-testid="auto-posted-count"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium"
          >
            <span className="text-slate-400">Auto-Posted:</span>
            <span className="text-emerald-400 font-bold">{autoPostedCount}</span>
          </div>

          <button
            type="button"
            onClick={handleToggleAutoPost}
            data-testid="auto-post-toggle-btn"
            aria-label={autoPostEnabled ? "Disable instant auto-post" : "Enable instant auto-post"}
            title={autoPostEnabled ? "Disable instant auto-post" : "Enable instant auto-post"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoPostEnabled
                ? "bg-emerald-950/60 hover:bg-emerald-950 text-emerald-400 border-emerald-800/60 hover:border-emerald-700"
                : "bg-slate-900/40 hover:bg-slate-900 text-slate-500 border-slate-800/60 hover:text-slate-400"
            }`}
          >
            {autoPostEnabled ? (
              <>
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant Auto-Post</span>
              </>
            ) : (
              <>
                <ZapOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Manual Publish</span>
              </>
            )}
          </button>

          <ActionButton
            onClick={() => setShowExportModal(true)}
            disabled={exportableItems.length === 0}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export Approved ({exportableItems.length})
          </ActionButton>
        </div>
      </div>

      {/* Filter Tabs & Hotkey Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Content Type Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {(
            [
              { id: "all", label: "All Drafts", count: pendingItems.length },
              {
                id: "article",
                label: "10x Articles",
                count: pendingItems.filter((i) => i.type === "article").length,
              },
              {
                id: "video_demo",
                label: "Video Demos",
                count: pendingItems.filter((i) => i.type === "video_demo").length,
              },
              {
                id: "trend_synthesis",
                label: "Trends",
                count: pendingItems.filter((i) => i.type === "trend_synthesis").length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filter === tab.id
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === tab.id
                    ? "bg-slate-700 text-emerald-300"
                    : "bg-slate-800/80 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Sound Feedback Toggle Button */}
          <button
            type="button"
            onClick={handleToggleSound}
            data-testid="sound-toggle-btn"
            aria-label={soundEnabled ? "Mute audio feedback" : "Enable audio feedback"}
            title={soundEnabled ? "Mute threshold click (M)" : "Enable threshold click (M)"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              soundEnabled
                ? "bg-slate-900/80 hover:bg-slate-800 text-emerald-400 border-slate-800 hover:border-slate-700"
                : "bg-slate-900/40 hover:bg-slate-900 text-slate-500 border-slate-800/60 hover:text-slate-400"
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sound On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span>Muted</span>
              </>
            )}
          </button>

          {/* Keyboard Shortcut Cheatsheet */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                ← / R
              </kbd>
              Reject
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                → / A
              </kbd>
              Approve
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                ↑ / E
              </kbd>
              Refine
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                ↓ / Space
              </kbd>
              Skip
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                M
              </kbd>
              Mute
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                Z
              </kbd>
              Undo
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-1.5 border border-slate-800 overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Review Section: Interactive Card Deck */}
      <div className="relative min-h-[500px] flex items-center justify-center py-4">
        {currentItem ? (
          <div className="relative w-full max-w-3xl">
            {/* Background Card 3 (Lowest layer) */}
            {thirdItem && (
              <div className="absolute inset-x-0 top-0 h-[480px] bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-xl transform scale-90 translate-y-6 opacity-30 pointer-events-none transition-all duration-300" />
            )}

            {/* Background Card 2 (Middle layer) */}
            {nextItem && (
              <div
                data-testid="next-card"
                style={{
                  transform: `scale(${nextScale}) translateY(12px)`,
                  opacity: nextOpacity,
                  transition: isDragging ? "none" : "all 0.3s ease",
                }}
                className="absolute inset-x-0 top-0 h-[480px] bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl pointer-events-none"
              />
            )}

            {/* Active Card 1 (Top layer) */}
            <div
              data-testid="active-card"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              style={
                animation
                  ? undefined
                  : {
                      transform: `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.3}px, 0) rotate(${dragOffset.x * 0.05}deg)`,
                      transition: isDragging
                        ? "none"
                        : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      cursor: isDragging ? "grabbing" : "grab",
                      userSelect: isDragging ? "none" : undefined,
                      touchAction: "pan-y",
                    }
              }
              className={`relative bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-slate-950 p-6 sm:p-8 flex flex-col justify-between ${
                animation === "approving"
                  ? "transform translate-x-[110%] rotate-12 opacity-0 transition-all duration-200"
                  : animation === "rejecting"
                    ? "transform -translate-x-[110%] -rotate-12 opacity-0 transition-all duration-200"
                    : "opacity-100"
              }`}
            >
              {/* Dynamic & Animation Stamp Indicators */}
              {(animation === "approving" || (isDragging && dragOffset.x > 30)) && (
                <div
                  data-testid="approved-stamp"
                  style={{
                    opacity: animation === "approving" ? 1 : Math.min((dragOffset.x - 30) / 90, 1),
                  }}
                  className="absolute top-8 right-8 z-30 transform rotate-12 border-4 border-emerald-500 bg-emerald-950/90 text-emerald-400 px-6 py-2 rounded-xl font-black text-2xl tracking-widest uppercase shadow-2xl pointer-events-none"
                >
                  APPROVED ⭐
                </div>
              )}
              {(animation === "rejecting" || (isDragging && dragOffset.x < -30)) && (
                <div
                  data-testid="rejected-stamp"
                  style={{
                    opacity: animation === "rejecting" ? 1 : Math.min((-dragOffset.x - 30) / 90, 1),
                  }}
                  className="absolute top-8 left-8 z-30 transform -rotate-12 border-4 border-rose-500 bg-rose-950/90 text-rose-400 px-6 py-2 rounded-xl font-black text-2xl tracking-widest uppercase shadow-2xl pointer-events-none"
                >
                  REJECTED ❌
                </div>
              )}

              {/* Card Header & Metadata */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {renderTypeBadge(currentItem.type)}
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      Channel: {currentItem.channel}
                    </span>
                    {autoPostEnabled && (
                      <span
                        data-testid="auto-post-destination-badge"
                        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 flex items-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Auto-Post → {getAutoPostDestination(currentItem.type)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">Draft ID: {currentItem.id}</div>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {currentItem.title}
                  </h3>
                  {currentItem.subtitle && (
                    <p className="text-sm font-medium text-emerald-400 mt-1">
                      {currentItem.subtitle}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 line-clamp-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                    {currentItem.summary}
                  </p>
                </div>

                {/* Content Preview Box */}
                <div
                  data-no-drag="true"
                  className="max-h-60 overflow-y-auto rounded-xl bg-slate-950/80 p-4 border border-slate-800/80 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text"
                >
                  {currentItem.content}
                </div>

                {/* Footers: Backlinks & Citations */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 font-medium">Inbound Backlinks:</span>
                    {currentItem.backlinks && currentItem.backlinks.length > 0 ? (
                      currentItem.backlinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 underline text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" /> Link #{idx + 1}
                        </a>
                      ))
                    ) : (
                      <span className="text-slate-600">None</span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Created: {new Date(currentItem.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Action Controls Toolbar ("Swipe Controls") */}
              <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                {/* Left: Undo Button */}
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  data-testid="undo-btn"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                  title="Undo last action (Z)"
                >
                  <Undo2 className="w-4 h-4" />
                  Undo
                </button>

                {/* Center / Primary Decision Buttons */}
                <div className="flex items-center gap-3">
                  {/* Reject Button (Swipe Left) */}
                  <button
                    onClick={handleReject}
                    data-testid="reject-btn"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 font-semibold text-xs sm:text-sm shadow-lg shadow-rose-950/30 transition-all transform active:scale-95"
                    title="Reject (ArrowLeft or R)"
                  >
                    <X className="w-4 h-4" />
                    Reject (←)
                  </button>

                  {/* Refine / Inline Edit Button */}
                  <button
                    onClick={() => handleOpenRefine(currentItem)}
                    data-testid="refine-btn"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 font-semibold text-xs sm:text-sm shadow-lg shadow-amber-950/30 transition-all transform active:scale-95"
                    title="Refine copy & hooks (ArrowUp or E)"
                  >
                    <Edit3 className="w-4 h-4" />
                    Refine (↑)
                  </button>

                  {/* Skip Card */}
                  <button
                    onClick={handleSkip}
                    data-testid="skip-btn"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
                    title="Skip for now (ArrowDown or Space)"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    Skip
                  </button>

                  {/* Approve Button (Swipe Right) */}
                  <ActionButton
                    size="lg"
                    icon={<Check className="w-4 h-4" />}
                    onClick={handleApprove}
                    data-testid="approve-btn"
                    title="Approve (ArrowRight or A)"
                    className="transform active:scale-95"
                  >
                    Approve
                  </ActionButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / All Caught Up State */
          <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-800/50 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-950/40">
              <CheckCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">All Caught Up! 🎉</h3>
              <p className="text-sm text-slate-400">
                {totalReviewed > 0
                  ? `You reviewed all items in this deck. ${approvedItems.length} approved items are ready for distribution.`
                  : "No pending review items found in the queue."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {history.length > 0 && (
                <ActionButton
                  variant="secondary"
                  onClick={handleUndo}
                  icon={<Undo2 className="w-3.5 h-3.5" />}
                >
                  Undo Last Decision
                </ActionButton>
              )}

              {exportableItems.length > 0 && (
                <ActionButton
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => setShowExportModal(true)}
                  size="md"
                >
                  Export {exportableItems.length} Approved Items
                </ActionButton>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inline Refinement Modal / Drawer */}
      {isRefining && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h4 className="text-lg font-bold text-white">Refine Draft Copy & Hook</h4>
              </div>
              <button
                onClick={() => setIsRefining(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title & Headline
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Channel
                </label>
                <input
                  type="text"
                  value={editChannel}
                  onChange={(e) => setEditChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hook / Executive Summary
                </label>
                <textarea
                  rows={2}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Body Content (Markdown)
                </label>
                <textarea
                  rows={6}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Backlinks (comma-separated URLs)
                </label>
                <input
                  type="text"
                  value={editBacklinks}
                  onChange={(e) => setEditBacklinks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <ActionButton variant="secondary" onClick={() => setIsRefining(false)}>
                Cancel
              </ActionButton>
              <button
                onClick={handleSaveRefinement}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/40"
              >
                Save & Update Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export & Publishing Modal Drawer */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                <h4 className="text-lg font-bold text-white">
                  Export Approved Growth Assets ({exportableItems.length})
                </h4>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Export curated articles, scripts, and PR blurbs for immediate distribution into social
              schedulers, CMS pipelines, or Git repositories.
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {exportableItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-slate-500 font-mono">#{idx + 1}</span>
                    <span className="font-semibold text-slate-200 truncate">{item.title}</span>
                  </div>
                  {item.type === "listing_blurb" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 shrink-0">
                      PR Submission & Antigravity Generation
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-emerald-300 shrink-0">
                      {item.channel}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <ActionButton
                variant="secondary"
                onClick={handleDownloadMarkdown}
                icon={<Download className="w-3.5 h-3.5 text-cyan-400" />}
              >
                Download .md
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={handleCopyAll}
                icon={
                  copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  )
                }
              >
                {copied ? "Copied!" : "Copy All"}
              </ActionButton>
              <ActionButton
                loading={isBatchPublishing}
                loadingText="Publishing..."
                icon={<Send className="w-3.5 h-3.5" />}
                onClick={handleBatchPublish}
              >
                Publish All
              </ActionButton>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <ActionButton variant="secondary" onClick={() => setShowExportModal(false)}>
                Close
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Instant Auto-Post Dispatch Feedback Toast */}
      {dispatchFeedback && (
        <div
          data-testid="auto-post-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-sm font-semibold"
        >
          {dispatchFeedback.phase === "dispatching" && (
            <>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-slate-200">Dispatching to {dispatchFeedback.destination}…</span>
            </>
          )}
          {dispatchFeedback.phase === "dispatched" && (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-200">Dispatched to {dispatchFeedback.destination}</span>
            </>
          )}
          {dispatchFeedback.phase === "failed" && (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-slate-200">
                Auto-post failed — {dispatchFeedback.destination}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
