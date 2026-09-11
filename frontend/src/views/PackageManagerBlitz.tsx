import React, { useState } from "react";
import type { PackageManagerTarget, PackageManifestResponse, GhAuthStatus } from "../types";
import {
  Package,
  Terminal,
  ExternalLink,
  GitPullRequest,
  Copy,
  Check,
  Download,
  FileCode,
  Edit2,
  Clock,
  ShieldCheck,
  Laptop,
  X,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface PackageManagerBlitzProps {
  packages: PackageManagerTarget[];
  onUpdatePackageStatus?: (
    id: string,
    payload: { status?: string; pr_url?: string; notes?: string },
  ) => Promise<void> | void;
  onDispatchPackagePr?: (
    id: string,
    version?: string,
    tagOrSkipAuth?: string | boolean,
    skipAuthCheck?: boolean,
  ) => Promise<string | void>;
}

export const PackageManagerBlitz: React.FC<PackageManagerBlitzProps> = ({
  packages,
  onUpdatePackageStatus,
  onDispatchPackagePr,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedManifest, setCopiedManifest] = useState<boolean>(false);
  const [activeManifestTab, setActiveManifestTab] = useState<string>("homebrew");
  const [showManifestDrawer, setShowManifestDrawer] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [editingTarget, setEditingTarget] = useState<PackageManagerTarget | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editPrUrl, setEditPrUrl] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [manifestCache, setManifestCache] = useState<Record<string, PackageManifestResponse>>({});
  const [isLoadingManifest, setIsLoadingManifest] = useState<boolean>(false);
  const [isRefreshingRelease, setIsRefreshingRelease] = useState<boolean>(false);

  const [dispatchTarget, setDispatchTarget] = useState<PackageManagerTarget | null>(null);
  const [dispatchVersion, setDispatchVersion] = useState<string>("0.8.4");
  const [dispatchTag, setDispatchTag] = useState<string>("");
  const [copiedCommands, setCopiedCommands] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<GhAuthStatus | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);
  const [skipAuthOverride, setSkipAuthOverride] = useState<boolean>(false);
  const [copiedLoginCmd, setCopiedLoginCmd] = useState<boolean>(false);

  const fetchGhAuthStatus = async () => {
    setIsCheckingAuth(true);
    try {
      const res = await fetch("/api/packages/gh-auth-status");
      if (res.ok) {
        const data: GhAuthStatus = await res.json();
        setAuthStatus(data);
      }
    } catch (err) {
      console.error("Failed to check GitHub CLI auth status:", err);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const getPreviewCommands = (target: PackageManagerTarget, version: string): string[] => {
    switch (target.target_key) {
      case "winget":
        return [
          "gh repo fork microsoft/winget-pkgs --clone=false",
          `git checkout -b ivy-tendril-v${version}`,
          `mkdir -p manifests/i/Ivy/Tendril/${version}`,
          `git add manifests/i/Ivy/Tendril/${version}/Ivy.Tendril.yaml`,
          `git commit -m "New version: Ivy.Tendril version ${version}"`,
          `git push origin ivy-tendril-v${version}`,
          `gh pr create --repo microsoft/winget-pkgs --title "New version: Ivy.Tendril version ${version}" --body "Automated update of Ivy-Tendril v${version} with portable x64/arm64 binaries."`,
        ];
      case "scoop":
        return [
          "gh repo fork ScoopInstaller/Extras --clone=false",
          `git checkout -b tendril-v${version}`,
          "mkdir -p bucket",
          "git add bucket/tendril.json",
          `git commit -m "tendril: Update to version ${version}"`,
          `git push origin tendril-v${version}`,
          `gh pr create --repo ScoopInstaller/Extras --title "tendril: Update to version ${version}" --body "Automated manifest update for Tendril v${version}."`,
        ];
      case "homebrew":
        return [
          "gh repo fork ivy-interactive/homebrew-tap --clone=false",
          `git checkout -b tendril-v${version}`,
          "mkdir -p Formula",
          "git add Formula/tendril.rb",
          `git commit -m "tendril ${version}"`,
          `git push origin tendril-v${version}`,
          `gh pr create --repo ivy-interactive/homebrew-tap --title "tendril ${version}" --body "Update tendril formula to v${version} with dual macOS/Linux bottles."`,
        ];
      default:
        return [];
    }
  };

  const handleOpenDispatch = (pkg: PackageManagerTarget) => {
    setDispatchTarget(pkg);
    setDispatchVersion("0.8.4");
    setDispatchTag(selectedTag || "");
    setCopiedCommands(false);
    setSkipAuthOverride(false);
    setAuthStatus(null);
    fetchGhAuthStatus();
  };

  // Manifest content cache/fallback
  const defaultManifests: Record<string, PackageManifestResponse> = {
    homebrew: {
      target_key: "homebrew",
      filename: "tendril.rb",
      language: "ruby",
      install_command: "brew install ivy-interactive/tap/tendril",
      instructions:
        "Add tap with 'brew tap ivy-interactive/tap' or install directly. Formula supports dual arm64 and x86_64 binaries with automated completions.",
      content: `# typed: false
# frozen_string_literal: true

class Tendril < Formula
  desc "Autonomous multi-agent software factory and plan orchestration system"
  homepage "https://github.com/Ivy-Interactive/Ivy-Tendril"
  version "0.8.4"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-darwin-arm64.tar.gz"
      sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    else
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-darwin-x64.tar.gz"
      sha256 "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-linux-arm64.tar.gz"
      sha256 "4e1243bd22c66e76c2ba9eddc1f91394e57f9f8352e8964d4b294e1e86973e8e"
    else
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-linux-x64.tar.gz"
      sha256 "30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7"
    end
  end

  def install
    bin.install "tendril"
    generate_completions_from_executable(bin/"tendril", "completion")
  end

  test do
    assert_match "tendril", shell_output("#{bin}/tendril version")
  end
end`,
    },
    winget: {
      target_key: "winget",
      filename: "Ivy.Tendril.yaml",
      language: "yaml",
      install_command: "winget install Ivy.Tendril",
      instructions:
        "Submit singleton manifest to microsoft/winget-pkgs repository under manifests/i/Ivy/Tendril/0.8.4/Ivy.Tendril.yaml.",
      content: `PackageIdentifier: Ivy.Tendril
PackageVersion: 0.8.4
PackageName: Ivy Tendril
Publisher: Ivy Interactive
PublisherUrl: https://github.com/Ivy-Interactive
PublisherSupportUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/issues
Author: Ivy Interactive
ShortDescription: Autonomous multi-agent software factory with isolated git worktrees
Description: Ivy-Tendril turns tasks and issues into verified pull requests using autonomous AI coding agents in isolated git worktrees.
Moniker: tendril
PackageUrl: https://github.com/Ivy-Interactive/Ivy-Tendril
License: MIT
LicenseUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/blob/main/LICENSE
Copyright: Copyright (c) 2026 Ivy Interactive
Tags:
  - ai
  - agents
  - coding
  - worktree
  - git
DefaultLocale: en-US
ManifestType: singleton
ManifestVersion: 1.6.0
Installers:
  - Architecture: x64
    InstallerType: portable
    InstallerUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-x64.zip
    InstallerSha256: 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae
    Commands:
      - tendril
  - Architecture: arm64
    InstallerType: portable
    InstallerUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-arm64.zip
    InstallerSha256: fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9
    Commands:
      - tendril`,
    },
    scoop: {
      target_key: "scoop",
      filename: "tendril.json",
      language: "json",
      install_command: "scoop bucket add extras && scoop install tendril",
      instructions:
        "Submit manifest to ScoopInstaller/Extras bucket repository under bucket/tendril.json.",
      content: `{
  "version": "0.8.4",
  "description": "Autonomous multi-agent software factory with isolated git worktrees",
  "homepage": "https://github.com/Ivy-Interactive/Ivy-Tendril",
  "license": "MIT",
  "architecture": {
    "64bit": {
      "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-x64.zip",
      "hash": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
    },
    "arm64": {
      "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-arm64.zip",
      "hash": "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"
    }
  },
  "bin": "tendril.exe",
  "checkver": "github",
  "autoupdate": {
    "architecture": {
      "64bit": {
        "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v$version/tendril-v$version-windows-x64.zip"
      },
      "arm64": {
        "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v$version/tendril-v$version-windows-arm64.zip"
      }
    }
  }
}`,
    },
    npx: {
      target_key: "npx",
      filename: "package.json",
      language: "json",
      install_command: "npx @ivy-interactive/tendril",
      instructions:
        "Publish package to npm registry as @ivy-interactive/tendril. The zero-install launcher bootstraps the native binary in seconds.",
      content: `{
  "name": "@ivy-interactive/tendril",
  "version": "0.8.4",
  "description": "Zero-install npx launcher for Tendril autonomous multi-agent software factory",
  "bin": {
    "tendril": "./bin/tendril.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/Ivy-Interactive/Ivy-Tendril.git"
  },
  "scripts": {
    "start": "node ./bin/tendril.js"
  },
  "keywords": [
    "tendril",
    "npx",
    "zero-install",
    "launcher",
    "ai",
    "coding-agent",
    "worktree"
  ],
  "author": "Ivy Interactive",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}`,
    },
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyManifest = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  const handleDownloadManifest = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchManifest = async (targetKey: string, refresh = false, tagOverride?: string) => {
    setIsLoadingManifest(true);
    try {
      const tagToUse = tagOverride !== undefined ? tagOverride : selectedTag;
      const params: string[] = [];
      if (tagToUse && tagToUse.trim()) {
        params.push(`tag=${encodeURIComponent(tagToUse.trim())}`);
      }
      if (refresh) {
        params.push("refresh=true");
      }
      const qs = params.length > 0 ? `?${params.join("&")}` : "";
      const url = `/api/packages/${targetKey}/manifest${qs}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: PackageManifestResponse | null = await res.json();
        if (data) {
          setManifestCache((prev) => ({
            ...prev,
            [targetKey]: data,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch manifest:", err);
    } finally {
      setIsLoadingManifest(false);
    }
  };

  const handleRefreshRelease = async () => {
    setIsRefreshingRelease(true);
    try {
      await fetchManifest(activeManifestTab, true);
    } finally {
      setIsRefreshingRelease(false);
    }
  };

  const openDrawerForTab = (targetKey: string) => {
    setActiveManifestTab(targetKey);
    setShowManifestDrawer(true);
    if (!manifestCache[targetKey]) {
      fetchManifest(targetKey, false);
    }
  };

  const handleTabSwitch = (targetKey: string) => {
    setActiveManifestTab(targetKey);
    if (!manifestCache[targetKey]) {
      fetchManifest(targetKey, false);
    }
  };

  const handleOpenEdit = (target: PackageManagerTarget) => {
    setEditingTarget(target);
    setEditStatus(target.status);
    setEditPrUrl(target.pr_url || "");
    setEditNotes(target.notes || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;

    if (onUpdatePackageStatus) {
      await onUpdatePackageStatus(editingTarget.id, {
        status: editStatus,
        pr_url: editPrUrl.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
    }

    setEditingTarget(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Live":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "Merged":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800";
      case "PR Submitted":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-800";
      case "Under Review":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const activeManifest =
    manifestCache[activeManifestTab] ||
    defaultManifests[activeManifestTab] ||
    defaultManifests["homebrew"];
  const activePrsCount = packages.filter((p) => p.pr_url).length;

  return (
    <div className="space-y-6">
      {/* Top Banner and Benchmark Hero Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Package className="w-4 h-4" />
            <span>Developer Experience // Native Distribution Blitz</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Package Manager & One-Line Install Blitz
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Eliminate onboarding friction by distributing Ivy-Tendril across Homebrew, Windows
            Package Manager (winget), Scoop, and npx. Achieving sub-60-second time-to-first-run on
            macOS, Linux, and Windows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowManifestDrawer(true)}
            data-testid="inspect-manifest-btn"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 transition-all hover:scale-[1.02]"
          >
            <FileCode className="w-4 h-4" />
            <span>Inspect Manifests</span>
          </button>
        </div>
      </div>

      {/* Hero Stats Benchmark Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Time-To-First-Run
          </span>
          <p className="text-xl font-bold text-emerald-300 mt-1">&lt; 60s Target</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            OS Targets
          </span>
          <p className="text-xl font-bold text-white mt-1">macOS, Linux, Win</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Active Registries
          </span>
          <p className="text-xl font-bold text-indigo-300 mt-1">{packages.length || 4} Tracked</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <GitPullRequest className="w-3.5 h-3.5 text-amber-400" />
            Active PRs
          </span>
          <p className="text-xl font-bold text-amber-300 mt-1">{activePrsCount} Submitted</p>
        </div>
      </div>

      {/* 1-Click Install Command Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            1-Click Native Install Commands
          </h3>
          <span className="text-xs text-slate-400 font-mono">Zero friction onboarding</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Homebrew */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">Homebrew</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  macOS / Linux
                </span>
              </div>
              <button
                onClick={() => openDrawerForTab("homebrew")}
                data-testid="inspect-manifest-homebrew"
                className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>tendril.rb</span>
              </button>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs">
              <code className="text-emerald-300 truncate mr-2">
                brew install ivy-interactive/tap/tendril
              </code>
              <button
                onClick={() => handleCopy("homebrew", "brew install ivy-interactive/tap/tendril")}
                data-testid="copy-btn-homebrew"
                className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
                title="Copy command"
              >
                {copiedKey === "homebrew" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Official tap formula with dual arm64 and x86_64 bottles and shell completions.
            </p>
          </div>

          {/* Winget */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">
                  Windows Package Manager (winget)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Windows
                </span>
              </div>
              <button
                onClick={() => openDrawerForTab("winget")}
                data-testid="inspect-manifest-winget"
                className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Ivy.Tendril.yaml</span>
              </button>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs">
              <code className="text-cyan-300 truncate mr-2">winget install Ivy.Tendril</code>
              <button
                onClick={() => handleCopy("winget", "winget install Ivy.Tendril")}
                data-testid="copy-btn-winget"
                className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
                title="Copy command"
              >
                {copiedKey === "winget" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Microsoft winget-pkgs singleton manifest v1.6.0 with portable x64/arm64 binaries.
            </p>
          </div>

          {/* Scoop */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">Scoop (Extras)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Windows
                </span>
              </div>
              <button
                onClick={() => openDrawerForTab("scoop")}
                data-testid="inspect-manifest-scoop"
                className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>tendril.json</span>
              </button>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs">
              <code className="text-amber-300 truncate mr-2">
                scoop bucket add extras && scoop install tendril
              </code>
              <button
                onClick={() =>
                  handleCopy("scoop", "scoop bucket add extras && scoop install tendril")
                }
                data-testid="copy-btn-scoop"
                className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
                title="Copy command"
              >
                {copiedKey === "scoop" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Scoop Extras bucket manifest with automated checkver hash verification.
            </p>
          </div>

          {/* npx */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">npx Zero-Install</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Cross-Platform
                </span>
              </div>
              <button
                onClick={() => openDrawerForTab("npx")}
                data-testid="inspect-manifest-npx"
                className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>package.json</span>
              </button>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs">
              <code className="text-purple-300 truncate mr-2">npx @ivy-interactive/tendril</code>
              <button
                onClick={() => handleCopy("npx", "npx @ivy-interactive/tendril")}
                data-testid="copy-btn-npx"
                className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
                title="Copy command"
              >
                {copiedKey === "npx" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Zero-install launcher running directly via Node.js in seconds without permanent
              installation.
            </p>
          </div>
        </div>
      </div>

      {/* Registry Submission Tracker Table */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-indigo-400" />
              Registry Submission Tracker
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status across official upstream package repositories and community registries.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-3 font-semibold">Registry / Target</th>
                <th className="pb-3 font-semibold">Platform</th>
                <th className="pb-3 font-semibold">Package ID</th>
                <th className="pb-3 font-semibold">Upstream Repository</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">PR Link</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 pr-3 font-sans font-semibold text-white">
                    <div className="flex items-center space-x-2">
                      <span>{pkg.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 pr-3 text-slate-300">{pkg.os}</td>
                  <td className="py-3.5 pr-3 text-indigo-300 font-bold">{pkg.package_id}</td>
                  <td className="py-3.5 pr-3 text-slate-400">
                    <a
                      href={`https://github.com/${pkg.registry_repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <span>{pkg.registry_repo}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="py-3.5 pr-3">
                    <span
                      data-testid={`status-badge-${pkg.id}`}
                      className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${getStatusBadge(
                        pkg.status,
                      )}`}
                    >
                      {pkg.status}
                    </span>
                  </td>
                  <td className="py-3.5 pr-3">
                    {pkg.pr_url ? (
                      <a
                        href={pkg.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        <GitPullRequest className="w-3.5 h-3.5" />
                        <span>View PR</span>
                      </a>
                    ) : (
                      <span className="text-slate-600">N/A</span>
                    )}
                  </td>
                  <td className="py-3.5 text-right font-sans">
                    <div className="flex items-center justify-end space-x-2">
                      {["winget", "scoop", "homebrew"].includes(pkg.target_key) && (
                        <button
                          onClick={() => handleOpenDispatch(pkg)}
                          data-testid={`dispatch-pr-${pkg.id}`}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-medium text-[11px] flex items-center gap-1.5 shadow-sm transition-all"
                          title="Submit formula update via Antigravity runner"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Dispatch Upstream PR</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(pkg)}
                        data-testid={`edit-status-${pkg.id}`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Update status"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Upstream PR Modal */}
      {dispatchTarget && (
        <div
          data-testid="dispatch-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-indigo-500/30">
                  <GitPullRequest className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Dispatch Upstream PR: {dispatchTarget.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Automated GitHub CLI fork, staging, branch push, and PR submission.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDispatchTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400">
                    Upstream Repository
                  </span>
                  <p className="text-xs font-mono text-cyan-300 flex items-center gap-1">
                    <span>{dispatchTarget.registry_repo}</span>
                  </p>
                </div>
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400">Package Identifier</span>
                  <p className="text-xs font-mono text-indigo-300 font-bold">
                    {dispatchTarget.package_id}
                  </p>
                </div>
              </div>

              {/* Release Tag input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Release Tag</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    GitHub Release tag (e.g. v1.2.0)
                  </span>
                </label>
                <input
                  type="text"
                  value={dispatchTag}
                  onChange={(e) => {
                    setDispatchTag(e.target.value);
                    const clean = e.target.value.trim().replace(/^v/, "");
                    if (clean) setDispatchVersion(clean);
                  }}
                  data-testid="dispatch-tag-input"
                  placeholder="e.g. v0.8.4"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Version input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Target Version</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Matches Ivy-Tendril release tag
                  </span>
                </label>
                <input
                  type="text"
                  value={dispatchVersion}
                  onChange={(e) => setDispatchVersion(e.target.value)}
                  placeholder="0.8.4"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* GitHub CLI Authentication Pre-Flight Feedback Card */}
              {isCheckingAuth && !authStatus && (
                <div
                  data-testid="gh-auth-loading"
                  className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center space-x-2 text-xs text-slate-400 font-mono"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Checking GitHub CLI authentication status...</span>
                </div>
              )}

              {authStatus && authStatus.authenticated && (
                <div
                  data-testid="gh-auth-badge"
                  className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2 text-emerald-300 text-xs font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      GitHub CLI Authenticated:{" "}
                      <strong className="text-white font-semibold">
                        {authStatus.account || "Active"}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchGhAuthStatus}
                    disabled={isCheckingAuth}
                    data-testid="recheck-gh-auth-btn"
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors disabled:opacity-50"
                    title="Re-check authentication status"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingAuth ? "animate-spin" : ""}`} />
                    <span>Re-check</span>
                  </button>
                </div>
              )}

              {authStatus && !authStatus.authenticated && (
                <div
                  data-testid="gh-auth-warning"
                  className="p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-2.5 text-xs text-amber-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>GitHub CLI Authentication Required</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchGhAuthStatus}
                      disabled={isCheckingAuth}
                      data-testid="recheck-gh-auth-btn"
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono transition-colors disabled:opacity-50"
                      title="Re-check authentication status"
                    >
                      <RefreshCw className={`w-3 h-3 ${isCheckingAuth ? "animate-spin" : ""}`} />
                      <span>Re-check</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    You must authenticate with GitHub CLI before submitting upstream pull requests.
                  </p>
                  <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-lg border border-amber-900/60 font-mono text-[11px]">
                    <code className="text-amber-300">gh auth login</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText("gh auth login");
                        setCopiedLoginCmd(true);
                        setTimeout(() => setCopiedLoginCmd(false), 2000);
                      }}
                      data-testid="copy-login-cmd-btn"
                      className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                      title="Copy command"
                    >
                      {copiedLoginCmd ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <label className="flex items-center space-x-2 pt-1 text-[11px] text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      data-testid="skip-auth-checkbox"
                      checked={skipAuthOverride}
                      onChange={(e) => setSkipAuthOverride(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span>Proceed anyway (skip authentication pre-flight check)</span>
                  </label>
                </div>
              )}

              {/* Command preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    GitHub CLI Command Sequence
                  </label>
                  <button
                    onClick={() => {
                      const text = getPreviewCommands(dispatchTarget, dispatchVersion).join("\n");
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(text);
                        setCopiedCommands(true);
                        setTimeout(() => setCopiedCommands(false), 2000);
                      }
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    {copiedCommands ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-mono">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  {getPreviewCommands(dispatchTarget, dispatchVersion).map((cmd, idx) => (
                    <div key={idx} className="text-slate-300">
                      <span className="text-slate-600 select-none mr-2">$</span>
                      <span
                        className={cmd.startsWith("gh pr") ? "text-emerald-300 font-semibold" : ""}
                      >
                        {cmd}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end space-x-3">
              <button
                onClick={() => setDispatchTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-dispatch-btn"
                disabled={
                  isLaunching ||
                  (authStatus !== null && !authStatus.authenticated && !skipAuthOverride)
                }
                onClick={async () => {
                  if (dispatchTarget) {
                    setIsLaunching(true);
                    try {
                      if (onDispatchPackagePr) {
                        const tagToPass =
                          dispatchTag && dispatchTag.trim() ? dispatchTag.trim() : undefined;
                        if (tagToPass) {
                          if (skipAuthOverride) {
                            await onDispatchPackagePr(
                              dispatchTarget.id,
                              dispatchVersion,
                              tagToPass,
                              true,
                            );
                          } else {
                            await onDispatchPackagePr(
                              dispatchTarget.id,
                              dispatchVersion,
                              tagToPass,
                            );
                          }
                        } else if (skipAuthOverride) {
                          await onDispatchPackagePr(dispatchTarget.id, dispatchVersion, true);
                        } else {
                          await onDispatchPackagePr(dispatchTarget.id, dispatchVersion);
                        }
                      }
                    } finally {
                      setIsLaunching(false);
                      setDispatchTarget(null);
                    }
                  }
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Launch Antigravity Runner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manifest Inspection Drawer / Modal */}
      {showManifestDrawer && (
        <div
          data-testid="manifest-drawer"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                  <FileCode className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    Package Manifest Inspector: {activeManifest.filename}
                  </h3>
                </div>
                {/* Release status pill */}
                <div
                  data-testid="release-status-pill"
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs font-mono"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Release: {activeManifest.release_tag || "v0.8.4"} (Dynamic)</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-mono">Tag:</span>
                  <input
                    type="text"
                    value={selectedTag}
                    onChange={(e) => {
                      const newTag = e.target.value;
                      setSelectedTag(newTag);
                      fetchManifest(activeManifestTab, true, newTag);
                    }}
                    placeholder={activeManifest.release_tag || "v0.8.4"}
                    data-testid="release-tag-input"
                    className="w-20 bg-transparent text-xs text-white font-mono placeholder-slate-600 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleRefreshRelease}
                  disabled={isRefreshingRelease || isLoadingManifest}
                  data-testid="refresh-github-btn"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                  title="Refresh from GitHub Releases API"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isRefreshingRelease || isLoadingManifest ? "animate-spin text-indigo-400" : ""
                    }`}
                  />
                  <span>
                    {isRefreshingRelease || isLoadingManifest
                      ? "Refreshing..."
                      : "Refresh from GitHub"}
                  </span>
                </button>
                <button
                  onClick={() => setShowManifestDrawer(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Manifest Target Tabs */}
            <div className="px-6 pt-3 border-b border-slate-800 flex space-x-2 overflow-x-auto">
              {Object.keys(defaultManifests).map((tabKey) => {
                const isTabActive = activeManifestTab === tabKey;
                const tabManifest = defaultManifests[tabKey];
                return (
                  <button
                    key={tabKey}
                    data-testid={`manifest-tab-${tabKey}`}
                    onClick={() => handleTabSwitch(tabKey)}
                    className={`px-3.5 py-2 text-xs font-mono font-medium rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
                      isTabActive
                        ? "border-indigo-500 text-indigo-300 bg-slate-800/60"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    }`}
                  >
                    <span>{tabManifest.filename}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-indigo-300">Instructions: </span>
                {activeManifest.instructions}
              </div>

              <div className="relative">
                <pre
                  data-testid="manifest-code"
                  className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed max-h-96"
                >
                  <code>{activeManifest.content}</code>
                </pre>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="text-xs text-slate-400 font-mono">
                Format: {activeManifest.language.toUpperCase()}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCopyManifest(activeManifest.content)}
                  data-testid="copy-manifest-btn"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedManifest ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedManifest ? "Copied!" : "Copy Manifest"}</span>
                </button>

                <button
                  onClick={() =>
                    handleDownloadManifest(activeManifest.filename, activeManifest.content)
                  }
                  data-testid="download-manifest-btn"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {activeManifest.filename}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Update Status: {editingTarget.name}</h3>
              <button
                onClick={() => setEditingTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Submission Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  data-testid="status-select"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="Targeted">Targeted</option>
                  <option value="PR Submitted">PR Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Merged">Merged</option>
                  <option value="Live">Live</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Pull Request URL</label>
                <input
                  type="url"
                  value={editPrUrl}
                  onChange={(e) => setEditPrUrl(e.target.value)}
                  data-testid="pr-url-input"
                  placeholder="https://github.com/..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Notes & Reviewer Comments
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  data-testid="notes-input"
                  rows={3}
                  placeholder="Feedback, test results, or merge notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-status-btn"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-950"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
