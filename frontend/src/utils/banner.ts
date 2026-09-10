import type { HeroBannerTheme } from "../types";

export interface BannerThemeConfig {
  name: HeroBannerTheme;
  label: string;
  primaryAccent: string;
  secondaryAccent: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  glowColor: string;
}

export const BANNER_THEMES: Record<HeroBannerTheme, BannerThemeConfig> = {
  "dark-cyan": {
    name: "dark-cyan",
    label: "Dark Cyan",
    primaryAccent: "#06b6d4",
    secondaryAccent: "#3b82f6",
    badgeBg: "rgba(6, 182, 212, 0.15)",
    badgeBorder: "#0891b2",
    badgeText: "#22d3ee",
    glowColor: "#06b6d4",
  },
  "midnight-emerald": {
    name: "midnight-emerald",
    label: "Midnight Emerald",
    primaryAccent: "#10b981",
    secondaryAccent: "#059669",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeBorder: "#059669",
    badgeText: "#34d399",
    glowColor: "#10b981",
  },
  "indigo-violet": {
    name: "indigo-violet",
    label: "Indigo Violet",
    primaryAccent: "#8b5cf6",
    secondaryAccent: "#6366f1",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    badgeBorder: "#7c3aed",
    badgeText: "#a78bfa",
    glowColor: "#8b5cf6",
  },
  "amber-glow": {
    name: "amber-glow",
    label: "Amber Glow",
    primaryAccent: "#f59e0b",
    secondaryAccent: "#d97706",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeBorder: "#d97706",
    badgeText: "#fbbf24",
    glowColor: "#f59e0b",
  },
};

export function getThemeForCategory(category: string): HeroBannerTheme {
  const cat = category.toLowerCase().trim();
  if (cat.includes("benchmark") || cat.includes("performance") || cat.includes("metric")) {
    return "midnight-emerald";
  }
  if (cat.includes("agent") || cat.includes("multi-agent") || cat.includes("ecosystem")) {
    return "indigo-violet";
  }
  if (cat.includes("tutorial") || cat.includes("guide") || cat.includes("how-to")) {
    return "amber-glow";
  }
  return "dark-cyan";
}

export function wrapBannerTitle(title: string, maxCharsPerLine = 34, maxLines = 3): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (lines.length === maxLines - 1 && currentLine.length > 0) {
      if (currentLine.length + 1 + word.length > maxCharsPerLine) {
        lines.push(currentLine + "...");
        currentLine = "";
        break;
      }
    }

    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        currentLine = "";
        break;
      }
      currentLine = word;
    }

    if (i === words.length - 1 && currentLine && lines.length < maxLines) {
      lines.push(currentLine);
      currentLine = "";
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateClientBannerSvg(
  title: string,
  category: string,
  summary: string,
  themeName: HeroBannerTheme,
): string {
  const theme = BANNER_THEMES[themeName] || BANNER_THEMES["dark-cyan"];
  const categoryUpper = (category.trim() || "ARCHITECTURE").toUpperCase();
  const safeCategory = escapeXml(categoryUpper);
  const titleLines = wrapBannerTitle(title.trim() || "Ivy Autonomous Growth", 34, 3);

  const cleanSummary = summary.trim();
  const truncatedSummary =
    cleanSummary.length > 120 ? cleanSummary.slice(0, 117) + "..." : cleanSummary;
  const safeSummary = escapeXml(truncatedSummary);

  const badgeWidth = Math.max(safeCategory.length * 10 + 36, 110);
  const badgeTextX = 80 + badgeWidth / 2;

  const titleStartY = 210;
  const lineHeight = 62;
  const titleElements = titleLines
    .map((line, idx) => {
      const y = titleStartY + idx * lineHeight;
      const safeLine = escapeXml(line);
      return `    <text x="80" y="${y}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" font-weight="800" fill="#f8fafc" letter-spacing="-0.5">${safeLine}</text>`;
    })
    .join("\n");

  const summaryY = titleStartY + Math.max(titleLines.length, 1) * lineHeight + 15;
  const summaryElement = safeSummary
    ? `    <text x="80" y="${summaryY}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="400" fill="#94a3b8" letter-spacing="0.2">${safeSummary}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bg-glow" cx="75%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${theme.glowColor}" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.primaryAccent}" />
      <stop offset="100%" stop-color="${theme.secondaryAccent}" />
    </linearGradient>
    <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1" stroke-opacity="0.35" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#020617" />
  <rect width="1200" height="630" fill="url(#grid-pattern)" />
  <rect width="1200" height="630" fill="url(#bg-glow)" />

  <rect x="16" y="16" width="1168" height="598" rx="16" fill="none" stroke="#1e293b" stroke-width="2" />
  <rect x="16" y="16" width="1168" height="4" rx="2" fill="url(#accent-grad)" />

  <g id="header">
    <rect x="80" y="65" width="${badgeWidth}" height="36" rx="18" fill="${theme.badgeBg}" stroke="${theme.badgeBorder}" stroke-width="1.5" />
    <text x="${badgeTextX}" y="88" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5" fill="${theme.badgeText}" text-transform="uppercase">${safeCategory}</text>

    <g id="brand-logo" transform="translate(1030, 65)">
      <rect width="90" height="36" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="18" r="6" fill="${theme.primaryAccent}" />
      <text x="36" y="23" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800" fill="#f8fafc" letter-spacing="1">IVY</text>
    </g>
  </g>

  <g id="content">
${titleElements}
${summaryElement}
  </g>

  <g id="footer">
    <line x1="80" y1="540" x2="1120" y2="540" stroke="#1e293b" stroke-width="1" />
    <text x="80" y="575" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#64748b" letter-spacing="0.5">ivy.interactive/blog</text>
    <text x="1120" y="575" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="500" fill="#475569">Autonomous Growth Engine</text>
  </g>
</svg>`;
}

export async function rasterizeSvgToPngDataUrl(svgString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not create 2d canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, 1200, 630);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG into image for canvas rasterization"));
    };

    img.src = url;
  });
}
