import React, { useState, useEffect, useMemo } from "react";
import { ActionButton } from "./ActionButton";
import type { Article, HeroBannerTheme } from "../types";
import { Palette, Upload, Download, Code, Check, Layers } from "lucide-react";
import {
  BANNER_THEMES,
  getThemeForCategory,
  generateClientBannerSvg,
  rasterizeSvgToPngDataUrl,
} from "../utils/banner";

export interface ArticleBannerStudioProps {
  article: Article;
  ivyTargetImagesDir?: string;
  currentSlug: string;
  onArticleUpdated?: (article: Article) => void;
  onAssetSyncResult?: (result: { success: boolean; image_path?: string; error?: string }) => void;
}

export const ArticleBannerStudio: React.FC<ArticleBannerStudioProps> = ({
  article,
  ivyTargetImagesDir,
  currentSlug,
  onArticleUpdated,
  onAssetSyncResult,
}) => {
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

  useEffect(() => {
    if (article) {
      setBannerTheme(getThemeForCategory(article.angle || article.feature || ""));
      setBannerTitle(article.title || "");
      setBannerCategory(article.angle || article.feature || "Architecture");
      setBannerSummary(article.summary || "");
      setDownloadSuccessMessage(null);
    }
  }, [article?.id]);

  const currentBannerSvg = useMemo(() => {
    return generateClientBannerSvg(
      bannerTitle || article?.title || "Ivy Autonomous Growth",
      bannerCategory || article?.angle || "Architecture",
      bannerSummary || article?.summary || "",
      bannerTheme,
    );
  }, [bannerTitle, bannerCategory, bannerSummary, bannerTheme, article]);

  const handleSyncRenderedPng = async () => {
    if (!article) return;
    setIsSyncingRenderedPng(true);

    try {
      const pngDataUrl = await rasterizeSvgToPngDataUrl(currentBannerSvg);
      const res = await fetch(`/api/articles/${article.id}/upload-hero-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data: pngDataUrl,
          target_images_dir: ivyTargetImagesDir?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onAssetSyncResult?.({
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
        onAssetSyncResult?.({
          success: false,
          error: data.error || "Custom hero PNG upload failed",
        });
      }
    } catch (err: any) {
      onAssetSyncResult?.({
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

  return (
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
            Interactive vector SVG preview with theme gradients, category overlay, and canvas PNG
            rasterization.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            variant="cyan"
            size="sm"
            loading={isSyncingRenderedPng}
            loadingText="Rasterizing & Syncing..."
            icon={<Upload className="w-3.5 h-3.5" />}
            onClick={handleSyncRenderedPng}
          >
            Sync Rendered PNG
          </ActionButton>

          <ActionButton
            variant="secondary"
            size="sm"
            loading={isRasterizing}
            loadingText="Download PNG"
            icon={<Download className="w-3.5 h-3.5 text-cyan-400" />}
            onClick={handleDownloadPng}
            title="Download high-resolution 1200x630 PNG for Twitter/X and LinkedIn"
          >
            Download PNG
          </ActionButton>

          <ActionButton
            variant="secondary"
            size="sm"
            icon={<Code className="w-3.5 h-3.5 text-indigo-400" />}
            onClick={handleDownloadSvg}
            title="Download standalone vector SVG"
          >
            Download SVG
          </ActionButton>
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
              {["Architecture", "Benchmark", "Tutorial", "Multi-Agent", "Ecosystem"].map((cat) => (
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
  );
};
