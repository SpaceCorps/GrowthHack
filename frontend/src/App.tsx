import React, { useEffect, useState } from 'react';
import type { ActiveTab, AgentStatus, Article, GrowthIssue, Listing, TrendTopic } from './types';
import { Navigation } from './components/Navigation';
import { LiveTerminal } from './components/LiveTerminal';
import { ArticleModal } from './components/ArticleModal';
import { IssuesHub } from './views/IssuesHub';
import { ArticleEngine } from './views/ArticleEngine';
import { TrendRadar } from './views/TrendRadar';
import { ListingBlitz } from './views/ListingBlitz';
import { VideoDemos } from './views/VideoDemos';
import { AgentConsole } from './views/AgentConsole';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('issues');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [issues, setIssues] = useState<GrowthIssue[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);

  // Live Terminal & Modal State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [terminalTitle, setTerminalTitle] = useState<string>('Antigravity Agent');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Initial Data Fetching
  const fetchAll = async () => {
    try {
      const [resIssues, resArticles, resTrends, resListings, resStatus] = await Promise.all([
        fetch('/api/issues').then((r) => r.json()),
        fetch('/api/articles').then((r) => r.json()),
        fetch('/api/trends').then((r) => r.json()),
        fetch('/api/listings').then((r) => r.json()),
        fetch('/api/agent/status').then((r) => r.json()),
      ]);
      setIssues(resIssues);
      setArticles(resArticles);
      setTrends(resTrends);
      setListings(resListings);
      setAgentStatus(resStatus);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Issue Handlers
  const handleRunIssue = async (id: string) => {
    try {
      const res = await fetch(`/api/issues/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Issue Action #${id}`);
        setActiveTaskId(data.task_id);
        fetchAll();
      }
    } catch (err) {
      console.error('Run issue error:', err);
    }
  };

  const handleUpdateIssueStatus = async (
    id: string,
    status: 'Todo' | 'In Progress' | 'Active Routine' | 'Done'
  ) => {
    try {
      await fetch(`/api/issues/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchAll();
    } catch (err) {
      console.error('Update issue error:', err);
    }
  };

  const handleCreateIssue = async (issueData: Partial<GrowthIssue>) => {
    try {
      await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueData),
      });
      fetchAll();
    } catch (err) {
      console.error('Create issue error:', err);
    }
  };

  // Article Handlers
  const handleGenerateArticle = async (
    feature: string,
    angle: string,
    channel: string,
    extra: string
  ) => {
    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Generate article error:', err);
    }
  };

  const handleUpdateArticleStatus = async (
    id: string,
    status: 'Draft' | 'Ready' | 'Published'
  ) => {
    try {
      await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchAll();
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      console.error('Update article status error:', err);
    }
  };

  // Trend Handlers
  const handleScoutTrends = async () => {
    try {
      const res = await fetch('/api/trends/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle('Scouting GitHub, Reddit, LinkedIn Trends');
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error('Scout trends error:', err);
    }
  };

  const handleSynthesizeTrend = async (
    id: string,
    tieIn: 'direct' | 'subtle' | 'none',
    channel: string
  ) => {
    try {
      const res = await fetch(`/api/trends/${id}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tendril_tie_in: tieIn, channel }),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Synthesizing Trend to ${channel}`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error('Synthesize trend error:', err);
    }
  };

  // Listing Handlers
  const handleGenerateBlurb = async (id: string) => {
    try {
      const res = await fetch(`/api/listings/${id}/generate-blurb`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle(`Tailoring PR Blurb for Listing #${id}`);
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error('Generate blurb error:', err);
    }
  };

  const handleUpdateListingStatus = async (
    id: string,
    status: any,
    prUrl?: string
  ) => {
    try {
      await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, pr_url: prUrl }),
      });
      fetchAll();
    } catch (err) {
      console.error('Update listing error:', err);
    }
  };

  const handleCreateListing = async (listingData: Partial<Listing>) => {
    try {
      await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      });
      fetchAll();
    } catch (err) {
      console.error('Create listing error:', err);
    }
  };

  const handleGenerateDemo = async (
    feature: string,
    platform: string,
    duration: number
  ) => {
    try {
      const res = await fetch('/api/demos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Generate demo error:', err);
    }
  };

  // Custom Prompt
  const handleRunCustomPrompt = async (prompt: string) => {
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.task_id) {
        setTerminalTitle('Custom Antigravity Turn');
        setActiveTaskId(data.task_id);
      }
    } catch (err) {
      console.error('Run custom prompt error:', err);
    }
  };

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
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'issues' && (
          <IssuesHub
            issues={issues}
            onRunIssue={handleRunIssue}
            onUpdateStatus={handleUpdateIssueStatus}
            onCreateIssue={handleCreateIssue}
          />
        )}

        {activeTab === 'articles' && (
          <ArticleEngine
            articles={articles}
            onGenerateArticle={handleGenerateArticle}
            onSelectArticle={(art) => setSelectedArticle(art)}
            onUpdateStatus={handleUpdateArticleStatus}
          />
        )}

        {activeTab === 'trends' && (
          <TrendRadar
            trends={trends}
            onScoutTrends={handleScoutTrends}
            onSynthesizeTrend={handleSynthesizeTrend}
          />
        )}

        {activeTab === 'demos' && (
          <VideoDemos onGenerateDemo={handleGenerateDemo} />
        )}

        {activeTab === 'listings' && (
          <ListingBlitz
            listings={listings}
            onGenerateBlurb={handleGenerateBlurb}
            onUpdateStatus={handleUpdateListingStatus}
            onCreateListing={handleCreateListing}
          />
        )}

        {activeTab === 'agent' && (
          <AgentConsole
            agentStatus={agentStatus}
            onRunCustomPrompt={handleRunCustomPrompt}
          />
        )}
      </main>

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
        onClose={() => setSelectedArticle(null)}
        onUpdateStatus={handleUpdateArticleStatus}
      />
    </div>
  );
};
