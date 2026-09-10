import React, { useState } from 'react';
import type { Article } from '../types';
import { X, Copy, Check, ExternalLink, Globe, Sparkles, Send } from 'lucide-react';

interface ArticleModalProps {
  article: Article | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'Draft' | 'Ready' | 'Published') => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  article,
  onClose,
  onUpdateStatus,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'raw' | 'backlinks'>('content');

  if (!article) return null;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(article.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
            </button>

            {article.status !== 'Published' ? (
              <button
                onClick={() => onUpdateStatus(article.id, 'Published')}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
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
          <p className="text-sm text-slate-400 mt-1">
            {article.summary}
          </p>

          {/* Sub-nav Tabs */}
          <div className="flex items-center space-x-4 mt-4 border-b border-slate-800">
            <button
              onClick={() => setActiveTab('content')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'content'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Article Reading View
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'raw'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw Markdown (with Frontmatter)
            </button>
            <button
              onClick={() => setActiveTab('backlinks')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'backlinks'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Backlinks & Citations ({article.backlinks.length + article.outbound_citations.length})
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-300">
          {activeTab === 'content' && (
            <div className="prose prose-invert max-w-none prose-headings:text-slate-100 prose-headings:font-bold prose-a:text-emerald-400 prose-code:text-emerald-300 prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800">
              <div className="whitespace-pre-wrap font-sans leading-relaxed space-y-4">
                {article.content}
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <textarea
              readOnly
              value={article.content}
              className="w-full h-96 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}

          {activeTab === 'backlinks' && (
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
        </div>
      </div>
    </div>
  );
};
