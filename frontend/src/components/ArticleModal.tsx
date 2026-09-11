import React, { useEffect, useState, useMemo } from "react";
import type {
  Article,
  ExportRecord,
  HeroBannerTheme,
  SyndicationStatusResponse,
  EngagementHistoryResponse,
} from "../types";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Sparkles,
  Send,
  Download,
  Share2,
  FileText,
  CheckCircle2,
  History,
  FolderCheck,
  Code,
  Loader2,
  Key,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Palette,
  Layers,
  Upload,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Award,
} from "lucide-react";
import { EngagementVelocityChart } from "./EngagementVelocityChart";
import {
  BANNER_THEMES,
  getThemeForCategory,
  generateClientBannerSvg,
  rasterizeSvgToPngDataUrl,
} from "../utils/banner";

interface ArticleModalProps {
  article: Article | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: "Draft" | "Ready" | "Published") => void;
  onArticleUpdated?: (article: Article) => void;
  initialTab?: "content" | "raw" | "backlinks" | "export" | "engagement";
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  article,
  onClose,
  onUpdateStatus,
  onArticleUpdated,
  initialTab = "content",
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "content" | "raw" | "backlinks" | "export" | "engagement"
  >(initialTab);
  const [articleHistory, setArticleHistory] = useState<EngagementHistoryResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isSeedingEngagement, setIsSeedingEngagement] = useState<boolean>(false);
  const [seedSuccessBanner, setSeedSuccessBanner] = useState<string | null>(null);

  // Export tab state
  const [selectedChannel, setSelectedChannel] = useState<string>("Dev.to");
  const [formattedContent, setFormattedContent] = useState<string>("");
  const [formattedPreviewType, setFormattedPreviewType] = useState<string>("markdown");
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [channelCopied, setChannelCopied] = useState<boolean>(false);

  // Direct API Syndication state
  const [syndicationSettings, setSyndicationSettings] = useState<SyndicationStatusResponse | null>(
    null,
  );
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    url?: string;
    error?: string;
  } | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [devtoApiKeyInput, setDevtoApiKeyInput] = useState<string>("");
  const [hashnodeApiKeyInput, setHashnodeApiKeyInput] = useState<string>("");
  const [hashnodePubIdInput, setHashnodePubIdInput] = useState<string>("");
  const [webhookSecretInput, setWebhookSecretInput] = useState<string>("");
  const [publishAsDraftInput, setPublishAsDraftInput] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState<string | null>(null);

  // Ivy Web exporter state
  const [ivyTargetDir, setIvyTargetDir] = useState<string>("");
  const [isExportingIvy, setIsExportingIvy] = useState<boolean>(false);
  const [ivyExportResult, setIvyExportResult] = useState<{
    success: boolean;
    file_path?: string;
    image_path?: string;
    error?: string;
  } | null>(null);

  // Hero Image Asset Synchronization state
  const [syncHeroImage, setSyncHeroImage] = useState<boolean>(true);
  const [heroFormat, setHeroFormat] = useState<"dual" | "svg" | "png">("dual");
  const [ivyTargetImagesDir, setIvyTargetImagesDir] = useState<string>("");
  const [isSyncingHero, setIsSyncingHero] = useState<boolean>(false);
  const [heroSyncResult, setHeroSyncResult] = useState<{
    success: boolean;
    image_path?: string;
    error?: string;
  } | null>(null);

  // Hero Banner Studio state
  const [bannerTheme, setBannerTheme] = useState<HeroBannerTheme>(
    article ? getThemeForCategory(article.angle || article.feature || "") : "dark-cyan",
  );
  const [bannerTitle, setBannerTitle] = useState<string>(article?.title || "");
  const [bannerCategory, setBannerCategory] = useState<string>(
    article?.angle || article?.feature || "Architecture",
  );
  const [bannerSummary, setBannerSummary] = useState<string>(article?.summary || "");
  const [isRasterizing, setIsRasterizing] = useState<boolean>(false);
  const [isSyncingRenderedPng, setIsSyncingRenderedPng] = useState<boolean>(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  const channels = ["Dev.to", "Hashnode", "Medium", "Substack", "LinkedIn", "X Thread"];

  useEffect(() => {
    setActiveTab(initialTab);
    setIvyExportResult(null);
    setPublishResult(null);
    setHeroSyncResult(null);
    setHeroFormat("dual");
    if (article) {
      setBannerTheme(getThemeForCategory(article.angle || article.feature || ""));
      setBannerTitle(article.title || "");
      setBannerCategory(article.angle || article.feature || "Architecture");
      setBannerSummary(article.summary || "");
      setDownloadSuccessMessage(null);
    }
  }, [article?.id, initialTab]);

  useEffect(() => {
    if (!article?.id) {
      setArticleHistory(null);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    fetch(`/api/articles/${article.id}/engagement-history`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("History fetch failed");
      })
      .then((data: EngagementHistoryResponse) => {
        if (isMounted) {
          setArticleHistory(data);
        }
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [article?.id]);

  const fetchSyndicationSettings = () => {
    fetch("/api/settings/syndication")
      .then((res) => res.json())
      .then((data: SyndicationStatusResponse) => {
        setSyndicationSettings(data);
        setPublishAsDraftInput(data.publish_as_draft);
        if (data.hashnode_publication_id) {
          setHashnodePubIdInput(data.hashnode_publication_id);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch syndication settings:", err);
      });
  };

  useEffect(() => {
    if (activeTab === "export") {
      fetchSyndicationSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!article || activeTab !== "export") return;

    let isMounted = true;
    setIsFormatting(true);

    fetch(`/api/articles/${article.id}/format/${encodeURIComponent(selectedChannel)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setFormattedContent(data.formatted_content);
          setFormattedPreviewType(data.preview_type || "markdown");
        }
      })
      .catch((err) => {
        console.error("Failed to load format:", err);
      })
      .finally(() => {
        if (isMounted) setIsFormatting(false);
      });

    return () => {
      isMounted = false;
    };
  }, [article?.id, selectedChannel, activeTab]);

  const currentBannerSvg = useMemo(() => {
    return generateClientBannerSvg(
      bannerTitle || article?.title || "Ivy Autonomous Growth",
      bannerCategory || article?.angle || "Architecture",
      bannerSummary || article?.summary || "",
      bannerTheme,
    );
  }, [bannerTitle, bannerCategory, bannerSummary, bannerTheme, article]);

  if (!article) return null;

  const currentSlug =
    article.slug ||
    article.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const exportsList: ExportRecord[] = article.exports || [];

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(article.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportIvyWeb = async () => {
    if (!article) return;
    setIsExportingIvy(true);
    setIvyExportResult(null);

    try {
      const res = await fetch(`/api/articles/${article.id}/export/ivy-web`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_dir: ivyTargetDir.trim() || undefined,
          target_images_dir: ivyTargetImagesDir.trim() || undefined,
          sync_hero_image: syncHeroImage,
          hero_format: heroFormat,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIvyExportResult({
          success: true,
          file_path: data.file_path,
          image_path: data.image_path,
        });
        const updatedExports = [...exportsList, data.record];
        const updatedArticle: Article = {
          ...article,
          slug: data.slug || article.slug,
          image_path: data.image_path || article.image_path,
          exports: updatedExports,
        };
        onArticleUpdated?.(updatedArticle);
      } else {
        setIvyExportResult({
          success: false,
          error: data.error || "Export to Ivy Web failed",
        });
      }
    } catch (err: any) {
      setIvyExportResult({
        success: false,
        error: err.message || "Export error",
      });
    } finally {
      setIsExportingIvy(false);
    }
  };

  const handleSyncHeroAsset = async () => {
    if (!article) return;
    setIsSyncingHero(true);
    setHeroSyncResult(null);

    try {
      const res = await fetch(`/api/articles/${article.id}/sync-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_images_dir: ivyTargetImagesDir.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setHeroSyncResult({
          success: true,
          image_path: data.image_path,
        });
        const updatedArticle: Article = {
          ...article,
          slug: data.slug || article.slug,
          image_path: data.image_path,
        };
        onArticleUpdated?.(updatedArticle);
      } else {
        setHeroSyncResult({
          success: false,
          error: data.error || "Hero asset synchronization failed",
        });
      }
    } catch (err: any) {
      setHeroSyncResult({
        success: false,
        error: err.message || "Network error syncing hero asset",
      });
    } finally {
      setIsSyncingHero(false);
    }
  };

  const handleSyncRenderedPng = async () => {
    if (!article) return;
    setIsSyncingRenderedPng(true);
    setHeroSyncResult(null);

    try {
      const pngDataUrl = await rasterizeSvgToPngDataUrl(currentBannerSvg);
      const res = await fetch(`/api/articles/${article.id}/upload-hero-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data: pngDataUrl,
          target_images_dir: ivyTargetImagesDir.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setHeroSyncResult({
          success: true,
          image_path: data.image_path,
        });
        const updatedArticle: Article = {
          ...article,
          slug: data.slug || article.slug,
          image_path: data.image_path,
        };
        onArticleUpdated?.(updatedArticle);
      } else {
        setHeroSyncResult({
          success: false,
          error: data.error || "Custom hero PNG upload failed",
        });
      }
    } catch (err: any) {
      setHeroSyncResult({
        success: false,
        error: err.message || "Failed to rasterize or upload PNG",
      });
    } finally {
      setIsSyncingRenderedPng(false);
    }
  };

  const handleDownloadPng = async () => {
    try {
      setIsRasterizing(true);
      const pngDataUrl = await rasterizeSvgToPngDataUrl(currentBannerSvg);
      const a = document.createElement("a");
      a.href = pngDataUrl;
      a.download = `${currentSlug}-hero.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadSuccessMessage("Downloaded 1200x630 PNG!");
      setTimeout(() => setDownloadSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to download PNG:", err);
    } finally {
      setIsRasterizing(false);
    }
  };

  const handleDownloadSvg = () => {
    try {
      const blob = new Blob([currentBannerSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentSlug}-hero.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccessMessage("Downloaded vector SVG!");
      setTimeout(() => setDownloadSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to download SVG:", err);
    }
  };

  const handleCopyChannelContent = async () => {
    if (!formattedContent) return;
    navigator.clipboard.writeText(formattedContent);
    setChannelCopied(true);
    setTimeout(() => setChannelCopied(false), 2500);

    try {
      const res = await fetch(`/api/articles/${article.id}/record-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: selectedChannel,
          status: "Copied",
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (updated) {
          onArticleUpdated?.(updated);
        }
      }
    } catch (err) {
      console.error("Failed to record export:", err);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveMessage(null);
    try {
      const res = await fetch("/api/settings/syndication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devto_api_key: devtoApiKeyInput.trim() || undefined,
          hashnode_api_key: hashnodeApiKeyInput.trim() || undefined,
          hashnode_publication_id: hashnodePubIdInput.trim() || undefined,
          webhook_secret: webhookSecretInput.trim() || undefined,
          publish_as_draft: publishAsDraftInput,
        }),
      });
      if (res.ok) {
        const data: SyndicationStatusResponse = await res.json();
        setSyndicationSettings(data);
        setDevtoApiKeyInput("");
        setHashnodeApiKeyInput("");
        setWebhookSecretInput("");
        setSettingsSaveMessage("Credentials saved successfully!");
        setTimeout(() => {
          setSettingsSaveMessage(null);
          setIsConfigOpen(false);
        }, 1500);
      } else {
        const err = await res.json().catch(() => ({}));
        setSettingsSaveMessage(err.error || "Failed to save settings.");
      }
    } catch (err: any) {
      setSettingsSaveMessage(err.message || "Network error saving settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handlePublishDirectApi = async () => {
    if (!article) return;
    const isDevto = selectedChannel === "Dev.to";
    const isHashnode = selectedChannel === "Hashnode";
    if (!isDevto && !isHashnode) return;

    // Check credentials configuration
    if (isDevto && !syndicationSettings?.devto_configured) {
      setIsConfigOpen(true);
      setPublishResult({
        success: false,
        error: "Dev.to API key is not configured. Please enter your API key below.",
      });
      return;
    }

    if (isHashnode && !syndicationSettings?.hashnode_configured) {
      setIsConfigOpen(true);
      setPublishResult({
        success: false,
        error:
          "Hashnode Personal Access Token is not configured. Please enter your credentials below.",
      });
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    const endpoint = isDevto
      ? `/api/articles/${article.id}/publish/devto`
      : `/api/articles/${article.id}/publish/hashnode`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPublishResult({
          success: true,
          url: data.url,
        });
        const updatedExports = [...exportsList, data.record];
        const updatedArticle: Article = {
          ...article,
          exports: updatedExports,
        };
        onArticleUpdated?.(updatedArticle);
      } else {
        setPublishResult({
          success: false,
          error: data.error || `Publishing to ${selectedChannel} failed.`,
        });
      }
    } catch (err: any) {
      setPublishResult({
        success: false,
        error: err.message || "Failed to publish article.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSeedEngagement = async () => {
    setIsSeedingEngagement(true);
    setSeedSuccessBanner(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/seed-engagement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.article) {
          onArticleUpdated?.(data.article);
        }
        if (data.article?.engagement_snapshots && data.velocity) {
          setArticleHistory({
            snapshots: data.article.engagement_snapshots,
            velocity: data.velocity,
          });
        }
        const badgesCount = data.article?.engagement_badges?.length || 0;
        const alertsCount = data.new_alerts_count ?? (data.new_alerts?.length || 0);
        setSeedSuccessBanner(
          `Seeded demo engagement metrics! Awarded ${badgesCount} milestone badge${
            badgesCount === 1 ? "" : "s"
          } and triggered ${alertsCount} alert${alertsCount === 1 ? "" : "s"}.`,
        );
        setTimeout(() => {
          setSeedSuccessBanner(null);
        }, 5000);
      } else {
        setSeedSuccessBanner(data.error || "Failed to seed demo engagement.");
      }
    } catch (err: any) {
      setSeedSuccessBanner(err.message || "Network error seeding demo engagement.");
    } finally {
      setIsSeedingEngagement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
              {article.feature}
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800">
              {article.channel}
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300">
              {article.angle}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy Markdown"}</span>
            </button>

            {article.status !== "Published" ? (
              <button
                onClick={() => onUpdateStatus(article.id, "Published")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Mark Published</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold">
                Published ✓
              </span>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title and Summary */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-800/60">
          <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
            {article.title}
          </h2>
          <p className="text-sm text-slate-400 mt-1">{article.summary}</p>

          {/* Sub-nav Tabs */}
          <div className="flex items-center space-x-4 mt-4 border-b border-slate-800">
            <button
              onClick={() => setActiveTab("content")}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "content"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Article Reading View</span>
            </button>
            <button
              onClick={() => setActiveTab("raw")}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "raw"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Raw Markdown</span>
            </button>
            <button
              onClick={() => setActiveTab("backlinks")}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "backlinks"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                Backlinks & Citations (
                {article.backlinks.length + article.outbound_citations.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "export"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Export & Syndicate ({exportsList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("engagement")}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "engagement"
                  ? "border-pink-400 text-pink-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>
                Engagement & Velocity (
                {articleHistory?.snapshots?.length ?? article.engagement_snapshots?.length ?? 0})
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-300">
          {activeTab === "content" && (
            <div className="prose prose-invert max-w-none prose-headings:text-slate-100 prose-headings:font-bold prose-a:text-emerald-400 prose-code:text-emerald-300 prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800">
              <div className="whitespace-pre-wrap font-sans leading-relaxed space-y-4">
                {article.content}
              </div>
            </div>
          )}

          {activeTab === "raw" && (
            <textarea
              readOnly
              value={article.content}
              className="w-full h-96 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}

          {activeTab === "backlinks" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-3">
                  <Sparkles className="w-4 h-4" />
                  Tendril Backlinks (Inbound Authority)
                </h4>
                <div className="space-y-2">
                  {article.backlinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-emerald-500/50 group transition-all"
                    >
                      <span className="text-xs font-mono text-emerald-300 group-hover:underline truncate">
                        {link}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 ml-2 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-3">
                  <Globe className="w-4 h-4" />
                  Primary External Citations (Outbound Authority)
                </h4>
                <div className="space-y-2">
                  {article.outbound_citations.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-cyan-500/50 group transition-all"
                    >
                      <span className="text-xs font-mono text-cyan-300 group-hover:underline truncate">
                        {link}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 ml-2 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-8">
              {/* Pipeline Section 1: Ivy Website Exporter */}
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                      <FolderCheck className="w-4 h-4" />
                      <span>Ivy Website Blog Pipeline (`ivy-web` Keystatic / Markdoc)</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Export directly to the Ivy Web Markdoc repository with SEO frontmatter, slug,
                      and canonical tags.
                    </p>
                  </div>

                  <button
                    onClick={handleExportIvyWeb}
                    disabled={isExportingIvy}
                    className="flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isExportingIvy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Export to Ivy Web</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Target Directory (Optional Custom Path)
                    </label>
                    <input
                      type="text"
                      value={ivyTargetDir}
                      onChange={(e) => setIvyTargetDir(e.target.value)}
                      placeholder="Default: /Users/rorychatt/git/ivy-web/apps/web-new/content/posts or ./content/posts"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Computed Slug</label>
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 truncate">
                      {article.slug || "Auto-generated on export"}
                    </div>
                  </div>
                </div>

                {/* Hero Image Asset Synchronization Subsection */}
                <div className="pt-3 border-t border-slate-800/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Hero Image Asset Synchronization
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[11px] truncate max-w-xs">
                        {heroFormat === "svg"
                          ? `/site/images/blog/${currentSlug}-hero.svg`
                          : heroFormat === "png"
                            ? `/site/images/blog/${currentSlug}-hero.png`
                            : `/site/images/blog/${currentSlug}-hero.{png,svg}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSyncHeroAsset}
                      disabled={isSyncingHero}
                      className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                      {isSyncingHero ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing Asset...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Sync Hero Asset</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="syncHeroCheckbox"
                        checked={syncHeroImage}
                        onChange={(e) => setSyncHeroImage(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
                      />
                      <label
                        htmlFor="syncHeroCheckbox"
                        className="text-slate-300 cursor-pointer select-none"
                      >
                        Synchronize hero image on export
                      </label>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={ivyTargetImagesDir}
                        onChange={(e) => setIvyTargetImagesDir(e.target.value)}
                        placeholder="Default: /Users/rorychatt/git/ivy-web/apps/web-new/public/site/images or ./public/site/images"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Hero Asset in Frontmatter Selector */}
                  <div className="pt-2 border-t border-slate-800/60 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Hero Asset in Frontmatter
                      </label>
                      <span className="text-[11px] text-slate-400">
                        High-DPI clients render vector SVG banners directly, with PNG fallback for
                        OpenGraph/social crawlers.
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setHeroFormat("dual")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          heroFormat === "dual"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        Dual (PNG + SVG Vector){" "}
                        <span className="text-[10px] opacity-75 font-normal">(Default)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroFormat("svg")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          heroFormat === "svg"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        Vector SVG (.svg)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroFormat("png")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          heroFormat === "png"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        Raster PNG (.png)
                      </button>
                    </div>
                  </div>

                  {/* Frontmatter / Markdown Live Preview */}
                  <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        Frontmatter / Markdoc Live Preview
                      </span>
                      <span className="font-mono text-cyan-400 text-[10px]">
                        Format: {heroFormat.toUpperCase()}
                      </span>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
                      {`---
title: "${article.title.replace(/"/g, '\\"')}"
slug: "${currentSlug}"
description: "${article.summary.replace(/"/g, '\\"')}"
publishedAt: "${(article.published_at || article.created_at).substring(0, 10)}"
type: "blog"
status: "published"
categories:
  - "${article.angle}"
tags:
  - "${article.feature}"
  - "Ivy"
  - "DevTools"
${
  heroFormat === "svg"
    ? `image: "/site/images/blog/${currentSlug}-hero.svg"\nimage_svg: "/site/images/blog/${currentSlug}-hero.svg"`
    : heroFormat === "png"
      ? `image: "/site/images/blog/${currentSlug}-hero.png"`
      : `image: "/site/images/blog/${currentSlug}-hero.png"\nimage_svg: "/site/images/blog/${currentSlug}-hero.svg"`
}
canonical_url: "https://ivy.interactive/blog/${currentSlug}"
---`}
                    </pre>
                  </div>

                  {heroSyncResult && (
                    <div
                      className={`p-2.5 rounded-lg text-xs font-mono border ${
                        heroSyncResult.success
                          ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                          : "bg-rose-950/40 text-rose-300 border-rose-800"
                      }`}
                    >
                      {heroSyncResult.success ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Hero asset synchronized at: {heroSyncResult.image_path}</span>
                        </div>
                      ) : (
                        <span>Error: {heroSyncResult.error}</span>
                      )}
                    </div>
                  )}

                  {/* Hero Banner Studio & Live Preview */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Palette className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            Hero Banner Studio
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                            1200x630 Social Card
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Interactive vector SVG preview with theme gradients, category overlay, and
                          canvas PNG rasterization.
                        </p>
                      </div>

                      {/* Action Toolbar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSyncRenderedPng}
                          disabled={isSyncingRenderedPng}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                        >
                          {isSyncingRenderedPng ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Rasterizing &amp; Syncing...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>Sync Rendered PNG</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadPng}
                          disabled={isRasterizing}
                          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                          title="Download high-resolution 1200x630 PNG for Twitter/X and LinkedIn"
                        >
                          {isRasterizing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          <span>Download PNG</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadSvg}
                          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
                          title="Download standalone vector SVG"
                        >
                          <Code className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Download SVG</span>
                        </button>
                      </div>
                    </div>

                    {downloadSuccessMessage && (
                      <div className="p-2 rounded-lg bg-cyan-950/40 text-cyan-300 border border-cyan-800 text-xs font-mono flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{downloadSuccessMessage}</span>
                      </div>
                    )}

                    {/* Theme & Category Selectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 text-[11px] font-semibold mb-1.5">
                          Color Theme
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(Object.keys(BANNER_THEMES) as HeroBannerTheme[]).map((thm) => {
                            const cfg = BANNER_THEMES[thm];
                            const isSelected = bannerTheme === thm;
                            return (
                              <button
                                key={thm}
                                type="button"
                                onClick={() => setBannerTheme(thm)}
                                className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-slate-800 border-cyan-500 text-white font-bold shadow"
                                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                                }`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cfg.primaryAccent }}
                                />
                                <span className="truncate text-[11px]">{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                            Category Badge Overlay
                          </label>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {[
                              "Architecture",
                              "Benchmark",
                              "Tutorial",
                              "Multi-Agent",
                              "Ecosystem",
                            ].map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setBannerCategory(cat)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                  bannerCategory === cat
                                    ? "bg-cyan-950 text-cyan-300 border-cyan-700"
                                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={bannerCategory}
                            onChange={(e) => setBannerCategory(e.target.value)}
                            placeholder="Custom Category..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Title & Summary preview adjustments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800/60">
                      <div>
                        <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                          Banner Title Text
                        </label>
                        <input
                          type="text"
                          value={bannerTitle}
                          onChange={(e) => setBannerTitle(e.target.value)}
                          placeholder={article.title}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                          Subtitle / Summary Overlay (Truncated at 120 chars)
                        </label>
                        <input
                          type="text"
                          value={bannerSummary}
                          onChange={(e) => setBannerSummary(e.target.value)}
                          placeholder={article.summary}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Live SVG 1200x630 Preview Container */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Live 1.91:1 Social Share Card Preview</span>
                        </span>
                        <span className="font-mono text-slate-500">
                          Targets: {currentSlug}-hero.svg &amp; {currentSlug}-hero.png
                        </span>
                      </div>

                      <div className="relative w-full aspect-[1200/630] rounded-xl overflow-hidden border border-slate-800/90 bg-slate-950 shadow-2xl group flex items-center justify-center">
                        <div
                          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                          dangerouslySetInnerHTML={{ __html: currentBannerSvg }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {ivyExportResult && (
                  <div
                    className={`p-3 rounded-lg text-xs font-mono border ${
                      ivyExportResult.success
                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                        : "bg-rose-950/40 text-rose-300 border-rose-800"
                    }`}
                  >
                    {ivyExportResult.success ? (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Successfully exported to: {ivyExportResult.file_path}</span>
                        </div>
                        {ivyExportResult.image_path && (
                          <div className="flex items-center space-x-2 text-cyan-300 pl-6 text-[11px]">
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Hero asset synced: {ivyExportResult.image_path}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span>Error: {ivyExportResult.error}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Pipeline Section 2: Multi-Channel Syndication & 1-Click Formatters */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-emerald-400" />
                      <span>Multi-Channel Syndication & 1-Click Formatters</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tailored syndication formats with canonical tags, platform frontmatter, and
                      direct zero-click publishing APIs.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsConfigOpen(!isConfigOpen)}
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                        isConfigOpen
                          ? "bg-slate-800 text-cyan-300 border-cyan-700"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                      title="Configure API Keys"
                    >
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Configure API Keys</span>
                    </button>

                    {(selectedChannel === "Dev.to" || selectedChannel === "Hashnode") && (
                      <button
                        type="button"
                        onClick={handlePublishDirectApi}
                        disabled={isPublishing}
                        className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all hover:scale-[1.02] disabled:opacity-50"
                      >
                        {isPublishing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Publishing to {selectedChannel}...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Publish to {selectedChannel}</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCopyChannelContent}
                      disabled={isFormatting || !formattedContent}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-950/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                      {channelCopied ? (
                        <>
                          <Check className="w-4 h-4 text-slate-950" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy {selectedChannel} Format</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline API Keys Configuration Drawer */}
                {isConfigOpen && (
                  <form
                    onSubmit={handleSaveSettings}
                    className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 shadow-lg space-y-4 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300">
                        <Key className="w-4 h-4" />
                        <span>Syndication API Credentials & Settings</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsConfigOpen(false)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Dev.to API Key
                          {syndicationSettings?.devto_configured && (
                            <span className="ml-2 text-[10px] text-emerald-400 font-mono">
                              ({syndicationSettings.devto_key_preview || "Configured"})
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={devtoApiKeyInput}
                          onChange={(e) => setDevtoApiKeyInput(e.target.value)}
                          placeholder={
                            syndicationSettings?.devto_configured
                              ? "Leave blank to keep current key"
                              : "Enter Dev.to API key"
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Hashnode Personal Access Token
                          {syndicationSettings?.hashnode_configured && (
                            <span className="ml-2 text-[10px] text-emerald-400 font-mono">
                              ({syndicationSettings.hashnode_key_preview || "Configured"})
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={hashnodeApiKeyInput}
                          onChange={(e) => setHashnodeApiKeyInput(e.target.value)}
                          placeholder={
                            syndicationSettings?.hashnode_configured
                              ? "Leave blank to keep current token"
                              : "Enter Hashnode Personal Access Token"
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Hashnode Publication ID
                          <span className="ml-1 text-[10px] text-slate-500 font-normal">
                            (Optional: auto-discovered if blank)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={hashnodePubIdInput}
                          onChange={(e) => setHashnodePubIdInput(e.target.value)}
                          placeholder="e.g. 6423... (or leave blank for auto-discovery)"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Webhook Secret (HMAC)
                          {syndicationSettings?.webhook_secret_configured && (
                            <span className="ml-2 text-[10px] text-emerald-400 font-mono">
                              ({syndicationSettings.webhook_secret_preview || "Configured"})
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={webhookSecretInput}
                          onChange={(e) => setWebhookSecretInput(e.target.value)}
                          placeholder={
                            syndicationSettings?.webhook_secret_configured
                              ? "Leave blank to keep current secret"
                              : "Enter HMAC webhook secret"
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-5 sm:col-span-2">
                        <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={publishAsDraftInput}
                            onChange={(e) => setPublishAsDraftInput(e.target.checked)}
                            className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="font-medium">Publish as Draft</span>
                        </label>
                        <span className="text-[11px] text-slate-500">
                          (Enables preview before going live)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      {settingsSaveMessage ? (
                        <span className="text-xs text-emerald-400 font-medium">
                          {settingsSaveMessage}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Credentials are stored securely in local database.
                        </span>
                      )}

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsConfigOpen(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {isSavingSettings ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Save Credentials</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Credentials Warning Prompt if selected platform is unconfigured */}
                {selectedChannel === "Dev.to" && !syndicationSettings?.devto_configured && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/80 flex items-center justify-between text-xs text-amber-200">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Dev.to API key is not configured for direct publishing.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfigOpen(true)}
                      className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-900 text-amber-100 font-semibold underline text-xs transition-colors"
                    >
                      Configure Dev.to Key
                    </button>
                  </div>
                )}

                {selectedChannel === "Hashnode" && !syndicationSettings?.hashnode_configured && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/80 flex items-center justify-between text-xs text-amber-200">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Hashnode Personal Access Token is not configured for direct publishing.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfigOpen(true)}
                      className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-900 text-amber-100 font-semibold underline text-xs transition-colors"
                    >
                      Configure Hashnode Token
                    </button>
                  </div>
                )}

                {/* Direct publish result banner */}
                {publishResult && (
                  <div
                    className={`p-3 rounded-lg text-xs font-mono border ${
                      publishResult.success
                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                        : "bg-rose-950/40 text-rose-300 border-rose-800"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        {publishResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>
                          {publishResult.success
                            ? `Successfully syndicated to ${selectedChannel}!`
                            : `Publishing Error: ${publishResult.error}`}
                        </span>
                      </div>
                      {publishResult.url && (
                        <a
                          href={publishResult.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 underline font-semibold text-xs shrink-0"
                        >
                          <span>Open Published Article</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Segmented Channel Selector */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {channels.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        setSelectedChannel(ch);
                        setPublishResult(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedChannel === ch
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>

                {/* Live Formatted Preview */}
                <div className="relative">
                  {isFormatting ? (
                    <div className="w-full h-80 flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>Formatting for {selectedChannel}...</span>
                    </div>
                  ) : (
                    <textarea
                      readOnly
                      value={formattedContent}
                      className={`w-full h-80 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        formattedPreviewType === "social"
                          ? "font-sans leading-relaxed"
                          : "font-mono"
                      }`}
                    />
                  )}
                </div>
              </div>

              {/* Pipeline Section 3: Export History Log */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Export & Syndication History</span>
                </div>

                {exportsList.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                    No export events recorded yet. Use the buttons above to syndicate this article.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden">
                    {exportsList.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                            {rec.channel}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                              rec.status === "Published" || rec.status === "Success"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                            }`}
                          >
                            {rec.status}
                          </span>
                          {rec.target_path &&
                            (rec.target_path.startsWith("http://") ||
                            rec.target_path.startsWith("https://") ? (
                              <a
                                href={rec.target_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] truncate max-w-xs sm:max-w-md inline-flex items-center gap-1"
                              >
                                <span>{rec.target_path}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                                {rec.target_path}
                              </span>
                            ))}
                        </div>

                        <span className="text-slate-500 font-mono text-[11px]">
                          {new Date(rec.exported_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "engagement" && (
            <div className="space-y-6">
              {seedSuccessBanner && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{seedSuccessBanner}</span>
                  </div>
                  <button
                    onClick={() => setSeedSuccessBanner(null)}
                    className="text-emerald-400 hover:text-emerald-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Velocity and 24h Delta Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Views Velocity
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-cyan-400">
                      +{articleHistory?.velocity?.views_per_day.toFixed(1) || "0.0"}/d
                    </span>
                    <span className="text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      +{articleHistory?.velocity?.views_24h ?? 0} (24h)
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Reactions Velocity
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-pink-400">
                      +{articleHistory?.velocity?.reactions_per_day.toFixed(1) || "0.0"}/d
                    </span>
                    <span className="text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      +{articleHistory?.velocity?.reactions_24h ?? 0} (24h)
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Comments Velocity
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-emerald-400">
                      +{articleHistory?.velocity?.comments_per_day.toFixed(1) || "0.0"}/d
                    </span>
                    <span className="text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      +{articleHistory?.velocity?.comments_24h ?? 0} (24h)
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Trend Trajectory
                  </span>
                  <div className="mt-2 flex items-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        articleHistory?.velocity?.trend === "Accelerating"
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                          : articleHistory?.velocity?.trend === "Steady"
                            ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                            : articleHistory?.velocity?.trend === "Decelerating"
                              ? "bg-amber-950/80 text-amber-300 border-amber-800"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {articleHistory?.velocity?.trend === "Accelerating" && (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      {articleHistory?.velocity?.trend === "Steady" && (
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      {articleHistory?.velocity?.trend === "Decelerating" && (
                        <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      {articleHistory?.velocity?.trend === "Flat" && (
                        <Minus className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{articleHistory?.velocity?.trend || "Flat"}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Engagement Velocity Chart */}
              <EngagementVelocityChart
                snapshots={articleHistory?.snapshots || article.engagement_snapshots || []}
                velocity={articleHistory?.velocity}
                title={`${article.title}: Historical Velocity and Trend`}
              />

              {/* Engagement Milestones Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Engagement Milestones ({article.engagement_badges?.length || 0})
                    </span>
                  </div>
                  <button
                    onClick={handleSeedEngagement}
                    disabled={isSeedingEngagement}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
                    title="Seed simulated engagement metrics and milestone alerts for testing"
                  >
                    {isSeedingEngagement ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{isSeedingEngagement ? "Seeding..." : "Seed Demo Engagement"}</span>
                  </button>
                </div>

                {/* Unlocked milestone badges */}
                <div className="mb-4">
                  <span className="text-[11px] font-medium text-slate-400 block mb-2">
                    Unlocked Milestone Badges:
                  </span>
                  {!article.engagement_badges || article.engagement_badges.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-1">
                      No milestones unlocked yet. Reach 100+ views, 25+ reactions, or 10+ comments
                      to earn badges.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {article.engagement_badges.map((badge) => {
                        const lower = badge.toLowerCase();
                        const badgeColor = lower.includes("view")
                          ? "bg-amber-950/80 text-amber-300 border-amber-800"
                          : lower.includes("react")
                            ? "bg-pink-950/80 text-pink-300 border-pink-800"
                            : lower.includes("comment")
                              ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                              : "bg-purple-950/80 text-purple-300 border-purple-800";
                        return (
                          <span
                            key={badge}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeColor}`}
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>{badge}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Chronological Milestone Alerts History */}
                <div className="pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-400 block mb-2">
                    Milestone Achievement History:
                  </span>
                  {!article.milestone_alerts || article.milestone_alerts.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-1">
                      No milestone alerts recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                            <th className="pb-2 font-medium">Triggered At</th>
                            <th className="pb-2 font-medium">Milestone</th>
                            <th className="pb-2 font-medium">Badge</th>
                            <th className="pb-2 font-medium text-right">Threshold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {article.milestone_alerts
                            .slice()
                            .reverse()
                            .map((alert) => (
                              <tr key={alert.id} className="hover:bg-slate-900/40">
                                <td className="py-2 text-slate-300">
                                  {new Date(alert.triggered_at).toLocaleString()}
                                </td>
                                <td className="py-2 text-slate-200 capitalize">
                                  {alert.milestone_type}
                                </td>
                                <td className="py-2 text-amber-300 font-bold">
                                  {alert.badge_awarded}
                                </td>
                                <td className="py-2 text-right text-cyan-400 font-bold">
                                  {alert.threshold}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Snapshot Timeline History */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>
                      Recorded Snapshot History (
                      {articleHistory?.snapshots?.length ||
                        article.engagement_snapshots?.length ||
                        0}
                      )
                    </span>
                  </div>
                  {isLoadingHistory && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans normal-case">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                      <span>Loading history...</span>
                    </div>
                  )}
                </h4>
                {(articleHistory?.snapshots || article.engagement_snapshots || []).length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No historical snapshots recorded yet. Sync metrics to begin recording velocity
                    checkpoints.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                          <th className="pb-2 font-medium">Timestamp</th>
                          <th className="pb-2 font-medium text-right">Views</th>
                          <th className="pb-2 font-medium text-right">Reactions</th>
                          <th className="pb-2 font-medium text-right">Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {(articleHistory?.snapshots || article.engagement_snapshots || [])
                          .slice()
                          .reverse()
                          .map((snap, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="py-2 text-slate-300">
                                {new Date(snap.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2 text-right text-cyan-400 font-bold">
                                {snap.views}
                              </td>
                              <td className="py-2 text-right text-pink-400 font-bold">
                                {snap.reactions}
                              </td>
                              <td className="py-2 text-right text-emerald-400 font-bold">
                                {snap.comments}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
