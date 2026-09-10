import React, { useState } from 'react';
import type { Listing } from '../types';
import { 
  ListTree, 
  ExternalLink, 
  GitPullRequest, 
  Sparkles, 
  Copy, 
  Check, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Filter
} from 'lucide-react';

interface ListingBlitzProps {
  listings: Listing[];
  onGenerateBlurb: (id: string) => void;
  onUpdateStatus: (id: string, status: any, prUrl?: string) => void;
  onCreateListing: (listing: Partial<Listing>) => void;
}

export const ListingBlitz: React.FC<ListingBlitzProps> = ({
  listings,
  onGenerateBlurb,
  onUpdateStatus,
  onCreateListing,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Add Listing Form
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Listing['category']>('Awesome Repo');
  const [url, setUrl] = useState('');
  const [blurb, setBlurb] = useState('');
  const [notes, setNotes] = useState('');

  const categories = Array.from(new Set(listings.map((l) => l.category)));

  const filteredListings = listings.filter((l) => {
    const matchesCategory = filterCategory === 'all' || l.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchesCategory && matchesStatus;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    onCreateListing({
      name,
      category,
      url,
      submission_blurb: blurb || `- [Ivy-Tendril](${url}) - Autonomous multi-agent coding factory.`,
      notes,
    });

    setName('');
    setUrl('');
    setBlurb('');
    setNotes('');
    setShowAddModal(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Live':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'Merged':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
      case 'PR Submitted':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800';
      case 'Under Review':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ListTree className="w-4 h-4" />
            <span>Distribution Blitz // Ecosystem Repos & Catalogs</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            List Ivy-Tendril Everywhere Developers Look
          </h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Awesome repositories, software factory registries, developer directories (AlternativeTo, OpenAlternative, DevHunt). Antigravity generates tailored PR descriptions and markdown table entries for instant merging.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950 transition-all hover:scale-[1.02] shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target Directory</span>
        </button>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">Total Targets:</span>
          <p className="text-xl font-bold text-white mt-1">{listings.length}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">PRs Submitted:</span>
          <p className="text-xl font-bold text-indigo-400 mt-1">
            {listings.filter((l) => l.status === 'PR Submitted' || l.status === 'Under Review').length}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">Merged PRs:</span>
          <p className="text-xl font-bold text-cyan-400 mt-1">
            {listings.filter((l) => l.status === 'Merged').length}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400">Live Backlinks:</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {listings.filter((l) => l.status === 'Live').length}
          </p>
        </div>
      </div>

      {/* Controls: Filter */}
      <div className="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 text-xs">
        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="Targeted">Targeted</option>
            <option value="PR Submitted">PR Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Merged">Merged</option>
            <option value="Live">Live</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredListings.length} of {listings.length} targets
        </span>
      </div>

      {/* Listings Table / Cards */}
      <div className="space-y-3">
        {filteredListings.map((listing) => (
          <div
            key={listing.id}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-3">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-300">
                  {listing.category}
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {listing.name}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-cyan-400"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={listing.status}
                  onChange={(e) => onUpdateStatus(listing.id, e.target.value as any)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-semibold focus:outline-none ${getStatusBadge(listing.status)}`}
                >
                  <option value="Targeted">Targeted</option>
                  <option value="PR Submitted">PR Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Merged">Merged</option>
                  <option value="Live">Live</option>
                </select>

                {listing.pr_url && (
                  <a
                    href={listing.pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800 text-xs font-mono"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    <span>View PR</span>
                  </a>
                )}
              </div>
            </div>

            {/* Submission Blurb / Entry */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 relative group">
              <div className="whitespace-pre-wrap leading-relaxed pr-16">
                {listing.submission_blurb}
              </div>

              <button
                onClick={() => handleCopy(listing.id, listing.submission_blurb)}
                className="absolute top-3 right-3 flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-sans font-medium transition-colors"
              >
                {copiedId === listing.id ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedId === listing.id ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-slate-400 italic">
                Notes: {listing.notes || 'No notes added.'}
              </span>

              <button
                onClick={() => onGenerateBlurb(listing.id)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white font-semibold transition-all self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tailor PR Blurb with Antigravity</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Target Repository / Directory</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. awesome-github-actions (sdras)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Awesome Repo">Awesome Repo</option>
                    <option value="Dev Directory">Dev Directory</option>
                    <option value="Software Factory">Software Factory</option>
                    <option value="Package Manager">Package Manager</option>
                    <option value="Community">Community</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Initial Blurb / PR Markdown
                </label>
                <textarea
                  rows={2}
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  placeholder="- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - ..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Strategy Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Target 'CI/CD Agents' subsection, requires signed commit"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:ring-1 focus:ring-cyan-500"
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
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
