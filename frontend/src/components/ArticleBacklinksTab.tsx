import React from "react";
import { Sparkles, Globe, ExternalLink } from "lucide-react";

export interface ArticleBacklinksTabProps {
  backlinks: string[];
  outboundCitations: string[];
}

export const ArticleBacklinksTab: React.FC<ArticleBacklinksTabProps> = ({
  backlinks,
  outboundCitations,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-3">
          <Sparkles className="w-4 h-4" />
          Tendril Backlinks (Inbound Authority)
        </h4>
        <div className="space-y-2">
          {backlinks.map((link, idx) => (
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
          {outboundCitations.map((link, idx) => (
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
  );
};
