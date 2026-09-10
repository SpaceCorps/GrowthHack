export interface GrowthIssue {
  id: string;
  number: number;
  title: string;
  category: string;
  status: "Todo" | "In Progress" | "Active Routine" | "Done";
  priority: "Critical" | "High" | "Medium" | "Low";
  description: string;
  direct_actions: string[];
  routine_schedule?: string;
  run_count: number;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  title: string;
  feature: string;
  channel: string;
  angle: string;
  summary: string;
  content: string;
  backlinks: string[];
  outbound_citations: string[];
  status: "Draft" | "Ready" | "Published";
  created_at: string;
  published_at?: string;
}

export interface TrendTopic {
  id: string;
  source: "GitHub" | "Reddit" | "LinkedIn";
  topic: string;
  url: string;
  engagement: string;
  summary: string;
  tendril_tie_in: "direct" | "subtle" | "none";
  status: "Scouted" | "Synthesizing" | "Published";
  generated_article_id?: string;
  created_at: string;
}

export interface Listing {
  id: string;
  name: string;
  category: "Awesome Repo" | "Dev Directory" | "Software Factory" | "Package Manager" | "Community";
  url: string;
  status: "Targeted" | "PR Submitted" | "Under Review" | "Merged" | "Live";
  pr_url?: string;
  submission_blurb: string;
  notes: string;
  updated_at: string;
}

export interface AgentStatus {
  is_available: boolean;
  agy_path: string;
  version?: string;
}

export type ActiveTab = "issues" | "articles" | "trends" | "demos" | "listings" | "agent";
